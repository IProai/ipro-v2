# PHASE 06 — STAGING DEPLOYMENT RUN

## Objective
Deploy the validated IProCore backbone to Google Cloud Platform (Staging) using Cloud Run and Cloud SQL.

## 1) Cloud SQL (Postgres) — STAGING
- Instance: `ipro-staging-db`
- Tier: `db-f1-micro` (Staging baseline)
- Database: `iprocore`
- Backups: Enabled
- SSL: Required (Prisma connector logic)

## 2) Migrations + Seed
- Apply Prisma Migrations (explicit/deploy mode)
- Create Founder user: `founder@iprocore.com`
- Create Tenant: `ipro-demo`
- Create Base Portfolio: `Core Spine`

## 3) Build & Push Images
- Registry: Artifact Registry (`ipro-registry`)
- Images: `iprocore-api`, `jad-runtime`, `iprocore-web`

## 4) Cloud Run Deployment
- `iprocore-api`: Public ingress
- `iprocore-web`: Public ingress
- `jad-runtime`: **PRIVATE** (Allow internal only / IAM restricted)

## 5) IAM / Security
- Custom Service Accounts per service
- `iprocore-api` SA granted `roles/run.invoker` on `jad-runtime`
- HMAC Shared Secret synchronized for inter-service bridge

## 6) Acceptance Criteria (Proof Tests)
- [ ] `GET /health` (API) -> DB: connected
- [ ] `GET /health` (JAD) -> DB: connected
- [ ] Persistence Proof: Created PortfolioItem survives container restart
- [ ] Execution Proof: AI confirm -> JAD dispatch -> WorkflowRun created
- [ ] RequestID chain preserved across service boundary

## Current Blockers
- **GCP Project ID**: Unknown
- **GCP Authentication**: Not authenticated in `gcloud`
