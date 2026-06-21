const test = require('node:test'); const assert = require('node:assert/strict');
const { buildReviewViewModel } = require('../qisi-review-view-model.js');
test('BM09: build view model', () => { const vm = buildReviewViewModel({ question: '1', answer: 'A' }, 0); assert.equal(vm.question, '1'); assert.ok(vm.hasAnswer); assert.ok(!vm.isMissingAnswer); });
test('BM09: missing answer', () => { const vm = buildReviewViewModel({ question: '2' }, 1); assert.ok(!vm.hasAnswer); assert.ok(vm.isMissingAnswer); });
