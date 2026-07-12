# Engineering Closure R2 Final Report

Stage:
QISI-MATH-PRO ENGINEERING CLOSURE R2

Baseline:
- start commit: `da699b53abbe8a6715bb8a8ffae5a954f6b514af`
- baseline tag: `pre-engineering-closure-r2-da699b5`

Final:
- end commit: release-tag target (the commit containing this report; exact hash
  is emitted by final Git verification)
- release tag: `v1.1.0-rc1-engineering-closure-r2`
- branch: `main` after fast-forward from
  `stage/post-rc-engineering-closure-r2`
- pushed: work branch before fast-forward; main and release tag in Phase 8.6
- working tree: clean at final-test and remote-main checkpoints; required clean
  after sealing
- local/origin equal: required and verified after Phase 8.6

Repository:
- EOL policy: audited/documented; existing Windows LF/index versus CRLF/worktree
  behavior preserved without mass churn
- tracked files: 545 including this report
- temporary files removed: no uncertain tracked file deleted; cleanup audit
  found no tracked temporary extension and local artifacts remain ignored
- gitignore updated: private OCR corpus/results and local benchmark material are
  excluded
- private files committed: none found
- models committed: none

Recognition:
- baseline OCR: real benchmark not authorized/not measured
- final OCR: real benchmark not authorized/not measured; no production quality
  promotion
- text CER: not measured on a real corpus
- formula accuracy: not measured on a real corpus
- structural accuracy: not measured on a real corpus
- wrong attachments: zero in deterministic known-bad safety fixtures; real
  aggregate not measured
- fabricated questions: scorer supports the metric; real aggregate not measured
- raw JSON: canonical draft validation rejects raw/fenced wrappers in tested
  paths
- manual correction cost: scorer implemented; real baseline/final not measured
- production engines: existing `qwen-vl-plus` path under unchanged safety gates
- research engines: loopback local OCR adapter, shadow comparison, and Route B
  answer-only AI pass; none is promoted

Architecture:
- app.js baseline lines: 22,043 physical lines
- app.js final lines: 21,779 physical lines (-264, -1.20%)
- responsibilities extracted: canonical schema/contract, storage repository,
  library query, review lifecycle, export mapping, import routing, OCR
  registry/adapters/shadow, and privacy-safe performance monitoring
- modules added: 11 root `qisi-*.js` production modules
- duplicate owners: 0 among guarded critical implementation symbols
- dependency cycles: 0 detected in the audited extracted layer
- remaining debt: 5,134-line legacy batch workflow, 131 previously audited
  high-risk DB call sites, legacy normalization/error/logging and browser-effect
  paths

Testing:
- production-linked: yes; high-risk owners are imported, not copied
- runtime dependency: current graph passes; missing/late/duplicate/404/typo cases
  fail the gate
- browser E2E: 4/4 lifecycle suites pass; final new-test matrix 86/86
- counterfactual: 7/7 across runtime, JSON/LaTeX, ownership, synthetic OCR
  isolation, storage, security, and performance
- DOCX stable: passed
- PDF safe partial: passed known-bad and alignment gates
- controlled-write: 21/21 ownership gate passed
- Route B: 6/6 hold gate passed; research-only
- aggregate `npm test`: 1,013/1,013, 0 failed, 0 skipped

Performance:
- first render: not measured with a controlled baseline/final fixture
- switch p50/p95: not measured
- save: not measured
- reload: not measured
- export: not measured
- memory: not measured
- image storage: not measured
- metadata aggregation: 449.721 ms baseline versus 310.307 ms final median
  for 1,000 calls on 5,000 records (-31.00%)

Safety:
- controlled-write bypass: none found; formal confirmation requires
  controlled-write acceptance plus explicit manual confirmation
- Route B integrated: no
- placeholder fallback: known-bad/safe-partial gates prevent placeholder or
  unsafe ownership from becoming complete formal data
- real AI called: no; final preflight/dry-run reported `realApiCalled=false` and
  `underlyingApiCallCount=0`
- model download: no
- credentials exposed: no; API-key preflight records presence only and never
  prints the value
- private files pushed: no tracked private/local material found

CTO Decision:

```text
ENGINEERING_CLOSURE_ACCEPTED_WITH_LIMITATIONS
```

Known limitations:
- no authorized real OCR corpus/baseline/final, so quality, dangerous-error, and
  correction-cost improvement are not established
- app shell reduction is below the suggested 20% and the legacy batch workflow
  remains oversized
- only metadata aggregation has a controlled performance baseline/final
- cold-start/UX/memory/storage browser metrics, complete ZIP-bomb protection,
  extension-specific console attribution, penetration testing, and teacher
  usability study remain incomplete
- synthetic OCR transforms prove isolation and gating, not real recognition
  accuracy

Rollback:
- baseline tag: `pre-engineering-closure-r2-da699b5`
- instructions: create a recovery branch from the baseline tag for inspection or
  deployment rollback; do not rewrite or force-push shared history. Preserve the
  release tag and exported/backup user data before any operational rollback.

Next stage:
- monitor the RC under the declared DOCX/PDF boundaries
- open separate, explicitly authorized work for real OCR benchmarking, browser
  performance fixtures, hostile-archive hardening, and ordered app-shell debt
- do not automatically enter BMR11 or any real AI/OCR run
