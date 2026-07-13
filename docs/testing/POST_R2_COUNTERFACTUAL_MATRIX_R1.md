# Post-R2 Counterfactual Attack Matrix R1

Status: active Phase 3 evidence. Rows are sealed one attack class per commit.

| Attack | Counterfactual input | Required invariant | Executable evidence | Result |
| --- | --- | --- | --- | --- |
| validator missing | Import and review controllers are constructed without a validator. | Import never reaches handoff; review never reaches confirmed state; both return `validator-required`. | `tests/post-r2-counterfactual-validator-missing.test.js`; `tests/import-orchestrator-fail-closed.test.js`; `tests/review-controller-fail-closed.test.js` | PASS |
| validator throws | Both controller validators throw an exception containing private internals. | Import never hands off and releases its lock; review stays pending; both expose only `validator-failed`. | `tests/post-r2-counterfactual-validator-throws.test.js`; controller fail-closed suites | PASS |
| malformed admission | Validator returns null, an empty object, a string boolean, or non-array errors. | Neither controller accepts structural ambiguity; no handoff or reviewed state; code is `validator-malformed`. | `tests/post-r2-counterfactual-malformed-admission.test.js`; controller fail-closed suites | PASS |
| fake manual flag | Attacker flips draft-level `userEdited`, `manualEdited`, and `manualConfirmed` while answer provenance remains rejected. | Formal Admission rejects the answer; only a real field revision may create manual provenance. | `tests/post-r2-counterfactual-fake-manual-flag.test.js`; `tests/formal-admission-policy.test.js` | PASS |
| rejected AI field only confirm | A PDF-AI answer has rejected ownership and the teacher only invokes confirm through the real review validator. | Draft remains pending, provenance remains rejected, and admission reports `admission-field-rejected`. | `tests/post-r2-counterfactual-rejected-ai-confirm.test.js`; `tests/production-review-validator.test.js` | PASS |
