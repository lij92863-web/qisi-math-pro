# Program C Corrective Baseline R1

## Identity

```text
fixed audited base: 79fea1e1cad0c682c42539dd575370f3919f1d05
audit-record commit: feebd7cc5990405add842f537aa4a6676d061b52
corrective branch: stage/program-c-corrective-r1
old RC2 tag: v1.2.0-rc2-app-shell-slimming-r3
old RC2 tag object: 91c757c0c2d5d77d990e34de5f4bc93840363f58
old RC2 peeled commit: 79fea1e1cad0c682c42539dd575370f3919f1d05
```

The corrective branch was created from the exact audited base. The only files
present before branch creation were the three independent-audit records allowed
by the master task. They were committed separately before any test or production
change.

## Independent blockers preserved

```text
B-01 / PC-IA-R1-001
The normal-UI browser matrix can select a production Bridge fixture route that
returns prebuilt final candidates and bypasses the real producer/parser/PDF
projection/controlled-write chain.

B-02 / PC-IA-R1-002
app.js retains production route selection, duplicate admission policy, and
ReviewDraft persistence lifecycle business logic.
```

The prior decision remains historical fact:

```text
PROGRAM_C_INDEPENDENT_AUDIT_BLOCKED
```

## Exact baseline callsites

### Fixture production reachability

- `app.js:1879-1888`: constructs `createFixtureImportRunner` and reads
  `ImportAdapterRegistry`.
- `app.js:1944`: injects `runFixtureImport` into the production Bridge.
- `app.js:2017-2028`: app-local producer route resolution.
- `app.js:2055-2062`: registry presence becomes `testFixture=true` on the
  visible normal-UI command.
- `qisi-normal-ui-import-controller.js:46-77`: accepts `testFixture` and
  caller-supplied `producerRoute`, then calls Bridge in production mode.
- `qisi-production-import-bridge.js:159-172`: accepts caller route and fixture
  exception.
- `qisi-production-import-bridge.js:324-380`: final-candidate fixture runner.
- `qisi-production-import-bridge.js:504-526`: fixture bypass of production
  DOCX/PDF source execution.
- `qisi-production-import-bridge.js:883`: fixture runner is a public production
  export.
- `tests/e2e/production-normal-ui-import-cutover.test.js:33-75,202-209`:
  installs the registry and returns final candidates.
- `tests/e2e/production-cutover-fixtures.js:9-171`: constructs final DOCX/PDF
  candidates and PDF projection in test code.

### app.js B/C/D ownership

- B route selection: `app.js:2017-2028,2046-2062`.
- C duplicate/answer-conflict policy: `app.js:2621-2631,2680-2697`.
- D batch statistics and ReviewDraft write lifecycle:
  `app.js:2738-2767`.
- D dedupe reload/mutate/persist lifecycle: `app.js:2796-2843`.
- D display cleanup reload/mutate/persist lifecycle: `app.js:2854-2905`.
- D reviewed-batch loop and per-item submit orchestration:
  `app.js:2912-2920`.
- formal image payload and direct BatchFormalSubmit orchestration:
  `app.js:2640-2736`.

## Baseline tests

Command:

```text
npm.cmd run verify:safe
```

Result before corrective code:

```text
Node suites: 54
Node tests: 1631
passed: 1631
failed: 0
cancelled: 0
skipped: 0
todo: 0
Node duration_ms: 13027.0676
batch mock: 20/20 passed
verify:no-real-ai: passed
```

This green numerical baseline does not resolve either independent blocker.

## Red-first blocker reproduction

Command:

```text
node --test tests/production-graph-no-fixture-route.test.js tests/app-corrective-boundary.test.js tests/true-producer-browser-authenticity.test.js
```

Result before corrective implementation:

```text
tests: 9
passed: 0
failed: 9
cancelled: 0
skipped: 0
todo: 0
```

The failures independently pin the two audited defects: production fixture
reachability and retained B/C/D ownership in `app.js`. The browser-authenticity
failures also require real producer/parser/validation/draft-persistence stage
evidence rather than a prebuilt-candidate fixture.

## Frozen file SHA-256

```text
d50b59b8f0738aaf6ffdae10da414f6c3f0a55f780b9bd7e5a80c2affd78ea22  qisi-pdf-support-controlled-write.js
b640f9a475202617a320644b600b08a3c5569a6e2e637fa69edf0bb26a840155  qisi-pdf-support-aligner.js
2eecb7b941b51e844a1e960655d5456f2fb089887093b9946896ab82fba877ae  qisi-pdf-support-block-parser.js
a7cbfa7d78e2e370ef75212402e2ce1f9b2b9f9cdd3a00d2ae40ccc1e5eaf6f9  qisi-pdf-answer-only-extraction.js
eaed30b036936ef2ab2be601e3c65e8596d9280c7d9015f1a22b546f1b188f37  qisi-pdf-answer-extraction-quality.js
cc4849382c53036a243e07ac558c5287b3050c0f0557fe2642301d3b9fbe9a24  scripts/pdf-master-browser-runner.js
```

These files are read-only for the entire corrective task.

## No-real-AI baseline

```text
real AI/OCR calls: 0
verify:no-real-ai: passed
forbidden commands executed: none
PDF master runner real-run: not executed
```

Browser corrections must mock only the outer engine transport and must keep
`realApiCalled=false`.
