# PHASE 03 — PORTFOLIO SSO + INTEROPERABILITY CONTRACTS

## Goal
Implement the SSO/Auth contract and shared contracts package.
No JAD runtime execution yet.

---

## Scope (Must Implement)

### 1) Shared Contracts Package
Location:
- /packages/contracts/

Implement:
- SSO token schema
- Event contract schema (structure only)
- Observability contract (X-Request-ID propagation)

SSO token claims minimum:
- iss
- aud
- exp (<= 60 seconds)
- jti
- tenantId
- userId
- roles/permKeys
- entitlements
- locale
- dir
- requestId

---

### 2) Signed Handoff Flow
When user clicks product tile:
- Generate short-lived signed token
- Redirect to launchUrl_prod or launchUrl_stage
- Include token in header or query param (as defined)

Validation middleware stub created in contracts (for products).

---

### 3) Portfolio Launch Rules
Enforce before redirect:
- Product status=published
- KillSwitch=false
- Entitlement valid
- Required permissions satisfied
- Rollout mode respected

All checks server-side.

---

### 4) Observability Middleware
- Inject X-Request-ID if not present
- Include requestId in logs
- Include requestId in SSO token

---

### 5) Role Simulator (Security Testing Tool)
Route:
- /console/security/role-simulator

Feature:
- Simulate user role
- Test if permission allowed/denied
- Founder-only

---

## Must NOT Implement
- No JAD runtime
- No connector execution
- No workflow queue

---

## Acceptance Criteria
- Clicking product tile redirects with valid short-lived token
- Invalid entitlement blocks redirect
- Kill switch blocks launch
- Role simulator works
- requestId propagated across requests
- Audit entries logged for product launches

---

## Proof Required
- Token structure example
- Validation test
- Redirect test
- Coverage checklist update
- Rollback notes