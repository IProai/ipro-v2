# IPRO BACKBONE MASTER BLUEPRINT v5
IProCore + JAD = the backbone of Intellect ProActive ecosystem.

## 1) DEFINITIONS
- **IProCore = Control Plane (Governance)**
  - Identity, Tenancy, RBAC/Policy
  - Entitlements/Plans/Feature Flags
  - Portfolio Registry (data-driven publishing)
  - Ecosystem Dashboard (single entry)
  - Onboarding + Knowledge + Support
  - Global Audit + Compliance visibility
  - Interop Contracts (SSO/Auth, Events, Observability)
- **JAD Connector = Execution Plane (Interoperability + Runtime)**
  - Connector registry + activation (OAuth/API keys)
  - Webhook ingestion + outbound delivery
  - Workflow runtime (queue, retries, schedules)
  - Orchestration across products + third parties
  - Health monitoring, run logs, connector events

## 2) NON-NEGOTIABLE BOUNDARY
- IProCore decides WHO/WHAT is allowed.
- JAD executes integration/workflow actions.
- No overlap: IProCore does not become a workflow runtime; JAD does not own identity/tenancy.

## 3) ENTERPRISE SECURITY BASELINE (HIGHEST PRACTICAL)
### Edge posture (recommended)
- Cloud Run services behind HTTPS Load Balancer + WAF.
- Cloud Run ingress restricted to LB only.
- Rate limits (edge + app) for auth and sensitive endpoints.

### Auth & sessions
- Access token short-lived.
- Refresh rotation + reuse detection => revoke-all sessions.
- Refresh stored in HttpOnly+Secure cookie (single consistent strategy).
- 2FA mandatory for Owner + Developer.
- Step-up auth for: role changes, connector secrets, impersonation, exports, billing/plan changes.

### Authorization
Pipeline for every request:
Auth → Resolve Tenant → Membership → Permission → Policy → Execute → Audit
- Never trust client-provided tenantId.
- No overposting (explicit allowlists).
- Safe error responses (no internal leakage).

### Tenant isolation
- Every tenant table has tenantId and queries always filter by tenantId.
- Required tests: cross-tenant blocked, ID guessing blocked, tenantId injection blocked.

### Secrets
- No plaintext secrets returned.
- Encrypted storage or secret reference.
- All secret operations audited.

### Audit & Observability
- Append-only AuditLog for all privileged/system actions.
- X-Request-ID and trace context propagated across services.

## 4) INTEROPERABILITY CONTRACTS
### SSO/Auth (per Portfolio item)
- Support: signed handoff (internal fast path) and OIDC (optional).
- Handoff token claims (minimum):
  iss, aud, exp (30–60s), jti, tenantId, userId, roles/permKeys, entitlements, locale, dir, requestId

### Events (JAD-owned)
- eventId, type, tenantId, timestamp, actor, source, payload (versioned), signature optional
- retries + dedupe policy enforced in JAD

### Observability
- X-Request-ID everywhere, included in logs, propagated to JAD and products.

## 5) ECOSYSTEM DASHBOARD (SINGLE ENTRY)
- Post-login landing: /console/dashboard
- Shows tenant switcher, product tiles (from Portfolio), onboarding progress, security status, billing summary, support entry, JAD readiness badges.
- Does NOT replicate product dashboards.

## 6) CLIENT ONBOARDING + KNOWLEDGE + SUPPORT (IN-DASHBOARD)
- Onboarding routes:
  /console/onboarding
  /console/onboarding/checklist
  /console/onboarding/setup-wizard
- Help routes:
  /console/help
  /console/help/knowledge-base
  /console/help/tutorials
  /console/help/tickets
- Includes AI-assisted help (draft responses, suggest steps). AI never executes destructive actions.

## 7) PORTFOLIO REGISTRY (DATA-DRIVEN PUBLISHING)
Owner can add/publish/disable products/engines/platforms WITHOUT code changes.

PortfolioItem (minimum):
- id, name
- type (product|engine|platform)
- icon
- description_en, description_ar
- launchUrl_prod, launchUrl_stage
- ssoMode (handoff|oidc)
- requiredPermissions
- requiredConnectors (optional)
- suggestedPlaybooks (optional)
- defaultPlans visibility
- version
- status (draft|published|disabled)
- rolloutMode (all|allowlistTenants|allowlistPlans)
- killSwitch (boolean)

## 8) JAD CONNECTOR (FIRST-CLASS MODULE)
Console routes:
- /console/jad/marketplace
- /console/jad/integrations
- /console/jad/connectors/:id
- /console/jad/activations/:id
- /console/jad/health
Rules:
- activations audited
- secrets never returned
- health logs append-only

## 9) AI LAYER (ASSISTIVE ONLY)
Routes:
- /console/ai/playbooks
- /console/ai/suggestions
- /console/ai/activity
Rules:
- AI cannot access secrets
- AI cannot bypass RBAC/policy
- Execution must be user-confirmed and routed through JAD
- All AI actions logged with human approver

## 10) CLOUD RUN + CLOUD SQL DISCIPLINE + PORTABILITY
- Stateless services, explicit migrations, strict env validation.
- Products may be hosted anywhere later; integration relies on contracts, not provider-specific internal networking.

## 11) ROUTE CONSTITUTION (COMPLETE)
Auth:
- /login
- /2fa

Ecosystem:
- /console/dashboard
- /console/control-tower
- /console/control-tower/portfolio

Core governance:
- /console/tenants
- /console/users
- /console/memberships
- /console/roles-permissions

Plans:
- /console/products
- /console/plans
- /console/entitlements
- /console/feature-flags

JAD:
- /console/jad/marketplace
- /console/jad/integrations
- /console/jad/connectors/:id
- /console/jad/activations/:id
- /console/jad/health

Security:
- /console/security/audit-log
- /console/security/role-simulator

AI:
- /console/ai/playbooks
- /console/ai/suggestions
- /console/ai/activity

Onboarding/help:
- /console/onboarding
- /console/onboarding/checklist
- /console/onboarding/setup-wizard
- /console/help
- /console/help/knowledge-base
- /console/help/tutorials
- /console/help/tickets

Dev:
- /console/dev/overview
- /console/dev/diagnostics

## 12) DEFINITION OF DONE
- Tenant isolation tests pass.
- RBAC + Policy enforced server-side.
- Portfolio registry works end-to-end.
- JAD activation + health + audit operational.
- Onboarding + Help exist in dashboard.
- AI assist exists with hard boundaries + audit.
- EN/AR RTL verified against Stitch.
- Cloud Run deploy stable + Cloud SQL migrations stable.