const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../qisi-storage-repository.js');
const Persistence = require('../qisi-draft-persistence-service.js');
const Maintenance = require('../qisi-draft-maintenance-service.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const draft = (id, extra = {}) => ({
    id, batchId: 'batch-1', version: 1, order: Number(id.split('-')[1]),
    questionNumber: Number(id.split('-')[1]), type: '单选题',
    options: ['A', 'B', 'C', 'D'], stem: '题干', answer: 'A', solution: '解析',
    status: 'pending', ...extra
});

// 真实仓储 + 真实持久化服务 + 真实维护服务，只把 IndexedDB 换成内存表。
// 这样测的是三层接起来之后的不变量，而不是某一层某个函数的实现细节。
const createStack = (questions = []) => {
    const database = new FakeDatabase({
        draftImportBatches: [{
            id: 'batch-1', status: 'review',
            draftPersistence: { version: 0, idempotencyKey: 'seed', signature: 'seed' }
        }],
        draftQuestions: questions,
        draftImages: questions.map(source => ({
            id: `image-${source.id}`, batchId: 'batch-1',
            questionId: source.id, status: 'assigned'
        })),
        draftImportFiles: [{ id: 'file-1', batchId: 'batch-1' }]
    });
    const repository = Storage.createRepository(database, { clock: () => 100 });
    const persistence = Object.fromEntries(
        ['reloadDraftBatch', 'persistReviewDraftBatch', 'refreshDraftBatchStats', 'deleteDraftBatch']
            .map(method => [method, (...args) => Persistence[method](...args, repository)])
    );
    const service = Maintenance.createDraftMaintenanceService({
        persistence,
        dedupeDrafts: value => ({ drafts: value, draftImages: [] }),
        countOptions: value => value.length,
        problemsForDraft: () => [],
        preserveRawEvidence: () => {},
        cleanDisplayFields: () => {},
        clock: () => 100
    });
    const rowOf = async id => (await repository.loadDraftBatch('batch-1'))
        .questions.find(row => row.id === id);
    const rawRowOf = async id => {
        const table = database.table('draftQuestions');
        return table.get(id);
    };
    const countOf = async () => (await repository.loadDraftBatch('batch-1'))
        .questions.filter(row => row.status === 'submitted').length;
    return { database, repository, service, rowOf, rawRowOf, countOf };
};

test('soft delete keeps the row, its credential, and a verifiable deletion record', async () => {
    const stack = createStack([
        draft('draft-1'),
        draft('draft-2', { status: 'submitted', submittedQuestionId: 'formal-2' })
    ]);

    const result = await stack.service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-2',
        reason: '页面里根本不存在的题', actorId: 'teacher-1'
    });

    // 墓碑不出现在可见集合里，但行还在库里。
    assert.equal(await stack.rowOf('draft-2'), undefined);
    const raw = await stack.rawRowOf('draft-2');
    assert.ok(raw, 'deleted draft row must survive in storage');
    assert.equal(raw.status, 'deleted');
    assert.equal(raw.deletedBy, 'teacher-1');
    assert.equal(raw.reason, '页面里根本不存在的题');
    assert.equal(raw.deletedAt, 100);
    // 凭证保留：这是回溯"这道题入库过"的唯一线索，也是重复提交去重的依据。
    assert.equal(raw.submittedQuestionId, 'formal-2');

    // 批次顶层审计与行状态同批落库。
    const batch = (await stack.repository.loadDraftBatch('batch-1')).batch;
    assert.equal(batch.deletedDrafts.length, 1);
    assert.deepEqual(batch.deletedDrafts[0], {
        draftId: 'draft-2',
        questionNumber: 2,
        submittedQuestionId: 'formal-2',
        reason: '页面里根本不存在的题',
        actorId: 'teacher-1',
        deletedAt: 100
    });
    // 版本与其它写入共用同一把锁、同一个计数器。
    assert.equal(batch.draftPersistence.version, result.version + 1);
    assert.equal(batch.draftPersistence.idempotencyKey,
        `maintenance:delete-draft:batch-1:draft-2:${result.version}`);
});

test('batch counts and formal admission statistics agree on the visible set', async () => {
    const stack = createStack([
        draft('draft-1'),
        draft('draft-2'),
        draft('draft-3', { status: 'submitted', submittedQuestionId: 'formal-3' }),
        draft('draft-4', { status: 'submitted', submittedQuestionId: 'formal-4' })
    ]);

    await stack.service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-4',
        reason: '乱码题', actorId: 'teacher-1'
    });

    const batch = (await stack.repository.loadDraftBatch('batch-1')).batch;
    // 三处口径必须一致：批次字段、countsFor 刷新结果、仓储按 status 统计。
    assert.equal(batch.submittedCount, 1);
    assert.equal(batch.totalCount, 3);
    const refreshed = await stack.service.refreshBatchStats({ batchId: 'batch-1' });
    assert.equal(refreshed.counts.submittedCount, 1);
    assert.equal(refreshed.readback.batch.submittedCount, 1);
    assert.equal(await stack.countOf(), 1);
});

test('batch audit is capped and says so instead of silently dropping entries', async () => {
    const questions = Array.from({ length: 52 }, (_, index) =>
        draft(`draft-${index + 1}`)
    );
    const stack = createStack(questions);

    let last = null;
    let firstOverflow = null;
    for (const source of questions) {
        last = await stack.service.deleteDraftQuestion({
            batchId: 'batch-1', draftId: source.id,
            reason: '批量清理', actorId: 'teacher-1'
        });
        if (last.droppedAuditCount && !firstOverflow) firstOverflow = last;
    }

    const batch = (await stack.repository.loadDraftBatch('batch-1')).batch;
    assert.equal(batch.deletedDrafts.length, 50);
    // 丢的是最旧的两条。每一次调用都报出自己挤掉了多少，不做静默截断。
    assert.equal(firstOverflow.droppedAuditCount, 1);
    assert.equal(last.droppedAuditCount, 1);
    assert.equal(batch.deletedDrafts.at(-1).draftId, 'draft-52');
    assert.ok(!batch.deletedDrafts.some(entry => entry.draftId === 'draft-1'));
    // 审计窗口滚动，行本身一条都不能少。
    assert.equal(
        (await stack.repository.loadDraftBatch('batch-1')).questions.length, 0
    );
    assert.equal(stack.database.table('draftQuestions').rows.size, 52);
});

test('the idempotency key carries the version, so a repeat is not silently dropped', async () => {
    const stack = createStack([draft('draft-1'), draft('draft-2')]);

    const first = await stack.service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-1',
        reason: '乱码题', actorId: 'teacher-1'
    });
    const firstBatch = (await stack.repository.loadDraftBatch('batch-1')).batch;

    // 同版本重复点删：目标行已不在可见集合里，必须明确失败而不是静默成功。
    await assert.rejects(
        stack.service.deleteDraftQuestion({
            batchId: 'batch-1', draftId: 'draft-1',
            reason: '乱码题', actorId: 'teacher-1'
        }),
        error => error.code === 'DRAFT_MAINTENANCE_DRAFT_NOT_FOUND'
    );

    // 换版本删另一道：是新的一次删除，不是被上一次的重放判定吞掉。
    const second = await stack.service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-2',
        reason: '重复题', actorId: 'teacher-1'
    });
    assert.equal(second.version, first.version + 1);
    const secondBatch = (await stack.repository.loadDraftBatch('batch-1')).batch;
    assert.notEqual(
        secondBatch.draftPersistence.idempotencyKey,
        firstBatch.draftPersistence.idempotencyKey
    );
    assert.equal(secondBatch.deletedDrafts.length, 2);
});

test('a deletion exemption is only honoured when the incoming row proves itself', async () => {
    const stack = createStack([
        draft('draft-1'),
        draft('draft-2', { status: 'submitted', submittedQuestionId: 'formal-2' })
    ]);
    const batch = { id: 'batch-1', draftPersistence: { version: 1 } };

    // 只在批次审计里写一条，行还是 submitted —— 凭证集合没变，写入本身合法，
    // 但这条审计指向一个不存在的墓碑行，必须被拦下。
    await assert.rejects(
        stack.repository.persistReviewDraftBatch({
            batch: {
                ...batch,
                deletedDrafts: [{
                    draftId: 'draft-2', questionNumber: 2,
                    submittedQuestionId: 'formal-2', reason: '伪造',
                    actorId: 'teacher-1', deletedAt: 100
                }]
            },
            drafts: [
                draft('draft-1'),
                draft('draft-2', { status: 'submitted', submittedQuestionId: 'formal-2' })
            ],
            images: [], expectedVersion: 0
        }),
        error => error.code === 'draft-tombstone-audit-orphaned' &&
            error.details.orphaned.includes('draft-2')
    );

    // 行标成 deleted 但没写 deletedBy / reason：自证不成立，不能借删除之名改凭证。
    for (const incomplete of [
        { deletedBy: '', reason: '乱码题' },
        { deletedBy: 'teacher-1', reason: '  ' },
        { deletedBy: 'teacher-1', reason: '乱码题', submittedQuestionId: 'formal-forged' }
    ]) {
        await assert.rejects(
            stack.repository.persistReviewDraftBatch({
                batch,
                drafts: [
                    draft('draft-1'),
                    draft('draft-2', {
                        status: 'deleted', deletedAt: 100, ...incomplete
                    })
                ],
                images: [], expectedVersion: 0
            }),
            error => error.code === 'draft-tombstone-uncontrolled' &&
                error.details.uncontrolled.includes('draft-2')
        );
    }

    // 行标成 deleted 但批次审计没跟上：删除必须一次写完。
    await assert.rejects(
        stack.repository.persistReviewDraftBatch({
            batch,
            drafts: [
                draft('draft-1'),
                draft('draft-2', {
                    status: 'deleted', deletedAt: 100,
                    deletedBy: 'teacher-1', reason: '乱码题',
                    submittedQuestionId: 'formal-2'
                })
            ],
            images: [], expectedVersion: 0
        }),
        error => error.code === 'draft-tombstone-unaudited' &&
            error.details.unaudited.includes('draft-2')
    );

    assert.equal((await stack.rawRowOf('draft-2')).status, 'submitted');
});

test('a tombstone survives every whole-batch rewrite and never comes back to life', async () => {
    const stack = createStack([draft('draft-1'), draft('draft-2')]);
    await stack.service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-2',
        reason: '乱码题', actorId: 'teacher-1'
    });

    // 去重 / 清理显示字段 / 统计刷新都按可见集合整批重写。三条路径都不许动墓碑。
    await stack.service.dedupeBatchDrafts({ batchId: 'batch-1', files: [] });
    await stack.service.cleanupDisplayFields({ batchId: 'batch-1' });
    await stack.service.refreshBatchStats({ batchId: 'batch-1' });
    const afterRewrites = await stack.rawRowOf('draft-2');
    assert.equal(afterRewrites.status, 'deleted');
    assert.equal(afterRewrites.reason, '乱码题');

    // 直接从写门提交一个把墓碑改回 pending 的整批重写：库里那份墓碑是事实，
    // 调用方说什么不算数。
    const batch = (await stack.repository.loadDraftBatch('batch-1')).batch;
    await stack.repository.persistReviewDraftBatch({
        batch: { ...batch, draftPersistence: { version: batch.draftPersistence.version } },
        drafts: [draft('draft-1'), draft('draft-2')],
        images: [], expectedVersion: batch.draftPersistence.version
    });
    const revived = await stack.rawRowOf('draft-2');
    assert.equal(revived.status, 'deleted');
    assert.equal(revived.deletedBy, 'teacher-1');

    // 墓碑连同它的图片都不许被整批 delete 物理抹掉。墓碑的图片对审核页不可见（挂在
    // 墓碑上），但证据必须留在库里。
    assert.equal((await stack.repository.loadDraftBatch('batch-1')).images.length, 0);
    assert.ok(stack.database.table('draftImages').rows.has('image-draft-2'));
});

test('a deleted draft cannot be submitted to the formal question bank', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [{
            id: 'batch-1', status: 'review', draftPersistence: { version: 0 }
        }],
        draftQuestions: [draft('draft-1')]
    });
    const repository = Storage.createRepository(database, {
        clock: () => 100,
        admission: {
            evaluateDraftAdmission: () => ({ accepted: true }),
            validateAdmissionDecision: () => ({ valid: true }),
            buildQuestionV2: () => ({}),
            validateQuestionV2: () => ({ valid: true })
        }
    });
    const persistence = Object.fromEntries(
        ['reloadDraftBatch', 'persistReviewDraftBatch', 'refreshDraftBatchStats', 'deleteDraftBatch']
            .map(method => [method, (...args) => Persistence[method](...args, repository)])
    );
    const service = Maintenance.createDraftMaintenanceService({
        persistence,
        dedupeDrafts: value => ({ drafts: value, draftImages: [] }),
        countOptions: value => value.length,
        problemsForDraft: () => [],
        preserveRawEvidence: () => {},
        cleanDisplayFields: () => {}
    });
    await service.deleteDraftQuestion({
        batchId: 'batch-1', draftId: 'draft-1',
        reason: '乱码题', actorId: 'teacher-1'
    });

    await assert.rejects(
        repository.confirmDraftToQuestion('draft-1', {}, {
            expectedDraftVersion: 1, requestId: 'req-1',
            idempotencyKey: 'key-1', actorId: 'teacher-1',
            questionId: 'formal-1', context: {}
        }),
        error => error.code === 'draft-deleted'
    );
    assert.equal(database.table('questions').rows.size, 0);
});
