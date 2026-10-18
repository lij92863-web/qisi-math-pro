const test = require('node:test');
const assert = require('node:assert/strict');

const Model = require('../qisi-handout-model.js');

const bank = () => ([
    { id: 'q1', stem: '题干一', options: ['A1', 'B1'], answer: 'A' },
    { id: 'q2', stem: '题干二', answer: 'B' },
    { id: 'q3', stem: '题干三', answer: 'C' },
    { id: 'q4', stem: '题干四', answer: 'D' }
]);

const codes = result => result.issues.map(item => item.code);

function questionIds(doc) {
    return doc.blocks.filter(block => block.type === 'question').map(block => block.questionId);
}

// 模拟老师拖拽后「只改了顺序、忘了重新编号」的状态：
// createDoc 会重编号，所以这里必须先建好文档再手改 blocks。
function withNumbers(doc, numbers) {
    let cursor = 0;
    return {
        ...doc,
        blocks: doc.blocks.map(block => {
            if (block.type !== 'question') return block;
            const no = numbers[cursor];
            cursor += 1;
            return { ...block, questionNo: no };
        })
    };
}

test('正常 3 题讲义：题号 1/2/3 连续，校验通过', () => {
    const doc = Model.createDoc({
        title: '导数的应用',
        blocks: [
            { type: 'heading', text: '一、知识梳理' },
            { type: 'note', text: '导数 $f(x)$ 的定义' },
            { type: 'question', questionId: 'q1' },
            { type: 'question', questionId: 'q2' },
            { type: 'divider' },
            { type: 'question', questionId: 'q3' }
        ]
    });

    assert.deepEqual(
        doc.blocks.filter(block => block.type === 'question').map(block => block.questionNo),
        [1, 2, 3]
    );

    const result = Model.validate(doc, bank());
    assert.equal(result.valid, true);
    assert.deepEqual(result.issues, []);
    assert.equal(result.doc, doc);
});

test('题号跳号报 number-gap，且不会自动重排', () => {
    const doc = withNumbers(Model.createDoc({
        blocks: ['q1', 'q2', 'q3'].map(id => ({ type: 'question', questionId: id }))
    }), [1, 2, 4]);

    const result = Model.validate(doc, bank());
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('number-gap'));
    // 关键：报错之后文档里的题号仍然是 4，没有被悄悄改成 3。
    assert.equal(doc.blocks[2].questionNo, 4);
});

test('题号重复报 number-duplicate', () => {
    const doc = withNumbers(Model.createDoc({
        blocks: ['q1', 'q2', 'q3'].map(id => ({ type: 'question', questionId: id }))
    }), [1, 1, 3]);

    const result = Model.validate(doc, bank());
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('number-duplicate'));
});

test('题号与出现顺序不一致报 number-sequence，renumber 后恢复', () => {
    const doc = Model.createDoc({
        blocks: ['q1', 'q2', 'q3'].map(id => ({ type: 'question', questionId: id }))
    });
    // 老师把第 3 题拖到最前面，但题号还锁着 3/1/2。
    const reordered = {
        ...doc,
        blocks: [doc.blocks[2], doc.blocks[0], doc.blocks[1]]
    };

    const broken = Model.validate(reordered, bank());
    assert.equal(broken.valid, false);
    assert.ok(codes(broken).includes('number-sequence'));

    const fixed = Model.renumber(reordered);
    assert.deepEqual(questionIds(fixed), ['q3', 'q1', 'q2']);
    assert.deepEqual(fixed.blocks.map(block => block.questionNo), [1, 2, 3]);
    assert.equal(Model.validate(fixed, bank()).valid, true);
    // 原对象不被修改。
    assert.equal(reordered.blocks[0].questionNo, 3);
});

test('缺少题号报 number-invalid', () => {
    const doc = Model.createDoc({
        blocks: [{ type: 'question', questionId: 'q1', questionNo: 0 }]
    });
    // createDoc 会补 1，这里直接构造一个坏文档。
    const broken = { ...doc, blocks: [{ type: 'question', questionId: 'q1', questionNo: null }] };
    const result = Model.validate(broken, bank());
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('number-invalid'));
});

test('引用不存在的题报 missing-question，不用别的题顶替', () => {
    const doc = Model.createDoc({
        blocks: ['q1', 'q-deleted'].map(id => ({ type: 'question', questionId: id }))
    });

    const result = Model.validate(doc, bank());
    assert.equal(result.valid, false);
    const hit = result.issues.find(item => item.code === 'missing-question');
    assert.ok(hit);
    assert.match(hit.detail, /q-deleted/);
    // 文档本身不变，没有把别的题塞进来。
    assert.deepEqual(questionIds(doc), ['q1', 'q-deleted']);
});

test('重复引用同一道题默认报 duplicate-question，allowDuplicates 放行', () => {
    const doc = Model.createDoc({
        blocks: [{ type: 'question', questionId: 'q1' }, { type: 'question', questionId: 'q1' }]
    });

    const strict = Model.validate(doc, bank());
    assert.equal(strict.valid, false);
    assert.ok(codes(strict).includes('duplicate-question'));

    const relaxed = Model.validate(doc, bank(), { allowDuplicates: true });
    assert.equal(relaxed.valid, true);
    assert.deepEqual(relaxed.issues, []);
});

test('空文档报 empty-doc', () => {
    const empty = Model.validate(Model.createDoc({ title: '空讲义' }), bank());
    assert.equal(empty.valid, false);
    assert.deepEqual(codes(empty), ['empty-doc']);

    const textOnly = Model.validate(Model.createDoc({
        blocks: [{ type: 'heading', text: '一、知识梳理' }]
    }), bank());
    assert.equal(textOnly.valid, false);
    assert.deepEqual(codes(textOnly), ['empty-doc']);
});

test('未知区块类型报 unknown-block，但不丢掉其它区块', () => {
    const doc = Model.createDoc({
        blocks: [
            { type: 'image', text: 'x' },
            { type: 'question', questionId: 'q1' }
        ]
    });

    const result = Model.validate(doc, bank());
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('unknown-block'));
    assert.deepEqual(questionIds(doc), ['q1']);
});

test('createDoc 保留区块 id 和单题留白，方便界面拖拽与逐题设置', () => {
    const doc = Model.createDoc({
        blocks: [
            { id: 'b1', type: 'heading', text: '一、知识梳理' },
            { id: 'b2', type: 'question', questionId: 'q1', answerSpaceMm: 0 }
        ]
    });

    assert.equal(doc.blocks[0].id, 'b1');
    assert.equal(doc.blocks[1].id, 'b2');
    assert.equal(doc.blocks[1].answerSpaceMm, 0);
    assert.equal(doc.blocks[1].questionNo, 1);
});

test('questionId 是数字时也能匹配题库里的字符串 id', () => {
    const doc = Model.createDoc({
        blocks: [{ type: 'question', questionId: 7 }]
    });
    const result = Model.validate(doc, [{ id: '7', stem: '题干' }]);
    assert.equal(result.valid, true);
});
