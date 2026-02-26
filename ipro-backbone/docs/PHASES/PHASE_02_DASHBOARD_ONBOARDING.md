# PHASE 02 — ECOSYSTEM DASHBOARD + ONBOARDING FOUNDATION

## Goal
Build the unified ecosystem dashboard and embed onboarding + support shell inside IProCore.

This phase must NOT implement JAD runtime logic or AI execution.

---

## Scope (Must Implement)

### 1) Ecosystem Dashboard (Single Entry Point)
Route:
- /console/dashboard

Features:
- Tenant switcher
- Welcome summary (user + tenant)
- Product tiles (data-driven from PortfolioItem where status=published AND entitlement valid)
- Security badge (2FA enabled, last login, session status)
- JAD readiness badge (placeholder only — not runtime yet)
- Onboarding progress widget
- Help/Support entry widget

Dashboard must NOT replicate product dashboards.

---

### 2) Control Tower (Founder Overview)
Routes:
- /console/control-tower
- /console/control-tower/portfolio

Features:
- Portfolio table (CRUD UI wired to PortfolioItem model)
- Status toggle (draft/published/disabled)
- Rollout mode selector
- Kill switch toggle
- Version field editable
- Audit entry on every change

Founder-only access enforced.

---

### 3) Onboarding Module (Shell Only)
Routes:
- /console/onboarding
- /console/onboarding/checklist
- /console/onboarding/setup-wizard

Features:
- Checklist items (stored in DB)
- Completion state per tenant
- Setup wizard scaffold
- Mark step complete API
- Audit onboarding actions

No AI execution yet.
No product provisioning logic yet.

---

### 4) Help & Knowledge Base Shell
Routes:
- /console/help
- /console/help/knowledge-base
- /console/help/tutorials
- /console/help/tickets

Features:
- Static KB entries stored in DB
- Ticket submission form (stores record)
- Ticket list (tenant-scoped)
- Audit log on ticket creation

---

### 5) EN/AR + RTL Enforcement
- Language toggle global
- dir="rtl" for Arabic
- Stitch tokens integrated
- No hardcoded strings

---

## Must NOT Implement
- No JAD connectors runtime
- No AI playbooks logic
- No SSO token exchange
- No event dispatch
- No workflow engine

---

## Acceptance Criteria
- Dashboard loads and shows product tiles from DB
- Founder can publish/disable product without code change
- Kill switch hides product from dashboard instantly
- Onboarding checklist persists per tenant
- Help tickets persist and are tenant-scoped
- All privileged changes logged in AuditLog
- EN/AR switching verified

---

## Proof Required
- Files changed
- Routes tested (URLs)
- Audit entries verified
- Coverage checklist update
- Rollback notes