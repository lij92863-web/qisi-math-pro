const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Validation = require('../qisi-import-validation-service.js');
const ROOT = path.resolve(__dirname, '..');

const draft = (overrides = {}) => ({
    id: 'draft-1', questionNumber: '1', type: '单选题', stem: 'Stem',
    options: ['A1', 'B1', 'C1', 'D1'], answer: 'A', solution: 'Solution',
    images: [], warnings: [], source: { mode: 'docx-deterministic', sourceId: 'source-1' },
    fieldProvenance: { stem: { status: 'deterministic-source' } },
    ...overrides
});

const passingPorts = (calls = []) => ({
    context: { expectedQuestionNumbers: ['1'] },
    validateSequence(drafts, input) {
        calls.push(['sequence', drafts.length, input.context.expectedQuestionNumbers]);
        return { valid: true, errors: [], warnings: [] };
    },
    validateSchema(value, input) {
        calls.push(['schema', value.id, input.index]);
        return { valid: true, errors: [], warnings: [] };
    },
    validateOwnership(value, input) {
        calls.push(['ownership', value.id, input.index]);
        return { valid: true, errors: [], warnings: [] };
    },
    validateSafePartial(value, input) {
        calls.push(['safe-partial', value.id, input.index]);
        return { valid: true, errors: [], warnings: [] };
    },
    validateControlledWriteEvidence(value, input) {
        calls.push(['controlled-write', value.id, input.index]);
        return { valid: true, errors: [], warnings: [] };
    }
});

const productionDependencies = (overrides = {}) => ({
    supportAligner: {
        validatePdfSupportSequence: () => ({
            mode: 'full', safeQuestionNumbers: ['1']
        })
    },
    contracts: {
        createStructuredQuestionDraft: value => value,
        validateStructuredQuestionDraft: () => ({
            valid: true, errors: [], warnings: []
        })
    },
    reviewValidator: {
        validate: () => ({ valid: true, errors: [], warnings: [] })
    },
    safePartialPipeline: {
        assertSafePartialInvariants: () => true
    },
    ...overrides
});

test('composes sequence, schema, ownership, safe-partial, and controlled-write ports', () => {
    const calls = [];
    const input = [draft(), draft({ id: 'draft-2', questionNumber: '2' })];
    const snapshot = structuredClone(input);
    const result = Validation.validateImportDrafts(input, passingPorts(calls));

    assert.deepEqual(input, snapshot);
    assert.deepEqual(result, snapshot);
    assert.deepEqual(calls.map(call => call[0]), [
        'sequence',
        'schema', 'ownership', 'safe-partial', 'controlled-write',
        'schema', 'ownership', 'safe-partial', 'controlled-write'
    ]);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result[0]), true);
    assert.notEqual(result[0], input[0]);
});

test('rejected evidence can remain reviewable only when every injected port accepts it', () => {
    const rejected = draft({
        source: { mode: 'pdf-ai', sourceId: 'pdf-1' },
        supportLevel: 'prefix', manualReviewRequired: true,
        fieldProvenance: {
            answer: { status: 'rejected', reasonCode: 'ownership-rewind' },
            solution: { status: 'rejected', reasonCode: 'solution-ownership-rewind' }
        }
    });
    const result = Validation.validateImportDrafts([rejected], passingPorts());
    assert.deepEqual(result[0].fieldProvenance, rejected.fieldProvenance);
    assert.equal(result[0].manualReviewRequired, true);
});

test('a rejecting validator fails closed without leaking private messages', () => {
    const ports = passingPorts();
    ports.validateOwnership = () => ({
        valid: false,
        errors: [{ code: 'wrong-attachment', message: 'PRIVATE SOURCE CONTENT' }],
        warnings: []
    });
    assert.throws(
        () => Validation.validateImportDrafts([draft()], ports),
        error => {
            assert.equal(error.code, 'IMPORT_VALIDATION_REJECTED');
            assert.doesNotMatch(error.message, /PRIVATE SOURCE CONTENT/);
            assert.deepEqual(error.failures, [{
                stage: 'ownership', index: 0, code: 'wrong-attachment'
            }]);
            return true;
        }
    );
});

test('missing, throwing, and malformed validator ports have stable errors', () => {
    assert.throws(
        () => Validation.validateImportDrafts([draft()], {}),
        error => error.code === 'IMPORT_VALIDATOR_REQUIRED'
    );

    const throwing = passingPorts();
    throwing.validateSchema = () => { throw new Error('PRIVATE DRAFT'); };
    assert.throws(
        () => Validation.validateImportDrafts([draft()], throwing),
        error => error.code === 'IMPORT_VALIDATOR_FAILED' &&
            !/PRIVATE DRAFT/.test(error.message)
    );

    const malformed = passingPorts();
    malformed.validateSafePartial = () => ({ accepted: true });
    assert.throws(
        () => Validation.validateImportDrafts([draft()], malformed),
        error => error.code === 'IMPORT_VALIDATOR_MALFORMED'
    );
});

test('production policy owner preserves deterministic acceptance and PDF fail-closed evidence', () => {
    const ports = Validation.createProductionValidationPorts(
        productionDependencies()
    );
    const deterministic = Validation.validateImportDrafts([draft()], {
        ...ports,
        context: { files: [{ fileType: 'docx' }] }
    });
    assert.equal(deterministic.length, 1);

    const pdf = draft({
        source: { format: 'pdf', mode: 'pdf-ai', sourceId: 'pdf-1' },
        producer: { routeId: 'pdf-vision-controlled-write' },
        supportLevel: 'full',
        validation: {
            schemaValid: true,
            sequenceValid: true,
            ownershipValid: true
        }
    });
    assert.throws(
        () => Validation.validateImportDrafts([pdf], {
            ...ports,
            context: { files: [{ fileType: 'pdf' }] }
        }),
        error => error.code === 'IMPORT_VALIDATION_REJECTED' &&
            error.failures.some(failure =>
                failure.code === 'controlled-write-missing'
            )
    );
});

test('production policy owner requires every real validation dependency', () => {
    assert.throws(
        () => Validation.createProductionValidationPorts({}),
        error => error.code ===
            'IMPORT_PRODUCTION_VALIDATION_DEPENDENCY_REQUIRED'
    );
});

test('production path requires the service before review persistence', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const injectedPath = fs.readFileSync(path.join(ROOT, 'qisi-injected-import-path.js'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-import-validation-service.js'), 'utf8'
    );
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');

    assert.match(app, /Qisi\.ImportValidationService\.validateImportDrafts\s*\(/);
    assert.match(
        app,
        /Qisi\.ImportValidationService\.createProductionValidationPorts\s*\(/
    );
    assert.match(injectedPath, /validatedDrafts\s*=\s*validateDrafts\s*\(/);
    assert.ok(
        injectedPath.indexOf('validatedDrafts = validateDrafts') <
        injectedPath.indexOf('await persistDraftBatch')
    );
    assert.ok(html.indexOf('qisi-import-validation-service.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|fetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(implementation, /FormalAdmission|evaluateDraftAdmission/);
    assert.doesNotMatch(implementation, /saveQuestion|persistReviewDraftBatch|db\.|\.put\s*\(|\.add\s*\(/i);
    assert.doesNotMatch(
        app,
        /\.validatePdfSupportSequence\s*\(|\.validateStructuredQuestionDraft\s*\(|\.assertSafePartialInvariants\s*\(/
    );
    assert.doesNotMatch(app, /const\s+canonicalPdf\s*=|const\s+reviewablePartial\s*=/);
});
