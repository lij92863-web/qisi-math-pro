# Program C Lost Session Full Recovery Audit R2

## Decision

```text
PROGRAM_C_RESUME_ALLOWED
```

The deleted chat did not remove a committed Wave or a pushed branch head. The
repository contains an externally backed-up, explainable, incomplete Wave 12
working tree. It is classified as Recovery Case B2 and may be completed from
the current tree without copying a legacy implementation or weakening a gate.

## Repository facts

```text
Branch: stage/app-shell-slimming-r3
Local HEAD: 7a4b945a3c0c50c33166c5c63689b7fca4e0c797
Tracking branch: origin/stage/app-shell-slimming-r3
Tracking HEAD: 7a4b945a3c0c50c33166c5c63689b7fca4e0c797
Live remote HEAD: 7a4b945a3c0c50c33166c5c63689b7fca4e0c797
Local-only commits: none
Remote-only commits: none
Staged: none
```

The expected repository is
`C:\Users\Administrator\Desktop\题库系统`. The initially focused
`E:\备份\题库系统` checkout is a separate clean `main` working copy at
`da699b53abbe8a6715bb8a8ffae5a954f6b514af`; it was not used for Program C
continuation.

## Protected working tree

The pre-existing working tree contained:

```text
 M app.js
 M architecture/layers.json
 M qisi-production-docx-vision-source-port.js
?? tests/docx-vision-support-source-producer.test.js
```

Before inspection, all status, binary diffs, index state, untracked paths, log,
reflog, and unreachable-object evidence were copied outside the repository to:

```text
C:\Users\Administrator\Desktop\qisi-program-c-recovery-20260714-024343
```

The untracked test was copied with its repository-relative path. No original
file was removed or reset.

## Process audit

Chrome, Edge, and Node processes existed on the machine, but the command-line
filter found no process associated with qisi, the question-bank repository,
Playwright, the PDF master runner, or `node --test`. No process was killed.

## Reflog and unreachable-object audit

The branch reflog ends at the pushed Wave 11 commit. There is no later Program C
commit in the reflog.

`git fsck --full --no-reflogs --unreachable` reported 4 commits, 14 trees, and
26 blobs. Every unreachable commit was inspected:

| Commit | Identity | Program C relation |
| --- | --- | --- |
| `d842378a90c2f258f2b479b50747b6d8972ab737` | old `index on main` at `a53f549` | none |
| `21059780551c58fb9bd4216c32591032761bdccd` | old BM04 documentation commit | none |
| `dbf9dadd14006bd23ad5d3332624f5f2a0101c50` | old `WIP on main` stash commit | none |
| `417d8d0d6f220805fe02eea838109415a7fc50c8` | old `index on main` stash parent | none |

None is an ancestor or descendant of the Program C HEAD. None contains a later
Wave 12 implementation, so no protection branch, merge, rebase, or cherry-pick
is required.

## Proven C2-12 history

The pre-wave audit commit is:

```text
e58a294ff5c8ad05bc2a5b7db74ed0b96fd6d65c
stage app shell audit C2-12 responsibilities and state trace
```

Wave 1 is reconstructed as:

```text
Wave 1 exact title: Formal lifecycle convergence on Import State Machine
Commit: b7f65c57ee825505cf5f8298498b5cff8c1d0beb
Commit message: stage app shell converge formal lifecycle on import state machine
```

It production-wired the existing state-machine owner across explicit teacher
confirmation, Formal Admission, repository commit, rejection, and failure. It
changed `app.js`, `qisi-batch-formal-submit.js`,
`qisi-import-state-machine.js`, architecture evidence, and production-linked
tests. Targeted state/admission tests passed 22/22 and browser formal-submit /
true-import admission passed 5/5. Decision: accepted.

Waves 2 through 11 are linear pushed descendants recorded in
`docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_C2_12.md`. The last fully
proven Wave is Wave 11:

```text
Commit: 7a4b945a3c0c50c33166c5c63689b7fca4e0c797
Message: stage app shell extract DOCX question producer
```

## Recovered partial Wave 12

The uncommitted tree is one coherent DOCX vision support-source producer move:

- old app-local `processStandaloneDocxSupportByVision` implementation removed;
- existing `ProductionDocxVisionSourcePort` gains
  `createSupportSourceProducer`;
- `app.js` retains dependency assembly and one producer call only;
- `architecture/layers.json` declares the existing owner's public API;
- a focused production-linked test covers owner assembly and fail-closed ports.

The old owner, new owner, production wiring, and test are explicit. No duplicate
production implementation or fallback remains. The work is incomplete because
Wave 12 acceptance coverage, evidence, commit, and push do not yet exist. It is
therefore Recovery Case B2, not B1 or B3.

One recovery-baseline `verify:safe` run exposed the diagnostic word `OCR` inside
the moved source-port error text. The architecture gate correctly rejected that
owner marker. A single bounded in-scope correction changed the diagnostic to
`页面视觉识别`; no algorithm, test expectation, validator, or ownership policy
changed. The focused architecture gate then passed 7/7.

## Current metrics

Measured from the recovered working tree with the repository inventory owner:

```text
Current app.js lines: 16,980
Current detected functions: 375
Current largest function: parseDocxOptionsFromText, 242 lines
Frozen PDF files changed: none
```

The state file previously said `C2-11 accepted; C2-12 is next`, while the Git
graph and responsibility matrix prove Waves 1 through 11. Git, production code,
tests, and the responsibility matrix take precedence; the state file is updated
in the recovery evidence change.

## Recovery baseline

Recovered Wave 1-11 targeted tests, Phase 5, C2-11, runtime dependency checks,
and browser evidence passed. The three browser suites passed 3/3, including all
15 normal-UI production-cutover scenarios. All safety counters were zero and
`realApiCalled=false`.

Final mandatory-gate results after the one bounded correction:

| Gate | Result |
| --- | --- |
| Base Migration execution gate | 15/15 passed |
| Route B hold | 6/6 passed |
| batch mock smoke | 20/20 passed |
| `verify:safe` | 1560/1560 passed across 54 suites; smoke and no-real-AI passed |
| `verify:batch-safety` | passed |
| PDF known-bad | 65/65 passed |
| controlled-write answer ownership | 21/21 passed |
| PDF master preflight | passed; real calls 0 |
| PDF master dry-run | passed in Chromium; real calls 0 |
| DOCX stable | 20/20 passed |
| no-real-AI | passed |

```text
failed = 0
timeout = 0
unexpected skipped = 0
todo = 0
realApiCalled = false
wrong attachment = 0
raw JSON leakage = 0
placeholder leakage = 0
controlled-write bypass = 0
Formal Admission bypass = 0
legacy fallback = 0
Bridge formal writes = 0
```

## Safe continuation point

Finish the existing Wave 12 DOCX vision support-source producer package. Add
the missing characterization and fail-closed coverage, run its normal-UI
browser canary and all mandatory gates, update the C2-12 matrix/state/evidence,
then commit and push that Wave only. Do not start Wave 13 before Wave 12 is
accepted and the three Git heads are equal.
