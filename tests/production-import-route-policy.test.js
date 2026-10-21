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

test('explicit DOCX deterministic and PDF identities select one port; DOCX vision is retired', () => {
    for (const [producerMode, fileType] of [
        ['docx-deterministic', 'docx'],
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
    // 2026-10-22: the DOCX visual fallback is retired; Qwen OCR stays for screenshots only.
    assert.throws(
        () => select({
            producerMode: 'docx-vision',
            manifest: [source('question', 'docx', ['full'], 1)]
        }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_RETIRED' &&
            error.causeCode === 'docx-vision-retired'
    );
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
            producerMode: 'docx-deterministic',
            manifest: [source('question', 'docx', ['full'], 1)],
            availableCapabilities: {
                ...capabilities,
                docxDeterministic: false
            }
        }),
        error => error.code ===
            'PRODUCTION_IMPORT_PRODUCER_CAPABILITY_UNAVAILABLE'
    );
});

test('PDF support ambiguity is refused while separate answer and solution files are allowed', () => {
    // Two sources claiming the same role are ambiguous and must never be ordered by guesswork.
    for (const manifest of [
        [source('question', 'pdf', ['question'], 1),
            source('answer-a', 'pdf', ['answer'], 2),
            source('answer-b', 'pdf', ['answer'], 3)],
        [source('question', 'pdf', ['question'], 1),
            source('solution-a', 'pdf', ['solution'], 2),
            source('solution-b', 'pdf', ['solution'], 3)],
        [source('question', 'pdf', ['question'], 1),
            source('question-2', 'pdf', ['question'], 2)]
    ]) {
        assert.throws(
            () => select({ producerMode: 'pdf', manifest }),
            error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED' &&
                error.causeCode === 'pdf-support-source-ambiguous'
        );
    }
    // One question file plus one answer file plus one solution file is unambiguous.
    const route = select({
        producerMode: 'pdf',
        manifest: [
            source('question', 'pdf', ['question'], 1),
            source('answer', 'pdf', ['answer'], 2),
            source('solution', 'pdf', ['solution'], 3)
        ]
    });
    assert.equal(route.sourceIds.length, 3);
});


test('normal UI selects local DOCX XML and PDF automatically from declared file roles', () => {
    for (const [fileType, expected] of [['docx', 'docx-deterministic'], ['pdf', 'pdf']]) {
        for (const manifest of [
            [source('full', fileType, ['full'], 1)],
            [source('question', fileType, ['question'], 1),
             source('support', fileType, ['answer', 'solution'], 2),
             source('figure', 'image', ['supplemental_image'], 3)]
        ]) {
            const classification = Roles.classifySourceRoles(manifest);
            const mode = Policy.selectNormalUiProducerMode(classification);
            assert.equal(mode, expected);
            assert.equal(select({ producerMode: mode, manifest }).producerIdentity, expected);
        }
    }
});

test('normal UI does not invent a producer for mixed, unsupported, or questionless sources', () => {
    for (const manifest of [
        [source('question', 'docx', ['question'], 1), source('support', 'pdf', ['answer'], 2)],
        [source('text', 'text', ['full'], 1)],
        [source('support', 'docx', ['answer'], 1)]
    ]) {
        assert.throws(() => Policy.selectNormalUiProducerMode(Roles.classifySourceRoles(manifest)),
            error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED');
    }
});
