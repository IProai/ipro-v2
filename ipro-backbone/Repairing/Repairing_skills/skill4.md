# Skill 4 — Entitlement Middleware (Stripe-Ready, Provider-Agnostic) — CODE ONLY

## SCOPE (STRICT)
- Only modify: `/services/iprocore-api/src/**`
- Do NOT refactor other services.
- Do NOT modify deployment files.
- Do NOT change existing auth logic beyond using `req.auth.activeTenantId` (already implemented).
- Keep changes minimal and modular.

## ASSUMPTION (NON-NEGOTIABLE)
The following DB tables already exist from **Skill1** migration:
- Subscription
- Entitlement
- UsageCounter
- StripeCustomer

This skill MUST NOT modify Prisma schema or migrations.

---

## OBJECTIVE
Implement minimal, production-ready entitlement enforcement that:
- Validates active subscription
- Validates feature entitlement
- Enforces usage limits
- Is provider-agnostic (Stripe-ready)
- Adds Stripe webhook stubs ONLY (no Stripe SDK)

---

## STEP 1 — Entitlement service
Create:

`/services/iprocore-api/src/entitlements/entitlement.service.ts`

Implement functions:
- `getActiveSubscription(tenantId)`
- `getPlanEntitlements(plan)`
- `getUsage(tenantId, featureKey)`
- `incrementUsage(tenantId, featureKey, inc=1)`
- `assertEntitled(tenantId, featureKey)` throws 403 errors with clear codes

Rules:
1) Load Subscription for tenantId
2) Require subscription.status in: ACTIVE or TRIAL (TRIAL allowed)
3) Load Entitlement by (plan + featureKey)
4) If not found -> 403
5) If entitlement.limit != null:
   - check UsageCounter.used < limit
   - else -> 403 limit reached

Do NOT call Stripe.

---

## STEP 2 — Middleware
Create:

`/services/iprocore-api/src/middleware/requireEntitlement.ts`

Export:
`requireEntitlement(featureKey: string)`

Uses:
- `req.auth.activeTenantId` as tenantId

Returns 403 on failure.

---

## STEP 3 — Stripe stub (NO SDK)
Create folder:

`/services/iprocore-api/src/billing/stripe/`

Add:
- `stripe.service.ts` (placeholder functions: createCustomer, createSubscription — throw "Not implemented")
- `stripe.webhook.ts` (handler: logs event + returns ok)

---

## STEP 4 — Route placeholder
Add route:

`POST /api/billing/stripe/webhook`

Behavior:
- Accept JSON body
- Log event type/id if present
- Return `{ ok: true }`

No signature validation yet.
No Stripe SDK.

---

## STEP 5 — Minimal seed (optional)
If your project uses a seed script, add plan entitlements:
- Starter: `portfolio.create` limit 5
- Pro: `portfolio.create` limit 50
- Enterprise: unlimited

If no seed system exists, skip this step (do not invent one).

---

## CONSTRAINTS
- No schema edits.
- No migrations.
- No Stripe SDK.
- No global refactors.
- Keep changes small and readable.