const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-production-import-route-policy.js');
const Roles = require('../qisi-source-role-classifier.js');

const capabilities = Object.freeze({
    docxDeterministic: true,
    docxVision: true,
    pdf: true
});

const source = (id, fileType, roles, sourceOrder, producerMode = '') => ({
    id,
    fileType,
    roles,
    sourceOrder,
    producerMode
});

function select({ producerMode, manifest, availableCapabilities = capabilities }) {
    const classification = Roles.classifySourceRoles(manifest);
    return Policy.resolveProductionImportRoute({
        batch: { id: 'batch-1', producerMode },
        batchContext: { batchMetadata: { producerMode } },
        sourceManifest: manifest,
        classification,
        availableCapabilities
    });
}

test('explicit DOCX deterministic, DOCX vision, and PDF identities select one port', () => {
    for (const [producerMode, fileType] of [
        ['docx-deterministic', 'docx'],
        ['docx-vision', 'docx'],
        ['pdf', 'pdf']
    ]) {
        const result = select({
            producerMode,
            manifest: [source('question', fileType, ['full'], 1)]
        });
        assert.equal(result.route, fileType);
        assert.equal(result.producerIdentity, producerMode);
        assert.deepEqual(result.sourceIds, ['question']);
    }
});

test('mixed and unsupported sources fail before producer selection', () => {
    assert.throws(
        () => select({
            producerMode: 'pdf',
            manifest: [
                source('question', 'docx', ['question'], 1),
                source('answer', 'pdf', ['answer'], 2)
            ]
        }),
        error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED' &&
            error.causeCode === 'mixed-or-unsupported-source'
    );
    assert.throws(
        () => select({
            producerMode: 'pdf',
            manifest: [source('question', 'text', ['full'], 1)]
        }),
        error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED'
    );
});

test('missing, unknown, and incompatible producer identity fail closed', () => {
    const manifest = [source('question', 'docx', ['full'], 1)];
    assert.throws(
        () => select({ producerMode: '', manifest }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_IDENTITY_REQUIRED'
    );
    assert.throws(
        () => select({ producerMode: 'fixture', manifest }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_IDENTITY_UNSUPPORTED'
    );
    assert.throws(
        () => select({ producerMode: 'pdf', manifest }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_IDENTITY_MISMATCH'
    );
});

test('batch and source producer identities cannot conflict', () => {
    assert.throws(
        () => select({
            producerMode: 'docx-vision',
            manifest: [source(
                'question', 'docx', ['full'], 1, 'docx-deterministic'
            )]
        }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_IDENTITY_MISMATCH' &&
            error.causeCode === 'batch-source-producer-identity-conflict'
    );
});

test('unavailable capability has no catch fallback to another producer', () => {
    assert.throws(
        () => select({
            producerMode: 'docx-vision',
            manifest: [source('question', 'docx', ['full'], 1)],
            availableCapabilities: {
                ...capabilities,
                docxVision: false
            }
        }),
        error => error.code ===
            'PRODUCTION_IMPORT_PRODUCER_CAPABILITY_UNAVAILABLE'
    );
});

test('PDF support ambiguity remains fail closed in the route owner', () => {
    assert.throws(
        () => select({
            producerMode: 'pdf',
            manifest: [
                source('question', 'pdf', ['question'], 1),
                source('answer', 'pdf', ['answer'], 2),
                source('solution', 'pdf', ['solution'], 3)
            ]
        }),
        error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED' &&
            error.causeCode === 'pdf-support-source-ambiguous'
    );
});
