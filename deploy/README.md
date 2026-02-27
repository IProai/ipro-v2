# IProCore — GCP Staging Deployment (me-central1)

This guide provides the **zero-ambiguity** workflow to recreate the IProCore staging environment.

## 🏢 Project Configuration
- **Project ID**: `iprocore`
- **Region**: `me-central1`
- **Cloud Run Service**: `iprocore-api-staging`
- **Cloud Run Job**: `iprocore-migrate`
- **Cloud SQL Instance**: `iprocore:me-central1:iprocore-pg`
- **Service Account**: `iprocore-api-sa@iprocore.iam.gserviceaccount.com`

---

## 🔐 Mandatory Secrets Checklist
Create these in Secret Manager before deploying. All are required for cold-start (fail-fast).

```bash
# Example setup for a new secret
echo -n "SECRET_VALUE" | gcloud secrets create SECRET_NAME --data-file=- --project=iprocore
```

1.  **DATABASE_URL**: `postgresql://postgres:PASSWORD@/iprocore_staging?host=/cloudsql/iprocore:me-central1:iprocore-pg&sslmode=require`
2.  **SESSION_SECRET**: 32+ char random string
3.  **ALLOWED_ORIGINS**: e.g., `https://iprocore-staging-web.run.app`
4.  **ACCESS_TOKEN_SECRET**: 64-byte random hex
5.  **REFRESH_TOKEN_SECRET**: 64-byte random hex
6.  **SSO_TOKEN_SECRET**: 64-byte random hex
7.  **BOOTSTRAP_ADMIN_PASSWORD**: Secure password for `almoutlakomar@gmail.com`

---

## 🚀 Execution Commands (Deterministic)

### 1. Build & Push Image
```bash
gcloud builds submit --config=cloudbuild.yaml --project=iprocore
```

### 2. Run Database Migrations (Job)
Uses the canonical entrypoint `npm run db:migrate:prod`.
```bash
# Apply/Update Job
gcloud run jobs replace deploy/iprocore-migrate.job.yaml --region=me-central1 --project=iprocore

# Execute Migration
gcloud run jobs execute iprocore-migrate --region=me-central1 --project=iprocore --wait
```

### 3. Deploy API Service
```bash
gcloud run services replace deploy/iprocore-api-staging.service.yaml --region=me-central1 --project=iprocore
```

### 4. Verify Health
```bash
API_URL=$(gcloud run services describe iprocore-api-staging --format='value(status.url)' --region=me-central1 --project=iprocore)
curl -i ${API_URL}/api/health
```

---

## ✅ Verification Checklist
- [ ] **Cloud Run Job**: Last execution status is "Succeeded".
- [ ] **Cloud Run Service**: Revision status is "Ready".
- [ ] **Health API**: Returns `HTTP 200` with `{"ok": true, "db": "up"}`.
- [ ] **Bootstrap**: Check logs for `[BOOTSTRAP] super_admin created`.

---

## 🛠 Common Failure Fixes

| Symptom | Cause | Fix |
|---|---|---|
| **Health 503 (DB down)** | Missing `sslmode=require` or wrong instance connection string. | Ensure `DATABASE_URL` matches the format above. |
| **Service won't start** | Missing one of the 7 mandatory secrets. | Check Cloud Run logs for `[ENV] Invalid environment variables`. |
| **Migration fails** | `prisma/migrations` folder not committed. | Run `npm run db:migrate:dev -- --name init` locally and push migrations to git. |
| **Permission Denied** | Service Account missing roles. | Ensure `iprocore-api-sa` has `cloudsql.client` and `secretmanager.secretAccessor`. |
