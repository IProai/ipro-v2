# PHASE 05 — AI ASSIST + ADVANCED SUPPORT

## Goal
Add assistive AI layer inside IProCore.
AI must NOT bypass governance.

---

## Scope (Must Implement)

### 1) AI Playbooks
Routes:
- /console/ai/playbooks
- /console/ai/suggestions
- /console/ai/activity

Features:
- Draft workflow suggestion
- Draft onboarding steps
- Draft help replies
- Draft integration suggestions

AI responses stored in DB.

---

### 2) Confirmation Gate
Before AI action executed:
- User confirmation required
- Permission revalidated
- Action routed to JAD runtime
- Confirmed execution must call /api/jad/ai/execute (JAD bridge).
- Audit entry created

---

### 3) AI Activity Log
- Record prompt
- Record summary (not raw secrets)
- Record approving user
- Record result

---

### 4) Help Auto-Suggestions
Inside:
- /console/help/tickets

AI can:
- Suggest reply draft
- Suggest KB article link

AI cannot:
- Modify data without confirmation
- Access secrets
- Change roles/permissions

---

## Must NOT Implement
- No autonomous execution
- No direct secret access
- No silent workflow triggers

---

## Acceptance Criteria
- AI suggestion visible
- User must confirm execution
- Execution routed to JAD (via /api/jad/ai/execute)
- All actions audited
- No secret exposure

---

## Proof Required
- AI suggestion example
- Confirmation flow test
- Audit verification
- Coverage checklist update
- Rollback notes