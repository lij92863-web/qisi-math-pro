const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const reviewState = require('../qisi-review-draft-state.js');

const {
    buildBatchRecognitionSummary,
    buildDraftEditorProjection,
    buildDraftQuestionProblems,
    draftHasImageToken,
    filterDraftQuestions
} = reviewState;

const ROOT = path.join(__dirname, '..');

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

test('review projection API remains available in Node and the browser namespace', () => {
    assert.equal(typeof buildBatchRecognitionSummary, 'function');
    assert.equal(typeof buildDraftEditorProjection, 'function');
    assert.equal(typeof buildDraftQuestionProblems, 'function');
    assert.equal(typeof draftHasImageToken, 'function');
    assert.equal(typeof filterDraftQuestions, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-review-draft-state.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);

    assert.equal(typeof context.Qisi.ReviewDraftState.buildBatchRecognitionSummary, 'function');
    assert.equal(typeof context.Qisi.ReviewDraftState.buildDraftEditorProjection, 'function');
    assert.equal(typeof context.Qisi.ReviewDraftState.buildDraftQuestionProblems, 'function');
    assert.equal(typeof context.Qisi.ReviewDraftState.draftHasImageToken, 'function');
    assert.equal(typeof context.Qisi.ReviewDraftState.filterDraftQuestions, 'function');
});

test('editor projection normalizes CRLF and preserves non-choice source verbatim otherwise', () => {
    assert.deepEqual(
        buildDraftEditorProjection('第一行\r\n第二行\r第三行', { type: ' 解答题 ' }),
        {
            stem: '第一行\n第二行\n第三行',
            options: ['', '', '', ''],
            type: '解答题',
            parsedOptions: false
        }
    );

    assert.deepEqual(buildDraftEditorProjection(false, { type: 0 }), {
        stem: 'false',
        options: ['', '', '', ''],
        type: '解答题',
        parsedOptions: false
    });
});

test('editor projection parses full-width lowercase labels and pads a partial choice sequence', () => {
    const question = deepFreeze({
        type: '单选题',
        options: ['旧 A', '旧 B', '旧 C', '旧 D']
    });
    const source = '题干保留  \r\n　ａ． 甲\r\nｂ）乙';

    const result = buildDraftEditorProjection(source, question);

    assert.deepEqual(result, {
        stem: '题干保留',
        options: ['甲', '乙', '', ''],
        type: '单选题',
        parsedOptions: true
    });
    assert.deepEqual(question.options, ['旧 A', '旧 B', '旧 C', '旧 D']);
});

test('editor projection keeps the earliest longest sequence and includes skipped labels in option text', () => {
    const source = [
        '题干',
        'A. 第一段',
        'A. 第二段',
        'B. 第一个 B',
        'B. 第二个 B',
        'C. C 内容',
        'D. D 内容'
    ].join('\n');

    const result = buildDraftEditorProjection(source, {
        type: '多选题',
        options: ['fallback A', 'fallback B', 'fallback C', 'fallback D']
    });

    assert.equal(result.parsedOptions, true);
    assert.equal(result.stem, '题干');
    assert.deepEqual(result.options, [
        '第一段\nA. 第二段',
        '第一个 B\nB. 第二个 B',
        'C 内容',
        'D 内容'
    ]);
});

test('editor projection falls back to normalized existing options when labels or stem are unreliable', () => {
    const question = deepFreeze({
        type: '单选题',
        options: [1, false, 'C', ' ', 'ignored']
    });

    assert.deepEqual(buildDraftEditorProjection('题干\nA. 只有一个选项', question), {
        stem: '题干\nA. 只有一个选项',
        options: ['1', '', 'C', ' '],
        type: '单选题',
        parsedOptions: false
    });
    assert.deepEqual(buildDraftEditorProjection('A. 无题干\nB. 乙', question), {
        stem: 'A. 无题干\nB. 乙',
        options: ['1', '', 'C', ' '],
        type: '单选题',
        parsedOptions: false
    });
});

test('draftHasImageToken detects only the current legal token and includegraphics forms', () => {
    assert.equal(draftHasImageToken({ stem: '[[IMAGE:img-1]]' }), true);
    assert.equal(draftHasImageToken({ options: ['', '[[FORMULA_IMAGE:eq-1]]'] }), true);
    assert.equal(draftHasImageToken({ answer: String.raw`\includegraphics[width=.4\linewidth]{plot.png}` }), true);
    assert.equal(draftHasImageToken({ solution: String.raw`before \includegraphics{plot.png} after` }), true);
    assert.equal(draftHasImageToken({ stem: '[[image:lowercase]]' }), false);
    assert.equal(draftHasImageToken({ stem: '[[IMAGE:]]' }), false);
    assert.equal(draftHasImageToken({ stem: String.raw`includegraphics{missing-slash}` }), false);
    assert.equal(draftHasImageToken(null), false);
});

test('batch recognition summary preserves counters, number fallbacks, and dependency call order', () => {
    const drafts = deepFreeze([
        {
            questionNumber: '9',
            question: 'ignored',
            type: '单选题',
            options: ['A', 'B', 'C'],
            answer: ' A ',
            solution: '',
            stem: '[[IMAGE:one]]'
        },
        {
            question: '2',
            type: '多选题',
            options: ['A', 'B', 'C', 'D'],
            answer: '',
            solution: '解析',
            stem: '普通题干'
        },
        {
            order: 0,
            type: '填空题',
            options: ['not a choice option'],
            answer: '答案',
            solution: '解析',
            stem: '普通题干'
        }
    ]);
    const calls = [];

    const result = buildBatchRecognitionSummary(drafts, {
        countValidOptions: options => {
            calls.push(options);
            return Array.isArray(options) ? options.filter(Boolean).length : 0;
        }
    });

    assert.deepEqual(result, {
        total: 3,
        withOptions: 3,
        withAnswers: 2,
        withSolutions: 2,
        withImageTokens: 1,
        missingAnswers: ['2'],
        missingSolutions: ['9'],
        missingOptions: ['9']
    });
    assert.deepEqual(calls, drafts.map(draft => draft.options));
});

test('batch recognition summary uses production cleanRecognizedText delegation dynamically', () => {
    const root = globalThis;
    root.Qisi = root.Qisi || {};
    const previousUtils = root.Qisi.Utils;
    root.Qisi.Utils = {
        cleanRecognizedText: value => value === 'recognized' ? 'clean' : ''
    };

    try {
        const result = buildBatchRecognitionSummary([
            {
                questionNumber: '1',
                type: '解答题',
                options: [],
                answer: 'recognized',
                solution: 'not-recognized'
            }
        ], {
            countValidOptions: () => 0
        });

        assert.equal(result.withAnswers, 1);
        assert.equal(result.withSolutions, 0);
        assert.deepEqual(result.missingSolutions, ['1']);
    } finally {
        if (previousUtils === undefined) delete root.Qisi.Utils;
        else root.Qisi.Utils = previousUtils;
    }
});

test('batch recognition summary exercises countValidOptions only when a draft exists', () => {
    assert.deepEqual(buildBatchRecognitionSummary([], {}), {
        total: 0,
        withOptions: 0,
        withAnswers: 0,
        withSolutions: 0,
        withImageTokens: 0,
        missingAnswers: [],
        missingSolutions: [],
        missingOptions: []
    });
    assert.throws(() => buildBatchRecognitionSummary([{}], {}), TypeError);
});

test('draft problems preserve legacy order, dependency arguments, and first-occurrence dedupe', () => {
    const placeholderMessage = '存在未转换的 DOCX 公式图片占位，不能作为最终识别结果。';
    const question = deepFreeze({
        type: '单选题',
        stem: '',
        options: ['[bad-image]', '', '', ''],
        answer: '',
        solution: '残缺解析',
        warnings: ['已有警告', placeholderMessage, '已有警告'],
        duplicateStatus: 'answerConflict',
        imageReviewStatus: 'low_confidence'
    });
    const calls = [];

    const result = buildDraftQuestionProblems(question, {
        hasUnconvertedImagePlaceholder: value => {
            calls.push(['placeholder', value]);
            return value === '[bad-image]';
        },
        choiceOptionIssue: (...args) => {
            calls.push(['choice', ...args]);
            return '选项问题';
        },
        solutionQualityIssue: (...args) => {
            calls.push(['solution', ...args]);
            return '解析问题';
        }
    });

    assert.deepEqual(result, [
        '已有警告',
        placeholderMessage,
        '题干为空，请先补充题干。',
        '选项问题',
        '答案为空，请先补充答案。',
        '解析问题',
        '重复或答案冲突需要确认。',
        '该题图片尚未确认，请先确认图片是否正确。'
    ]);
    assert.deepEqual(calls, [
        ['placeholder', ''],
        ['placeholder', '[bad-image]'],
        ['choice', '单选题', question.options, ''],
        ['solution', '', question.options, '残缺解析']
    ]);
});

test('missing solution alone is not a draft problem and clean text still delegates to production', () => {
    const root = globalThis;
    root.Qisi = root.Qisi || {};
    const previousUtils = root.Qisi.Utils;
    root.Qisi.Utils = {
        cleanRecognizedText: value => value === 'valid' ? 'valid' : ''
    };

    try {
        const result = buildDraftQuestionProblems({
            type: '填空题',
            stem: 'valid',
            options: [],
            answer: 'valid',
            solution: ''
        }, {
            hasUnconvertedImagePlaceholder: () => false,
            choiceOptionIssue: () => '',
            solutionQualityIssue: () => ''
        });

        assert.deepEqual(result, []);
    } finally {
        if (previousUtils === undefined) delete root.Qisi.Utils;
        else root.Qisi.Utils = previousUtils;
    }
});

test('draft problems preserve warning spreading quirks and fail only when dependencies are exercised', () => {
    const dependencies = {
        hasUnconvertedImagePlaceholder: () => false,
        choiceOptionIssue: () => '',
        solutionQualityIssue: () => ''
    };

    assert.deepEqual(buildDraftQuestionProblems(null), []);
    assert.deepEqual(buildDraftQuestionProblems({
        stem: '题干',
        warnings: '警告',
        type: '解答题'
    }, dependencies).slice(0, 2), ['警', '告']);
    assert.throws(() => buildDraftQuestionProblems({ stem: '题干' }, {}), TypeError);
});

test('draft filtering preserves list identity for unrecognized filters and question identity for matches', () => {
    const pending = { id: 'pending', status: 'pending' };
    const reviewed = { id: 'reviewed', status: 'reviewed' };
    const submitted = { id: 'submitted', status: 'submitted' };
    const drafts = deepFreeze([pending, reviewed, submitted]);

    assert.strictEqual(filterDraftQuestions(drafts, 'all', () => []), drafts);
    assert.strictEqual(filterDraftQuestions(drafts, 'unknown', () => []), drafts);

    const pendingResult = filterDraftQuestions(drafts, 'pending', () => []);
    assert.notStrictEqual(pendingResult, drafts);
    assert.deepEqual(pendingResult, [pending]);
    assert.strictEqual(pendingResult[0], pending);
    assert.deepEqual(filterDraftQuestions(drafts, 'reviewed', () => []), [reviewed]);
    assert.deepEqual(filterDraftQuestions(drafts, 'submitted', () => []), [submitted]);
});

test('problem and image filters keep their exact predicates and lazy dependency behavior', () => {
    const imageFlagOnly = { id: 'image', hasImage: 'yes', stem: 'no token' };
    const tokenOnly = { id: 'token', hasImage: false, stem: '[[IMAGE:x]]' };
    const problem = { id: 'problem', hasImage: false };
    const clean = { id: 'clean', hasImage: 0 };
    const drafts = [imageFlagOnly, tokenOnly, problem, clean];
    const calls = [];
    const getProblems = question => {
        calls.push(question.id);
        return question === problem ? ['problem'] : [];
    };

    assert.deepEqual(filterDraftQuestions(drafts, 'images', getProblems), [imageFlagOnly]);
    assert.deepEqual(calls, []);
    assert.deepEqual(filterDraftQuestions(drafts, 'problems', getProblems), [problem]);
    assert.deepEqual(calls, ['image', 'token', 'problem', 'clean']);
    assert.deepEqual(filterDraftQuestions([], 'problems'), []);
    assert.throws(() => filterDraftQuestions([problem], 'problems'), TypeError);
    assert.deepEqual(filterDraftQuestions(null, 'pending', getProblems), []);
});
