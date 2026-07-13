# Post-R2 Counterfactual Attack Matrix R1

Status: active Phase 3 evidence. Rows are sealed one attack class per commit.

| Attack | Counterfactual input | Required invariant | Executable evidence | Result |
| --- | --- | --- | --- | --- |
| validator missing | Import and review controllers are constructed without a validator. | Import never reaches handoff; review never reaches confirmed state; both return `validator-required`. | `tests/post-r2-counterfactual-validator-missing.test.js`; `tests/import-orchestrator-fail-closed.test.js`; `tests/review-controller-fail-closed.test.js` | PASS |
| validator throws | Both controller validators throw an exception containing private internals. | Import never hands off and releases its lock; review stays pending; both expose only `validator-failed`. | `tests/post-r2-counterfactual-validator-throws.test.js`; controller fail-closed suites | PASS |
| malformed admission | Validator returns null, an empty object, a string boolean, or non-array errors. | Neither controller accepts structural ambiguity; no handoff or reviewed state; code is `validator-malformed`. | `tests/post-r2-counterfactual-malformed-admission.test.js`; controller fail-closed suites | PASS |
