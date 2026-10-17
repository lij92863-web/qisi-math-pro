const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../qisi-pdf-multimodal-contract.js');
const I = require('../qisi-docx-producer-identity-contract.js');
const Policy = require('../qisi-formal-admission-policy.js');
const ReviewValidator = require('../qisi-production-review-validator.js');
const projectPdf = () => C.canonicalDraft(C.groupProposals([
    { field: 'question', item: { question_no: '1', type: 'single', stem: 'Canonical statement.', options: ['1','2','3','4'].map((text,i) => ({ label: 'ABCD'[i], text })), figures: [], source_pages: [1], status: 'complete', warnings: [] } },
    { field: 'answer', item: { question_no: '1', answer: 'A', figures: [], source_pages: [2], status: 'complete', warnings: [] } },
    { field: 'solution', item: { question_no: '1', solution: 'Source proof.', figures: [], source_pages: [2], status: 'complete', warnings: [] } }
].map(p => ({ ...p, source: { sourceId: 'pdf-source', format: 'pdf', filename: 'question.pdf', sourceOrder: 1 }, model: 'qwen3-vl-plus', evidence: [] })), 'exam')[0], { batchId: 'exam', now: 1, identityContract: I });

test('PDF V1 records source, vision producer, route and producer-time field evidence', () => {
    const q = projectPdf();
    assert.equal(q.source.format, 'pdf');
    assert.equal(q.producer.mode, 'vision-ai');
    assert.equal(q.producer.routeId, C.PROTOCOL);
    assert.equal(q.producer.deterministic, false);
    assert.equal(q.route.identity, C.PROTOCOL);
    assert.deepEqual(q.route.transitions, I.PDF_VISION_TRANSITIONS);
    for (const p of Object.values(q.fieldProvenance)) {
        assert.equal(p.sourceFormat, 'pdf'); assert.equal(p.producerMode, 'vision-ai');
        assert.equal(p.routeId, C.PROTOCOL); assert.equal(p.engine, 'qwen3-vl-plus');
        assert.equal(p.producerBoundary, 'pdf-vision-engine-output-to-candidate');
        assert.ok(p.contractVersion);
    }
});

test('legacy PDF producer identity cannot enter the V1 canonical pipeline', () => {
    const q = projectPdf();
    q.producer = { mode: 'deterministic-pdf', routeId: 'pdf-deterministic-import', deterministic: true };
    assert.throws(() => C.validateCanonical([q], 'exam', I), e => e.code === 'PDF_V1_SCHEMA_INVALID');
});

test('shared identity comparator detects changed PDF source, producer, route and field evidence', () => {
    const left = projectPdf();
    for (const [path, value] of [
        ['source.sourceId', 'wrong-source'], ['source.format', 'docx'], ['source.sourceOrder', 2],
        ['producer.mode', 'deterministic-pdf'], ['producer.routeId', 'wrong-route'], ['producer.routeReason', 'wrong-reason'], ['producer.engine', 'wrong-engine'],
        ['route.identity', 'wrong-route'], ['route.reason', 'wrong-reason'],
        ['fieldProvenance.stem.sourceFormat', 'docx'], ['fieldProvenance.stem.producerMode', 'deterministic-pdf'],
        ['fieldProvenance.stem.routeId', 'wrong-route'], ['fieldProvenance.stem.engine', 'wrong-engine'],
        ['fieldProvenance.stem.producerBoundary', 'post-hoc-review'], ['fieldProvenance.stem.controlledWriteDecisionId', 'wrong-decision']
    ]) {
        const right = structuredClone(left), keys = path.split('.'), last = keys.pop();
        let target = right; for (const key of keys) target = target[key]; target[last] = value;
        assert.ok(I.compareCanonicalDocxCandidates(left, right).some(d => d.path === '$.' + path), path);
    }
});

test('shared identity comparator ignores only declared volatile diagnostics', () => {
    const left = projectPdf(), right = structuredClone(left);
    left.diagnostics = { requestId: 'left', timestamp: 1, duration: 1, temporaryPath: 'left', randomDiagnosticId: 'left' };
    right.diagnostics = { requestId: 'right', timestamp: 2, duration: 2, temporaryPath: 'right', randomDiagnosticId: 'right' };
    assert.deepEqual(I.compareCanonicalDocxCandidates(left, right), []);
});

test('canonical PDF passes admission validation only with producer-time identity evidence', () => {
    const q = projectPdf();
    const validator = ReviewValidator.createProductionReviewValidator({ policy: Policy, clock: () => 0 });
    assert.equal(validator.validate(q).valid, true);
    const forged = structuredClone(q); delete forged.producer; delete forged.route;
    assert.equal(validator.validate(forged).valid, false);
});
