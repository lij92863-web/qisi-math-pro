const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../qisi-question-duplicate-policy');
const normalizeBefore = value => String(value || '').replace(/\\left|\\right/g, '')
    .replace(/\s+/g, '').replace(/[，。；：、,.．]/g, '')
    .replace(/[（）]/g, char => char === '（' ? '(' : ')')
    .replace(/[Ａ-Ｄ]/g, char => String.fromCharCode(char.charCodeAt(0) - 65248)).toLowerCase();
test('database comparison aliases share one fingerprint owner and preserve normalization with v2 tuple serialization', () => {
    class Dexie { version() { return { stores: () => ({ upgrade() {} }) }; } }
    const context = vm.createContext({ Dexie, Qisi: { QuestionDuplicatePolicy: policy, QuestionIndexStorage: { configure() {} } } });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../qisi-db.js'), 'utf8'), context);
    const methods = vm.runInContext('({ normalizeCompareText, questionCoreFingerprint, questionStemFingerprint, normalizeOptionsForCompare })', context);
    assert.equal(methods.questionCoreFingerprint, policy.canonicalCoreFingerprint);
    assert.equal(methods.questionStemFingerprint, policy.canonicalStemFingerprint);
    for (const question of [{ stem: '$\\left(x^2+1\\right)$， Ａ', options: ['（X）', 'Ｂ.'] },
        { stem: '普通题', options: null }, {}, { stem: '0', options: ['', '$\\frac{1}{2}$'] }]) {
        const expected = 'qisi-core-v2:' + JSON.stringify([normalizeBefore(question.stem),
            Array.isArray(question.options) ? question.options.map(normalizeBefore) : []]);
        assert.equal(methods.questionCoreFingerprint(question), expected);
        assert.equal(methods.questionStemFingerprint(question), normalizeBefore(question.stem));
    }
    assert.equal(methods.normalizeOptionsForCompare(undefined), '');
});
