const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    createImportThroughUi,
    clearE2eData,
    readImportStageTrace
} = require('./browser-harness.js');
const { installMineruReplay } = require('../harness/mineru-replay.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
test('true dual PDF V2 directly structures and exact-key attaches support without a parser', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32313);
    try {
        await clearE2eData(harness.page);
        // IndexedDB file order is independent of upload order. Bind cached
        // evidence to exact source bytes, never to the first/second request.
        const item = text => ({ page_idx: 0, type: 'text', text });
        const engine = await installMineruReplay(harness.page, [
            { file: fixture('pdf-question.pdf'), items: [
                item('一、单项选择题'),
                item('1. Production question 1.\nA. First\nB. Second\nC. Third\nD. Fourth')
            ] },
            { file: fixture('pdf-solution.pdf'), items: [
                item('参考答案'), item('1【答案】A'),
                item('【解析】First is structured support.')
            ] }
        ]);
        const { batchId, snapshot } = await createImportThroughUi(
            harness.page,
            {
                producerMode: 'pdf',
                files: [
                    { file: fixture('pdf-question.pdf'), roles: ['question'] },
                    {
                        file: fixture('pdf-solution.pdf'),
                        roles: ['answer', 'solution']
                    }
                ]
            }
        );
        const drafts = snapshot.drafts.filter(item => item.batchId === batchId);
        assert.equal(drafts.length, 1, JSON.stringify(snapshot.batches));
        assert.equal(drafts[0].producer.routeId, 'pdf-mineru-v1');
        assert.equal(drafts[0].answer, 'A');
        assert.equal(drafts[0].fieldProvenance.answer.controlledWriteAccepted, false);
        assert.notEqual(drafts[0].fieldProvenance.answer.sourceId, drafts[0].source.sourceId);
        assert.equal(snapshot.questions.length, 0);
        const stages = (await readImportStageTrace(harness.page, batchId))
            .map(event => event.stage);
        assert.ok(stages.includes('pdf-mineru-contract-validated'));
        assert.equal(stages.includes('pdf-projection-entered'), false);
        assert.equal(stages.includes('parser-entered'), false);
        assert.equal(engine.calls.filter(endpoint => endpoint === '/api/mineru/parse').length, 2);
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }
});
