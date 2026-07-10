# Test Strategy R2

| Level | Purpose | Reality requirement |
|---|---|---|
| Pure unit | deterministic helpers | import production export |
| Production-linked module | module behavior and compatibility | no inline equivalent |
| Contract | all adapter/repository implementations | shared production validator |
| Gate | stable invariants | execute actual scripts |
| Browser startup | load order and initialization | real main.html in browser |
| Browser product E2E | upload/review/edit/confirm/persist/export/delete | real UI with mock services |
| Known-bad fixtures | historical unsafe inputs | fail-closed assertions |
| Counterfactual attack | actively break boundaries | failure-first tests |
| Benchmark | repeatable quality/performance | fixed corpus/config/scorer |
| Manual acceptance | teacher comprehension and final interaction | explicitly reported, not inferred |

## Prohibitions

No copied parser/repair/ownership logic, source-grep-only claims, mocked controlled-write, hidden skips, or timeout-as-pass. String inspection may support an architectural guard but cannot be the sole behavioral proof.

## Browser E2E

Use existing Playwright and runner infrastructure. Tests isolate storage per run, use mock AI/OCR only, capture console/page errors, and clean test data. The acceptance flow covers startup, DOCX mock, PDF safe partial, review edits, confirmation, persistence after reload, export, deletion, and recent tasks.

## Failure handling

A production regression receives a failing production-linked test before the minimal fix. Out-of-scope failures stop the work package. Every production package runs targeted tests then the full R2 mandatory gates.
