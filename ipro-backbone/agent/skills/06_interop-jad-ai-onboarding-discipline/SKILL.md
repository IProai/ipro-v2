# SKILL 06: Interop + JAD + AI + Onboarding Discipline

Rules:
- IProCore = Control Plane, JAD = Execution Plane
- Implement SSO/Auth contract and Event contract as shared contracts
- Propagate X-Request-ID across services
- JAD owns: connectors, webhooks, workflow runtime, retries, health logs
- AI is assistive only: no secrets access, no destructive execution, confirm-before-run via JAD
- Onboarding + Help always exist in dashboard