# PHASE 01 — CORE SPINE (CONTROL PLANE FOUNDATIONS)

## Goal
Implement the minimum IProCore foundations:
- Identity skeleton
- Tenancy skeleton
- RBAC skeleton
- AuditLog skeleton
- Portfolio Registry skeleton
- RequestId propagation
- Cloud SQL migrations discipline

## Scope (must do)
API:
- Models: User, Tenant, Membership, Role, Permission, RolePermission, AuditLog, PortfolioItem
- Middleware: requireAuth, tenantResolver, requirePerm, requirePolicy, requestId
- Health endpoints: /api/health

Web:
- Minimal routes:
  - /login (UI shell ok)
  - /console/dashboard (placeholder UI ok, Stitch tokens later)
  - /console/control-tower/portfolio (CRUD placeholder)
- EN/AR toggle + RTL shell (basic)

## Must NOT do
- No JAD runtime
- No AI
- No connectors
- No onboarding KB beyond placeholder links

## Acceptance
- Typecheck passes
- Migration runs successfully
- Basic login works
- Tenant isolation enforced in queries
- AuditLog writes on privileged actions
- PortfolioItem CRUD exists (draft/published/disabled)

## Proof
Provide:
- Files changed list
- Commands run
- URLs tested
- Rollback notes