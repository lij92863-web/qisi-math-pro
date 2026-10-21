const test = require('node:test');
const assert = require('node:assert/strict');

const Contract = require('../qisi-pdf-mineru-contract.js');
const Policy = require('../qisi-review-draft-normalization-policy.js');

const stubPorts = () => ({
    choiceOptionIssue: () => '',
    solutionQualityIssue: () => '',
    attachSourceTraceToDraftQuestion: () => {},
    extractOptionsFromCurrentBlockOnly: () => [],
    normalizeQuestionType: value => value,
    choiceQuestionMissingOptions: () => false,
    countValidOptions: () => 0,
    addWarningOnce: () => {},
    batchDebugLog: () => {},
    toBatchDebugQuestion: () => ({}),
    getDefaultType: () => '',
    clock: () => 0
});

const mineruDraft = overrides => ({
    batchId: 'batch-1',
    questionNumber: '1',
    stem: '题干',
    options: ['A', 'B'],
    answer: 'A',
    solution: '',
    type: '单选题',
    images: [],
    status: 'pending',
    producer: { mode: 'vision-ai', routeId: Contract.PROTOCOL, routeReason: 'x', engine: 'mineru', deterministic: false },
    route: { identity: Contract.PROTOCOL },
    pdfReview: {
        protocol: Contract.PROTOCOL,
        examId: 'batch-1',
        taskProblems: [],
        taskIssuesAcknowledged: false,
        optionLabels: ['A', 'B'],
        candidates: { question: [], answer: [], solution: [] },
        sourcePageImages: []
    },
    warnings: [],
    ...overrides
});

test('a MinerU record is gated by its own protocol contract, not the DOCX path', () => {
    const policy = Policy.createReviewDraftNormalizationPolicy(stubPorts());
    const unowned = mineruDraft();
    unowned.pdfReview.taskProblems = ['q1: MINERU_UNASSIGNED'];
    assert.equal(
        policy.validateDraftContentForReview(unowned),
        '本任务存在未归属内容或未完成页，请先对照来源并确认本题范围。'
    );
    // The same draft under the DOCX path would only complain about the empty type.
    const docxDraft = mineruDraft({
        producer: { mode: 'deterministic-docx', routeId: 'legacy-docx-deterministic' },
        type: '',
        pdfReview: null
    });
    assert.equal(policy.validateDraftContentForReview(docxDraft), '题型为空，请先选择题型。');
});

test('an unconfirmed MinerU record reports its contract problems to the review list', () => {
    const policy = Policy.createReviewDraftNormalizationPolicy(stubPorts());
    const draft = mineruDraft({ type: '待确认' });
    const problems = policy.draftQuestionProblems(draft);
    assert.ok(problems.includes('请选择原卷题型。'), problems.join('\n'));
    draft.pdfReview.taskProblems = ['q1: MINERU_UNASSIGNED'];
    assert.ok(
        policy.draftQuestionProblems(draft).includes('本任务存在未归属内容或未完成页，请先对照来源并确认本题范围。')
    );
});

test('MinerU records are never rewritten by DOCX display normalization', () => {
    const policy = Policy.createReviewDraftNormalizationPolicy(stubPorts());
    const draft = mineruDraft({ stem: ' 间距不一致   的题干 ' });
    const before = draft.stem;
    assert.equal(policy.normalizeDraftQuestionBeforeSave(draft), false);
    assert.equal(draft.stem, before);
});
