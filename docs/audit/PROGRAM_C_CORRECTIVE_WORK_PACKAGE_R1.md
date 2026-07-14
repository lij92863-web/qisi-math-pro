# Program C Corrective Work Package R1

Decision:

```text
PROGRAM_C_INDEPENDENT_AUDIT_BLOCKED
```

This is a corrective work package only. No correction was implemented during
the independent audit.

## Blockers

### PC-IA-R1-001 — production-path browser evidence is bypassed

- **evidence**
  - `tests/e2e/production-normal-ui-import-cutover.test.js:33-75` installs an
    `ImportAdapterRegistry` fixture transport.
  - `tests/e2e/production-normal-ui-import-cutover.test.js:202-209` returns an
    already-built final candidate from that transport.
  - `tests/e2e/production-cutover-fixtures.js:9-171` constructs final DOCX/PDF
    candidates, controlled-write decisions, alignment, evidence, validation and
    PDF projection in test code.
  - `app.js:2055-2062` turns registry presence into `testFixture=true`.
  - `qisi-normal-ui-import-controller.js:46-77` selects
    `producerRoute='fixture'` while still calling Bridge with
    `mode='production'`.
  - `qisi-production-import-bridge.js:159-166,504-526` accepts the fixture route
    and calls `runFixtureImport`, bypassing the actual DOCX/PDF producer chain.
  - “True import” tests register the same path through
    `tests/e2e/browser-harness.js:418-426`.
- **production impact**
  - The sealed evidence cannot prove DOCX+DOCX, DOCX vision, PDF full,
    safe-partial, known-bad, conflict, formula fallback, attachment ownership,
    or projection behavior from the real normal-UI production source entry.
  - A runtime dependency can select an alternate fixture producer inside the
    production app/controller/Bridge graph.
- **exact failing test**
  - Audit authenticity failure:
    `node --test tests/e2e/production-normal-ui-import-cutover.test.js`.
    The runner is numerically green, but its own setup forces the prohibited
    fixture path. An authenticity assertion that
    `result.producerRoute !== 'fixture'` and that the applicable production
    DOCX/PDF source/projection owner executed would fail the current snapshot.
  - The full required browser replay is likewise invalid as production-path
    proof: all sorted `tests/e2e/*.test.js` pass 17/17, while the broad matrix and
    true-import/formal cases use the same final-candidate adapter.
- **exact owner**
  - Incorrect production selection: `ui-shell` (`app.js`),
    `normal-ui-controller` (`qisi-normal-ui-import-controller.js`), and
    `production-import-bridge` (`qisi-production-import-bridge.js`).
  - Test correction: `tests/e2e/production-normal-ui-import-cutover.test.js`,
    `tests/e2e/browser-harness.js`, and the true-import browser suites.
- **prohibited shortcut**
  - Do not rename the fixture route or merely relabel it production.
  - Do not preserve final-candidate envelopes behind a different registry,
    adapter, shadow, or “true import” helper.
  - Do not mock parser, aligner, controlled-write, projection, validation,
    ReviewDraft construction, persistence, or Formal Admission.
  - Do not seed ReviewDraft or weaken assertions to match current behavior.
  - Do not call real AI/OCR endpoints.
- **minimal corrective action**
  1. Make the test fixture producer unreachable from the production normal-UI
     command graph. The production controller/Bridge must select only declared
     DOCX/PDF production producers.
  2. Rebuild the required browser matrix from the real visible UI entry with
     actual input files and real production source/parser/aligner/projection,
     validation, ReviewDraft, persistence, reload and Formal Admission code.
     Mocks may terminate only the external AI/OCR/conversion boundary.
  3. Add explicit instrumentation/assertions for `producerRoute`, production
     source-port calls, PDF projection/controlled-write calls, ReviewDraft and
     formal write counts, legacy/fallback calls, real API calls and console
     errors for every required scenario.
  4. Ensure the matrix includes actual manual field edit and formal
     confirmation, not only Bridge formal-write isolation.

### PC-IA-R1-002 — app.js has not exited Program C B/C/D ownership

- **evidence**
  - B import route decision: `app.js:2046-2062` inspects the adapter registry and
    changes the producer route.
  - C validation/ownership policy: `app.js:2621-2631`
    (`detectDraftDuplicate`) decides exact duplicate, similar duplicate and
    answer conflict, then gates submit at `app.js:2680-2697`.
  - D persistence business logic: `app.js:2738-2767` (`refreshBatchStats`)
    computes reviewed/submitted/problem/unassigned counts and lifecycle status,
    then persists the aggregate.
- **production impact**
  - The audit's hard `B=0`, `C=0` except explicit command delegation, and `D=0`
    transaction/business-logic conditions are false.
  - `app.js` remains a second policy/lifecycle decision point outside the
    declared controller, library/formal policy and DraftPersistence owners.
- **exact failing test**
  - The current static owner gates pass because they do not assert these
    remaining behaviors. Add a Program C app-boundary test that fails if:
    `runBatchRecognition` selects a producer, duplicate/answer-conflict policy
    is implemented in `app.js`, or batch lifecycle aggregates/status are
    computed before a persistence command. That test fails on the cited sealed
    lines.
  - Required audit condition reproduction: independent A/B/C/D classification
    of `app.js` reports B, C and D each non-zero.
- **exact owner**
  - Incorrect owner: `ui-shell` (`app.js`).
  - Existing target owners: normal-UI/Bridge production routing,
    `library-service`/formal-submit policy for duplicate admission gating, and
    `draft-persistence` for persisted review lifecycle aggregation/status.
- **prohibited shortcut**
  - Do not move the same logic into a new `V2`, `New`, `Modern`, `Final`, generic
    helper, Bridge callback, or 1,000+ line mixed owner.
  - Do not leave a second copy in `app.js`.
  - Do not remove duplicate or lifecycle safety checks merely to satisfy a
    static scan.
  - Do not change expected safety behavior or tests just to make the new gate
    pass.
- **minimal corrective action**
  1. Remove fixture route selection as required by `PC-IA-R1-001`; keep
     `runBatchRecognition` as an explicit UI command delegation only.
  2. Delegate duplicate/answer-conflict evaluation to the existing
     question-library/formal-submit policy boundary, returning a data-only
     decision for UI display.
  3. Move review lifecycle aggregation/status computation into the existing
     DraftPersistence command owner; `app.js` may request refresh and map the
     returned view only.
  4. Add focused boundary tests proving B=0, C=0 except command delegation,
     D=0 business/transaction logic, no direct formal mutation, and unchanged
     DOCX/PDF safety behavior.

## Minimal corrective sequence

1. Correct production fixture reachability and add the failing authenticity
   assertion.
2. Replace the final-candidate browser matrix with external-boundary-only mocks
   and rerun every required normal-UI scenario.
3. Correct the three bounded `app.js` B/C/D ownership residues using existing
   owners; do not broaden Program C.
4. Recompute static metrics and rerun targeted, counterfactual, browser,
   benchmark smoke and all mandatory gates.
5. Create a new corrective commit/tag only in the separately authorized
   implementation session. Do not alter the audited tag.

## Git

```text
audited commit: 79fea1e1cad0c682c42539dd575370f3919f1d05
tag: v1.2.0-rc2-app-shell-slimming-r3
branch: stage/app-shell-slimming-r3
working tree before audit reports: clean, upstream +0/-0
audited tag/branch history modified: no
main modified/merged: no
```

## Next action

Run corrective work in a separate implementation session.

Then rerun Program C Independent Audit R1 from the beginning.
