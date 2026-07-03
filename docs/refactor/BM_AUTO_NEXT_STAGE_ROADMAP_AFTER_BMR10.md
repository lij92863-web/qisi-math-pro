# BM-AUTO Next Stage Roadmap After BMR10

## Current Status
- BMR8 accepted: yes (7e7980e — pdf page trace helpers, delta -45)
- BMR9 accepted: yes (c154d30 — xml docx text helpers, delta -15)
- BMR10 no eligible: yes (3034083 — honest stop, no candidate satisfies all criteria)
- automatic long run frozen: yes (POST-BMR10 freeze)

## Recommended Next Stage Options

### Option 1 — Freeze BM-AUTO and return to product validation
Purpose:
Run real user workflow validation without new migration.

Tasks:
- DOCX+DOCX manual browser smoke
- PDF safe partial manual review workflow
- review page editing flow
- export/import sanity

Risk:
low

Recommended:
yes — do this first before any further migration work.

---

### Option 2 — Manual remaining candidate review
Purpose:
Manually inspect BMR10 blocked candidates and identify if any can be unlocked safely.

Tasks:
- Review the 37 individual candidates and 4 group candidates from BMR10
- Build dependency map for foundational helpers (normalizeQuestionKey, mergeStemWithOptions, etc.)
- Identify candidates that can be unlocked by extracting foundational dependencies first
- Mark candidates that will never be eligible (Vue-coupled, no callers)

Risk:
medium

Recommended:
yes, before any BMR11.

---

### Option 3 — app.js responsibility design
Purpose:
Design next architectural boundary before further migration.

Tasks:
- UI event boundary: separate Vue event handlers from pure logic
- Review state boundary: extract review draft state management
- Batch orchestration boundary: decouple batch workflow from Vue components
- Storage facade boundary: design qisi-storage.js for IndexedDB/localStorage

Risk:
medium

Recommended:
yes — architecture decisions needed before more migration.

---

### Option 4 — BMR11 targeted migration
Purpose:
Only if manual review identifies a single safe candidate.

Prerequisites:
- explicit user approval (new task document required)
- one candidate only
- no A4
- no controlled-write/parser/aligner/runner
- no AI/OCR
- verifier REAL_MIGRATION
- all gates pass before and after

Risk:
medium/high

Recommended:
not now — complete Options 1-3 first.

---

### Option 5 — PDF pipeline work
Purpose:
Improve PDF safe partial/manual review UX.

Restrictions:
- do not chase complete automation
- do not connect Route B
- do not weaken controlled-write
- keep safe partial boundary intact

Risk:
high

Recommended:
only with separate task document and explicit user approval.

---

## Recommended Order
1. **Post-BMR10 user review** — user reads and approves this roadmap and freeze decision
2. **Product validation / regression** — Option 1: manual smoke tests of DOCX+DOCX, PDF, review, export/import
3. **Remaining candidate manual review** — Option 2: inspect all 37+ candidates, identify unlockable ones
4. **Architecture boundary plan** — Option 3: design UI-event, review-state, batch-orchestration, storage boundaries
5. **Only then targeted BMR11** — Option 4: if and only if a single safe candidate is identified and approved

## Stop Conditions for Future Work

Any future migration or architecture work MUST stop if:
- controlled-write, parser, aligner, or runner is touched
- Route B is connected to production path
- real-run is called
- AI/OCR real API is called
- A4 remaining callsites are auto-migrated without manual review
- A4 wrappers are removed
- CALLSITE_PARTIAL is changed to COMPLETE
- package.json or package-lock.json is modified without explicit approval
- main.html or app.css is modified without explicit approval
- any test is deleted or weakened
- verifier does not classify REAL_MIGRATION
- any gate fails (execution-gate, route-b-hold, smoke:batch:mock, verify:safe, verify:batch-safety, verify:pdf-known-bad, controlled-write, preflight, dry-run, verify:docx-stable)
- working tree is not clean before starting
- local HEAD != origin/main before starting

## Decision

BM-AUTO automatic long run is frozen after BMR10. No automatic BMR11. Next action: user review and decision on recommended Options 1-3.
