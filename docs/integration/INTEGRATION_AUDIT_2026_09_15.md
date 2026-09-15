# Integration audit — hardening branch against `origin/main` (2026-09-15)

Two lines diverged from the common ancestor `da699b5`:

| line | commits since the ancestor | what it carries |
| --- | --- | --- |
| `codex/app-refactor-master-plan-r1` (hardening) | 89 | handout/Typst program (H1–H9), import reliability, the 2026-09-15 hardening pass |
| `origin/main` | 80 | the closure/post-R2 architecture: `qisi-storage-repository.js`, `qisi-formal-admission-policy.js`, `qisi-batch-formal-submit.js`, `qisi-production-review-validator.js`, `qisi-recognition-contracts.js`, OCR quality work |

401 files changed on the hardening line, 216 on main, and **12 files were changed on both**:
`.gitignore`, `app.js`, `main.html`, `package.json`, `qisi-backup.js`, `qisi-batch-importer.js`,
`qisi-db.js`, `qisi-local-server.js`, `qisi-support-repair.js`, `qisi-utils.js`,
`tests/qisi-utils-find-node.test.js`, `tests/support-repair.test.js`.

Because the two lines carry different architectures, this audit works on
`codex/integration-main-hardening`, **branched from `origin/main`**. Main was not modified and
nothing was merged into it.

## 1. Main-only mechanisms that must survive any integration

Verified present on `origin/main` and absent from the hardening line (which predates them):

```text
qisi-storage-repository.js           Qisi.StorageRepository
qisi-formal-admission-policy.js      Qisi.FormalAdmissionPolicy (evaluateDraftAdmission, buildQuestionV2)
qisi-batch-formal-submit.js          Qisi.BatchFormalSubmit (idempotency key, draft version, manual provenance)
qisi-production-review-validator.js  ProductionReviewValidator
qisi-recognition-contracts.js        recognition candidate / structured draft / question v2 validation
tests/e2e/true-import-*.test.js      real DOCX/PDF import reaching admitted question v2
```

The QuestionV2 admission transaction, draft versioning, idempotency and field provenance are
therefore treated as the base contract of the integration branch; nothing in this audit replaces
them. The hardening line's own final gate (`qisi-batch-final-gate.js`) does not exist on main and
was **not** ported; main's equivalent logic lives in `app.js` and was fixed in place.

## 2. The final gate merged answers and solutions by quality, which is fail-open

Found in `app.js` (`batchFinalGateMergeCandidateIntoBest`), used when the final gate collapses
several candidates for the same source file and question number:

```js
merged.stem     = batchFinalGateBetterText(best.stem, other.stem);
merged.answer   = batchFinalGateBetterText(best.answer, other.answer);    // picks one
merged.solution = batchFinalGateBetterText(best.solution, other.solution); // picks the longer
```

The same class of defect existed at the second merge site, `mergeQuestionItemsWithFallback`
(primary recognition merged with its text-layer/visual fallback):

```js
const mergedAnswer   = itemAnswer || fallbackAnswer || '';                   // picks the primary
const mergedSolution = longer(fallbackSolution, itemSolution);              // picks the longer
```

Both are now resolved by one contract, `qisi-batch-candidate-merge.js`:

1. presentation fields (stem, options) may still be taken from the better candidate, and each
   field's provenance follows the candidate the value actually came from;
2. two non-empty answers that differ after normalisation are **not** resolved: the field is cleared
   and recorded as an `answerConflict` with both candidate values and both candidate traces;
3. two non-empty solutions that differ after normalisation are treated the same way, so length and
   LaTeX-signal count can no longer choose one;
4. the conflicted field's provenance is `{ status: 'rejected', reasonCode: 'candidate-conflict' }`,
   which `Qisi.FormalAdmissionPolicy` rejects with `admission-field-rejected`, so reviewed → formal
   admission is blocked until a teacher edits the field (which records manual provenance);
5. both candidates stay auditable: `sourceTrace.duplicateMergedFrom` plus
   `sourceTrace.mergedCandidates` keeps each candidate's trace, and `fieldConflicts` keeps the two
   disagreeing values with their source and score;
6. `duplicateStatus = 'answerConflict'` makes the review page list it ("重复或答案冲突需要确认");
7. a field taken from the other candidate no longer inherits the best candidate's provenance: the
   stale entry is removed instead.

## 3. Loopback / local-origin server protection

`origin/main` served the local API with `cors({ origin: true, credentials: false })` and
`app.listen(PORT)`, i.e. any page in the browser could call the AI proxy and file APIs, and the
listener was reachable from the network. The hardening line's protection was ported, keeping main's
routes, temp-job manager and secure logger untouched:

- `HOST` defaults to `127.0.0.1` and the listener binds it explicitly;
- `isAllowedLocalOrigin` accepts only `http://localhost|127.0.0.1|[::1]:<own port>` (no credentials,
  query, hash or path) and refuses everything else with `403 ORIGIN_NOT_ALLOWED`;
- CORS headers are only echoed for the allowed origin; a preflight from a foreign origin is refused;
- the unused `cors` dependency import was removed, and the server now exports its guards and starts
  only under `require.main === module`, so tests can exercise it without starting a service.

Evidence: `tests/local-server-origin-guard.test.js` — own origin and no-origin requests succeed, four
foreign origins and a foreign preflight are refused with `ORIGIN_NOT_ALLOWED`, and the port is not
reachable through the machine's network interface.

## 4. Gates on the integration branch

```text
npm run verify:safe          1253 tests, 1253 passed, 0 failed, 0 skipped
npm run smoke:batch:mock     20/20
npm run verify:no-real-ai    passed
npm run verify:docx-stable   20/20 passed
npm run verify:pdf-known-bad 65/65 passed
npm run verify:batch-safety  passed
```

New deterministic regressions: `tests/batch-candidate-merge-conflict.test.js` (8 cases, including
candidate A answer=B against candidate B answer=C) and `tests/local-server-origin-guard.test.js`.

### Environment note

nine `tests/e2e/*` browser tests failed at first **before this audit changed anything**: the offline
asset cache the harness serves CDN files from (`local-run-artifacts/r2-e2e-cdn-cache`) was empty, so
Tailwind/KaTeX/Vue never loaded. Proof: the same test failed identically with the unmodified server
file. The cache was then populated (CDN assets plus the fonts their CSS references), after which the
whole suite, including the true-import end-to-end tests, passes. The cache lives in an ignored local
directory; no repository file depends on it.

## 5. Not done, and why

- The hardening line itself still contains its own `qisi-batch-final-gate.js` with the same
  fail-open merge. It is **not** part of main's architecture, and this audit did not merge the two
  lines; the fix here is main-shaped. Bringing the hardening line to the same rule is a follow-up on
  that branch, not a change to main.
- The 12 shared files were not merged in this audit; a real integration would have to reconcile
  `app.js`, `qisi-local-server.js` and `qisi-utils.js` function by function, which the owner asked
  not to do inside this step.
