const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    installBrowserEngineInjection,
    createImportThroughUi,
    clearE2eData,
    readImportStageTrace
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
const questionEnvelope = {
    value: { questions: [{
        questionNumber: '1', type: '单选题',
        stem: 'True PDF safe-partial question.',
        options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
        answer: '', solution: '', images: [], isFragment: false,
        question_bbox: [0, 0, 1000, 1000]
    }] }
};

test('true PDF safe-partial is derived by projection and controlled-write', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32313);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [
                questionEnvelope,
                '1. 【答案】A\n【解析】First is controlled support.'
            ]
        });
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
        assert.equal(drafts.length, 1);
        assert.ok(['prefix', 'safe-partial'].includes(drafts[0].supportLevel));
        assert.equal(drafts[0].answer, 'A');
        assert.equal(drafts[0].controlledWrite.evaluated, true);
        assert.equal(drafts[0].validation.ownershipValid, true);
        assert.equal(snapshot.questions.length, 0);
        const stages = (await readImportStageTrace(harness.page, batchId))
            .map(event => event.stage);
        assert.ok(stages.includes('pdf-projection-entered'));
        assert.ok(stages.includes('controlled-write-evaluated'));
        assert.equal(engine.realApiCalled, false);
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }
});
