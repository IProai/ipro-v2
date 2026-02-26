# PHASE 04 — JAD CONNECTOR (EXECUTION PLANE)

## Goal
Implement JAD as a separate service (Cloud Run service).
Strict separation from IProCore.

---

## Scope (Must Implement)

### 1) JAD Service Boot
Location:
- /services/jad-runtime/

Features:
- Health endpoint
- Strict env validation
- Shared contracts imported

---

### 2) Connector Registry
Models:
- ConnectorDefinition
- ConnectorActivation
- ConnectorHealthLog
- WorkflowRun
- WebhookEvent

Routes:
- /console/jad/marketplace
- /console/jad/integrations
- /console/jad/connectors/:id
- /console/jad/activations/:id
- /console/jad/health

---

### 3) Connector Activation Flow
- Store credentials encrypted or secret-ref
- Validate connection
- Log activation
- Health status persisted

No secret returned to UI.

---

### 4) Webhook Ingestion
- Endpoint for external events
- Validate signature if configured
- Persist WebhookEvent
- Enqueue WorkflowRun record (stub runtime OK)

---

### 5) Workflow Runtime (Minimal Engine)
- Process queued WorkflowRun
- Retry logic (basic)
- Status transitions: pending → running → success|failed
- Append-only logs

---

### 6) Health Monitoring
- Connector health check route
- HealthLog entries appended

---

## Must NOT Implement
- No AI auto-trigger
- No destructive automation without user-confirmed call

---

## Acceptance Criteria
- Connector can be activated
- Health check logs recorded
- Webhook stored
- WorkflowRun transitions work
- Cross-tenant isolation enforced
- Secrets never exposed
- Audit entries logged in IProCore

---

## Proof Required
- Service runs separately
- Health endpoint OK
- Connector activation tested
- Workflow run example
- Coverage checklist update
- Rollback notes