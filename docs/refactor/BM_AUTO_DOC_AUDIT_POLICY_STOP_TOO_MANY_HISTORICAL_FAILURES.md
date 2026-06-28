# BM-AUTO Doc Audit Policy Stop Too Many Historical Failures

Stage: BM-AUTO-DOC-AUDIT-POLICY-STOP-TOO-MANY-HISTORICAL-FAILURES

Branch: main

## Reason

The updated doc audit policy still reports more than 50 failing documents.

Current failure count after policy implementation:

```text
63
```

The task explicitly says not to keep repairing indefinitely when failing documents exceed 50.

## Latest Clean Commit

```text
df3f50a4b6910d4772024af7c26cad5bc24f3308
```

Commit subject:

```text
stage BM-AUTO implement doc audit policy
```

## Dirty Files If Any

No dirty files before writing this STOP document.

## Failed Command

The audit command still fails:

```text
node scripts/bm-a4-doc-audit.js --json
```

The refreshed report is:

```text
docs/refactor/BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md
```

## Failure Inventory

Docs scanned: 155.

Failures before policy: 106.

Failures after policy: 63.

Failure classes still include:

- active residual campaign docs missing active Safety or Validation/Tests sections
- active doc-audit docs containing literal `backslash-n`
- historical documents with literal `backslash-n`
- historical documents with to-do markers
- historical documents with not-completed markers
- historical compressed documents below 10 physical lines
- historical documents missing Stage or historical note
- historical documents missing Decision or historical status

## Partial Results

Completed safely:

- Phase 0 preflight and baseline minimum
- Phase 1 doc audit failure inventory
- Phase 2 doc audit policy document
- Phase 3 doc audit policy implementation

Committed stages:

- `e61a681 stage BM-AUTO report doc audit failures`
- `0c0577a stage BM-AUTO define doc audit policy`
- `df3f50a stage BM-AUTO implement doc audit policy`

## What Was Safe

The doc audit tool now supports:

- active, historical, and archived policy classes
- `--json` machine-readable summary
- `--write-report` Markdown failure inventory
- per-file failure reasons
- non-zero exit on ordinary failure

The doc audit tests cover active, historical, archived, report, and JSON behavior.

All committed changes passed scoped `verify:diff-scope`.

## What Was Not Safe

It is not safe to continue bulk-editing historical documents in this task because the failure count remains above 50.

Doc audit cleanup is not accepted yet.

Residual final verification was not resumed.

Residual final verification document and campaign summary were not created.

## app.js Changed

No.

## qisi-utils.js Changed

No.

## Committed Changes Safe

Yes.

The committed changes are limited to:

- `scripts/bm-a4-doc-audit.js`
- `tests/qisi-app-display-cleaners-doc-audit.test.js`
- `docs/refactor/**`

No production behavior was changed.

## Local Snapshot

`.bm_a4_app_before.js` remains local, ignored through `.git/info/exclude`, not committed, and available for staged verifier use.

## Next Recommended Action

Create a follow-up task that explicitly authorizes a larger historical doc cleanup campaign, split into batches of at most 10 documents, starting from `docs/refactor/BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md`.
