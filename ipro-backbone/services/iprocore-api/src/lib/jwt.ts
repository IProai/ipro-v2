import jwt from 'jsonwebtoken';
import { env } from './env';
import { AuthPayload } from '../middleware/requireAuth';

export function issueAccessToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    });
}
