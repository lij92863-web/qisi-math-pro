# Program C Phase 8 Git Seal Report

## Decision

`PROGRAM_C_PHASE8_GIT_SEAL_ACCEPTED`

Phase 8 began only after commit `0d34084` recorded
`PROGRAM_C_PHASE7_CTO_ACCEPTED`. Phase 8 changes release state and evidence
only; it contains no production logic, test expectation, validator, owner,
route, schema, persistence, Formal Admission, or frozen-file change.

## Pre-seal audit

```text
Branch: stage/app-shell-slimming-r3
Phase 7 HEAD: 0d34084adefb897302aeb82cea570067f642cbec
Local/tracking/live remote at entry: equal
Working tree at entry: clean
Staged at entry: none
Target tag locally: absent
Target tag remotely: absent
Frozen file delta: none
Phase 7: PROGRAM_C_PHASE7_CTO_ACCEPTED
realApiCalled: false
```

The seal delta is restricted to:

- `ai/APP_SHELL_SLIMMING_R3_STATE.md`;
- `docs/release/PROGRAM_C_APP_SHELL_SLIMMING_R3_FINAL_REPORT.md`;
- `docs/release/PROGRAM_C_FINAL_EVIDENCE_INDEX_R3.md`;
- this Phase 8 Git seal record.

## Seal identity

```text
Commit message: release app shell slimming r3 engineering closure
Annotated tag: v1.2.0-rc2-app-shell-slimming-r3
Seal commit resolver: v1.2.0-rc2-app-shell-slimming-r3^{}
```

The report intentionally uses the peeled annotated tag as the exact commit
resolver: a commit hash is computed from the tree and cannot truthfully be
embedded inside a file in that same tree. The final command evidence outside
the commit records the exact SHA and proves both local and remote tag peeling.

## Final verification contract

The seal is accepted only after all of these checks succeed:

1. push `stage/app-shell-slimming-r3` without force;
2. verify local HEAD, tracking ref, and live remote branch are identical;
3. verify the tree is clean, the index is empty, and no untracked release
   evidence exists;
4. verify all four final release records are committed;
5. create the annotated tag once and never move it;
6. push the tag without force;
7. verify local and remote tag objects are identical;
8. verify local and remote peeled tags both equal the branch seal commit;
9. verify all six frozen PDF files have no seal delta;
10. verify the seal commit has no production-logic file.

The executed post-commit result is authoritative Git state and is reported to
the user with the exact hashes. Failure of any equality would change this
decision to blocked and prevent the tag from being represented as accepted.

## Safety and scope

```text
production logic modified in Phase 8 = 0
legacy owner = 0
legacy fallback = 0
duplicate owner = 0
Bridge formal writes = 0
app direct formal DB writes = 0
wrong attachment = 0
raw JSON leakage = 0
placeholder leakage = 0
controlled-write bypass = 0
Formal Admission bypass = 0
realApiCalled = false
frozen files modified = none
```

No merge to `main` is included or authorized.

`PROGRAM_C_PHASE8_GIT_SEAL_ACCEPTED`
