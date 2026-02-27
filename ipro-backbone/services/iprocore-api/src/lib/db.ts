import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — stateless, reconnects automatically
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    (() => {
        const redactedUrl = process.env.DATABASE_URL?.replace(/:[^@:]+@/, ':****@');
        process.stderr.write(`[DB] Initializing PrismaClient with DATABASE_URL: ${redactedUrl}\n`);
        return new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
        });
    })();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
