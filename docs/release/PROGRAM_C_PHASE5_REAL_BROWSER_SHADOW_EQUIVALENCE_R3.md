# Program C Phase 5 — Real Browser Shadow Equivalence R3

## Stage

`PHASE 5 — REAL BROWSER SHADOW EQUIVALENCE`

## Baseline

- start production commit:
  `d7f0f8b5d2daaca94ca3d164cf730fbe7fdae1ab`
- end production commit:
  `d7f0f8b5d2daaca94ca3d164cf730fbe7fdae1ab`
- branch: `stage/app-shell-slimming-r3`
- working tree before investigation: clean
- normal UI owner: legacy `processDraftImportBatch`
- Bridge status: layer-3 scaffold; not the normal UI owner

## Browser scenarios

### Failure-first DOCX deterministic complete import

- Used the normal browser batch-import UI.
- Uploaded the real 12-question DOCX fixture.
- Did not register `InjectedImportTransport`.
- Did not seed a review draft or final question.
- Used a temporary deterministic adapter only at the raw recognition boundary.
- Made no real AI/API call.
- The 1-question counterfactual was rejected by the production authoritative
  question-number contract as missing questions 2–12.
- The 12-question run reached the production review state and persisted 12
  legacy drafts.
- The persisted legacy result had no `source.mode` and no `fieldProvenance`.
- Its real route evidence was `docx-local-convert-pdf-strict-vision`.

The evidence is recorded in
`docs/benchmark/IMPORT_SHADOW_EQUIVALENCE_R3.md`.

The remaining required PDF, known-bad, ambiguity, conflict, formula-fallback,
and cancellation scenarios were not run after the global stop condition was
triggered.

## Production call graphs

Legacy:

```text
normal UI entry
→ runBatchRecognition
→ LegacyBatchRunCoordinator
→ processDraftImportBatch
→ processDocxByLocalConvertAndStrictVision
→ processStrictVisualQuestionFile
→ legacy persistence
```

Bridge:

```text
ProductionImportBridge
→ deterministic-source-loaded
→ runDocxImport
→ ProductionDocxSourcePort.parseDocxSource
→ shared validation / review-draft persistence
```

## Comparator coverage and result

The required comparison cannot legally produce zero differences for the DOCX
case:

- `source.mode` is mandatory but absent from the legacy review draft;
- stable field provenance is mandatory but absent from the legacy review draft;
- the legacy route is visual, while the Bridge route is deterministic;
- ignoring those differences would weaken the comparator;
- setting `docx-deterministic` on the legacy visual result would fabricate
  provenance;
- switching the normal UI route to the deterministic owner is C2-11 and is not
  allowed before Phase 5 acceptance.

Therefore no `EXACT` result, approved safety refinement, or canonical hash is
claimed.

## Safety counters

- canonical accepted cases: `0`
- wrong attachments observed: `0`
- raw JSON leakage observed: `0`
- placeholder leakage observed: `0`
- controlled-write bypass observed: `0`
- Formal Admission bypass observed: `0`
- Bridge formal writes: `0`
- real API called: `false`

These zero observations do not constitute Phase 5 acceptance because the first
mandatory accepted case is not canonically equivalent.

## Tests and gates

- source-level call-graph inspection: completed
- true-browser normal-UI failure-first runs: `2`
- first run result: expected production coverage failure (1/12 questions)
- second run result: production review reached; mandatory source-mode assertion
  failed
- skipped/todo/timeout: `0/0/0` in the failure-first browser executions
- Phase 5 full browser suite: not run after global stop
- `verify:safe`: not run after global stop
- 11 mandatory gates: not run after global stop
- DOCX stable / PDF known-bad / Route B / controlled-write ownership / runtime /
  architecture owner / no-real-AI / preflight / dry-run: not rerun after global
  stop

Stopping before the remaining gates follows the instruction to stop immediately
when a credible normal-UI legacy/Bridge snapshot cannot be produced without
fabricated provenance or weakened validation.

## Changed files

Production code changes: none. All temporary trial modules, tests, and `app.js`
or `main.html` edits were removed before this report was created.

Permanent changes are evidence only:

- `docs/benchmark/IMPORT_SHADOW_EQUIVALENCE_R3.md`
- `docs/release/PROGRAM_C_PHASE5_REAL_BROWSER_SHADOW_EQUIVALENCE_R3.md`
- `ai/APP_SHELL_SLIMMING_R3_STATE.md`

## Frozen files

All six frozen high-risk PDF files remain unchanged. No validator, comparator,
controlled-write owner, Formal Admission owner, parser, aligner, or normal UI
production owner was modified.

## Git

- start production commit:
  `d7f0f8b5d2daaca94ca3d164cf730fbe7fdae1ab`
- end production commit:
  `d7f0f8b5d2daaca94ca3d164cf730fbe7fdae1ab`
- evidence disposition: committed and pushed as a documentation-only blocker
  seal
- working tree target after seal: clean
- local/tracking/live target after seal: equal

## Remaining limitations

- Phase 5 is not accepted.
- C2-11 is prohibited.
- No old owner was deleted.
- No production entry was migrated.
- C2-12 through C2-14, attack campaign, architecture audit, benchmark,
  internal CTO review, and Phase 8 Git seal were not entered.

## Decision

`PHASE_5_BLOCKED`

Exact blocker:

`DOCX_NORMAL_UI_LEGACY_VISUAL_PROVENANCE_NOT_EQUIVALENT_TO_DETERMINISTIC_BRIDGE`

Next exact action: define and authorize a prerequisite migration that makes the
normal UI DOCX route use a truthful deterministic production owner before
restarting Phase 5. That action cannot be performed inside this blocked task
because C2-11 remains gated on Phase 5 acceptance.

