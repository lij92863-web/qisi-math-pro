const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { useSettings } = require('../qisi-settings-composable.js');
const KnowledgeTreeState = require('../qisi-knowledge-tree-state.js');

const ROOT = path.join(__dirname, '..');

const ref = value => ({ value });
const computed = getter => Object.defineProperty({}, 'value', {
    enumerable: true,
    get: getter
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

const PRESET_TEMPLATES = deepFreeze({
    standard: { name: '标准卷', desc: '标准说明', code: 'STANDARD_CODE' },
    compact: { name: '紧凑卷', desc: '紧凑说明', code: 'COMPACT_CODE' }
});

const EXAM_LAYOUT_PRESETS = deepFreeze({
    standard: { config: { columns: 1 } },
    compact: { config: { columns: 2 } }
});

const makeTree = () => [
    {
        id: 'l1',
        name: '代数',
        expanded: true,
        children: [
            {
                id: 'l2',
                name: '函数',
                expanded: true,
                children: [{ id: 'l3', name: '定义域' }]
            }
        ]
    }
];

const makeHarness = (options = {}) => {
    const calls = {
        ensure: [],
        validate: [],
        templatePersists: [],
        treePersists: [],
        now: 0,
        createId: [],
        requestText: [],
        confirmAction: [],
        notify: []
    };
    const requestResults = [...(options.requestResults || [])];
    const confirmResults = [...(options.confirmResults || [])];
    let idSequence = 0;

    const dependencies = {
        ref,
        computed,
        DEFAULT_TEMPLATE: 'DEFAULT_CODE',
        PRESET_TEMPLATES,
        EXAM_LAYOUT_PRESETS,
        KnowledgeTreeState,
        ensureImagePackagesForLatex(code) {
            calls.ensure.push(code);
            return options.ensureResult === undefined
                ? `PACKAGED(${code})`
                : options.ensureResult;
        },
        validateStrictLatex(code) {
            calls.validate.push(code);
            return options.validation || { ok: true, issues: [] };
        },
        async persistPersonalTree(tree, updatedAt) {
            calls.treePersists.push({ tree, updatedAt });
        },
        async persistTemplateOverrides(overrides) {
            calls.templatePersists.push(overrides);
        },
        now() {
            calls.now += 1;
            return 1700000000000 + calls.now;
        },
        createId(prefix) {
            calls.createId.push(prefix);
            idSequence += 1;
            return `${prefix}_${idSequence}`;
        },
        requestText(label, initialValue) {
            calls.requestText.push([label, initialValue]);
            return requestResults.shift();
        },
        confirmAction(message) {
            calls.confirmAction.push(message);
            return confirmResults.shift();
        },
        notify(message) {
            calls.notify.push(message);
        },
        ...(options.dependencies || {})
    };

    const hoverPersonalL1 = options.hoverPersonalL1 || ref(null);
    const selectedExamTemplate = options.selectedExamTemplate || ref('standard');
    const context = {
        hoverPersonalL1,
        selectedExamTemplate,
        templateOverrides: options.templateOverrides,
        personalKnowledgeTree: options.personalKnowledgeTree,
        ...(options.context || {})
    };

    return {
        calls,
        context,
        dependencies,
        settings: useSettings(context, dependencies)
    };
};

test('settings composable exposes the same factory in Node and the browser namespace', () => {
    assert.equal(typeof useSettings, 'function');

    const source = fs.readFileSync(
        path.join(ROOT, 'qisi-settings-composable.js'),
        'utf8'
    );
    const browser = {};
    vm.runInNewContext(source, browser);

    assert.equal(typeof browser.Qisi.SettingsComposable.useSettings, 'function');
    assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|\blocalStorage\b|\bindexedDB\b|\bfetch\b|Math\.random|Date\./);
});

test('construction owns legacy defaults, preserves supplied identities, and triggers zero effects', () => {
    const initialOverrides = deepFreeze({
        standard: { name: '我的标准卷', code: 'OVERRIDE_CODE' }
    });
    const initialTree = deepFreeze(makeTree());
    const hoverPersonalL1 = ref(initialTree[0]);
    const selectedExamTemplate = ref('compact');
    const { calls, settings } = makeHarness({
        initialOverrides,
        templateOverrides: initialOverrides,
        personalKnowledgeTree: initialTree,
        hoverPersonalL1,
        selectedExamTemplate
    });

    assert.strictEqual(settings.templateOverrides.value, initialOverrides);
    assert.strictEqual(settings.personalKnowledgeTree.value, initialTree);
    assert.strictEqual(settings.hoverPersonalL1, hoverPersonalL1);
    assert.strictEqual(settings.selectedExamTemplate, selectedExamTemplate);
    assert.equal(settings.latexTemplate.value, 'DEFAULT_CODE');
    assert.equal(settings.currentPresetKey.value, '');
    assert.equal(settings.editTplName.value, '');
    assert.equal(settings.personalL1Name.value, '');
    assert.equal(settings.personalL2Name.value, '');
    assert.equal(settings.personalL3Name.value, '');
    assert.equal(settings.selectedPersonalL1Id.value, '');
    assert.equal(settings.selectedPersonalL2Id.value, '');
    assert.deepEqual(calls, {
        ensure: [],
        validate: [],
        templatePersists: [],
        treePersists: [],
        now: 0,
        createId: [],
        requestText: [],
        confirmAction: [],
        notify: []
    });

    const cards = settings.allTemplateCards.value;
    assert.deepEqual(cards, [
        {
            id: 'standard',
            name: '我的标准卷',
            desc: '标准说明',
            code: 'OVERRIDE_CODE',
            system: true
        },
        {
            id: 'compact',
            name: '紧凑卷',
            desc: '紧凑说明',
            code: 'COMPACT_CODE',
            system: true
        }
    ]);
    assert.deepEqual(settings.personalTreeRows.value.map(row => row.node.id), [
        'l1',
        'l2',
        'l3'
    ]);
    assert.strictEqual(settings.personalTreeRows.value[0].node, initialTree[0]);
    assert.deepEqual(initialOverrides, {
        standard: { name: '我的标准卷', code: 'OVERRIDE_CODE' }
    });
    assert.deepEqual(initialTree, makeTree());
});

test('template selection and code input preserve legacy ref and preset behavior', () => {
    const overrides = deepFreeze({
        compact: { name: '两栏卷', code: 'TWO_COLUMN' }
    });
    const { settings } = makeHarness({ templateOverrides: overrides });

    const custom = deepFreeze({
        id: 'teacher',
        name: '教师模板',
        code: 'TEACHER_CODE',
        system: false
    });
    settings.selectTemplateCard(custom);
    assert.equal(settings.currentPresetKey.value, 'teacher');
    assert.equal(settings.editTplName.value, '教师模板');
    assert.equal(settings.latexTemplate.value, 'TEACHER_CODE');
    assert.equal(settings.selectedExamTemplate.value, 'standard');

    settings.selectPresetTemplate('compact');
    assert.equal(settings.currentPresetKey.value, 'compact');
    assert.equal(settings.editTplName.value, '两栏卷');
    assert.equal(settings.latexTemplate.value, 'TWO_COLUMN');
    assert.equal(settings.selectedExamTemplate.value, 'compact');

    const event = deepFreeze({ target: { value: '\\documentclass{article}' } });
    settings.handleCodeInput(event);
    assert.equal(settings.latexTemplate.value, '\\documentclass{article}');
    assert.deepEqual(custom, {
        id: 'teacher',
        name: '教师模板',
        code: 'TEACHER_CODE',
        system: false
    });
    assert.deepEqual(overrides, {
        compact: { name: '两栏卷', code: 'TWO_COLUMN' }
    });
});

test('template update fails closed with the exact warning and no state persistence', async () => {
    const { calls, settings } = makeHarness({
        validation: { ok: false, issues: ['缺少 \\begin{document}', '括号不闭合'] }
    });
    settings.currentPresetKey.value = 'standard';
    settings.editTplName.value = '新名称';
    settings.latexTemplate.value = 'BROKEN';
    const originalOverrides = settings.templateOverrides.value;

    await settings.updateExistingCustomTemplate();

    assert.deepEqual(calls.ensure, ['BROKEN']);
    assert.deepEqual(calls.validate, ['PACKAGED(BROKEN)']);
    assert.deepEqual(calls.notify, [
        '模板未保存：\n缺少 \\begin{document}\n括号不闭合'
    ]);
    assert.deepEqual(calls.templatePersists, []);
    assert.equal(calls.now, 0);
    assert.strictEqual(settings.templateOverrides.value, originalOverrides);
    assert.equal(settings.latexTemplate.value, 'BROKEN');
});

test('template update replaces only the active override before persistence and success notice', async () => {
    const untouched = deepFreeze({ name: '保留', code: 'KEEP', custom: 7 });
    const initialOverrides = deepFreeze({ compact: untouched });
    const { calls, settings } = makeHarness({
        templateOverrides: initialOverrides,
        ensureResult: 'PACKAGED_CODE'
    });
    settings.currentPresetKey.value = 'standard';
    settings.editTplName.value = '教师标准卷';
    settings.latexTemplate.value = 'RAW_CODE';

    await settings.updateExistingCustomTemplate();

    assert.notStrictEqual(settings.templateOverrides.value, initialOverrides);
    assert.strictEqual(settings.templateOverrides.value.compact, untouched);
    assert.deepEqual(settings.templateOverrides.value.standard, {
        name: '教师标准卷',
        code: 'PACKAGED_CODE',
        updatedAt: 1700000000001
    });
    assert.equal(settings.latexTemplate.value, 'PACKAGED_CODE');
    assert.equal(calls.templatePersists.length, 1);
    assert.strictEqual(calls.templatePersists[0], settings.templateOverrides.value);
    assert.deepEqual(calls.notify, ['A4 模板已更新']);
    assert.equal(calls.now, 1);
    assert.deepEqual(initialOverrides, { compact: untouched });
});

test('template update is a true no-op when the selected key is not a preset', async () => {
    const { calls, settings } = makeHarness();
    settings.currentPresetKey.value = 'teacher-only';
    settings.latexTemplate.value = 'CUSTOM';

    await settings.updateExistingCustomTemplate();

    assert.deepEqual(calls.ensure, []);
    assert.deepEqual(calls.validate, []);
    assert.deepEqual(calls.templatePersists, []);
    assert.deepEqual(calls.notify, []);
    assert.equal(calls.now, 0);
    assert.equal(settings.latexTemplate.value, 'CUSTOM');
});

test('personal tree creation, expansion, child insertion, and rename persist every successful action', async () => {
    const initialTree = deepFreeze(makeTree());
    const { calls, settings } = makeHarness({
        personalKnowledgeTree: initialTree,
        requestResults: ['新增叶子', '重命名叶子']
    });

    settings.personalL1Name.value = '  几何  ';
    await settings.createPersonalL1();
    const geometry = settings.personalKnowledgeTree.value.at(-1);
    assert.deepEqual(geometry, {
        id: 'pk_1',
        name: '几何',
        children: [],
        expanded: true
    });
    assert.equal(settings.selectedPersonalL1Id.value, 'pk_1');
    assert.equal(settings.selectedPersonalL2Id.value, '');
    assert.equal(settings.personalL1Name.value, '');

    settings.personalL2Name.value = '  立体几何  ';
    await settings.createPersonalL2();
    assert.equal(settings.selectedPersonalL2Id.value, 'pk_2');
    assert.equal(settings.personalL2Name.value, '');

    settings.personalL3Name.value = '  空间向量  ';
    await settings.createPersonalL3();
    assert.equal(settings.personalL3Name.value, '');

    let liveGeometry = settings.personalKnowledgeTree.value.find(node => node.id === 'pk_1');
    await settings.togglePersonalExpanded(liveGeometry);
    liveGeometry = settings.personalKnowledgeTree.value.find(node => node.id === 'pk_1');
    assert.equal(liveGeometry.expanded, false);

    await settings.addPersonalChild({
        level: 1,
        node: liveGeometry,
        parent: null,
        grandParent: null
    });
    liveGeometry = settings.personalKnowledgeTree.value.find(node => node.id === 'pk_1');
    const addedLevelTwo = liveGeometry.children.at(-1);
    assert.deepEqual(addedLevelTwo, {
        id: 'pk_4',
        name: '新增叶子',
        children: [],
        expanded: true
    });
    assert.equal(settings.selectedPersonalL1Id.value, 'pk_1');
    assert.equal(settings.selectedPersonalL2Id.value, 'pk_4');

    await settings.renamePersonalNode(addedLevelTwo);
    liveGeometry = settings.personalKnowledgeTree.value.find(node => node.id === 'pk_1');
    assert.equal(liveGeometry.children.at(-1).name, '重命名叶子');

    assert.deepEqual(calls.createId, ['pk', 'pk', 'pk', 'pk']);
    assert.deepEqual(calls.requestText, [
        ['二级方向名称', ''],
        ['新的知识点名称', '新增叶子']
    ]);
    assert.equal(calls.treePersists.length, 6);
    assert.deepEqual(calls.treePersists.map(call => call.updatedAt), [
        1700000000001,
        1700000000002,
        1700000000003,
        1700000000004,
        1700000000005,
        1700000000006
    ]);
    assert.deepEqual(initialTree, makeTree());
});

test('adding a level-three child preserves legacy fields, selection rules, and source row identity', async () => {
    const initialTree = deepFreeze(makeTree());
    const { calls, settings } = makeHarness({
        personalKnowledgeTree: initialTree,
        requestResults: ['  值域  ']
    });
    const levelOne = initialTree[0];
    const levelTwo = levelOne.children[0];

    await settings.addPersonalChild({
        level: 2,
        node: levelTwo,
        parent: levelOne,
        grandParent: levelOne
    });

    const nextLevelOne = settings.personalKnowledgeTree.value[0];
    const nextLevelTwo = nextLevelOne.children[0];
    const child = nextLevelTwo.children.at(-1);
    assert.equal(child.id, 'pk_1');
    assert.equal(child.name, '值域');
    assert.equal(child.expanded, true);
    assert.equal(Object.hasOwn(child, 'children'), true);
    assert.equal(child.children, undefined);
    assert.equal(settings.selectedPersonalL1Id.value, 'l1');
    assert.equal(settings.selectedPersonalL2Id.value, 'l2');
    assert.strictEqual(initialTree[0], levelOne);
    assert.strictEqual(initialTree[0].children[0], levelTwo);
    assert.equal(calls.treePersists.length, 1);
});

test('tree replacement rebinds a matching hover node and retains the old hover when absent', () => {
    const initialTree = makeTree();
    const hoverPersonalL1 = ref(initialTree[0]);
    const { settings } = makeHarness({
        personalKnowledgeTree: initialTree,
        hoverPersonalL1
    });
    const replacement = makeTree();

    settings.replacePersonalKnowledgeTree(replacement);
    assert.strictEqual(settings.personalKnowledgeTree.value, replacement);
    assert.strictEqual(hoverPersonalL1.value, replacement[0]);

    const previousHover = hoverPersonalL1.value;
    const absent = [{ id: 'another', name: '其他', children: [] }];
    settings.replacePersonalKnowledgeTree(absent);
    assert.strictEqual(settings.personalKnowledgeTree.value, absent);
    assert.strictEqual(hoverPersonalL1.value, previousHover);
});

test('personal deletion preserves exact confirmation, parent routing, and selection cleanup', async () => {
    const { calls, settings } = makeHarness({
        personalKnowledgeTree: makeTree(),
        confirmResults: [true, true, true]
    });
    settings.selectedPersonalL1Id.value = 'l1';
    settings.selectedPersonalL2Id.value = 'l2';

    await settings.deletePersonalNode(3, 'l3', 'l2');
    assert.equal(settings.selectedPersonalL1Id.value, 'l1');
    assert.equal(settings.selectedPersonalL2Id.value, 'l2');
    assert.deepEqual(settings.personalKnowledgeTree.value[0].children[0].children, []);

    const row = settings.personalTreeRows.value.find(item => item.node.id === 'l2');
    const result = settings.deletePersonalRow(row);
    assert.equal(result, undefined);
    assert.equal(settings.selectedPersonalL1Id.value, 'l1');
    assert.equal(settings.selectedPersonalL2Id.value, '');
    assert.deepEqual(settings.personalKnowledgeTree.value[0].children, []);

    await settings.deletePersonalNode(1, 'l1');
    assert.equal(settings.selectedPersonalL1Id.value, '');
    assert.equal(settings.selectedPersonalL2Id.value, '');
    assert.deepEqual(settings.personalKnowledgeTree.value, []);
    assert.deepEqual(calls.confirmAction, [
        '确定删除这个知识点及其下级吗？',
        '确定删除这个知识点及其下级吗？',
        '确定删除这个知识点及其下级吗？'
    ]);
    assert.equal(calls.treePersists.length, 3);
});

test('empty text and cancelled prompts or confirmation leave tree, inputs, and selection unchanged', async () => {
    const initialTree = deepFreeze(makeTree());
    const { calls, settings } = makeHarness({
        personalKnowledgeTree: initialTree,
        requestResults: [null, '   '],
        confirmResults: [false]
    });
    settings.personalL1Name.value = '   ';
    settings.personalL2Name.value = '保留二级输入';
    settings.personalL3Name.value = '保留三级输入';
    settings.selectedPersonalL1Id.value = 'missing';
    settings.selectedPersonalL2Id.value = 'missing';

    await settings.createPersonalL1();
    await settings.createPersonalL2();
    await settings.createPersonalL3();
    await settings.addPersonalChild({ level: 1, node: initialTree[0] });
    await settings.renamePersonalNode(initialTree[0]);
    await settings.deletePersonalNode(1, 'l1');

    assert.strictEqual(settings.personalKnowledgeTree.value, initialTree);
    assert.equal(settings.personalL1Name.value, '   ');
    assert.equal(settings.personalL2Name.value, '保留二级输入');
    assert.equal(settings.personalL3Name.value, '保留三级输入');
    assert.equal(settings.selectedPersonalL1Id.value, 'missing');
    assert.equal(settings.selectedPersonalL2Id.value, 'missing');
    assert.deepEqual(calls.requestText, [
        ['二级方向名称', ''],
        ['新的知识点名称', '代数']
    ]);
    assert.deepEqual(calls.confirmAction, ['确定删除这个知识点及其下级吗？']);
    assert.deepEqual(calls.createId, []);
    assert.deepEqual(calls.treePersists, []);
    assert.equal(calls.now, 0);
});

test('an exercised action fails loudly when its explicit effect dependency is missing', async () => {
    const base = makeHarness();

    const withoutEnsure = { ...base.dependencies };
    delete withoutEnsure.ensureImagePackagesForLatex;
    const templateSettings = useSettings(base.context, withoutEnsure);
    templateSettings.currentPresetKey.value = 'standard';
    await assert.rejects(
        templateSettings.updateExistingCustomTemplate(),
        /useSettings requires ensureImagePackagesForLatex/
    );

    const withoutCreateId = { ...base.dependencies };
    delete withoutCreateId.createId;
    const createSettings = useSettings(base.context, withoutCreateId);
    createSettings.personalL1Name.value = '几何';
    await assert.rejects(
        createSettings.createPersonalL1(),
        /useSettings requires createId/
    );

    const withoutRequest = { ...base.dependencies };
    delete withoutRequest.requestText;
    const requestSettings = useSettings(base.context, withoutRequest);
    await assert.rejects(
        requestSettings.addPersonalChild({ level: 1, node: {} }),
        /useSettings requires requestText/
    );

    const withoutConfirm = { ...base.dependencies };
    delete withoutConfirm.confirmAction;
    const deleteSettings = useSettings(base.context, withoutConfirm);
    await assert.rejects(
        deleteSettings.deletePersonalNode(1, 'l1'),
        /useSettings requires confirmAction/
    );
});

test('construction rejects missing primitives, constants, and shared refs with named errors', () => {
    const { context, dependencies } = makeHarness();

    assert.throws(
        () => useSettings(context, { ...dependencies, ref: undefined }),
        /useSettings requires ref/
    );
    const noDefault = { ...dependencies };
    delete noDefault.DEFAULT_TEMPLATE;
    assert.throws(
        () => useSettings(context, noDefault),
        /useSettings requires DEFAULT_TEMPLATE/
    );
    assert.throws(
        () => useSettings({ ...context, hoverPersonalL1: null }, dependencies),
        /useSettings requires context\.hoverPersonalL1 ref/
    );
    assert.throws(
        () => useSettings({ ...context, selectedExamTemplate: null }, dependencies),
        /useSettings requires context\.selectedExamTemplate ref/
    );
});
