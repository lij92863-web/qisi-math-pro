const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../qisi-personal-knowledge-model.js');

test('flattenRows walks expanded levels and records parent links', () => {
    const tree = [{
        id: 'l1', name: 'L1', children: [
            { id: 'l2a', name: 'L2A', children: [{ id: 'l3', name: 'L3' }] },
            { id: 'l2b', name: 'L2B', expanded: false, children: [{ id: 'hidden', name: 'H' }] }
        ]
    }];
    const rows = model.flattenRows(tree);
    assert.deepEqual(rows.map(row => [row.node.id, row.level, row.parent?.id ?? null, row.grandParent?.id ?? null]), [
        ['l1', 1, null, null],
        ['l2a', 2, 'l1', 'l1'],
        ['l3', 3, 'l2a', 'l1'],
        ['l2b', 2, 'l1', 'l1']
    ]);
    assert.equal(rows[0].hasChildren, true);
    assert.equal(rows[3].hasChildren, true);
    assert.equal(rows[1].hasChildren, true);
});

test('flattenRows does not descend into collapsed nodes and tolerates bad input', () => {
    assert.deepEqual(model.flattenRows(null), []);
    assert.deepEqual(model.flattenRows([{ id: 'a' }]).map(row => row.node.id), ['a']);
    const rows = model.flattenRows([{ id: 'a', expanded: false, children: [{ id: 'b' }] }]);
    assert.deepEqual(rows.map(row => row.node.id), ['a']);
});

test('flattenRows keeps a caller-provided accumulator', () => {
    const existing = [{ node: { id: 'seed' }, level: 1 }];
    const rows = model.flattenRows([{ id: 'a' }], 1, null, null, existing);
    assert.equal(rows, existing);
    assert.deepEqual(rows.map(row => row.node.id), ['seed', 'a']);
});

test('buildNode creates the level 1/2 shape with children and expanded state', () => {
    assert.deepEqual(model.buildNode({ id: 'n1', name: '方向', level: 1 }), { id: 'n1', name: '方向', children: [], expanded: true });
    assert.deepEqual(model.buildNode({ id: 'n2', name: '章节', level: 2 }), { id: 'n2', name: '章节', children: [], expanded: true });
});

test('buildNode creates the level 3 leaf shape without children', () => {
    assert.deepEqual(model.buildNode({ id: 'n3', name: '知识点', level: 3 }), { id: 'n3', name: '知识点' });
});

test('buildNode fails closed without id or name', () => {
    assert.throws(() => model.buildNode({ id: '', name: 'x' }), error => error.code === 'PERSONAL_KNOWLEDGE_NODE_INVALID');
    assert.throws(() => model.buildNode({ id: 'n', name: '  ' }), error => error.code === 'PERSONAL_KNOWLEDGE_NODE_INVALID');
});
