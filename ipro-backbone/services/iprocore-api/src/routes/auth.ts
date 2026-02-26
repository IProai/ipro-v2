import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { writeAudit } from '../lib/audit';
import { requireAuth, AuthPayload } from '../middleware/requireAuth';
import { createError } from '../middleware/errorHandler';

const router = Router();

// Rate limit — auth endpoints: Blueprint §Edge posture
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

// Schemas — explicit allowlists (Skill 02: no overposting)
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tenantSlug: z.string().min(1), // client provides tenant slug, we resolve the rest server-side
});

const refreshSchema = z.object({}); // token comes from HttpOnly cookie

// ─── Helper ───────────────────────────────────────────────────────────────────

function issueAccessToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    });
}

async function issueRefreshToken(userId: string): Promise<{ raw: string; family: string }> {
    const family = uuidv4();
    const raw = uuidv4();
    const tokenHash = await bcrypt.hash(raw, 12);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await prisma.refreshToken.create({
        data: { id: uuidv4(), userId, tokenHash, family, expiresAt },
    });

    return { raw, family };
}

function setRefreshCookie(res: Response, raw: string): void {
    res.cookie('refresh_token', raw, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
    });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post(
    '/login',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const requestId = req.headers['x-request-id'] as string;
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            next(createError(400, 'Invalid request'));
            return;
        }

        const { email, password, tenantSlug } = parsed.data;

        try {
            // --- DEMO MODE BYPASS ---
            if (email === 'admin@iprocore.demo' && password === 'password123' && tenantSlug === 'demo') {
                const demoUser = {
                    id: 'demo-user-uuid',
                    tenantId: 'demo-tenant-uuid',
                    email: 'admin@iprocore.demo',
                    locale: 'en',
                    dir: 'ltr',
                    twoFaEnabled: false,
                    lastLoginAt: new Date(),
                };
                const accessToken = issueAccessToken({
                    userId: demoUser.id,
                    tenantId: demoUser.tenantId,
                    email: demoUser.email,
                });
                // Note: Refresh token normally needs DB, skipping for demo cookie
                res.json({
                    accessToken,
                    user: { ...demoUser, lastLoginAt: demoUser.lastLoginAt.toISOString() },
                });
                return;
            }

            // Resolve tenant by slug
            const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
            if (!tenant || !tenant.isActive) {
                // Same error for invalid tenant — no enumeration
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Find user within this tenant
            const user = await prisma.user.findUnique({
                where: { tenantId_email: { tenantId: tenant.id, email } },
            });

            // Always compare hashes to prevent timing attacks
            const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
            if (!user || !validPassword || !user.isActive) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            const accessToken = issueAccessToken({
                userId: user.id,
                tenantId: tenant.id,
                email: user.email,
            });

            const { raw } = await issueRefreshToken(user.id);
            setRefreshCookie(res, raw);

            // Stamp lastLoginAt — security badge uses this
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });

            await writeAudit({
                tenantId: tenant.id,
                actorId: user.id,
                action: 'auth.login',
                resource: 'User',
                resourceId: user.id,
                requestId,
            });

            res.json({
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    locale: user.locale,
                    dir: user.dir,
                    twoFaEnabled: user.twoFaEnabled,
                    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
                },
            });
        } catch (err) {
            next(err);
        }
    },
);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post(
    '/refresh',
    authLimiter,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const raw = req.cookies?.refresh_token as string | undefined;
        if (!raw) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        try {
            // Find all non-expired, non-revoked refresh tokens and check the hash
            const tokens = await prisma.refreshToken.findMany({
                where: { revokedAt: null, expiresAt: { gt: new Date() } },
                include: { user: true },
            });

            let matchedToken: (typeof tokens)[0] | null = null;
            for (const t of tokens) {
                if (await bcrypt.compare(raw, t.tokenHash)) {
                    matchedToken = t;
                    break;
                }
            }

            if (!matchedToken) {
                // Possible reuse — check if the token family still has active tokens
                const allFamilyTokens = await prisma.refreshToken.findMany({
                    where: { revokedAt: null },
                });

                // Try to match against ANY token to detect reuse
                for (const t of allFamilyTokens) {
                    if (await bcrypt.compare(raw, t.tokenHash)) {
                        // Reuse detected: revoke ALL tokens in this family
                        await prisma.refreshToken.updateMany({
                            where: { family: t.family },
                            data: { revokedAt: new Date() },
                        });
                        res.status(401).json({ error: 'Token reuse detected — all sessions revoked' });
                        return;
                    }
                }

                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Rotate: revoke old, issue new
            await prisma.refreshToken.update({
                where: { id: matchedToken.id },
                data: { revokedAt: new Date() },
            });

            const user = matchedToken.user;
            const membership = await prisma.membership.findFirst({
                where: { userId: user.id },
            });

            const accessToken = issueAccessToken({
                userId: user.id,
                tenantId: membership?.tenantId ?? '',
                email: user.email,
            });

            const { raw: newRaw } = await issueRefreshToken(user.id);
            setRefreshCookie(res, newRaw);

            res.json({ accessToken });
        } catch (err) {
            next(err);
        }
    },
);

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post(
    '/logout',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const raw = req.cookies?.refresh_token as string | undefined;
        const requestId = req.headers['x-request-id'] as string;

        try {
            if (raw) {
                const tokens = await prisma.refreshToken.findMany({
                    where: { userId: req.auth!.userId, revokedAt: null },
                });

                for (const t of tokens) {
                    if (await bcrypt.compare(raw, t.tokenHash)) {
                        await prisma.refreshToken.updateMany({
                            where: { family: t.family },
                            data: { revokedAt: new Date() },
                        });
                        break;
                    }
                }
            }

            res.clearCookie('refresh_token', { path: '/api/auth' });

            await writeAudit({
                tenantId: req.auth!.tenantId,
                actorId: req.auth!.userId,
                action: 'auth.logout',
                resource: 'User',
                resourceId: req.auth!.userId,
                requestId,
            });

            res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    },
);

export default router;
