# EOL Policy Audit R2

## Current configuration

- `core.autocrlf=true` from system Git config.
- `core.eol` unset.
- `core.filemode=false` in repository config.
- `core.ignorecase=true`.
- `.gitattributes` absent.
- Git LFS filters exist globally, but no repository attributes select them.

## Tracked EOL census

| Index/worktree | Count |
|---|---:|
| LF / LF | 323 |
| LF / CRLF | 123 |
| LF / mixed | 5 |
| binary / binary | 3 |

Mixed worktree files:

- `app.css`
- `docs/testing/PDF_SUPPORT_ANSWER_MISSING_8_9_REPORT.md`
- `qisi-batch-importer.js`
- `qisi-db.js`
- `qisi-pdf-support-aligner.js`

By relevant type:

- JS: 125 total; 103 CRLF, 19 LF, 3 mixed.
- JSON: 2 CRLF.
- Markdown: 315 total; 300 LF, 14 CRLF, 1 mixed.
- HTML: 1 CRLF.
- CSS: 1 mixed.
- CMD: `open-app.cmd` currently LF.
- PowerShell: 3 files, all CRLF.
- Binary: `1.docx`, `page-1.png`, `test.pdf`.

## Dry-run decision

`git add --renormalize -n -- .` proposed entries across essentially the full 454-file tracked corpus. This is a broad, unrelated diff and triggers the R2 rule to avoid in-task EOL migration.

Decision:

- Do not add `.gitattributes` in Phase 0.5.
- Do not renormalize tracked files.
- Do not modify `core.autocrlf`.
- Preserve the clean index established by Recovery Task 2.
- Schedule a standalone REPOSITORY EOL POLICY AUDIT migration after release closure, with a dedicated diff review and commit.

Recommended future policy remains the R2 proposal: LF for JS/JSON/MD/HTML/CSS/YAML/sh/py, CRLF for bat/cmd/ps1, explicit binary extensions.
