const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
    appendPersonalNode,
    buildPersonalTreeRows,
    deletePersonalNode,
    findPersonalNodeById,
    renamePersonalNode,
    togglePersonalNodeExpanded
} = require('../qisi-knowledge-tree-state.js');

const ROOT = path.join(__dirname, '..');

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

const makeTree = () => [
    {
        id: 'l1-a',
        name: '代数',
        expanded: true,
        marker: 'root-a',
        children: [
            {
                id: 'l2-a',
                name: '函数',
                expanded: true,
                marker: 'branch-a',
                children: [
                    { id: 'l3-a', name: '定义域', marker: 'leaf-a' },
                    { id: 'l3-b', name: '值域', marker: 'leaf-b' }
                ]
            },
            {
                id: 'l2-b',
                name: '数列',
                expanded: false,
                marker: 'branch-b',
                children: [{ id: 'l3-c', name: '递推', marker: 'leaf-c' }]
            }
        ]
    },
    {
        id: 'l1-b',
        name: '几何',
        expanded: 0,
        marker: 'root-b',
        children: [{ id: 'l2-c', name: '立体几何', children: 'not-an-array' }]
    }
];

test('knowledge tree state exposes the same API in Node and a browser global', () => {
    assert.equal(typeof appendPersonalNode, 'function');
    assert.equal(typeof buildPersonalTreeRows, 'function');
    assert.equal(typeof deletePersonalNode, 'function');
    assert.equal(typeof findPersonalNodeById, 'function');
    assert.equal(typeof renamePersonalNode, 'function');
    assert.equal(typeof togglePersonalNodeExpanded, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-knowledge-tree-state.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);

    assert.equal(typeof context.Qisi.KnowledgeTreeState.appendPersonalNode, 'function');
    assert.equal(typeof context.Qisi.KnowledgeTreeState.buildPersonalTreeRows, 'function');
    assert.equal(typeof context.Qisi.KnowledgeTreeState.deletePersonalNode, 'function');
    assert.equal(typeof context.Qisi.KnowledgeTreeState.findPersonalNodeById, 'function');
    assert.equal(typeof context.Qisi.KnowledgeTreeState.renamePersonalNode, 'function');
    assert.equal(typeof context.Qisi.KnowledgeTreeState.togglePersonalNodeExpanded, 'function');
});

test('buildPersonalTreeRows preserves visible order, parent links, and legacy grandParent links', () => {
    const tree = deepFreeze(makeTree());
    const rows = buildPersonalTreeRows(tree);

    assert.deepEqual(rows.map(row => [row.node.id, row.level, row.hasChildren]), [
        ['l1-a', 1, true],
        ['l2-a', 2, true],
        ['l3-a', 3, false],
        ['l3-b', 3, false],
        ['l2-b', 2, true],
        ['l1-b', 1, true],
        ['l2-c', 2, false]
    ]);

    assert.equal(rows.some(row => row.node.id === 'l3-c'), false);
    assert.strictEqual(rows[0].node, tree[0]);
    assert.equal(rows[0].parent, null);
    assert.equal(rows[0].grandParent, null);
    assert.strictEqual(rows[1].parent, tree[0]);
    assert.strictEqual(rows[1].grandParent, tree[0]);
    assert.strictEqual(rows[2].parent, tree[0].children[0]);
    assert.strictEqual(rows[2].grandParent, tree[0]);
    assert.strictEqual(rows[6].parent, tree[1]);
    assert.strictEqual(rows[6].grandParent, tree[1]);
});

test('buildPersonalTreeRows treats only expanded false as collapsed and ignores non-array children', () => {
    const falseNode = { id: 'false', expanded: false, children: [{ id: 'hidden' }] };
    const falsyNodes = [
        { id: 'zero', expanded: 0, children: [{ id: 'zero-child' }] },
        { id: 'null', expanded: null, children: [{ id: 'null-child' }] },
        { id: 'missing', children: [{ id: 'missing-child' }] },
        { id: 'malformed', children: { id: 'not-visible' } },
        falseNode
    ];

    assert.deepEqual(buildPersonalTreeRows(falsyNodes).map(row => row.node.id), [
        'zero',
        'zero-child',
        'null',
        'null-child',
        'missing',
        'missing-child',
        'malformed',
        'false'
    ]);
    assert.deepEqual(buildPersonalTreeRows(null), []);
});

test('findPersonalNodeById returns the first depth-first strict-id match', () => {
    const nestedFirst = { id: 'duplicate', name: 'nested first' };
    const rootLater = { id: 'duplicate', name: 'root later' };
    const numeric = { id: 1, name: 'numeric' };
    const tree = [
        { id: 'root', children: [nestedFirst] },
        rootLater,
        numeric
    ];

    assert.strictEqual(findPersonalNodeById(tree, 'duplicate'), nestedFirst);
    assert.strictEqual(findPersonalNodeById(tree, 1), numeric);
    assert.equal(findPersonalNodeById(tree, '1'), null);
    assert.equal(findPersonalNodeById(null, 'missing'), null);
});

test('appendPersonalNode appends an unchanged caller node at the root', () => {
    const tree = deepFreeze(makeTree());
    const child = deepFreeze({ id: 'new-root', name: '自定义形状', custom: { keep: true } });

    const result = appendPersonalNode(tree, null, child);

    assert.notStrictEqual(result, tree);
    assert.strictEqual(result[0], tree[0]);
    assert.strictEqual(result[1], tree[1]);
    assert.strictEqual(result[2], child);
    assert.equal(Object.hasOwn(result[2], 'children'), false);
    assert.equal(Object.hasOwn(result[2], 'expanded'), false);
    assert.equal(tree.length, 2);
});

test('appendPersonalNode matches its parent by object identity and clones only that path', () => {
    const tree = makeTree();
    tree[1].children[0].id = 'l2-a';
    const frozen = deepFreeze(tree);
    const target = frozen[0].children[0];
    const duplicateId = frozen[1].children[0];
    const child = deepFreeze({ id: 'new-leaf', name: '新节点', arbitrary: 7 });

    const result = appendPersonalNode(frozen, target, child);

    assert.notStrictEqual(result, frozen);
    assert.notStrictEqual(result[0], frozen[0]);
    assert.notStrictEqual(result[0].children, frozen[0].children);
    assert.notStrictEqual(result[0].children[0], target);
    assert.strictEqual(result[0].children[1], frozen[0].children[1]);
    assert.strictEqual(result[1], frozen[1]);
    assert.strictEqual(result[1].children[0], duplicateId);
    assert.equal(result[0].children[0].expanded, true);
    assert.strictEqual(result[0].children[0].children.at(-1), child);
    assert.equal(Object.hasOwn(child, 'children'), false);
    assert.equal(target.children.length, 2);
});

test('appendPersonalNode preserves no-op identity and legacy malformed-children failure', () => {
    const tree = deepFreeze(makeTree());
    const absent = { id: 'l2-a', name: 'same id, different object' };

    assert.strictEqual(appendPersonalNode(tree, absent, { id: 'child' }), tree);

    const malformed = [{ id: 'root', children: 'truthy malformed children' }];
    assert.throws(
        () => appendPersonalNode(malformed, malformed[0], { id: 'child' }),
        TypeError
    );
});

test('togglePersonalNodeExpanded uses identity and the exact expanded-false toggle rule', () => {
    const duplicateId = { id: 'same', name: 'unchanged duplicate', expanded: true };
    const target = { id: 'same', name: 'target', children: [] };
    const tree = deepFreeze([
        { id: 'root', children: [target] },
        duplicateId
    ]);

    const collapsed = togglePersonalNodeExpanded(tree, target);
    assert.equal(collapsed[0].children[0].expanded, false);
    assert.notStrictEqual(collapsed[0], tree[0]);
    assert.strictEqual(collapsed[1], duplicateId);

    const expanded = togglePersonalNodeExpanded(collapsed, collapsed[0].children[0]);
    assert.equal(expanded[0].children[0].expanded, true);
    assert.strictEqual(togglePersonalNodeExpanded(tree, { id: 'same' }), tree);
    assert.equal(Object.hasOwn(target, 'expanded'), false);
});

test('renamePersonalNode matches identity, preserves supplied text, and shares unchanged branches', () => {
    const tree = deepFreeze(makeTree());
    const target = tree[0].children[1];

    const result = renamePersonalNode(tree, target, '  caller already decides trimming  ');

    assert.equal(result[0].children[1].name, '  caller already decides trimming  ');
    assert.notStrictEqual(result[0], tree[0]);
    assert.strictEqual(result[0].children[0], tree[0].children[0]);
    assert.strictEqual(result[1], tree[1]);
    assert.strictEqual(renamePersonalNode(tree, { id: target.id }, 'ignored'), tree);
    assert.strictEqual(renamePersonalNode(tree, target, target.name), tree);
    assert.equal(target.name, '数列');
});

test('deletePersonalNode level 1 removes every duplicate root id', () => {
    const keep = { id: 'keep', children: [] };
    const first = { id: 'duplicate', marker: 'first' };
    const second = { id: 'duplicate', marker: 'second' };
    const tree = deepFreeze([first, keep, second]);

    const result = deletePersonalNode(tree, 1, 'duplicate');

    assert.deepEqual(result, [keep]);
    assert.strictEqual(result[0], keep);
    assert.strictEqual(deletePersonalNode(tree, 1, 'missing'), tree);
});

test('deletePersonalNode level 2 changes only the first parent id and removes all duplicate child ids', () => {
    const keepChild = { id: 'keep-child' };
    const firstParent = {
        id: 'duplicate-parent',
        marker: 'first-parent',
        children: [
            { id: 'remove', marker: 'first' },
            keepChild,
            { id: 'remove', marker: 'second' }
        ]
    };
    const secondParent = {
        id: 'duplicate-parent',
        marker: 'second-parent',
        children: [{ id: 'remove', marker: 'must remain' }]
    };
    const tree = deepFreeze([firstParent, secondParent]);

    const result = deletePersonalNode(tree, 2, 'remove', 'duplicate-parent');

    assert.notStrictEqual(result, tree);
    assert.notStrictEqual(result[0], firstParent);
    assert.deepEqual(result[0].children, [keepChild]);
    assert.strictEqual(result[0].children[0], keepChild);
    assert.strictEqual(result[1], secondParent);
    assert.equal(result[1].children.length, 1);

    const missingChildrenParent = deepFreeze([{ id: 'parent-without-children', marker: 1 }]);
    const normalized = deletePersonalNode(missingChildrenParent, 2, 'absent', 'parent-without-children');
    assert.deepEqual(normalized, [{ id: 'parent-without-children', marker: 1, children: [] }]);
});

test('deletePersonalNode other levels scan every root but only the first matching level-2 parent per root', () => {
    const untouchedDuplicateParent = {
        id: 'parent',
        marker: 'second-in-root',
        children: [{ id: 'remove', marker: 'must remain' }]
    };
    const untouchedRoot = { id: 'unrelated-root', children: [{ id: 'other-parent', children: [] }] };
    const tree = deepFreeze([
        {
            id: 'root-a',
            children: [
                {
                    id: 'parent',
                    marker: 'first-in-root',
                    children: [{ id: 'remove' }, { id: 'keep-a' }, { id: 'remove' }]
                },
                untouchedDuplicateParent
            ]
        },
        {
            id: 'root-b',
            children: [{ id: 'parent', marker: 'first-in-root-b' }]
        },
        untouchedRoot
    ]);

    const result = deletePersonalNode(tree, 3, 'remove', 'parent');

    assert.deepEqual(result[0].children[0].children.map(node => node.id), ['keep-a']);
    assert.strictEqual(result[0].children[1], untouchedDuplicateParent);
    assert.deepEqual(result[1].children[0].children, []);
    assert.strictEqual(result[2], untouchedRoot);
    assert.equal(untouchedDuplicateParent.children.length, 1);
});

test('deletePersonalNode preserves the legacy else branch for non-numeric levels and malformed failures', () => {
    const tree = deepFreeze([
        {
            id: 'remove',
            children: [{ id: 'parent', children: [{ id: 'leaf' }] }]
        }
    ]);

    const result = deletePersonalNode(tree, '1', 'leaf', 'parent');
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].children[0].children, []);

    assert.strictEqual(deletePersonalNode(tree, 2, 'missing', 'absent-parent'), tree);
    assert.strictEqual(deletePersonalNode(tree, 3, 'missing', 'absent-parent'), tree);

    const malformedLevel2 = [{ id: 'parent', children: 'not-an-array' }];
    assert.throws(
        () => deletePersonalNode(malformedLevel2, 2, 'child', 'parent'),
        TypeError
    );

    const malformedLevel3 = [{ id: 'root', children: 'not-an-array' }];
    assert.throws(
        () => deletePersonalNode(malformedLevel3, 3, 'leaf', 'parent'),
        TypeError
    );
});
