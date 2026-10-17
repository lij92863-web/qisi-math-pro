const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyFrozenPdfFiles } = require('../scripts/verify-frozen-pdf-files.js');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '84e1b8a70f8a927345b8b3f55189585ec61d37ec';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Phase 5 release, benchmark, and internal CTO reports record an unqualified acceptance', () => {
    const release = read(
        'docs/release/PROGRAM_C_PHASE5_REAL_BROWSER_SHADOW_EQUIVALENCE_R3.md'
    );
    const benchmark = read('docs/benchmark/IMPORT_SHADOW_EQUIVALENCE_R3.md');
    const cto = read('docs/audit/PROGRAM_C_PHASE5_INTERNAL_CTO_REVIEW_R3.md');

    assert.match(release, /`PHASE_5_ACCEPTED`/);
    assert.match(release, new RegExp(BASELINE));
    assert.match(release, /bba2fc48840fb8d11968b5fa86a820f51a6464f4/);
    assert.match(benchmark, /Same-producer canonical differences \| 0/);
    assert.match(benchmark, /Different-producer false equivalence \| 0/);
    assert.match(cto, /internal CTO acceptance review/i);
    assert.match(
        cto,
        /not represented as an[\s\S]*independent external audit/i
    );
    assert.doesNotMatch(release + cto, /ACCEPTED_WITH_LIMITATIONS/);
});

test('current browser evidence uses real files and the normal UI production entry', () => {
    const docx = read('tests/e2e/docx-producer-identity-browser.test.js');
    const pdf = read('tests/e2e/pdf-projection-browser-shadow.test.js');

    assert.match(docx, /createImportThroughUi/);
    assert.match(docx, /docx-vision\.docx/);
    assert.match(docx, /docx-question\.docx/);
    assert.match(docx, /installBrowserEngineInjection/);
    assert.match(docx, /non-applicable-different-producers/);
    assert.match(pdf, /createImportThroughUi/);
    assert.match(pdf, /pdf-question\.pdf/);
    assert.match(pdf, /installBrowserEngineInjection/);
    assert.match(pdf, /pdf-projection-entered/);
    assert.match(pdf, /controlled-write-evaluated/);
    assert.doesNotMatch(docx + pdf, /prebuiltCandidates|finalCandidates/);
});

test('current PDF contract retains source, producer, provenance and exact identity boundaries', () => {
    const source = read('qisi-pdf-multimodal-contract.js');
    const required = [
        'source.sourceId', 'producer.engine',
        'fieldProvenance', 'producerBoundary',
        'controlledWriteDecisionId', 'controlledWriteAccepted',
        'validateCanonicalIdentity', 'questionKey(batchId, draft.questionNumber)',
        'draft.pdfV1.examId === batchId'
    ];
    for (const token of required) assert.ok(source.includes(token), token);
});

test('Phase 5 frozen PDF files match baseline or exact user-approved repairs', () => {
    const frozen = [
        'qisi-pdf-support-controlled-write.js',
        'qisi-pdf-support-aligner.js',
        'qisi-pdf-support-block-parser.js',
        'qisi-pdf-answer-only-extraction.js',
        'qisi-pdf-answer-extraction-quality.js',
        'scripts/pdf-master-browser-runner.js'
    ];
    // User approved exact N1/N2/D-1 repairs on 2026-10-01, not a blanket freeze exemption.
    assert.deepEqual(verifyFrozenPdfFiles(frozen, BASELINE), []);
});

test('Phase 5 browser and acceptance gates contain no hidden skip or todo', () => {
    const sources = [
        'tests/e2e/docx-producer-identity-browser.test.js',
        'tests/e2e/pdf-projection-browser-shadow.test.js',
        'tests/phase5-canonical-producer-comparator.test.js'
    ].map(read).join('\n');
    assert.doesNotMatch(sources, /\b(?:test|it)\.(?:skip|todo)\b/);
});

test('state preserves Phase 5 acceptance and records the later C2-11 cutover', () => {
    const state = read('ai/APP_SHELL_SLIMMING_R3_STATE.md');
    assert.match(state, /Current phase: Program C \/ C2-11 accepted/);
    assert.match(state, /Decision: `PHASE_5_ACCEPTED`/);
    assert.match(
        state,
        /Decision: `C2_11_LEGACY_BATCH_OWNER_RETIREMENT_ACCEPTED`/
    );
    assert.match(state, /normal UI now calls `NormalUiImportController`/);
    assert.match(state, /2,495-line baseline `processDraftImportBatch` owner[\s\S]*removed/);
    assert.match(state, /C2-12 may begin as[\s\S]*next independent stage only/);
});
