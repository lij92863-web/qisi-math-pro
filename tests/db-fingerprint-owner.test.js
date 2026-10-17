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
    for (const question of [{ stem: '$\\left(x^2+1\\right)$， Ａ', options: ['（X）', 'Ｂ.'] },
        { stem: '普通题', options: null }, {}, { stem: '0', options: ['', '$\\frac{1}{2}$'] }]) {
        const expected = 'qisi-core-v2:' + JSON.stringify([normalizeBefore(question.stem),
            Array.isArray(question.options) ? question.options.map(normalizeBefore) : []]);
        assert.equal(methods.questionCoreFingerprint(question), expected);
        assert.equal(methods.questionStemFingerprint(question), normalizeBefore(question.stem));
    }
    assert.equal(methods.normalizeOptionsForCompare(undefined), '');
});

test('database loaded before duplicate policy delegates comparison and index hooks to the real owner', () => {
    let indexedPolicy;
    class Dexie { version() { return { stores: () => ({ upgrade() {} }) }; } }
    const context = vm.createContext({Dexie, Qisi: {QuestionIndexStorage: {
        configure(_db, {policy}) {indexedPolicy = policy;}
    }}});
    context.window = context;
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../qisi-db.js'), 'utf8'), context);
    const methods = vm.runInContext('({ normalizeCompareText, questionCoreFingerprint, questionStemFingerprint })', context);
    const question = {stem: 'late policy', options: ['A', 'B']};
    assert.throws(() => methods.questionCoreFingerprint(question), /QuestionDuplicatePolicy|canonicalCoreFingerprint|undefined/);
    const calls = [];
    context.Qisi.QuestionDuplicatePolicy = Object.fromEntries(
        ['normalizeText', 'canonicalCoreFingerprint', 'canonicalStemFingerprint'].map(name => [name,
            (...args) => {calls.push(name); return policy[name](...args);}])
    );
    assert.equal(methods.normalizeCompareText(' A '), policy.normalizeText(' A '));
    assert.equal(methods.questionCoreFingerprint(question), policy.canonicalCoreFingerprint(question));
    assert.equal(methods.questionStemFingerprint(question), policy.canonicalStemFingerprint(question));
    assert.equal(indexedPolicy.canonicalCoreFingerprint(question), policy.canonicalCoreFingerprint(question));
    assert.equal(indexedPolicy.canonicalStemFingerprint(question), policy.canonicalStemFingerprint(question));
    assert.deepEqual(calls, ['normalizeText', 'canonicalCoreFingerprint', 'canonicalStemFingerprint', 'canonicalCoreFingerprint', 'canonicalStemFingerprint']);
});
