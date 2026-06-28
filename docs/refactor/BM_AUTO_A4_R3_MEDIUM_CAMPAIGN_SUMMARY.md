# BM-AUTO A4 R3 Medium Campaign Summary

Stage: BM-AUTO-A4-R3-MEDIUM-CAMPAIGN
Branch: main
Status: accepted after documentation formatting fix

## Baseline

- Start commit: 8600200
- Latest accepted medium campaign commit: f786397
- Formatting correction target: committed raw Markdown content
- A4 staged migration complete: no
- Final classification: CALLSITE_PARTIAL

## Campaign Results

| Item | Value |
| --- | --- |
| Starting naked callsites | 45 |
| Medium replacements | 5 |
| Total R3 replacements | 65 |
| Remaining naked callsites | 40 |
| Deferred callsites | 19 |
| Blocked callsites | 21 |
| Unknown callsites | 0 |
| Wrappers remain | 4 |
| Explicit module callsites | 75 |

## Validation

| Check | Result |
| --- | --- |
| doc audit | passed after raw-line enforcement |
| syntax checks | passed |
| tool runs | passed |
| fixture tests | 85 pass |
| staged verifier | CALLSITE_PARTIAL |
| verify:safe | passed |
| verify:batch-safety | passed |
| smoke:batch:mock | passed |
| verify:pdf-known-bad | passed |
| controlled-write ownership | passed |
| preflight | ok:true |
| dry-run | ok:true |

## Safety

| Check | Value |
| --- | --- |
| app.js changed in formatting fix | no |
| qisi-utils.js changed | no |
| production behavior changed | no |
| controlled-write touched | no |
| parser touched | no |
| aligner touched | no |
| runner touched | no |
| forbidden files changed | no |

## Decision

- Medium campaign accepted: yes.
- A4 staged migration complete: no.
- Wrappers remain: yes.
- Remaining blocker: 40 callsites require additional proof or manual review.
- Next recommended stage: blocked/deferred review only after documentation state is stable.

