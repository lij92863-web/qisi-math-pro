const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { useExam } = require('../qisi-exam-composable.js');
const ExamGrouping = require('../qisi-exam-grouping.js');

const ROOT = path.join(__dirname, '..');

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

const PRESET_TEMPLATES = deepFreeze({
    standard: { name: '标准卷', desc: '标准说明', code: 'STANDARD' },
    compact: { name: '紧凑卷', desc: '紧凑说明', code: 'COMPACT' }
});

const EXAM_LAYOUT_PRESETS = deepFreeze({
    standard: {
        name: '标准布局',
        desc: '布局说明',
        config: {
            title: '预设标题',
            columns: 1,
            showHeaderFields: true,
            showAnswerGrid: false
        }
    },
    compact: {
        name: '紧凑布局',
        desc: '紧凑布局说明',
        config: {
            title: '紧凑标题',
            columns: 2,
            showHeaderFields: false,
            showAnswerGrid: true
        }
    }
});

const DEFAULT_GROUP_CONFIG = deepFreeze({
    单选题: { title: '一、单选题', points: 5 },
    多选题: { title: '二、多选题', points: 6 },
    填空题: { title: '三、填空题', points: 5 },
    解答题: { title: '四、解答题', points: 12 }
});

const QUESTION_TYPE_LABELS = deepFreeze({
    单选题: '单选题',
    多选题: '多选题',
    填空题: '填空题',
    解答题: '解答题'
});

const EXAM_TYPE_ORDER = deepFreeze(['单选题', '多选题', '填空题', '解答题']);

const makeQuestions = () => [
    { id: 'q1', type: '单选题', knowledge: '集合' },
    { id: 'q2', type: '填空题', meta: { knowledge: '函数' } },
    { id: 'q3', type: '单选题', knowledge: '向量' },
    { id: 'q4', type: '单选题', knowledge: '立体几何' },
    { id: 'q5', type: '解答题', knowledge: '' }
];

const createVueHarness = () => {
    const refInputs = [];
    const reactiveInputs = [];
    const computedGetters = [];
    return {
        refInputs,
        reactiveInputs,
        computedGetters,
        ref(value) {
            refInputs.push(value);
            return { value };
        },
        reactive(value) {
            reactiveInputs.push(value);
            return value;
        },
        computed(getter) {
            computedGetters.push(getter);
            return Object.defineProperty({}, 'value', {
                enumerable: true,
                get: getter
            });
        }
    };
};

const createExam = (options = {}) => {
    const vue = createVueHarness();
    const effects = {
        confirms: [],
        grouping: [],
        summaries: []
    };
    const confirmResults = [...(options.confirmResults || [])];
    const grouping = options.ExamGrouping || {
        buildExamGroups(questions, policy) {
            effects.grouping.push({ questions, policy });
            return ExamGrouping.buildExamGroups(questions, policy);
        },
        formatExamGroupSummary(group) {
            effects.summaries.push(group);
            return `摘要:${group.type}:${group.count}`;
        }
    };

    const questions = options.questions || { value: makeQuestions() };
    const cart = options.cart || { value: ['q2', 'q1', 'missing', 'q3'] };
    const view = options.view || { value: 'library' };
    const isCartOpen = options.isCartOpen || { value: true };
    const selectedExamTemplate = options.selectedExamTemplate || { value: 'compact' };
    const templateOverrides = options.templateOverrides || {
        value: { compact: { name: '我的紧凑卷' } }
    };
    const context = {
        questions,
        cart,
        view,
        isCartOpen,
        selectedExamTemplate,
        templateOverrides,
        initialExamTitle: options.initialExamTitle ?? '高中数学期末模拟测试',
        initialExportMode: options.initialExportMode ?? 'questions',
        ...(options.context || {})
    };
    const dependencies = {
        ref: vue.ref,
        reactive: vue.reactive,
        computed: vue.computed,
        PRESET_TEMPLATES,
        EXAM_LAYOUT_PRESETS,
        DEFAULT_PRESET_KEY: 'standard',
        DEFAULT_GROUP_CONFIG,
        QUESTION_TYPE_LABELS,
        EXAM_TYPE_ORDER,
        ExamGrouping: grouping,
        confirmAction(message) {
            effects.confirms.push(message);
            return confirmResults.shift();
        },
        ...(options.dependencies || {})
    };

    return {
        vue,
        effects,
        context,
        dependencies,
        exam: useExam(context, dependencies)
    };
};

test('exam composable exposes the same factory in Node and the browser namespace', () => {
    assert.equal(typeof useExam, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-exam-composable.js'), 'utf8');
    const browser = {};
    vm.runInNewContext(source, browser, { filename: 'qisi-exam-composable.js' });

    assert.equal(typeof browser.Qisi.ExamComposable.useExam, 'function');
    assert.doesNotMatch(
        source,
        /\b(?:window|document|fetch|indexedDB|localStorage|sessionStorage|navigator)\b/
    );
    assert.doesNotMatch(source, /\bdb\s*\.|\bDate\b|Math\.random/);
});

test('construction owns exact fresh defaults, preserves shared ref identities, and triggers zero effects', () => {
    const constantsBefore = JSON.stringify({
        PRESET_TEMPLATES,
        EXAM_LAYOUT_PRESETS,
        DEFAULT_GROUP_CONFIG,
        QUESTION_TYPE_LABELS,
        EXAM_TYPE_ORDER
    });
    const result = createExam({
        initialExamTitle: '显式标题',
        initialExportMode: 'withAnswers'
    });
    const { exam, context, vue, effects } = result;

    assert.strictEqual(exam.questions, context.questions);
    assert.strictEqual(exam.cart, context.cart);
    assert.strictEqual(exam.view, context.view);
    assert.strictEqual(exam.isCartOpen, context.isCartOpen);
    assert.strictEqual(exam.selectedExamTemplate, context.selectedExamTemplate);
    assert.strictEqual(exam.templateOverrides, context.templateOverrides);

    assert.equal(exam.examTitle.value, '显式标题');
    assert.equal(exam.exportMode.value, 'withAnswers');
    assert.deepEqual(exam.examConfig, EXAM_LAYOUT_PRESETS.standard.config);
    assert.notStrictEqual(exam.examConfig, EXAM_LAYOUT_PRESETS.standard.config);
    assert.deepEqual(exam.examQuestionMeta, {});
    assert.deepEqual(exam.examGroupConfig, {});
    assert.equal(exam.draggingExamQuestionId.value, '');
    assert.equal(exam.dragOverExamQuestionId.value, '');
    assert.equal(exam.restoringExamConfig.value, false);
    assert.equal(exam.printBusy.value, false);

    assert.deepEqual(vue.refInputs, [
        '显式标题',
        'withAnswers',
        '',
        '',
        false,
        false
    ]);
    assert.strictEqual(vue.reactiveInputs[0], exam.examConfig);
    assert.strictEqual(vue.reactiveInputs[1], exam.examQuestionMeta);
    assert.strictEqual(vue.reactiveInputs[2], exam.examGroupConfig);
    assert.equal(vue.computedGetters.length, 5);
    assert.deepEqual(effects, { confirms: [], grouping: [], summaries: [] });
    assert.equal(JSON.stringify({
        PRESET_TEMPLATES,
        EXAM_LAYOUT_PRESETS,
        DEFAULT_GROUP_CONFIG,
        QUESTION_TYPE_LABELS,
        EXAM_TYPE_ORDER
    }), constantsBefore);
});

test('computed projections preserve cart order, preset overrides, fallback, grouping policy, and feature labels', () => {
    const result = createExam();
    const { exam, context, effects } = result;

    assert.deepEqual(exam.cartQuestionsOrdered.value.map(question => question.id), [
        'q2',
        'q1',
        'q3'
    ]);
    assert.equal(exam.examPresets.value.compact.name, '我的紧凑卷');
    assert.equal(exam.examPresets.value.compact.desc, '紧凑说明');
    assert.equal(exam.examPresets.value.standard.name, '标准布局');
    assert.deepEqual(exam.selectedExamPreset.value, exam.examPresets.value.compact);
    context.selectedExamTemplate.value = 'unknown';
    assert.deepEqual(exam.selectedExamPreset.value, exam.examPresets.value.standard);

    assert.deepEqual(exam.templateFeatureOptions.value, [
        { key: 'showHeaderFields', label: '显示班级 / 姓名 / 评分' },
        { key: 'showAnswerGrid', label: '显示晚测答题表' }
    ]);
    assert.deepEqual(exam.activeExamGroups.value.map(group => ({
        type: group.type,
        ids: group.items.map(item => item.id)
    })), [
        { type: '单选题', ids: ['q1', 'q3'] },
        { type: '填空题', ids: ['q2'] }
    ]);
    assert.equal(effects.grouping.length, 1);
    assert.strictEqual(effects.grouping[0].questions[0], context.questions.value[1]);
    assert.strictEqual(effects.grouping[0].policy.typeOrder, EXAM_TYPE_ORDER);
    assert.strictEqual(effects.grouping[0].policy.defaultGroupConfig, DEFAULT_GROUP_CONFIG);
    assert.strictEqual(effects.grouping[0].policy.typeLabels, QUESTION_TYPE_LABELS);
    assert.strictEqual(effects.grouping[0].policy.groupConfig, exam.examGroupConfig);
    assert.strictEqual(effects.grouping[0].policy.questionMeta, exam.examQuestionMeta);
});

test('getGroupCfg, syncExamMeta, and syncExamGroups preserve defaults without mutating policy inputs', () => {
    const defaultsBefore = JSON.stringify(DEFAULT_GROUP_CONFIG);
    const { exam, effects } = createExam({ cart: { value: ['q1', 'q2', 'q5'] } });

    const singleConfig = exam.getGroupCfg('单选题');
    assert.deepEqual(singleConfig, { title: '一、单选题', points: 5 });
    assert.notStrictEqual(singleConfig, DEFAULT_GROUP_CONFIG.单选题);
    assert.deepEqual(exam.getGroupCfg('其他自定义题'), {
        title: '其他自定义题',
        points: 0
    });

    exam.examQuestionMeta.q2 = { name: '保留名称', points: 0, source: '保留来源', note: '保留备注' };
    exam.syncExamMeta();
    assert.deepEqual(exam.examQuestionMeta.q1, {
        name: '单选题',
        points: 5,
        source: '集合',
        note: ''
    });
    assert.deepEqual(exam.examQuestionMeta.q2, {
        name: '保留名称',
        points: 5,
        source: '保留来源',
        note: '保留备注'
    });
    assert.deepEqual(exam.examQuestionMeta.q5, {
        name: '解答题',
        points: 12,
        source: '',
        note: ''
    });

    exam.examGroupConfig.单选题.text = '手工分组说明';
    exam.syncExamGroups();
    assert.equal(exam.examGroupConfig.单选题.text, '手工分组说明');
    assert.equal(exam.examGroupConfig.填空题.text, '摘要:填空题:1');
    assert.equal(exam.examGroupConfig.解答题.text, '摘要:解答题:1');
    assert.equal(effects.summaries.some(group => group.type === '单选题'), false);
    assert.equal(JSON.stringify(DEFAULT_GROUP_CONFIG), defaultsBefore);
});

test('toggleCart keeps legacy add/remove identity and deduplicates every occurrence on removal', () => {
    const questions = { value: makeQuestions() };
    const originalCart = ['q1', 'q1', 'q2'];
    const cart = { value: originalCart };
    const { exam } = createExam({ questions, cart });

    exam.toggleCart('q1');
    assert.notStrictEqual(cart.value, originalCart);
    assert.deepEqual(cart.value, ['q2']);

    const beforeAdd = cart.value;
    exam.toggleCart('q3');
    assert.strictEqual(cart.value, beforeAdd);
    assert.deepEqual(cart.value, ['q2', 'q3']);
    assert.deepEqual(exam.examQuestionMeta.q3, {
        name: '单选题',
        points: 5,
        source: '向量',
        note: ''
    });

    exam.toggleCart('q3');
    assert.deepEqual(cart.value, ['q2']);
});

test('move and direct reorder change only same-type slots and preserve question records', () => {
    const questions = makeQuestions();
    const questionsBefore = JSON.stringify(questions);
    const cart = { value: ['q1', 'q2', 'q3', 'q4', 'q5'] };
    const { exam } = createExam({ questions: { value: questions }, cart });

    exam.moveCartQuestion('q3', -1);
    assert.deepEqual(cart.value, ['q3', 'q2', 'q1', 'q4', 'q5']);
    exam.moveCartQuestion('q3', -1);
    assert.deepEqual(cart.value, ['q3', 'q2', 'q1', 'q4', 'q5']);
    exam.moveCartQuestion('missing', 1);
    assert.deepEqual(cart.value, ['q3', 'q2', 'q1', 'q4', 'q5']);

    assert.equal(exam.reorderQuestionWithinType('q4', 0), true);
    assert.deepEqual(cart.value, ['q4', 'q2', 'q3', 'q1', 'q5']);
    assert.equal(exam.reorderQuestionWithinType('q4', 0), false);
    assert.equal(exam.reorderQuestionWithinType('missing', 0), false);
    assert.equal(JSON.stringify(questions), questionsBefore);
});

test('drop resets drag refs and reorders only matching question types', () => {
    const cart = { value: ['q1', 'q2', 'q3', 'q4'] };
    const { exam } = createExam({ cart });

    exam.draggingExamQuestionId.value = 'q4';
    exam.dragOverExamQuestionId.value = 'q1';
    exam.dropExamQuestion('q1');
    assert.deepEqual(cart.value, ['q4', 'q2', 'q1', 'q3']);
    assert.equal(exam.draggingExamQuestionId.value, '');
    assert.equal(exam.dragOverExamQuestionId.value, '');

    exam.draggingExamQuestionId.value = 'q2';
    exam.dragOverExamQuestionId.value = 'q1';
    exam.dropExamQuestion('q1');
    assert.deepEqual(cart.value, ['q4', 'q2', 'q1', 'q3']);
    assert.equal(exam.draggingExamQuestionId.value, '');
    assert.equal(exam.dragOverExamQuestionId.value, '');
});

test('display index follows grouped exam order and reset uses legacy string sorting', () => {
    const cart = { value: ['q2', 'q4', 'q1', 'q3'] };
    const { exam } = createExam({ cart });

    assert.equal(exam.examDisplayIndex('q4'), 1);
    assert.equal(exam.examDisplayIndex('q1'), 2);
    assert.equal(exam.examDisplayIndex('q3'), 3);
    assert.equal(exam.examDisplayIndex('q2'), 4);
    assert.equal(exam.examDisplayIndex('missing'), 5);

    const numericCart = { value: [10, 2, '1'] };
    const numericExam = createExam({ cart: numericCart }).exam;
    numericExam.resetExamOrder();
    assert.deepEqual(numericCart.value, ['1', 10, 2]);
});

test('openExamBuilder performs local sync then selects exam view and closes the shared cart panel', () => {
    const result = createExam({ cart: { value: ['q1', 'q2'] } });
    const { exam, context, effects } = result;

    assert.equal(exam.openExamBuilder(), undefined);
    assert.equal(context.view.value, 'exam');
    assert.equal(context.isCartOpen.value, false);
    assert.equal(exam.examGroupConfig.单选题.text, '摘要:单选题:1');
    assert.equal(exam.examGroupConfig.填空题.text, '摘要:填空题:1');
    assert.equal(exam.examQuestionMeta.q1.points, 5);
    assert.equal(exam.examQuestionMeta.q2.points, 5);
    assert.deepEqual(effects.confirms, []);
});

test('clearCart calls the injected confirmation once and preserves cancel/success semantics', () => {
    const cancelledCart = { value: ['q1', 'q2'] };
    const cancelled = createExam({
        cart: cancelledCart,
        confirmResults: [false]
    });
    const cancelledIdentity = cancelledCart.value;
    assert.equal(cancelled.exam.clearCart(), undefined);
    assert.strictEqual(cancelledCart.value, cancelledIdentity);
    assert.deepEqual(cancelledCart.value, ['q1', 'q2']);
    assert.deepEqual(cancelled.effects.confirms, ['确定清空试卷篮吗？']);

    const acceptedCart = { value: ['q1', 'q2'] };
    const accepted = createExam({
        cart: acceptedCart,
        confirmResults: [true]
    });
    const acceptedIdentity = acceptedCart.value;
    assert.equal(accepted.exam.clearCart(), undefined);
    assert.notStrictEqual(acceptedCart.value, acceptedIdentity);
    assert.deepEqual(acceptedCart.value, []);
    assert.deepEqual(accepted.effects.confirms, ['确定清空试卷篮吗？']);
});

test('missing structural and exercised effect dependencies fail loudly without partial mutation', () => {
    assert.throws(() => useExam(), /ref/);

    const base = createExam();
    const missingTitle = { ...base.context };
    delete missingTitle.initialExamTitle;
    assert.throws(
        () => useExam(missingTitle, base.dependencies),
        /initialExamTitle/
    );

    const noConfirmation = createExam({
        dependencies: { confirmAction: undefined }
    });
    const cartIdentity = noConfirmation.context.cart.value;
    assert.throws(() => noConfirmation.exam.clearCart(), /confirmAction/);
    assert.strictEqual(noConfirmation.context.cart.value, cartIdentity);

    const noGroupBuilder = createExam({
        ExamGrouping: { formatExamGroupSummary() { return ''; } }
    });
    assert.throws(() => noGroupBuilder.exam.activeExamGroups.value, /buildExamGroups/);

    const noSummary = createExam({
        cart: { value: ['q1'] },
        ExamGrouping: { buildExamGroups: ExamGrouping.buildExamGroups }
    });
    assert.throws(() => noSummary.exam.syncExamGroups(), /formatExamGroupSummary/);
});
