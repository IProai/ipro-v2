import { Router } from 'express';
import { handleStripeWebhook } from '../billing/stripe/stripe.webhook';

const router = Router();

// POST /api/billing/stripe/webhook
// Raw bodyParser used in real stripe; JSON is fine for stub
router.post('/stripe/webhook', handleStripeWebhook);

export default router;
