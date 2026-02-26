# EXECUTION LAW (FOUNDER CONTROL) — STRICT MODE A

## The agent MUST follow these rules:
1) Read docs/BLUEPRINT.md and the relevant PHASE doc before coding.
2) Use agent/skills/* as enforcement rules.
3) Implement ONLY the current Phase. Do not jump ahead.
4) If a requirement is missing or conflicting:
   - STOP
   - Propose a Blueprint amendment (do not implement silently).
5) Every change set must include:
   - Coverage checklist update (what blueprint items are now satisfied)
   - Proof: commands run (typecheck/tests), key routes verified
   - Rollback notes

## Phase gating:
- Work is done only when the PHASE acceptance criteria is met.
- After completion, STOP and wait for Founder approval for next phase.

## Secrecy discipline:
- Never print secrets.
- Never expose secret values in API responses or UI.
- Prefer secret references and encrypted storage patterns.

## Team discipline:
- Team members execute tasks by Phase.
- No one edits BLUEPRINT.md or EXECUTION_LAW.md unless Founder explicitly instructs.