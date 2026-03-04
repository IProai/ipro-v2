/**
 * Minimum viable Stripe service stubs for Phase 04 testing, pending full SDK.
 * Will throw "NotImpelemented" until real integration happens.
 */

export async function createCustomer(tenantId: string, email: string) {
    throw new Error('Not implemented: stripe createCustomer');
}

export async function createSubscription(customerId: string, priceId: string) {
    throw new Error('Not implemented: stripe createSubscription');
}
