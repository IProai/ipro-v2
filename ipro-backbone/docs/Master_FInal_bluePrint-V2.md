🧠 Intellect Proactive Ecosystem — Master Blueprint vFinal
0) North Star Definition
Intellect Proactive (IPro) is a multi-vertical operating ecosystem that provides:
One identity
One tenant system
One entitlement engine
Shared engines (workflow/approvals/docs/notifications/reporting)
Multiple vertical products (Projects, SmartBooks, HR, Marketing, etc.)
A hub control tower (read model)
An event spine (Jad) to connect everything safely and scalably
This is not “many apps.” This is one ecosystem with bounded verticals.

1) Architecture at a Glance (Vertical + Horizontal)
Horizontal Platforms (Shared, Cross-Ecosystem)
Core (Identity + Tenant + RBAC + Entitlements + Audit)
Jad Connector (Event Spine + Replay + Projections + DLQ)
Hub Control Tower (Read Models: Inbox + KPIs + Analytics)
Shared Engines
Workflow Engine
Approvals Engine
Docs Engine
Notification Engine
Reporting Engine
AI Engine (future deep integration)
Vertical Products (Bounded Domains)
IProProjects (fit-out project OS)
IProSmartBooks (finance/accounting)
IProHR (HR/payroll/WPS bridge stance)
IProMarketing (campaign + CRM-like workflows)
Future: IProGuest, IProMaintenance, Event121, Clinic OS, AI Departments, etc.
Rule: Verticals do not talk to each other directly.
They integrate through Jad event contracts and shared engines.

2) Infrastructure Blueprint (GCP)
Compute
Cloud Run services:
core-service
jad-service
hub-service
projects-service
smartbooks-service
hr-service
marketing-service
engines: workflow/approvals/docs/notify/reporting/ai (can be separate services or grouped by load)
Data
Cloud SQL Postgres (single shared cluster Day-1)
schema-per-app
extraction-ready boundaries
RLS per tenant
Routing
GCP Load Balancer (host-based routing)
hub.intellectproactive.com → hub-service
projects.intellectproactive.com → projects-service
smartbooks.intellectproactive.com → smartbooks-service
etc.
No API gateway Day-1 (LB acts as gateway)
Security + Ops
IAM service accounts per Cloud Run service
Secret Manager for env secrets
VPC connector for Cloud SQL private connectivity
Future optional: Pub/Sub, Redis, CDN depending on scale needs

3) Database Constitution (Cloud SQL Postgres)
Day-1 Strategy (Locked)
One Postgres cluster
Schema-per-app
No cross-schema writes
Cross-app data movement only via events + projections
Core Schemas (System of Record)
core.*:
tenants
users
memberships (user ↔ tenant)
roles
role_bindings (per-tenant RBAC)
entitlements / subscriptions
audit_log
admin_jobs
Jad Schemas (Event Spine)
jad.events (append-only event store)
jad.projection_cursors
jad.projection_dlq
Hub Schemas (Read Models only)
hub.inbox_items
hub.analytics_snapshots
hub.kpis_daily
hub.projection_cursors
hub.projection_dlq
Vertical Schemas
projects.*, smartbooks.*, hr.*, marketing.*, etc.
Non-Negotiable Data Rules
Every business table has tenant_id (except global config tables)
RLS policies always enforce tenant isolation
Financial records: no hard deletes (soft delete + audit)

4) Identity, Tenancy, RBAC (Core)
Identity
One login across ecosystem
Session/token is ecosystem-wide (SSO behavior)
Multi-Tenant
A user can belong to multiple tenants
User selects active tenant
Active tenant context controls:
data scope (RLS)
permissions (RBAC)
entitlements (feature access)
Token Claims (minimum)
user_id
active_tenant_id
roles[] (or role ids)
entitlements[] (or plan/tier + feature flags)
locale (en/ar)
iat/exp, session_id
RBAC (Per Tenant)
Role registry in Core (authoritative)
Per-tenant assignment of roles to users/teams
Fine-grained permissions:
module access
action access
export access
admin tools access
replay/backfill access (restricted)

5) Subscription + Entitlement Flow (Centralized)
Why centralized?
Because entitlements must be consistent across:
UI
API
engines
projections
hub visibility
Entitlement Objects (Core)
plan (tier)
features (boolean flags)
limits (seats, usage caps, module caps)
addons (optional modules)
billing_state (trial/active/past_due/suspended)
Enforcement Layers
API: deny action if not entitled
UI: hide/lock feature (preview-locked)
Engine: enforce rules even if API is bypassed
Projection: hub visibility respects entitlement if needed (optional)
Billing Events (typical)
billing.subscription.created
billing.subscription.updated
billing.subscription.past_due
billing.subscription.suspended
billing.entitlement.changed

6) Jad Connector (Event Spine) — Final Spec
Responsibilities (Locked)
Event bus abstraction (append-only store)
Projection consumers:
hub_inbox_v1
hub_analytics_v1
Idempotency via event_id
Cursor tracking per projection
DLQ on failure
Replay / backfill support
Admin projection events
Event Store (jad.events)
Each event includes:
event_id (uuid)
event_type (string, namespaced)
event_version (v1, v2…)
occurred_at
tenant_id
actor_user_id (nullable for system events)
source_service (projects/smartbooks/core/etc.)
payload (JSON)
meta (JSON: correlation_id, request_id, idempotency_key, etc.)
Versioning Discipline
Breaking change → new version (v2)
Projections must support multiple versions or migration path
Contracts are treated like APIs (reviewed & locked)
DLQ Discipline
DLQ is not “errors.” It’s a managed backlog.
Admin tools must allow:
inspect
reprocess
skip with reason
replay range

7) Hub Control Tower — Final Spec
Hub is Read-Only
Hub has no business logic writes back to verticals.
Two Primary Read Models
A) Global Inbox
Unified “things that require attention” across ecosystem:
approvals
permits
billing alerts
workflow tasks
document actions
integration failures
compliance reminders
project blocks
Table: hub.inbox_items
Suggested columns:
inbox_id
tenant_id
source (projects/smartbooks/approvals/etc.)
type (approval_required, permit_expired, payment_due…)
severity (info/warn/critical)
status (open/ack/done)
title, summary
entity_ref (type + id + deep link)
due_at, created_at, updated_at
assigned_to (optional)
B) Analytics Snapshots
Preferred: reporting.daily_rollup.ready event feed
Hub consumes and stores snapshots:
daily rollups
KPIs
trend signals
forecasts (optional)
Tables:
hub.analytics_snapshots
hub.kpis_daily
Projection Ops Tables
hub.projection_cursors
hub.projection_dlq

8) Shared Engines (Horizontal Services)
8.1 Workflow Engine
Purpose:
orchestrate multi-step processes across apps
emit events for each transition
keep workflow state per tenant
Typical events:
workflow.instance.created
workflow.step.entered
workflow.step.completed
workflow.instance.blocked
workflow.instance.completed
8.2 Approvals Engine
Purpose:
standardized approvals for any vertical
role-based approvers
escalation rules
Events:
approvals.requested
approvals.approved
approvals.rejected
approvals.escalated
approvals.expired
8.3 Docs Engine
Purpose:
lifecycle for:
proposals/quotes
invoices
compliance documents
permits documentation packs
versioning + signatures + templates (future)
Events:
docs.created
docs.updated
docs.sent
docs.signed
docs.voided
8.4 Notification Engine
Purpose:
unified outbound channels:
email
sms/whatsapp (future)
in-app
push (future)
tenant branding rules
Events:
notify.queued
notify.sent
notify.failed
8.5 Reporting Engine
Purpose:
produce rollups safely (async)
emit reporting.daily_rollup.ready
8.6 AI Engine (Future-Ready)
Purpose:
predictions, assistant actions, summarization
must be entitlement-gated
must log every “AI action” for audit
Events:
ai.suggestion.created
ai.action.proposed
ai.action.confirmed
ai.action.executed

9) Cross-App Workflow Mapping (Ecosystem Flows)
Flow A: “Approval blocks a Project”
Projects emits: projects.change_requested
Workflow Engine creates workflow: workflow.instance.created
Approvals requested: approvals.requested
Hub inbox gets item via projection: hub.inbox_items.open
Approver acts → approvals.approved/rejected
Workflow continues → workflow.step.completed
Projects receives outcome (via event consumer or internal handler) → updates project state
Hub inbox item resolved
Block Policy (your rule):
A “block” is configurable per tenant:
strict mode: block entire project
soft mode: allow work with warnings + audit note
Flow B: “Permit expiring locks execution”
Permits engine emits: permits.expiring_soon / permits.expired
Hub inbox shows critical item
Projects checks “block policy” for that tenant:
strict: freeze changes (except admin override)
soft: allow but add compliance banner + require acknowledgment
Flow C: “Quote → Invoice → Payment → SmartBooks”
Docs emits quote events
Once accepted → docs.accepted
SmartBooks emits invoice smartbooks.invoice.created
Payment status changes emit billing.payment.succeeded/failed
Hub shows payment alerts + cashflow KPI updates
Flow D: “HR payroll completion affects cost KPIs”
HR emits payroll run hr.payroll.run.completed
Reporting engine rolls costs → reporting.daily_rollup.ready
Hub dashboard updates margins & burn

10) Scalability Model (Designed In, Not Added Later)
Scale axis 1: Product Usage Growth
Cloud Run autoscaling
connection pooling
async processing via jobs tables / queues
Scale axis 2: Data Growth
partitioning strategies later (events, logs)
analytics snapshots instead of querying live tables
Scale axis 3: Organization Complexity
multi-tenant RBAC
per-tenant policy config (block modes, approval routing, doc templates)
Scale axis 4: Extraction
When a vertical becomes too heavy:
keep same contracts
move schema to new DB
deploy vertical as independent service
keep Jad + Hub unchanged

11) Tenant Lifecycle Flow (End-to-End)
11.1 Create Tenant
core.tenant.created
default roles provisioned
default plan assigned
default feature flags applied
create projection cursors for that tenant (if tenant-scoped projections)
11.2 Onboard Tenant
select vertical modules
set org profile
invite users
assign roles
configure policies:
strict vs soft blocks
approvals routes
doc templates
notification branding
11.3 Operate Tenant
all actions emit events
hub receives inbox + KPIs
entitlements enforced continuously
11.4 Suspend Tenant (Billing / Risk)
entitlements reduced
write actions restricted
admin override allowed with audit
11.5 Offboard / Archive Tenant
export tools
freeze writes
archive data
disable projections
preserve audit trail

12) Future Extraction Strategy (Zero Redesign)
Extraction Triggers
team ownership requires isolation
scaling requires independent DB
compliance requirements
cost performance
Extraction Steps (Standard Playbook)
Identify vertical boundary (schema + service)
Freeze contract version (events v1 stable)
Create new Postgres cluster for vertical
Deploy vertical service with same API surface
Keep emitting same events
Hub projections stay intact
Run backfill replay from jad.events into new service if needed

13) Governance + Risk Control (Final)
Governance Rules
contracts are “law”
event versioning discipline mandatory
RLS mandatory on every business table
audit log mandatory for:
RBAC changes
entitlement changes
data export
replay/backfill operations
admin overrides
Risk Controls
idempotency everywhere
DLQ operational playbook
replay tools locked behind admin roles
safe redirect policy enforced
blocking policy configurable per tenant (strict/soft)
Observability (Minimum viable enterprise)
structured logs with correlation_id
health endpoints per service
projection health dashboard:
lag
dlq count
replay jobs

14) Arabic Readiness Validation (System-Level)
Must-Haves
i18n at UI + email templates + documents
RTL support
Arabic fonts + proper numeral/date formatting
field labels not “translated strings only” — must be native copy quality
tenant-specific branding applies to both languages
Contracts & Data
store content in language-aware format where needed:
title_en, title_ar (for key UX items) OR structured locale maps
ensure PDFs & docs support RTL (critical for proposals/invoices where relevant)
Governance for Arabic
no Google auto-translation
Arabic copy must be reviewed or professionally authored
system must support bilingual data entry for official docs (where needed)

2) Full Visual Mindmap (Hierarchical Structured Text)
Intellect Proactive Ecosystem (IPro)
├─ Core Platform
│  ├─ Auth (SSO)
│  ├─ Tenancy (multi-tenant switching)
│  ├─ RBAC (per tenant)
│  ├─ Entitlements (plans, limits, addons)
│  ├─ Audit Log
│  └─ Admin Jobs
├─ Jad Connector (Event Spine)
│  ├─ Event Store (append-only)
│  ├─ Contract Registry (v1, v2…)
│  ├─ Projections
│  │  ├─ hub_inbox_v1
│  │  └─ hub_analytics_v1
│  ├─ Cursor Tracking
│  ├─ DLQ
│  ├─ Replay / Backfill
│  └─ Admin Tools
├─ Hub Control Tower (Read Models)
│  ├─ Inbox Items (global attention system)
│  ├─ Analytics Snapshots
│  ├─ KPIs Daily
│  ├─ Projection Cursors
│  └─ Projection DLQ
├─ Shared Engines
│  ├─ Workflow Engine
│  ├─ Approvals Engine
│  ├─ Docs Engine
│  ├─ Notification Engine
│  ├─ Reporting Engine
│  └─ AI Engine (future)
├─ Vertical Products (Schema-per-app)
│  ├─ IProProjects
│  ├─ IProSmartBooks
│  ├─ IProHR
│  ├─ IProMarketing
│  └─ Future Verticals
│     ├─ IProGuest
│     ├─ IProMaintenance
│     ├─ Event121
│     └─ Clinic OS
└─ GCP Infrastructure
   ├─ Cloud Run (services)
   ├─ Cloud SQL (Postgres)
   ├─ Load Balancer (host routing)
   ├─ IAM (per service)
   ├─ Secret Manager
   ├─ VPC Connector
   └─ Future: Pub/Sub, Redis


3) “Vertical + Horizontal” Architecture (in one view)
Horizontal = platforms/engines (Core, Jad, Hub, Engines)
Vertical = domain apps (Projects, SmartBooks, HR, Marketing)
All cross-app coordination occurs through:
jad.events → projections → hub
or jad.events → engine consumers → downstream actions
No cross-schema direct coupling.


