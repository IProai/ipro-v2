# SKILL 02: Secure API Guardrails

Enforce:
- Access token short-lived, refresh rotation, reuse detection => revoke-all
- Tenant resolved server-side; never trust payload tenantId
- RBAC + policy checks in route + service layer
- No overposting: explicit allowlists only
- Audit privileged actions
- Safe errors (no stack traces in responses)
- Rate limit sensitive endpoints

Required tests (minimum):
- Cross-tenant read/write blocked
- Missing permission blocked
- Refresh reuse revokes sessions