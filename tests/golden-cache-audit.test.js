const test = require('node:test');
const assert = require('node:assert/strict');
const { audit } = require('../scripts/golden/audit-cache.cjs');
const item = text => ({ page_idx: 0, type: 'text', text });
test('historical reference audit distinguishes declaration absence from a retained solution', () => {
    const result = audit([item('1. 题目'), item('参考答案'), item('1【解析】给出证明。')],
        { questions: [{ no: '1', answer: 'A' }] });
    assert.equal(result.counts.referenceNumbersLocated, 1);
    assert.equal(result.rows[0].solutionLocated, true);
    assert.equal(result.rows[0].diagnosis, 'no-standalone-answer-declaration');
    assert.equal(result.wrongAttachmentCount, null);
    assert.equal(result.sourcePdfIdentityVerified, false);
    assert.equal(result.rows[0].exactReferenceAgreement, null);
});
test('duplicate reference numbers fail rather than inflate coverage or manufacture certification', () => {
    assert.throws(() => audit([], { questions: [{ no: '1' }, { no: '1' }] }), /CACHE_REFERENCE_NUMBERS/);
});
