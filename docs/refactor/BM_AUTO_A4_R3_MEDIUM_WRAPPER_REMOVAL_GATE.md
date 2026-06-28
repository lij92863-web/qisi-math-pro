# BM-AUTO A4 R3 Medium Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-MEDIUM-WRAPPER-REMOVAL-GATE
Branch: main
Status: failed gate; wrappers remain

## Gate Result

Wrapper removal allowed: no.

## Gate Criteria

| Criterion | Status | Detail |
| --- | --- | --- |
| Remaining naked A4 callsites = 0 | fail | 40 remain. |
| Deferred callsites = 0 | fail | 19 deferred. |
| Blocked callsites = 0 | fail | 21 blocked. |
| Unknown callsites = 0 | pass | 0 unknown. |
| All A4 calls explicit | fail | 75 explicit module callsites, 40 naked remain. |
| verify:safe passed | pass | passed. |
| verify:pdf-known-bad passed | pass | passed. |
| controlled-write ownership passed | pass | passed. |
| preflight ok:true | pass | ok:true. |
| dry-run ok:true | pass | ok:true. |

## Safety Rationale

The four wrapper functions must remain because naked A4 callsites still depend on the compatibility layer. Removing wrappers now would break unresolved callsites.

## Wrapper Status

| Wrapper | Status |
| --- | --- |
| cleanDisplayTextForBatchSave | keep |
| cleanDisplayOptionsForBatchSave | keep |
| addWarningOnce | keep |
| cleanDisplayFieldsOnly | keep |

## Validation

| Check | Result |
| --- | --- |
| staged verifier | CALLSITE_PARTIAL |
| verify:safe | passed |
| verify:pdf-known-bad | passed |
| controlled-write ownership | passed |

## Decision

- Wrapper removal allowed: no.
- A4 staged migration complete: no.
- Wrappers remain: yes.
- Next action: only continue after remaining 40 callsites are resolved.

