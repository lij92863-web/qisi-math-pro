const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { useLibrary } = require('../qisi-library-composable.js');
const LibraryViewState = require('../qisi-library-view-state.js');
const UiEvents = require('../qisi-ui-events.js');
const Utils = require('../qisi-utils.js');

const ROOT = path.join(__dirname, '..');

const createVueHarness = () => {
    const refInputs = [];
    const reactiveInputs = [];
    const computedGetters = [];
    const dependencies = {
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
    return { dependencies, refInputs, reactiveInputs, computedGetters };
};

const ref = value => ({ value });

const makeSystemTree = () => [{
    id: 'system-root',
    name: '代数',
    children: [{
        id: 'system-group',
        name: '函数',
        children: [
            { id: 'system-quadratic', name: '二次函数' },
            { id: 'system-linear', name: '一次函数' }
        ]
    }]
}];

const makePersonalTree = () => [{
    id: 'personal-root',
    name: '我的分类',
    children: [{ id: 'personal-leaf', name: '错题' }]
}];

const getQuestionKnowledge = (question, type) => (
    type === 'personal' ? question.personalKnowledge : question.systemKnowledge
);

const hasText = value => String(value || '').trim().length > 0;

const defaultQuestions = () => [
    {
        id: 'q1',
        stem: 'target quadratic',
        answer: 'A',
        solution: '完整解析',
        type: '单选题',
        diff: '中等',
        grade: '高一',
        images: [{ id: 'img1' }],
        systemKnowledge: '二次函数',
        personalKnowledge: '错题'
    },
    {
        id: 'q2',
        stem: 'linear',
        answer: 'B',
        solution: '',
        type: '单选题',
        diff: '简单',
        grade: '高一',
        images: [],
        systemKnowledge: '一次函数',
        personalKnowledge: ''
    },
    {
        id: 'q3',
        stem: 'geometry',
        answer: '',
        solution: '证明',
        type: '解答题',
        diff: '困难',
        grade: '高二',
        images: [],
        systemKnowledge: '立体几何',
        personalKnowledge: '错题'
    }
];

const makeLibrary = (options = {}) => {
    const harness = createVueHarness();
    const questions = options.questions || ref(defaultQuestions());
    const knowledgeTree = options.knowledgeTree || makeSystemTree();
    const personalKnowledgeTree = options.personalKnowledgeTree || ref(makePersonalTree());
    const activeExternalBatchId = options.activeExternalBatchId || ref('batch-1');
    const externalPickMode = options.externalPickMode || ref(true);
    const selectedExternalIds = options.selectedExternalIds || ref(['external-1']);
    const context = {
        questions,
        knowledgeTree,
        personalKnowledgeTree,
        activeExternalBatchId,
        externalPickMode,
        selectedExternalIds,
        ...(options.context || {})
    };
    const dependencies = {
        ...harness.dependencies,
        LibraryViewState,
        UiEvents,
        Utils,
        getQuestionKnowledge,
        questionCoreFingerprint: question => `core:${question.id}`,
        questionStemFingerprint: question => `stem:${question.stem}`,
        hasText,
        ...(options.dependencies || {})
    };

    return {
        ...harness,
        context,
        dependencies,
        library: useLibrary(context, dependencies)
    };
};

test('library composable exposes useLibrary in Node and the browser without hidden infrastructure', () => {
    assert.equal(typeof useLibrary, 'function');

    const source = fs.readFileSync(
        path.join(ROOT, 'qisi-library-composable.js'),
        'utf8'
    );
    const browser = {};
    vm.runInNewContext(source, browser, { filename: 'qisi-library-composable.js' });

    assert.equal(typeof browser.Qisi.LibraryComposable.useLibrary, 'function');
    const browserHarness = createVueHarness();
    const browserLibrary = browser.Qisi.LibraryComposable.useLibrary({
        questions: ref([]),
        knowledgeTree: [],
        personalKnowledgeTree: ref([]),
        activeExternalBatchId: ref(null),
        externalPickMode: ref(false),
        selectedExternalIds: ref([])
    }, browserHarness.dependencies);
    assert.equal(browserLibrary.currentPage.value, 1);
    assert.equal(browserLibrary.pageSize, 10);
    assert.doesNotMatch(
        source,
        /\b(?:window|document|fetch|indexedDB|localStorage|sessionStorage)\b/
    );
    assert.doesNotMatch(source, /\bdb\s*\./);
    assert.doesNotMatch(source, /\bDate\b|Math\.random|\bsetTimeout\b|\bclearTimeout\b/);
});

test('construction owns exact legacy defaults and triggers zero domain or external effects', () => {
    const calls = { maps: 0, filter: 0, counts: 0, core: 0, stem: 0, knowledge: 0 };
    const LibraryViewStateSpy = {
        buildQuestionFingerprintMaps() {
            calls.maps += 1;
        },
        filterLibraryQuestions() {
            calls.filter += 1;
            return [];
        }
    };
    const UiEventsSpy = {
        buildKnowledgeCounts() {
            calls.counts += 1;
            return {};
        }
    };
    const sourceQuestions = ref(defaultQuestions());
    const sourceTree = makeSystemTree();
    const personalTree = ref(makePersonalTree());
    const externalBatch = ref('batch-kept');
    const pickMode = ref(true);
    const selected = ref(['kept']);
    const result = makeLibrary({
        questions: sourceQuestions,
        knowledgeTree: sourceTree,
        personalKnowledgeTree: personalTree,
        activeExternalBatchId: externalBatch,
        externalPickMode: pickMode,
        selectedExternalIds: selected,
        dependencies: {
            LibraryViewState: LibraryViewStateSpy,
            UiEvents: UiEventsSpy,
            questionCoreFingerprint() {
                calls.core += 1;
            },
            questionStemFingerprint() {
                calls.stem += 1;
            },
            getQuestionKnowledge() {
                calls.knowledge += 1;
            }
        }
    });
    const { library } = result;

    assert.equal(library.currentPage.value, 1);
    assert.equal(library.pageSize, 10);
    assert.equal(library.librarySearchInput.value, '');
    assert.equal(library.librarySearchKeyword.value, '');
    assert.deepEqual(library.libraryFilters, {
        type: '',
        diff: '',
        grade: '',
        answerState: '',
        imageState: ''
    });
    assert.ok(library.coreFingerprintMap.value instanceof Map);
    assert.ok(library.stemFingerprintMap.value instanceof Map);
    assert.notStrictEqual(
        library.coreFingerprintMap.value,
        library.stemFingerprintMap.value
    );
    assert.equal(library.activeKnowledge.value, null);
    assert.equal(library.activeKnowledgeType.value, 'system');
    assert.equal(library.libraryKnowledgeMode.value, 'system');
    assert.strictEqual(result.reactiveInputs[0], library.libraryFilters);
    assert.equal(result.computedGetters.length, 7);
    assert.deepEqual(calls, {
        maps: 0,
        filter: 0,
        counts: 0,
        core: 0,
        stem: 0,
        knowledge: 0
    });
    assert.equal(externalBatch.value, 'batch-kept');
    assert.equal(pickMode.value, true);
    assert.deepEqual(selected.value, ['kept']);
    assert.strictEqual(sourceQuestions.value, result.context.questions.value);
    assert.strictEqual(sourceTree, result.context.knowledgeTree);
    assert.strictEqual(personalTree.value, result.context.personalKnowledgeTree.value);
});

test('filter reset preserves the reactive object identity and resets every legacy field and page', () => {
    const { library } = makeLibrary();
    const filters = library.libraryFilters;
    Object.assign(filters, {
        type: '单选题',
        diff: '困难',
        grade: '高三',
        answerState: 'hasAnswer',
        imageState: 'hasImage'
    });
    library.librarySearchInput.value = 'input';
    library.librarySearchKeyword.value = 'keyword';
    library.currentPage.value = 7;

    assert.equal(library.resetLibraryFilters(), undefined);

    assert.strictEqual(library.libraryFilters, filters);
    assert.deepEqual(filters, {
        type: '',
        diff: '',
        grade: '',
        answerState: '',
        imageState: ''
    });
    assert.equal(library.librarySearchInput.value, '');
    assert.equal(library.librarySearchKeyword.value, '');
    assert.equal(library.currentPage.value, 1);
});

test('fingerprint map rebuild delegates exact identities and replaces both map refs', () => {
    const items = Object.freeze([
        Object.freeze({ id: 'first', stem: 'same' }),
        Object.freeze({ id: 'second', stem: 'same' })
    ]);
    const calls = [];
    const coreFingerprint = question => `core:${question.id}`;
    const stemFingerprint = question => `stem:${question.stem}`;
    const coreMap = new Map([['core:first', items[0]]]);
    const stemMap = new Map([['stem:same', items[0]]]);
    const { library } = makeLibrary({
        dependencies: {
            questionCoreFingerprint: coreFingerprint,
            questionStemFingerprint: stemFingerprint,
            LibraryViewState: {
                ...LibraryViewState,
                buildQuestionFingerprintMaps(source, policy) {
                    calls.push({ source, policy });
                    return { coreMap, stemMap };
                }
            }
        }
    });
    const previousCore = library.coreFingerprintMap.value;
    const previousStem = library.stemFingerprintMap.value;

    assert.equal(library.buildQuestionFingerprintMaps(items), undefined);

    assert.strictEqual(calls[0].source, items);
    assert.strictEqual(calls[0].policy.coreFingerprint, coreFingerprint);
    assert.strictEqual(calls[0].policy.stemFingerprint, stemFingerprint);
    assert.strictEqual(library.coreFingerprintMap.value, coreMap);
    assert.strictEqual(library.stemFingerprintMap.value, stemMap);
    assert.notStrictEqual(library.coreFingerprintMap.value, previousCore);
    assert.notStrictEqual(library.stemFingerprintMap.value, previousStem);
});

test('system, personal, and external knowledge modes preserve tree, count, and filtering semantics', () => {
    const questions = defaultQuestions();
    const systemTree = makeSystemTree();
    const personalTree = makePersonalTree();
    const { library } = makeLibrary({
        questions: ref(questions),
        knowledgeTree: systemTree,
        personalKnowledgeTree: ref(personalTree)
    });

    assert.strictEqual(library.activeKnowledgeTree.value, systemTree);
    assert.deepEqual(library.knowledgeCounts.value, {
        '二次函数': 1,
        '函数': 2,
        '代数': 2,
        '一次函数': 1,
        '立体几何': 1
    });
    library.handleKnowledgeSelect({ name: '函数', type: 'system' });
    assert.deepEqual(library.filteredQuestions.value.map(item => item.id), ['q1', 'q2']);

    library.switchLibraryKnowledgeMode('personal');
    assert.strictEqual(library.activeKnowledgeTree.value, personalTree);
    assert.deepEqual(library.personalKnowledgeCounts.value, {
        '错题': 2,
        '我的分类': 2
    });
    assert.deepEqual(library.activeKnowledgeCounts.value, {
        '错题': 2,
        '我的分类': 2
    });
    library.handleKnowledgeSelect('错题');
    assert.equal(library.activeKnowledgeType.value, 'personal');
    assert.deepEqual(library.filteredQuestions.value.map(item => item.id), ['q1', 'q3']);

    library.switchLibraryKnowledgeMode('external');
    assert.deepEqual(library.activeKnowledgeTree.value, []);
    assert.deepEqual(library.activeKnowledgeCounts.value, {});
    assert.equal(library.activeKnowledge.value, null);
    assert.equal(library.activeKnowledgeType.value, 'external');
});

test('keyword, metadata, answer, and image filters feed pagination without cloning questions', () => {
    const source = defaultQuestions();
    const { library } = makeLibrary({ questions: ref(source) });
    library.librarySearchKeyword.value = 'TARGET';
    Object.assign(library.libraryFilters, {
        type: '单选题',
        diff: '中等',
        grade: '高一',
        answerState: 'hasAnswer',
        imageState: 'hasImage'
    });

    assert.deepEqual(library.filteredQuestions.value, [source[0]]);
    assert.strictEqual(library.filteredQuestions.value[0], source[0]);
    assert.equal(library.totalPages.value, 1);
    assert.deepEqual(library.paginatedQuestions.value, [source[0]]);

    const many = Array.from({ length: 21 }, (_, index) => ({
        id: `page-${index + 1}`,
        stem: `题目 ${index + 1}`,
        solution: '',
        images: [],
        systemKnowledge: '',
        personalKnowledge: ''
    }));
    const paged = makeLibrary({ questions: ref(many) }).library;
    assert.equal(paged.totalPages.value, 3);
    paged.currentPage.value = 2;
    assert.deepEqual(
        paged.paginatedQuestions.value.map(item => item.id),
        Array.from({ length: 10 }, (_, index) => `page-${index + 11}`)
    );
    paged.currentPage.value = 3;
    assert.deepEqual(paged.paginatedQuestions.value, [many[20]]);
});

test('mode switches and knowledge selection reset page with exact external-selection cleanup', () => {
    const activeExternalBatchId = ref('batch-7');
    const externalPickMode = ref(true);
    const originalSelection = ['external-a', 'external-b'];
    const selectedExternalIds = ref(originalSelection);
    const { library } = makeLibrary({
        activeExternalBatchId,
        externalPickMode,
        selectedExternalIds
    });
    library.currentPage.value = 5;
    library.activeKnowledge.value = '旧知识点';

    library.switchLibraryKnowledgeMode('external');

    assert.equal(library.libraryKnowledgeMode.value, 'external');
    assert.equal(library.activeKnowledgeType.value, 'external');
    assert.equal(library.activeKnowledge.value, null);
    assert.equal(library.currentPage.value, 1);
    assert.equal(activeExternalBatchId.value, 'batch-7');
    assert.equal(externalPickMode.value, true);
    assert.strictEqual(selectedExternalIds.value, originalSelection);

    library.currentPage.value = 4;
    library.switchLibraryKnowledgeMode('system');

    assert.equal(library.libraryKnowledgeMode.value, 'system');
    assert.equal(activeExternalBatchId.value, null);
    assert.equal(externalPickMode.value, false);
    assert.deepEqual(selectedExternalIds.value, []);
    assert.notStrictEqual(selectedExternalIds.value, originalSelection);
    assert.equal(library.currentPage.value, 1);

    library.currentPage.value = 3;
    library.handleKnowledgeSelect({ name: '二次函数', type: '' });
    assert.equal(library.activeKnowledge.value, '二次函数');
    assert.equal(library.activeKnowledgeType.value, 'system');
    assert.equal(library.currentPage.value, 1);
});

test('shared refs and exercised dependencies fail loudly with named boundaries', () => {
    assert.throws(() => useLibrary(), /useLibrary requires ref/);

    const harness = createVueHarness();
    assert.throws(
        () => useLibrary({}, harness.dependencies),
        /context\.questions ref/
    );

    const complete = makeLibrary();
    assert.throws(
        () => useLibrary(
            { ...complete.context, knowledgeTree: null },
            complete.dependencies
        ),
        /context\.knowledgeTree array/
    );
    assert.throws(
        () => useLibrary(
            { ...complete.context, selectedExternalIds: null },
            complete.dependencies
        ),
        /context\.selectedExternalIds ref/
    );

    const noDomain = useLibrary(complete.context, harness.dependencies);
    assert.throws(
        () => noDomain.filteredQuestions.value,
        /LibraryViewState\.filterLibraryQuestions/
    );
    assert.throws(
        () => noDomain.knowledgeCounts.value,
        /UiEvents\.buildKnowledgeCounts/
    );
    assert.throws(
        () => noDomain.buildQuestionFingerprintMaps([]),
        /LibraryViewState\.buildQuestionFingerprintMaps/
    );

    const noCore = useLibrary(complete.context, {
        ...harness.dependencies,
        LibraryViewState
    });
    assert.throws(
        () => noCore.buildQuestionFingerprintMaps([]),
        /questionCoreFingerprint/
    );

    const noUtils = useLibrary(complete.context, {
        ...harness.dependencies,
        LibraryViewState,
        getQuestionKnowledge,
        hasText
    });
    assert.throws(
        () => noUtils.filteredQuestions.value,
        /Utils\.findNode/
    );
});
