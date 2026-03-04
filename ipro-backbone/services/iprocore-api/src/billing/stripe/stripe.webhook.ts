import { Request, Response } from 'express';

/**
 * Stripe webhook handler placeholder.
 * Logs event payload to stdout rather than parsing it with Stripe crypto.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'];

    // In actual implementation, we would construct the Stripe Event.
    // For now, acknowledge to unblock billing flow dev.

    res.json({ ok: true });
}
