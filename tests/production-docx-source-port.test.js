const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Port = require('../qisi-production-docx-source-port.js');
const ROOT = path.resolve(__dirname, '..');

const source = () => ({
    id: 'docx-1', batchId: 'batch-1', fileType: 'docx',
    filename: 'questions.docx', roles: ['question']
});

test('parseDocxSource calls the importer once and preserves accepted output order', async () => {
    const calls = [];
    const rawDrafts = [
        { id: 'raw-1', stem: 'first', options: [] },
        { id: 'raw-empty', stem: '', options: [] },
        { id: 'raw-2', stem: '', options: ['option'] }
    ];
    const warning = { code: 'source-warning' };
    const result = await Port.parseDocxSource({
        source: source(), batch: { id: 'batch-1' }, defaultMeta: { grade: '高一' },
        importerHelpers: { marker: true }
    }, {
        importer: {
            parseDocxFile: async (file, context) => {
                calls.push({ file, context });
                return {
                    drafts: structuredClone(rawDrafts),
                    draftImages: [{ id: 'image-1' }],
                    unmatchedAnswers: [{ questionNumber: '3' }],
                    warnings: [warning]
                };
            }
        },
        convertDraft: (draft, index) => ({
            ...draft, order: index + 10, converted: true
        }),
        acceptDraft: draft => Boolean(
            String(draft.stem || '').trim() ||
            draft.options.some(option => String(option || '').trim())
        )
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].file.id, 'docx-1');
    assert.deepEqual(calls[0].context.defaultMeta, { grade: '高一' });
    assert.deepEqual(calls[0].context.helpers, { marker: true });
    assert.deepEqual(result.drafts.map(draft => draft.id), ['raw-1', 'raw-2']);
    assert.deepEqual(result.drafts.map(draft => draft.order), [10, 12]);
    assert.deepEqual(result.draftImages, [{ id: 'image-1' }]);
    assert.deepEqual(result.unmatchedAnswers, [{ questionNumber: '3' }]);
    assert.equal(result.warnings[0], warning);
});

test('projection and acceptance retain legacy Array callback coordinates', async () => {
    const coordinates = [];
    const result = await Port.parseDocxSource({ source: source() }, {
        importer: {
            parseDocxFile: async () => ({
                drafts: [{ id: 'first' }, { id: 'second' }]
            })
        },
        convertDraft(draft, index, rawDrafts) {
            coordinates.push(['convert', index, rawDrafts.length]);
            return { ...draft, index };
        },
        acceptDraft(draft, index, convertedDrafts) {
            coordinates.push(['accept', index, convertedDrafts.length]);
            return draft.id === 'second';
        }
    });
    assert.deepEqual(result.drafts.map(draft => draft.id), ['second']);
    assert.deepEqual(coordinates, [
        ['convert', 0, 2], ['convert', 1, 2],
        ['accept', 0, 2], ['accept', 1, 2]
    ]);
});

test('invalid source, missing ports, and malformed importer output fail closed', async () => {
    const validPorts = {
        importer: { parseDocxFile: async () => ({ drafts: [] }) },
        convertDraft: draft => draft,
        acceptDraft: () => true
    };
    await assert.rejects(
        Port.parseDocxSource({ source: { ...source(), fileType: 'pdf' } }, validPorts),
        error => error.code === 'DOCX_SOURCE_INVALID'
    );
    await assert.rejects(
        Port.parseDocxSource({ source: source() }, {}),
        error => error.code === 'DOCX_SOURCE_PORT_REQUIRED'
    );
    await assert.rejects(
        Port.parseDocxSource({ source: source() }, {
            ...validPorts, importer: { parseDocxFile: async () => null }
        }),
        error => error.code === 'DOCX_SOURCE_RESULT_MALFORMED'
    );
});

test('importer errors retain identity for coordinator mapping and legacy fallback', async () => {
    const stable = Object.assign(new Error('private DOCX content'), {
        code: 'DOCX_IMPORTER_FAILED'
    });
    await assert.rejects(
        Port.parseDocxSource({ source: source() }, {
            importer: { parseDocxFile: async () => { throw stable; } },
            convertDraft: draft => draft,
            acceptDraft: () => true
        }),
        error => error === stable
    );
});

test('cancellation stops before import and discards a late importer result', async () => {
    const before = new AbortController();
    before.abort();
    let called = false;
    await assert.rejects(
        Port.parseDocxSource({ source: source(), signal: before.signal }, {
            importer: { parseDocxFile: async () => { called = true; return { drafts: [] }; } },
            convertDraft: draft => draft,
            acceptDraft: () => true
        }),
        error => error.name === 'AbortError' && error.code === 'DOCX_SOURCE_ABORTED'
    );
    assert.equal(called, false);

    const after = new AbortController();
    await assert.rejects(
        Port.parseDocxSource({ source: source(), signal: after.signal }, {
            importer: {
                parseDocxFile: async () => {
                    after.abort();
                    return { drafts: [{ id: 'late', stem: 'late' }] };
                }
            },
            convertDraft: draft => draft,
            acceptDraft: () => true
        }),
        error => error.name === 'AbortError' && error.code === 'DOCX_SOURCE_ABORTED'
    );
});

test('caller policy can preserve a media-only deterministic draft', async () => {
    const result = await Port.parseDocxSource({ source: source() }, {
        importer: {
            parseDocxFile: async () => ({
                drafts: [{ id: 'media-only', stem: '', options: ['[[IMAGE:i1]]'] }]
            })
        },
        convertDraft: draft => draft,
        acceptDraft: draft => draft.options.some(option => option.includes('[[IMAGE:'))
    });
    assert.deepEqual(result.drafts.map(draft => draft.id), ['media-only']);
});

test('source port has no DB, UI, FormalAdmission, transport, OCR, or fallback owner', () => {
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-production-docx-source-port.js'), 'utf8'
    );
    assert.doesNotMatch(implementation, /indexedDB|Dexie|\.transaction\s*\(|\.update\s*\(/);
    assert.doesNotMatch(implementation, /document\.|AppProxy|FormalAdmission|\bfetch\s*\(/);
    assert.doesNotMatch(implementation, /InjectedImportTransport|\/api\/ai|controlledWrite/i);
    assert.doesNotMatch(implementation, /recognize|vision|ocr/i);
});

test('the remaining deterministic precursor uses the owner with no direct importer call in app', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const calls = app.match(/ProductionDocxSourcePort\.parseDocxSource\s*\(/g) || [];
    assert.equal(calls.length, 1);
    assert.doesNotMatch(app, /const\s+processDraftImportBatch\s*=/);
    assert.doesNotMatch(app, /QisiBatchImporter\.parseDocxFile\s*\(/);
});
