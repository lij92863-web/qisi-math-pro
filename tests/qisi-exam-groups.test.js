const test = require('node:test');
const assert = require('node:assert/strict');
const groups = require('../qisi-exam-groups.js');

const q = (id, type) => ({ id, type });

test('groupQuestions groups by type, orders known types first and keeps item order', () => {
    const list = [q('a', '解答题'), q('b', '单选题'), q('c', '单选题'), q('d', '其他')];
    const result = groups.groupQuestions({
        questions: list,
        typeOrder: ['单选题', '解答题'],
        defaultGroupConfig: { 单选题: { title: '一、单选题', points: 5 }, 解答题: { title: '二、解答题', points: 10 } }
    });
    assert.deepEqual(result.map(group => group.type), ['单选题', '解答题', '其他']);
    assert.deepEqual(result[0].items.map(item => item.id), ['b', 'c']);
    assert.equal(result[0].count, 2);
    assert.equal(result[0].points, 5);
    assert.equal(result[0].total, 10);
    assert.equal(result[0].title, '一、单选题');
    assert.equal(result[0].text, '一、单选题：本大题共 2 小题，每小题 5 分，共计 10 分。');
});

test('groupQuestions honours per-question points and custom text', () => {
    const result = groups.groupQuestions({
        questions: [q('a', '单选题'), q('b', '单选题')],
        questionMeta: { b: { points: 3 } },
        groupConfig: { 单选题: { title: '选择', points: 5, text: '自定义说明' } }
    });
    assert.equal(result[0].total, 8);
    assert.equal(result[0].text, '自定义说明');
});

test('groupQuestions falls back to type labels and tolerates empty input', () => {
    const result = groups.groupQuestions({ questions: [q('a', '填空题')], typeLabels: { 填空题: '填空' } });
    assert.equal(result[0].title, '填空');
    assert.equal(result[0].points, 0);
    assert.deepEqual(groups.groupQuestions({ questions: null }), []);
});

test('reorderWithinType moves a question inside its own type only', () => {
    const questions = [q('a', '单选题'), q('b', '单选题'), q('c', '解答题'), q('d', '单选题')];
    const cart = ['a', 'b', 'c', 'd'];
    const moved = groups.reorderWithinType({ sourceId: 'd', targetIndex: 0, cart, questions });
    assert.equal(moved.changed, true);
    assert.deepEqual(moved.cart, ['d', 'a', 'c', 'b']);
});

test('reorderWithinType clamps the target and reports a no-op', () => {
    const questions = [q('a', '单选题'), q('b', '单选题')];
    assert.deepEqual(groups.reorderWithinType({ sourceId: 'a', targetIndex: 99, cart: ['a', 'b'], questions }).cart, ['b', 'a']);
    const same = groups.reorderWithinType({ sourceId: 'a', targetIndex: 0, cart: ['a', 'b'], questions });
    assert.equal(same.changed, false);
    assert.deepEqual(same.cart, ['a', 'b']);
});

test('reorderWithinType ignores an unknown source', () => {
    const result = groups.reorderWithinType({ sourceId: 'missing', targetIndex: 0, cart: ['a'], questions: [q('a', '单选题')] });
    assert.equal(result.changed, false);
    assert.deepEqual(result.cart, ['a']);
});
