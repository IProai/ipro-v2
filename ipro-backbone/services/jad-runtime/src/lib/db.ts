/**
 * JAD Runtime — Prisma Client
 *
 * Singleton Prisma client for the JAD database (jad-runtime DB).
 * Uses JAD_DATABASE_URL — separate from IProCore's DATABASE_URL.
 */

import { PrismaClient } from '@prisma/client';

declare global {
    // Prevent multiple instances during hot-reload in development
    // eslint-disable-next-line no-var
    var __jadPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
    global.__jadPrisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    global.__jadPrisma = prisma;
}
