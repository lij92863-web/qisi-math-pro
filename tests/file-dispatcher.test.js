const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyFileType, buildDispatchPlan, getFileType, fileTypeText, formatFileSize, makeBatchId, getBatchFileRoles, batchHasQuestionRole, batchHasAnswerRole, batchHasSolutionRole, batchIsFullRole, batchIsSupplementalImage } = require('../qisi-file-dispatcher.js');

test('BM23: getFileType classifies all extensions', () => {
    assert.equal(getFileType('test.pdf'), 'pdf');
    assert.equal(getFileType('test.docx'), 'docx');
    assert.equal(getFileType('test.doc'), 'docx');
    assert.equal(getFileType('test.jpg'), 'image');
    assert.equal(getFileType('test.png'), 'image');
    assert.equal(getFileType('test.xlsx'), 'excel');
    assert.equal(getFileType('test.txt'), 'text');
    assert.equal(getFileType('test.xyz'), 'unknown');
    assert.equal(getFileType(''), 'unknown');
});

test('BM23: fileTypeText returns Chinese name', () => {
    assert.equal(fileTypeText('pdf'), 'PDF');
    assert.equal(fileTypeText('docx'), 'Word');
    assert.equal(fileTypeText('image'), '图片');
    assert.equal(fileTypeText('unknown'), '未知');
});

test('BM23: formatFileSize human-readable', () => {
    assert.ok(formatFileSize(2*1024*1024).includes('MB'));
    assert.ok(formatFileSize(500).includes('KB'));
});

test('BM23: makeBatchId generates unique IDs', () => {
    const id1 = makeBatchId('batch');
    assert.ok(id1.startsWith('batch_'));
    assert.notEqual(id1, makeBatchId('batch'));
});

test('BM23: classifyFileType original', () => {
    assert.equal(classifyFileType('a.docx'), 'docx');
    assert.equal(classifyFileType('b.pdf'), 'pdf');
    assert.equal(classifyFileType('c.png'), 'image');
});

test('BM23: buildDispatchPlan original', () => {
    const p = buildDispatchPlan([{ name: 'q.docx' }, { name: 's.pdf' }]);
    assert.ok(p.questions);
    assert.ok(p.answers);
});

test('BM24: getBatchFileRoles extracts roles', () => {
    assert.deepEqual(getBatchFileRoles({ roles: ['question', 'answer'] }), ['question', 'answer']);
    assert.deepEqual(getBatchFileRoles({ role: 'full' }), ['full']);
    assert.deepEqual(getBatchFileRoles({ roles: [] }), []);
    assert.deepEqual(getBatchFileRoles({}), []);
    assert.deepEqual(getBatchFileRoles(null), []);
});

test('BM24: batchHasQuestionRole detects question', () => {
    assert.ok(batchHasQuestionRole({ roles: ['question'] }));
    assert.ok(batchHasQuestionRole({ roles: ['full'] }));
    assert.ok(!batchHasQuestionRole({ roles: ['answer'] }));
});

test('BM24: batchHasAnswerRole detects answer', () => {
    assert.ok(batchHasAnswerRole({ roles: ['answer'] }));
    assert.ok(batchHasAnswerRole({ roles: ['full'] }));
    assert.ok(!batchHasAnswerRole({ roles: ['question'] }));
});

test('BM24: batchHasSolutionRole detects solution', () => {
    assert.ok(batchHasSolutionRole({ roles: ['solution'] }));
    assert.ok(!batchHasSolutionRole({ roles: ['answer'] }));
});

test('BM24: batchIsFullRole and batchIsSupplementalImage', () => {
    assert.ok(batchIsFullRole({ roles: ['full'] }));
    assert.ok(!batchIsFullRole({ roles: ['question'] }));
    assert.ok(batchIsSupplementalImage({ roles: ['supplemental_image'] }));
    assert.ok(!batchIsSupplementalImage({ roles: ['question'] }));
});
