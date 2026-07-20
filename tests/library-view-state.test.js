const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildQuestionFingerprintMaps,
    collectKnowledgeNames,
    flattenKnowledgeTree,
    filterLibraryQuestions
} = require('../qisi-library-view-state.js');

const deepClone = value => JSON.parse(JSON.stringify(value));

const systemTree = [
    {
        id: 'algebra',
        name: '代数',
        children: [
            { id: 'linear', name: '一次函数' },
            {
                id: 'quadratic',
                name: '二次函数',
                children: [{ id: 'vertex', name: '顶点式' }]
            }
        ]
    },
    { id: 'geometry', name: '几何' }
];

const personalTree = [
    {
        id: 'personal-root',
        name: '错题',
        children: [{ id: 'personal-child', name: '易错函数' }]
    }
];

const findNode = (tree, name) => {
    for (const node of tree || []) {
        if (node.name === name) return node;
        const child = findNode(node.children, name);
        if (child) return child;
    }
    return null;
};

const getQuestionKnowledge = (question, type) => (
    type === 'personal' ? question?.personalKnowledge : question?.systemKnowledge
);

const matchAllExistingQuestions = question => Boolean(question);

test('buildQuestionFingerprintMaps keeps the first matching question by identity', () => {
    const first = Object.freeze({ id: 'first', core: 'same-core', stemKey: 'same-stem' });
    const duplicate = Object.freeze({ id: 'duplicate', core: 'same-core', stemKey: 'same-stem' });
    const independent = Object.freeze({ id: 'independent', core: 'other-core', stemKey: '' });
    const blank = Object.freeze({ id: 'blank', core: '', stemKey: '' });
    const items = Object.freeze([first, null, duplicate, independent, blank]);

    const { coreMap, stemMap } = buildQuestionFingerprintMaps(items, {
        coreFingerprint: question => question.core,
        stemFingerprint: question => question.stemKey
    });

    assert.equal(coreMap.get('same-core'), first);
    assert.equal(stemMap.get('same-stem'), first);
    assert.equal(coreMap.get('other-core'), independent);
    assert.equal(coreMap.size, 2);
    assert.equal(stemMap.size, 1);
});

test('buildQuestionFingerprintMaps returns independent empty maps and requires both dependencies', () => {
    const dependencies = {
        coreFingerprint: question => question.core,
        stemFingerprint: question => question.stem
    };
    const first = buildQuestionFingerprintMaps(null, dependencies);
    const second = buildQuestionFingerprintMaps([], dependencies);

    assert.deepEqual([...first.coreMap], []);
    assert.deepEqual([...first.stemMap], []);
    assert.notEqual(first.coreMap, second.coreMap);
    assert.notEqual(first.stemMap, second.stemMap);
    assert.throws(
        () => buildQuestionFingerprintMaps([], { coreFingerprint: dependencies.coreFingerprint }),
        /coreFingerprint and stemFingerprint/
    );
});

test('collectKnowledgeNames returns the target and all descendants without mutation', () => {
    const before = deepClone(systemTree);

    assert.deepEqual(
        collectKnowledgeNames(systemTree[0]),
        ['代数', '一次函数', '二次函数', '顶点式']
    );
    assert.deepEqual(collectKnowledgeNames(null), []);
    assert.deepEqual(systemTree, before);
});

test('flattenKnowledgeTree preserves traversal order and caller prefix', () => {
    const before = deepClone(systemTree);
    const prefix = Object.freeze(['高中数学']);

    assert.deepEqual(flattenKnowledgeTree(systemTree, prefix), [
        { id: 'algebra', name: '代数', path: '高中数学 / 代数' },
        { id: 'linear', name: '一次函数', path: '高中数学 / 代数 / 一次函数' },
        { id: 'quadratic', name: '二次函数', path: '高中数学 / 代数 / 二次函数' },
        { id: 'vertex', name: '顶点式', path: '高中数学 / 代数 / 二次函数 / 顶点式' },
        { id: 'geometry', name: '几何', path: '高中数学 / 几何' }
    ]);
    assert.deepEqual(flattenKnowledgeTree(null), []);
    assert.deepEqual(systemTree, before);
    assert.deepEqual(prefix, ['高中数学']);
});

test('filterLibraryQuestions includes a selected node and all descendants', () => {
    const questions = [
        { id: 'root', systemKnowledge: '代数' },
        { id: 'child', systemKnowledge: '一次函数' },
        { id: 'grandchild', systemKnowledge: '顶点式' },
        { id: 'other', systemKnowledge: '几何' }
    ];
    const before = deepClone(questions);

    const result = filterLibraryQuestions(questions, {
        activeKnowledge: '代数',
        knowledgeType: 'system',
        knowledgeTree: systemTree,
        findNode,
        getQuestionKnowledge,
        questionMatchesLibraryFilters: matchAllExistingQuestions
    });

    assert.deepEqual(result.map(question => question.id), ['root', 'child', 'grandchild']);
    assert.equal(result[0], questions[0]);
    assert.equal(result[1], questions[1]);
    assert.deepEqual(questions, before);
});

test('filterLibraryQuestions uses the personal tree for personal knowledge', () => {
    const questions = [
        { id: 'personal-root', personalKnowledge: '错题', systemKnowledge: '几何' },
        { id: 'personal-child', personalKnowledge: '易错函数', systemKnowledge: '几何' },
        { id: 'system-only', personalKnowledge: '', systemKnowledge: '代数' }
    ];

    const result = filterLibraryQuestions(questions, {
        activeKnowledge: '错题',
        knowledgeType: 'personal',
        knowledgeTree: personalTree,
        findNode,
        getQuestionKnowledge,
        questionMatchesLibraryFilters: matchAllExistingQuestions
    });

    assert.deepEqual(result.map(question => question.id), ['personal-root', 'personal-child']);
});

test('filterLibraryQuestions falls back to exact knowledge when a node is absent', () => {
    const questions = [
        { id: 'exact', systemKnowledge: '临时分类' },
        { id: 'other', systemKnowledge: '代数' }
    ];

    const result = filterLibraryQuestions(questions, {
        activeKnowledge: '临时分类',
        knowledgeType: 'system',
        knowledgeTree: systemTree,
        findNode,
        getQuestionKnowledge,
        questionMatchesLibraryFilters: matchAllExistingQuestions
    });

    assert.deepEqual(result, [questions[0]]);
});

test('filterLibraryQuestions delegates keyword and filter semantics without cloning question objects', () => {
    const questions = [
        { id: 'keep', stem: '三角函数', type: '单选题' },
        { id: 'drop', stem: '数列', type: '解答题' },
        null
    ];
    const filters = Object.freeze({ type: '单选题' });
    const hasText = value => Boolean(String(value || '').trim());
    const calls = [];
    const matcher = (question, options) => {
        calls.push({ question, options });
        return Boolean(
            question &&
            question.type === options.filters.type &&
            question.stem.includes(options.keyword)
        );
    };

    const result = filterLibraryQuestions(questions, {
        keyword: '三角',
        filters,
        findNode: () => assert.fail('findNode must not run without active knowledge'),
        getQuestionKnowledge: () => assert.fail('getQuestionKnowledge must not run without active knowledge'),
        questionMatchesLibraryFilters: matcher,
        hasText
    });

    assert.deepEqual(result, [questions[0]]);
    assert.notEqual(result, questions);
    assert.equal(result[0], questions[0]);
    assert.equal(calls.length, 3);
    for (const call of calls) {
        assert.equal(call.options.keyword, '三角');
        assert.equal(call.options.filters, filters);
        assert.equal(call.options.hasText, hasText);
    }
});

test('filterLibraryQuestions handles empty input and fails fast for missing dependencies', () => {
    assert.deepEqual(filterLibraryQuestions(null, {
        questionMatchesLibraryFilters: matchAllExistingQuestions
    }), []);
    assert.throws(() => filterLibraryQuestions([], {}), /questionMatchesLibraryFilters/);
    assert.throws(() => filterLibraryQuestions([], {
        activeKnowledge: '代数',
        questionMatchesLibraryFilters: matchAllExistingQuestions
    }), /findNode and getQuestionKnowledge/);
});
