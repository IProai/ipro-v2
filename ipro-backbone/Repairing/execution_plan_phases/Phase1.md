PHASE 1 – Tenancy Correction (Highest Priority)

Remove User.tenantId column.

Add UserRole table.

Add activeTenant to session.

Add endpoints:

GET /tenancy/list

POST /tenancy/switch

Stop. Test. Deploy.

Do NOT touch anything else.