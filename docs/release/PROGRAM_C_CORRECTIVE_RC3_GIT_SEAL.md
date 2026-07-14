# Program C Corrective RC3 Git Seal

## Decision

`PROGRAM_C_CORRECTIVE_RC3_GIT_SEAL_ACCEPTED`

The RC3 seal begins only after commit
`b37f04bbf0c6491f74d63979baea3c9bab0ba661` recorded
`PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED`. This seal commit is restricted to
the three declared `docs/release` records and contains no production code,
test, package, architecture manifest, frozen file, branch-history, or `main`
change.

## Pre-seal identity

```text
fixed base: 79fea1e1cad0c682c42539dd575370f3919f1d05
branch: stage/program-c-corrective-r1
internal CTO HEAD: b37f04bbf0c6491f74d63979baea3c9bab0ba661
working tree before release records: clean
index before release records: empty
corrective branch live remote at entry: absent
target RC3 tag locally at entry: absent
target RC3 tag remotely at entry: absent
frozen-file delta from fixed base: none
realApiCalled: false
```

The old immutable tag was checked locally and against the live remote:

```text
old tag: v1.2.0-rc2-app-shell-slimming-r3
tag object: 91c757c0c2d5d77d990e34de5f4bc93840363f58
peeled commit: 79fea1e1cad0c682c42539dd575370f3919f1d05
status: unchanged
```

## Seal scope

The exact seal delta is:

- `docs/release/PROGRAM_C_CORRECTIVE_RC3_REPORT.md`;
- `docs/release/PROGRAM_C_CORRECTIVE_RC3_EVIDENCE_INDEX.md`;
- this `docs/release/PROGRAM_C_CORRECTIVE_RC3_GIT_SEAL.md`.

The intended commit message is:

```text
release program c corrective rc3
```

The intended annotated tag is:

```text
v1.2.0-rc3-program-c-corrective
```

The exact seal commit resolver is:

```text
v1.2.0-rc3-program-c-corrective^{}
```

The resolver is intentionally relational. A Git commit hash is derived from
the tree and cannot truthfully be embedded in a file in that same tree without
changing the hash. Final local and live-remote command evidence must record the
resolved SHA and prove every equality below.

## Final verification contract

The seal is accepted only if all checks succeed:

1. verify the staged set is exactly the three release documents;
2. commit with no production or test delta in the seal commit;
3. push `stage/program-c-corrective-r1` without force;
4. create the annotated RC3 tag once and never move it;
5. push only the new RC3 tag without force;
6. prove local HEAD, tracking branch, and live remote branch are equal;
7. prove the local and live remote RC3 tag objects are equal;
8. prove both peeled RC3 tags equal the branch seal commit;
9. re-prove the RC2 tag object and peeled target are unchanged;
10. prove the working tree and index are clean after push;
11. prove the six frozen files have no diff from the fixed base;
12. do not merge or otherwise modify `main`.

Any failed equality blocks the release and forbids an accepted representation.
The executed post-commit/post-push Git state, reported with exact hashes, is
authoritative.

## Sealed verification state

```text
internal CTO = PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED
verify:personal-stable = 16/16 suites; 1848/1848 tests
true producer-chain browser = 17/17 scenarios
production fixture route = 0
app route selection / duplicate policy / persistence lifecycle = 0 / 0 / 0
duplicate transaction race = closed
Bridge formal writes = 0
wrong attachment / raw JSON / placeholder = 0 / 0 / 0
controlled-write bypass / Formal Admission bypass = 0 / 0
realApiCalled = false
frozen files modified = none
```

No independent RC3 audit or personal-stable promotion is performed by this
implementation session. The next authorized action is a fresh-session
independent RC3 audit.

`PROGRAM_C_CORRECTIVE_RC3_GIT_SEAL_ACCEPTED`
