📜 INTELLECT PROACTIVE
MASTER BLUEPRINT – FOUNDATION REPAIR v1.0

(Authoritative Source of Truth for Antigravity)

This document replaces all drifted interpretations.
Anything conflicting with this must be refactored.

1️⃣ Architectural Authority Model (Non-Negotiable)
IProCore = Governance Spine

Owns:

Identity (User)

Tenancy

Membership

RBAC

Entitlements

Portfolio Registry

Auth tokens

Subscription state

It does NOT:

Execute vertical business logic

Store vertical domain data

Jad Connector = Event Runtime

Owns:

Event transport

Connector definitions

Workflow execution

Webhook ingestion

Projection consumers (future)

It does NOT:

Define governance rules

Store identity or tenant policy

2️⃣ Identity & Tenancy Model (FIX THIS FIRST)
Non-Negotiable Truth

User is GLOBAL identity.
User does NOT belong to a single tenant.

Tenant association is ONLY via Membership.

Final Data Model

User

id

email

passwordHash

status

Tenant

id

name

plan

subscriptionStatus

Membership

id

userId

tenantId

role

status

Session

userId

activeTenantId

Remove Immediately

❌ User.tenantId
If it exists → delete via migration.

3️⃣ RBAC (Minimal Correct Version)

Tables:

Role
Permission
RolePermission
UserRole (NEW – REQUIRED)

Permission keys are canonical (string constants).

Middleware:
requirePermission("core.user.manage")

No dynamic magic.

4️⃣ Entitlements Engine (Minimal Viable)

Tables:

Subscription

tenantId

plan

status

validUntil

Entitlement

plan

featureKey

limit

UsageCounter

tenantId

featureKey

used

Middleware:
requireEntitlement("portfolio.create")

NO complex billing logic yet.

5️⃣ Contracts Canonical Layer (Critical)

Add folder:

packages/contracts/
openapi/
schemas/
events/

All services validate against JSON schemas.
TS types are generated FROM schemas — not the opposite.

6️⃣ Event Envelope (Future-Ready but Simple Now)

Every event must follow:

{
eventId,
eventType,
occurredAt,
tenantId,
payload
}

No custom shapes allowed.