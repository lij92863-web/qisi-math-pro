const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const BlockParser = require('../qisi-pdf-support-block-parser.js');
const Aligner = require('../qisi-pdf-support-aligner.js');
const Projection = require('../qisi-pdf-candidate-projection.js');

const questionSource = {
    id: 'question-pdf', fileType: 'pdf', roles: ['question'], sourceOrder: 1
};
const draft = {
    id: 'ambiguity-draft-1', questionNumber: '1', type: 'solution',
    stem: 'Prove the source statement.', options: [], answer: '', solution: '',
    images: [], sourceQuestionFileId: 'question-pdf',
    sourceTrace: {
        sourceFileId: 'question-pdf', sourcePage: 1,
        sourceKind: 'textLayer', evidenceId: 'question-block-1'
    }
};

function engineResult(sourceIds) {
    return {
        drafts: [draft],
        evidences: sourceIds.map((sourceId, index) => ({
            id: `support-evidence-${index + 1}`,
            sourceFileId: sourceId,
            sourceFileName: `${sourceId}.pdf`,
            pageNo: 1,
            selectedSourceKind: 'textLayer',
            textLayer: '第1题\n答案：A\n解析：Because the evidence is valid.'
        }))
    };
}

test('one combined answer-solution support PDF keeps the existing context path', () => {
    const support = {
        id: 'combined-support', fileType: 'pdf',
        roles: ['answer', 'solution'], sourceOrder: 2
    };
    const context = Projection.createPdfEngineProjectionContext({
        sources: [questionSource, support],
        engineResult: engineResult([support.id]),
        controlledWriteOwner: ControlledWrite,
        blockParser: BlockParser,
        aligner: Aligner,
        decisionId: 'cw:single-support'
    });
    assert.equal(context.controlledWriteDecisions.length, 1);
    assert.equal(context.controlledWriteDecisionId, 'cw:single-support');
});

for (const fixture of [{
    name: 'two answer PDFs',
    supportSources: [{
        id: 'answer-a', fileType: 'pdf', roles: ['answer'], sourceOrder: 2
    }, {
        id: 'answer-b', fileType: 'pdf', roles: ['answer'], sourceOrder: 3
    }]
}, {
    name: 'separate answer and solution PDFs without a grouping contract',
    supportSources: [{
        id: 'answer-only', fileType: 'pdf', roles: ['answer'], sourceOrder: 2
    }, {
        id: 'solution-only', fileType: 'pdf', roles: ['solution'], sourceOrder: 3
    }]
}]) {
    test(`${fixture.name} fails before parser or controlled-write`, () => {
        const calls = { parserGate: 0, controlledWrite: 0 };
        const controlledWriteOwner = {
            buildPdfSupportParserGate() {
                calls.parserGate += 1;
                throw new Error('parser-must-not-run');
            },
            buildPdfSupportFieldLevelControlledWrite() {
                calls.controlledWrite += 1;
                throw new Error('controlled-write-must-not-run');
            }
        };
        assert.throws(
            () => Projection.createPdfEngineProjectionContext({
                sources: [questionSource, ...fixture.supportSources],
                engineResult: engineResult(
                    fixture.supportSources.map(source => source.id)
                ),
                controlledWriteOwner,
                blockParser: { parsePdfSupportBlocks() {} },
                aligner: { alignPdfSupport() {} }
            }),
            error => error.code === 'pdf-support-source-ambiguous'
        );
        assert.deepEqual(calls, { parserGate: 0, controlledWrite: 0 });
    });
}

