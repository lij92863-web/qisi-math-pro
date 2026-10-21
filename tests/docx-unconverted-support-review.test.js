const test = require('node:test');
const assert = require('node:assert/strict');
const Validation = require('../qisi-import-validation-service');
const Policy = require('../qisi-formal-admission-policy');
const Identity = require('../qisi-docx-producer-identity-contract');
const review = require('../qisi-production-review-validator').createProductionReviewValidator({ policy: Policy });
const marker = '[DOCX不可显示图片:公式:synthetic-equation]';
const context = { files: [{ id: 'questions', fileType: 'docx' }, { id: 'support', fileType: 'docx' }] };
const ports = { ...Validation.createProductionValidationPorts({ reviewValidator: review }), context };

function candidate(number = '1', solution = 'Unconverted ' + marker, sourceId = 'support') {
    const base = Identity.projectDeterministicDocxCandidate({
        candidate: { id: 'draft-' + number, version: 1, questionNumber: number, type: '单选题',
            stem: 'Question ' + number, options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
            answer: 'A', solution: '', images: [], warnings: [] },
        source: { sourceId: 'questions', format: 'docx', filename: 'questions.docx' }
    });
    return Identity.applyDeterministicDocxSupportField({
        candidate: base, field: 'solution', support: { question: number, solution },
        source: { sourceId, format: 'docx', filename: sourceId + '.docx' }, roles: ['solution']
    });
}
const rejected = (row, selectedPorts = ports) => assert.throws(
    () => Validation.validateImportDrafts([row], selectedPorts), { code: 'IMPORT_VALIDATION_REJECTED' });

test('owned unconverted DOCX solution remains exact review evidence and remains formally rejected', () => {
    const row = candidate(), original = structuredClone(row);
    const saved = Validation.validateImportDrafts([row], ports)[0];
    assert.deepEqual(saved, original);
    assert.deepEqual(row, original);
    assert.equal(Object.isFrozen(saved), true);
    assert.match(saved.solution, /DOCX不可显示图片/);
    assert.equal(saved.supportEvidence.solution.state, 'unique');
    assert.equal(saved.fieldProvenance.solution.status, 'deterministic-source');
    const decision = review.validate(saved);
    assert.equal(decision.valid, false);
    assert.equal(decision.admissionDecision.accepted, false);
    assert.ok(decision.errors.some(error => error.code === 'admission-field-rejected' && error.field === 'solution'));
});

test('a problem solution does not block a clean neighbouring question or require a second source', () => {
    const problematic = candidate('1', 'Original ' + marker, 'questions');
    const clean = candidate('2', 'Clean solution');
    const saved = Validation.validateImportDrafts([problematic, clean], ports);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].solution, problematic.solution);
    assert.equal(review.validate(saved[0]).valid, false);
    assert.equal(review.validate(saved[1]).valid, true);
});

test('empty, conflicting, altered or foreign solution evidence cannot obtain review acceptance', () => {
    for (const mutate of [
        row => { row.supportEvidence.solution.declarations = []; },
        row => { row.supportEvidence.solution.state = 'conflict'; },
        row => { row.supportEvidence.solution.value = 'different'; },
        row => { row.supportEvidence.solution.values.push('different'); },
        row => { row.supportEvidence.solution.declarations[0].value = 'different'; },
        row => { row.supportEvidence.solution.declarations[0].sourceId = 'foreign'; },
        row => { row.supportSources[0].roles = ['answer']; },
        row => { row.solution += ' altered after the evidence was recorded'; }
    ]) {
        const row = structuredClone(candidate()); mutate(row); rejected(row);
    }
    rejected(candidate(), { ...ports, context: { files: [{ id: 'questions', fileType: 'docx' }] } });
});

test('manual, rejected, vision and PDF provenance cannot use the DOCX solution exception', () => {
    for (const mutate of [
        row => { row.fieldProvenance.solution.kind = row.fieldProvenance.solution.status = 'manual'; row.fieldProvenance.solution.manualEditRevision = 1; },
        row => { row.fieldProvenance.solution.kind = row.fieldProvenance.solution.status = 'rejected'; },
        row => { row.fieldProvenance.solution.reasonCode = 'other-rejection'; },
        row => { row.producer.mode = 'vision-ai'; row.producer.routeId = 'docx-rendered-to-pdf-vision'; },
        row => { row.source.format = 'pdf'; row.producer.routeId = 'pdf-mineru-v1'; }
    ]) {
        const row = structuredClone(candidate()); mutate(row); rejected(row);
    }
});

test('unconverted stem, options or answer errors still reject the import even with a reviewable solution', () => {
    for (const field of ['stem', 'options', 'answer']) {
        const row = structuredClone(candidate());
        if (field === 'options') row.options[0] += marker; else row[field] += marker;
        rejected(row);
    }
});

test('an unrelated validator error cannot be hidden alongside an unconverted solution', () => {
    const selectedPorts = { ...Validation.createProductionValidationPorts({ reviewValidator: {
        validate: row => review.validate(row, { baseErrors: [{ code: 'review-manual-state-invalid', field: 'answer' }] })
    } }), context };
    rejected(candidate(), selectedPorts);
});
