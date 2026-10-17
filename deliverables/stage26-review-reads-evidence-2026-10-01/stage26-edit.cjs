const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const evidence = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage26-review-reads';
const changes = [];
function edit(name, work) {
    const file = path.join(root, name);
    const before = fs.readFileSync(file, 'utf8');
    const backup = path.join(evidence, 'source-before', name);
    if (fs.existsSync(backup)) {
        changes.push({ name, before: crypto.createHash('sha256').update(fs.readFileSync(backup)).digest('hex'), after: crypto.createHash('sha256').update(before).digest('hex') });
        return;
    }
    const after = work(before.replace(/\r\n/g, '\n')).replace(/\n/g, before.includes('\r\n') ? '\r\n' : '\n');
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    if (fs.existsSync(backup)) throw new Error('Already edited: ' + name);
    fs.writeFileSync(backup, before);
    fs.writeFileSync(file, after);
    changes.push({ name, before: crypto.createHash('sha256').update(before).digest('hex'), after: crypto.createHash('sha256').update(after).digest('hex') });
}
function replace(text, oldText, newText) {
    if (text.split(oldText).length !== 2) throw new Error('Anchor count: ' + oldText.slice(0, 100));
    return text.replace(oldText, newText);
}
if (process.argv[2] === 'tests') {
    edit('tests/storage-repository.test.js', text => text + `
test('targeted review view uses one readonly transaction and only requested keys', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [{ id: 'b1' }],
        draftQuestions: [{ id: 'd1', batchId: 'b1', version: 1 }, { id: 'd2', batchId: 'b1' }],
        draftImages: [{ id: 'i1', batchId: 'b1', questionId: 'd1' }, { id: 'i2', batchId: 'b1', questionId: 'd2' }]
    });
    const reads = [];
    for (const name of ['draftImportBatches', 'draftQuestions']) {
        const table = database.table(name);
        const get = table.get.bind(table);
        table.get = async id => { reads.push([name, id]); return get(id); };
        table.toArray = () => { throw new Error('full table read'); };
    }
    database.table('draftImportFiles').where = () => { throw new Error('unused files'); };
    database.table('draftQuestions').where = () => { throw new Error('full batch questions'); };
    const imageTable = database.table('draftImages');
    const where = imageTable.where.bind(imageTable);
    imageTable.where = index => { reads.push(['draftImages', index]); return where(index); };
    const transactions = [];
    const transact = database.transaction.bind(database);
    database.transaction = (mode, ...args) => {
        transactions.push([mode, args.slice(0, -1).map(table => table.name)]);
        return transact(mode, ...args);
    };
    const repository = Storage.createRepository(database);
    const loaded = await repository.loadDraftReview('b1', 'd1');
    assert.deepEqual(transactions, [['r', ['draftImportBatches', 'draftQuestions', 'draftImages']]]);
    assert.deepEqual(reads, [['draftImportBatches', 'b1'], ['draftQuestions', 'd1'], ['draftImages', 'questionId']]);
    assert.equal(loaded.draft.id, 'd1');
    assert.deepEqual(loaded.images.map(row => row.id), ['i1']);
    loaded.draft.version = 99;
    assert.equal((await repository.loadDraftReview('b1', 'd1')).draft.version, 1);
    await database.table('draftQuestions').delete('d1');
    assert.equal((await repository.loadDraftReview('b1', 'd1')).draft, undefined);
});
`);
    edit('tests/draft-persistence-service.test.js', text => text + `
test('targeted review rejects cross-batch drafts and misbound image evidence', async () => {
    const valid = { batch: { id: 'b1' }, draft: { id: 'd1', batchId: 'b1', version: 1 }, images: [{ id: 'i1', batchId: 'b1', questionId: 'd1' }] };
    for (const loaded of [
        { ...valid, batch: { id: 'other' } },
        { ...valid, draft: { id: 'd1', batchId: 'other' } },
        { ...valid, draft: { id: 'other', batchId: 'b1' } },
        { ...valid, images: [{ id: 'i1', batchId: 'other', questionId: 'd1' }] },
        { ...valid, images: [{ id: 'i1', batchId: 'b1', questionId: 'other' }] }
    ]) {
        await assert.rejects(Persistence.reloadDraftReview('b1', 'd1', {
            loadDraftReview: async () => loaded
        }), error => error.code === 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
    }
    const result = await Persistence.reloadDraftReview('b1', 'd1', { loadDraftReview: async () => valid });
    result.draft.version = 2;
    assert.equal(valid.draft.version, 1);
});

test('targeted review preserves missing draft and normalizes missing batch/storage failure', async () => {
    const result = await Persistence.reloadDraftReview('b1', 'gone', {
        loadDraftReview: async () => ({ batch: { id: 'b1' }, draft: undefined, images: [] })
    });
    assert.equal(result.draft, undefined);
    await assert.rejects(Persistence.reloadDraftReview('b1', 'd1', {
        loadDraftReview: async () => ({ batch: undefined, draft: undefined, images: [] })
    }), error => error.code === 'DRAFT_BATCH_NOT_FOUND');
    await assert.rejects(Persistence.reloadDraftReview('b1', 'd1', {
        loadDraftReview: async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }
    }), error => error.code === 'DRAFT_PERSISTENCE_RELOAD_FAILED' && error.causeCode === 'AbortError');
});
`);
} else if (process.argv[2] === 'implementation') {
    edit('qisi-storage-repository.js', text => {
        text = replace(text, '        const loadDraftBatch = async batchId => ({', `        const loadDraftReview = (batchId, draftId) => transaction(
            ['draftImportBatches', 'draftQuestions', 'draftImages'],
            async () => ({
                batch: await get('draftImportBatches', batchId),
                draft: await get('draftQuestions', draftId),
                images: await findBy('draftImages', 'questionId', draftId)
            }),
            'r'
        );
        const loadDraftBatch = async batchId => ({`);
        return replace(text, '            loadDraftBatch, createDraftBatch, persistReviewDraftBatch,', '            loadDraftBatch, loadDraftReview, createDraftBatch, persistReviewDraftBatch,');
    });
    edit('qisi-draft-persistence-service.js', text => {
        text = replace(text, '    const validateAssociatedRows = (rows, batchId) => {', `    const reloadDraftReview = async (batchIdValue, draftIdValue, repository) => {
        requirePorts(repository, ['loadDraftReview']);
        const batchId = requireId(batchIdValue, 'DRAFT_BATCH_ID_REQUIRED');
        const draftId = requireId(draftIdValue);
        let loaded;
        try {
            loaded = await repository.loadDraftReview(batchId, draftId);
        } catch (error) {
            throw createError(
                'DRAFT_PERSISTENCE_RELOAD_FAILED',
                error?.code || error?.name || 'storage-failure'
            );
        }
        if (!loaded?.batch) throw createError('DRAFT_BATCH_NOT_FOUND');
        if (
            loaded.batch.id !== batchId ||
            (loaded.draft && (loaded.draft.id !== draftId || loaded.draft.batchId !== batchId)) ||
            !Array.isArray(loaded.images) ||
            loaded.images.some(row => row?.batchId !== batchId || row?.questionId !== draftId)
        ) {
            throw createError('DRAFT_PERSISTENCE_ASSOCIATION_INVALID');
        }
        return cloneValue(loaded);
    };

    const validateAssociatedRows = (rows, batchId) => {`);
        return replace(text, '        reloadDraftBatch,', '        reloadDraftBatch,\n        reloadDraftReview,');
    });
    edit('qisi-review-workflow-service.js', text => {
        text = replace(text, "            typeof persistence.reloadDraftBatch !== 'function' ||", "            typeof persistence.reloadDraftBatch !== 'function' ||\n            typeof persistence.reloadDraftReview !== 'function' ||");
        return replace(text, `            const loaded = await persistence.reloadDraftBatch(
                normalizedBatchId
            );
            assertActive(signal);
            const draft = loaded.questions.find(
                item => item.id === normalizedDraftId
            );`, `            const loaded = await persistence.reloadDraftReview(
                normalizedBatchId, normalizedDraftId
            );
            assertActive(signal);
            const draft = loaded.draft;`);
    });
    edit('app.js', text => replace(text, '                    deleteDraftBatch: (batchId, options) =>', `                    reloadDraftReview: (batchId, draftId) =>
                        Qisi.DraftPersistenceService.reloadDraftReview(
                            batchId, draftId, storageRepository
                        ),
                    deleteDraftBatch: (batchId, options) =>`));
    edit('main.html', text => {
        for (const name of ['qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-review-workflow-service.js', 'app.js']) {
            const pattern = new RegExp('(' + name.replaceAll('.', '\\.') + '\\?v=)[^" ]+');
            if (!pattern.test(text)) throw new Error('Cache anchor: ' + name);
            text = text.replace(pattern, '$1targeted-review-read-01');
        }
        return text;
    });
    edit('tests/review-workflow-service.test.js', text => {
        text = replace(text, '    const persistence = {\n        reloadDraftBatch: async () => clone(state),', `    const reads = { batch: 0, review: 0 };
    const persistence = {
        reloadDraftBatch: async () => { reads.batch += 1; return clone(state); },
        reloadDraftReview: async (_batchId, draftId) => {
            reads.review += 1;
            return clone({
                batch: state.batch,
                draft: state.questions.find(item => item.id === draftId),
                images: state.images.filter(item => item.questionId === draftId)
            });
        },`);
        text = replace(text, '    return { service, state: () => clone(state), formalCalls };', '    return { service, state: () => clone(state), formalCalls, reads };');
        text = replace(text, "    assert.equal(result.draft.version, 2);", "    assert.equal(result.draft.version, 2);\n    assert.deepEqual(harness.reads, { batch: 0, review: 2 });");
        return text + `
test('deleted draft is rejected before confirmation or formal submission', async () => {
    const harness = createHarness();
    for (const operation of ['confirmDraft', 'submitDraft']) {
        await assert.rejects(harness.service[operation]({
            batchId: 'batch-1', draftId: 'deleted-draft', expectedDraftVersion: 1
        }), error => error.code === 'REVIEW_WORKFLOW_DRAFT_NOT_FOUND');
    }
    assert.equal(harness.formalCalls.length, 0);
    assert.deepEqual(harness.reads, { batch: 0, review: 2 });
});
`;
    });
    edit('tests/reviewed-batch-submit-idempotency.test.js', text => replace(text, '        persistReviewDraftCommand: async () => {', `        reloadDraftReview: async (_batchId, draftId) => ({
            batch: { id: 'batch-1' }, images: [],
            draft: structuredClone(drafts.find(item => item.id === draftId))
        }),
        persistReviewDraftCommand: async () => {`));
} else throw new Error('Specify tests or implementation');
fs.writeFileSync(path.join(evidence, process.argv[2] + '-manifest.json'), JSON.stringify(changes, null, 2));
console.log(JSON.stringify({ phase: process.argv[2], files: changes.map(item => item.name) }));
