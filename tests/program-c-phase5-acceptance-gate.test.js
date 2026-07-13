const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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

test('browser evidence uses normal UI entries and classifies deterministic DOCX honestly', () => {
    const docx = read('tests/e2e/docx-producer-identity-browser.test.js');
    const pdf = read('tests/e2e/pdf-projection-browser-shadow.test.js');

    assert.match(docx, /callProxy[\s\S]*'runBatchRecognition'/);
    assert.match(docx, /non-applicable-different-producers/);
    assert.match(pdf, /callProxy[\s\S]*'runBatchRecognition'/);
    assert.match(pdf, /pdf-normal-ui-full/);
    assert.match(pdf, /__phase5NormalUiPdfProjection/);
    assert.match(pdf, /non-applicable-no-normal-ui-deterministic-route/);
    assert.match(pdf, /Projection\.compareCanonicalPdfCandidates/);
});

test('PDF canonical comparator protects source, producer, route, provenance, and decisions', () => {
    const source = read('qisi-pdf-candidate-projection.js');
    const required = [
        'source.sourceId', 'source.format', 'source.sourceOrder',
        'producer.mode', 'producer.routeId', 'producer.routeReason',
        'producer.engine', 'route.identity', 'route.transitions',
        'fieldProvenance', 'producerBoundary',
        'controlledWrite.decisionId', 'acceptedFields', 'rejectedFields',
        'supportLevel', 'manualReviewRequired',
        'validation.schemaValid', 'validation.sequenceValid',
        'validation.ownershipValid', 'rawEvidenceRefs'
    ];
    for (const token of required) assert.match(source, new RegExp(token.replace('.', '\\.')));
});

test('Phase 5 leaves app owner wiring and all six frozen PDF files unchanged', () => {
    const frozen = [
        'app.js',
        'qisi-pdf-support-controlled-write.js',
        'qisi-pdf-support-aligner.js',
        'qisi-pdf-support-block-parser.js',
        'qisi-pdf-answer-only-extraction.js',
        'qisi-pdf-answer-extraction-quality.js',
        'scripts/pdf-master-browser-runner.js'
    ];
    const changed = execFileSync(
        'git',
        ['diff', '--name-only', BASELINE, '--', ...frozen],
        { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    assert.equal(changed, '');
});

test('Phase 5 browser and acceptance gates contain no hidden skip or todo', () => {
    const sources = [
        'tests/e2e/docx-producer-identity-browser.test.js',
        'tests/e2e/pdf-projection-browser-shadow.test.js',
        'tests/phase5-canonical-producer-comparator.test.js'
    ].map(read).join('\n');
    assert.doesNotMatch(sources, /\b(?:test|it)\.(?:skip|todo)\b/);
});

test('state accepts Phase 5 but requires a separate future C2-11 task', () => {
    const state = read('ai/APP_SHELL_SLIMMING_R3_STATE.md');
    assert.match(state, /Current phase: Program C \/ Phase 5 accepted/);
    assert.match(state, /Decision: `PHASE_5_ACCEPTED`/);
    assert.match(state, /C2-11 may be considered only in a new,[\s\S]*independent task/);
    assert.match(state, /Legacy remains the user-visible normal UI owner/);
    assert.match(state, /Bridge[\s\S]*remains shadow-only/);
});
