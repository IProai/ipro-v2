/**
 * JAD — HMAC Guard
 * 
 * Verifies request signatures from IProCore for sensitive inter-service calls.
 * Uses SHA256 HMAC with JAD_IPROCORE_SHARED_SECRET.
 * 
 * Expected header: x-jad-signature
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../lib/env';

export function hmacGuard(req: Request, res: Response, next: NextFunction): void {
    const signature = req.headers['x-jad-signature'];

    if (!signature || typeof signature !== 'string') {
        res.status(401).json({ error: 'Missing or invalid signature' });
        return;
    }

    // Body must be parsed (express.json() should be upstream)
    const bodyStr = JSON.stringify(req.body);

    const hmac = crypto.createHmac('sha256', env.JAD_IPROCORE_SHARED_SECRET);
    hmac.update(bodyStr);
    const expected = hmac.digest('hex');

    if (signature !== expected) {
        console.warn(`[JAD] HMAC Mismatch. Got: ${signature.slice(0, 8)}...`);
        res.status(401).json({ error: 'Signature mismatch' });
        return;
    }

    next();
}
