const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../qisi-exam-template-model.js');

test('buildCustomTemplate keeps code and layout config together', () => {
    assert.deepEqual(
        model.buildCustomTemplate({ id: 'tpl_1', name: '我的模板', code: 'CODE', config: { fontSize: 12 }, now: 99 }),
        { id: 'tpl_1', name: '我的模板', code: 'CODE', config: { fontSize: 12 }, createdAt: 99 }
    );
});

test('buildSystemOverride stamps updatedAt', () => {
    assert.deepEqual(
        model.buildSystemOverride({ name: '系统模板', code: 'C', config: { a: 1 }, now: 5 }),
        { name: '系统模板', code: 'C', config: { a: 1 }, updatedAt: 5 }
    );
});

test('buildCustomTemplateUpdate only carries the mutable fields', () => {
    assert.deepEqual(
        model.buildCustomTemplateUpdate({ name: 'n', code: 'c', config: { a: 2 } }),
        { name: 'n', code: 'c', config: { a: 2 } }
    );
});

test('template builders fail closed on invalid input', () => {
    assert.throws(() => model.buildCustomTemplate({ name: 'n', now: 1 }), error => error.code === 'EXAM_TEMPLATE_RECORD_INVALID');
    assert.throws(() => model.buildCustomTemplate({ id: 't', now: NaN }), error => error.code === 'EXAM_TEMPLATE_RECORD_INVALID');
    assert.throws(() => model.buildSystemOverride({ name: 'n' }), error => error.code === 'EXAM_TEMPLATE_RECORD_INVALID');
});
