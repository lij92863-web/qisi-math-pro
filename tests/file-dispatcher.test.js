const test = require('node:test'); const assert = require('node:assert/strict');
const { classifyFileType, buildDispatchPlan } = require('../qisi-file-dispatcher.js');
test('BM10: classify', () => { assert.equal(classifyFileType('a.docx'), 'docx'); assert.equal(classifyFileType('b.pdf'), 'pdf'); assert.equal(classifyFileType('c.png'), 'image'); assert.equal(classifyFileType('d.txt'), 'unknown'); });
test('BM10: dispatch plan', () => { const p = buildDispatchPlan([{ name: 'q.docx' }, { name: 's.pdf' }, { name: 'img.png' }]); assert.ok(p.questions); assert.ok(p.answers); assert.equal(p.images.length, 1); });
