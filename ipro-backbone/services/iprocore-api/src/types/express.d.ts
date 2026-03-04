import { AuthPayload } from '../middleware/requireAuth';

declare global {
    namespace Express {
        interface Request {
            auth?: AuthPayload;
            requestId?: string;
            tenant?: {
                id: string;
                slug: string;
                name: string;
                plan: string;
                isActive: boolean;
            };
        }
    }
}
