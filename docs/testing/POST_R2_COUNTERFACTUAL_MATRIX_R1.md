# Post-R2 Counterfactual Attack Matrix R1

Status: active Phase 3 evidence. Rows are sealed one attack class per commit.

| Attack | Counterfactual input | Required invariant | Executable evidence | Result |
| --- | --- | --- | --- | --- |
| validator missing | Import and review controllers are constructed without a validator. | Import never reaches handoff; review never reaches confirmed state; both return `validator-required`. | `tests/post-r2-counterfactual-validator-missing.test.js`; `tests/import-orchestrator-fail-closed.test.js`; `tests/review-controller-fail-closed.test.js` | PASS |
