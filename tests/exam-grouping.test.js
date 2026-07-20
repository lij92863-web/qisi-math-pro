const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
    buildExamGroups,
    formatExamGroupSummary
} = require('../qisi-exam-grouping.js');

const ROOT = path.join(__dirname, '..');
const TYPE_ORDER = ['单选题', '多选题', '填空题', '解答题', '证明题'];

const createPolicy = (overrides = {}) => ({
    typeOrder: [...TYPE_ORDER],
    groupConfig: {},
    defaultGroupConfig: Object.fromEntries(
        TYPE_ORDER.map(type => [type, { title: type, points: 0 }])
    ),
    typeLabels: Object.fromEntries(TYPE_ORDER.map(type => [type, type])),
    questionMeta: {},
    ...overrides
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

test('exam grouping exposes the same API in Node and a browser global', () => {
    assert.equal(typeof buildExamGroups, 'function');
    assert.equal(typeof formatExamGroupSummary, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-exam-grouping.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);

    assert.equal(typeof context.Qisi.ExamGrouping.buildExamGroups, 'function');
    assert.equal(typeof context.Qisi.ExamGrouping.formatExamGroupSummary, 'function');
});

test('known types follow the production order and unknown types sort last by text', () => {
    const questions = [
        { id: 'unknown-z', type: 'Ztype' },
        { id: 'proof-1', type: '证明题' },
        { id: 'unknown-a', type: 'Atype' },
        { id: 'single-1', type: '单选题' },
        { id: 'answer-1', type: '解答题' },
        { id: 'blank-1', type: '填空题' },
        { id: 'multi-1', type: '多选题' },
        { id: 'single-2', type: '单选题' }
    ];

    const groups = buildExamGroups(questions, createPolicy());

    assert.deepEqual(
        groups.map(group => group.type),
        ['单选题', '多选题', '填空题', '解答题', '证明题', 'Atype', 'Ztype']
    );
    assert.deepEqual(groups[0].items.map(question => question.id), ['single-1', 'single-2']);
});

test('every falsy question type maps to the current fallback group', () => {
    const questions = [
        { id: 'missing' },
        { id: 'null', type: null },
        { id: 'empty', type: '' },
        { id: 'zero', type: 0 },
        { id: 'false', type: false }
    ];

    const groups = buildExamGroups(questions, createPolicy());

    assert.deepEqual(groups, [{
        type: '其他题型',
        items: questions,
        count: 5,
        points: 0,
        total: 0,
        title: '其他题型',
        text: '其他题型：本大题共 5 小题，每小题 0 分，共计 0 分。'
    }]);
});

test('custom config and per-question scores preserve current truthy override semantics', () => {
    const first = { id: 'single-1', type: '单选题' };
    const second = { id: 'single-2', type: '单选题' };
    const policy = createPolicy({
        groupConfig: {
            '单选题': { title: '客观题', points: '5', text: '自定义说明' }
        },
        questionMeta: {
            'single-1': { points: '7' },
            'single-2': { points: 0 }
        }
    });

    const [group] = buildExamGroups([first, second], policy);

    assert.deepEqual(group, {
        type: '单选题',
        items: [first, second],
        count: 2,
        points: 5,
        total: 12,
        title: '客观题',
        text: '自定义说明'
    });
});

test('a partial custom config replaces rather than merges the default config', () => {
    const question = { id: 'single-1', type: '单选题' };
    const policy = createPolicy({
        groupConfig: {
            '单选题': { text: '仅覆盖说明' }
        },
        defaultGroupConfig: {
            '单选题': { title: '默认标题', points: 4, text: '默认说明' }
        }
    });

    const [group] = buildExamGroups([question], policy);

    assert.deepEqual(group, {
        type: '单选题',
        items: [question],
        count: 1,
        points: 0,
        total: 0,
        title: '单选题',
        text: '仅覆盖说明'
    });
});

test('type labels supply the title only when no group config exists', () => {
    const question = { id: 'judge-1', type: '判断题' };
    const policy = createPolicy({
        typeLabels: { '判断题': '判断正误' }
    });

    const [group] = buildExamGroups([question], policy);

    assert.equal(group.title, '判断正误');
    assert.equal(group.text, '判断正误：本大题共 1 小题，每小题 0 分，共计 0 分。');
});

test('generated and explicit summaries are byte-for-byte compatible', () => {
    const question = { id: 'blank-1', type: '填空题' };
    const policy = createPolicy({
        groupConfig: {
            '填空题': { title: '填空题', points: '4', text: '' }
        }
    });
    const [group] = buildExamGroups([question], policy);

    assert.equal(group.text, '填空题：本大题共 1 小题，每小题 4 分，共计 4 分。');
    assert.equal(formatExamGroupSummary(group), group.text);
    assert.equal(
        formatExamGroupSummary({ title: '解答题', count: 2, points: '6', total: 12, text: '' }),
        '解答题：本大题共 2 小题，每小题 6 分，共计 12 分。'
    );
    assert.equal(
        formatExamGroupSummary({ title: '填空题', count: 0, points: undefined, total: 0, text: '' }),
        '填空题：本大题共 0 小题，每小题 0 分，共计 0 分。'
    );
    assert.equal(formatExamGroupSummary({ text: '保留原说明' }), '保留原说明');
});

test('empty input stays empty and missing input keeps the legacy failure contract', () => {
    assert.deepEqual(buildExamGroups([], createPolicy()), []);
    assert.throws(() => buildExamGroups(null, createPolicy()), TypeError);
    assert.throws(() => buildExamGroups(undefined, createPolicy()), TypeError);
});

test('grouping does not mutate frozen input or policy and retains question identity', () => {
    const questions = deepFreeze([
        { id: 'single-1', type: '单选题', stem: '原题' },
        { id: 'single-2', type: '单选题', stem: '原题二' }
    ]);
    const policy = deepFreeze(createPolicy({
        groupConfig: { '单选题': { title: '单选题', points: 5 } },
        questionMeta: { 'single-1': { points: 6 } }
    }));
    const questionSnapshot = structuredClone(questions);
    const policySnapshot = structuredClone(policy);

    const [group] = buildExamGroups(questions, policy);

    assert.deepEqual(questions, questionSnapshot);
    assert.deepEqual(policy, policySnapshot);
    assert.notStrictEqual(group.items, questions);
    assert.strictEqual(group.items[0], questions[0]);
    assert.strictEqual(group.items[1], questions[1]);
});
