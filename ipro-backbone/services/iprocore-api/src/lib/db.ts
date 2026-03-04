import { PrismaClient } from '@prisma/client';

// Singleton Prisma client — stateless, reconnects automatically
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    (() => {
        const redactedUrl = process.env.DATABASE_URL?.replace(/:[^@:]+@/, ':****@');
        process.stderr.write(`[DB] Initializing PrismaClient with DATABASE_URL: ${redactedUrl}\n`);
        // Prevent connection exhaustion when Cloud Run scales out
        let dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl && !dbUrl.includes('connection_limit=')) {
            const separator = dbUrl.includes('?') ? '&' : '?';
            dbUrl = `${dbUrl}${separator}connection_limit=5`;
        }

        return new PrismaClient({
            datasources: {
                db: {
                    url: dbUrl,
                },
            },
            log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
        });
    })();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
