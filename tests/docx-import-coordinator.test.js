const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Coordinator = require('../qisi-docx-import-coordinator.js');
const ROOT = path.resolve(__dirname, '..');

const context = () => ({
    batchId: 'batch-1',
    sources: [
        { id: 'late', fileType: 'docx', sourceOrder: 2, createdAt: 20 },
        { id: 'early', fileType: 'docx', sourceOrder: 1, createdAt: 10 }
    ]
});

test('runs DOCX sources in deterministic order and creates candidates with progress', async () => {
    const calls = [];
    const progress = [];
    const result = await Coordinator.runDocxImport(context(), {
        parseSource: async ({ source, candidateOffset }) => {
            calls.push([source.id, candidateOffset]);
            return {
                drafts: [{ id: `draft-${source.id}` }],
                draftImages: [{ id: `image-${source.id}` }],
                warnings: [`warning-${source.id}`]
            };
        },
        reportProgress: snapshot => { progress.push(snapshot.progress); }
    });

    assert.deepEqual(calls, [['early', 0], ['late', 1]]);
    assert.deepEqual(result.orderedSourceIds, ['early', 'late']);
    assert.deepEqual(result.drafts.map(draft => draft.id), ['draft-early', 'draft-late']);
    assert.deepEqual(result.candidates.map(candidate => [candidate.sourceId, candidate.candidateOrder]), [
        ['early', 1], ['late', 2]
    ]);
    assert.deepEqual(progress, [0, 50, 100]);
});

test('invalid or non-DOCX context fails closed', async () => {
    await assert.rejects(
        Coordinator.runDocxImport({ batchId: '', sources: [] }, { parseSource: async () => ({}) }),
        error => error.code === 'DOCX_COORDINATOR_INVALID_CONTEXT'
    );
    const invalid = context();
    invalid.sources[0].fileType = 'pdf';
    await assert.rejects(
        Coordinator.runDocxImport(invalid, { parseSource: async () => ({}) }),
        error => error.code === 'DOCX_COORDINATOR_NON_DOCX_SOURCE'
    );
});

test('cancellation stops before the next source and ignores the completed result', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(
        Coordinator.runDocxImport(context(), {
            parseSource: async () => {
                calls += 1;
                controller.abort();
                return { drafts: [{ id: 'late-result' }] };
            }
        }, controller.signal),
        error => error.code === 'DOCX_COORDINATOR_ABORTED'
    );
    assert.equal(calls, 1);
});

test('source failures are mapped without leaking their message', async () => {
    await assert.rejects(
        Coordinator.runDocxImport(context(), {
            parseSource: async () => {
                const error = new Error('private document text');
                error.code = 'IMPORTER_BROKEN';
                throw error;
            }
        }),
        error => {
            assert.equal(error.code, 'DOCX_COORDINATOR_SOURCE_FAILED');
            assert.equal(error.causeCode, 'IMPORTER_BROKEN');
            assert.equal(error.sourceId, 'early');
            assert.doesNotMatch(error.message, /private document text/);
            return true;
        }
    );
});

test('production V2 path uses the coordinator and the owner has no forbidden authority', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const implementation = fs.readFileSync(path.join(ROOT, 'qisi-docx-import-coordinator.js'), 'utf8');
    assert.match(app, /Qisi\.DocxImportCoordinator\.runDocxImport\s*\(/);
    assert.match(app, /Qisi\.ProductionDocxSourcePort\.parseDocxSource\s*\(/);
    assert.doesNotMatch(app, /QisiBatchImporter\.parseDocxFile\s*\(/);
    assert.match(app, /\{ \.\.\.helpers, baseOrder: candidateOffset, signal \}/);
    assert.ok(html.indexOf('qisi-docx-import-coordinator.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|\.put\s*\(|\.add\s*\(|\.delete\s*\(|\.transaction\s*\(/);
    assert.doesNotMatch(implementation, /pdf|ocr|vision|FormalAdmission|controlledWrite|saveQuestion/i);
});
