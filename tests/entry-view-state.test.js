const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
    buildEntryPreview,
    normalizeEntryOptions,
    projectEntryKnowledge,
    validateEntryForm
} = require('../qisi-entry-view-state.js');
const { splitQuestionForStorage } = require('../qisi-utils.js');

const ROOT = path.join(__dirname, '..');
const EMPTY_STEM_MESSAGE = '题干为空，先把 OCR 内容送入题干或手动输入题目。';

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

test('entry view state exposes the same API in Node and a browser global', () => {
    assert.equal(typeof buildEntryPreview, 'function');
    assert.equal(typeof normalizeEntryOptions, 'function');
    assert.equal(typeof projectEntryKnowledge, 'function');
    assert.equal(typeof validateEntryForm, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-entry-view-state.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);

    assert.equal(typeof context.Qisi.EntryViewState.buildEntryPreview, 'function');
    assert.equal(typeof context.Qisi.EntryViewState.normalizeEntryOptions, 'function');
    assert.equal(typeof context.Qisi.EntryViewState.projectEntryKnowledge, 'function');
    assert.equal(typeof context.Qisi.EntryViewState.validateEntryForm, 'function');
});

test('buildEntryPreview preserves the current manual preview projection', () => {
    const options = Object.freeze(['甲', '乙', '丙', '丁']);
    const form = Object.freeze({
        stem: '题干',
        type: '单选题',
        options
    });
    const parsed = Object.freeze({
        stem: '拆分后的题干',
        type: '多选题',
        options: Object.freeze(['A1', 'B1', 'C1', 'D1'])
    });
    const calls = [];

    const result = buildEntryPreview(form, {
        splitQuestionForStorage: (...args) => {
            calls.push(args);
            return parsed;
        }
    });

    assert.deepEqual(calls, [['题干', '单选题', options]]);
    assert.strictEqual(result.parsed, parsed);
    assert.equal(result.stem, '拆分后的题干');
    assert.strictEqual(result.options, parsed.options);
});

test('buildEntryPreview keeps the legacy falsy fallbacks without normalizing preview output', () => {
    const originalOptions = Object.freeze(['原选项']);
    const form = Object.freeze({ stem: 0, type: '', options: originalOptions });
    const parsed = Object.freeze({ stem: '', type: '', options: null });

    const result = buildEntryPreview(form, {
        splitQuestionForStorage: () => parsed
    });

    assert.strictEqual(result.parsed, parsed);
    assert.equal(result.stem, 0);
    assert.deepEqual(result.options, []);
});

test('buildEntryPreview remains equivalent to the real question splitter on manual-form paths', () => {
    const fixtures = [
        {
            stem: '普通解答题',
            type: '解答题',
            options: ['', '', '', '']
        },
        {
            stem: '选择正确结论\nA. 甲\nB. 乙\nC. 丙\nD. 丁',
            type: '解答题',
            options: ['', '', '', '']
        },
        {
            stem: '已有独立选项',
            type: '多选题',
            options: ['甲', '', 0, false]
        }
    ];

    for (const fixture of fixtures) {
        const frozen = deepFreeze(structuredClone(fixture));
        const expectedParsed = splitQuestionForStorage(
            frozen.stem,
            frozen.type,
            frozen.options
        );
        const result = buildEntryPreview(frozen, { splitQuestionForStorage });

        assert.deepEqual(result.parsed, expectedParsed);
        assert.equal(result.stem, expectedParsed.stem || frozen.stem);
        assert.deepEqual(result.options, expectedParsed.options || []);
        assert.deepEqual(frozen, fixture);
    }
});

test('buildEntryPreview fails fast when the splitter dependency is absent', () => {
    const form = { stem: '', type: '解答题', options: ['', '', '', ''] };

    assert.throws(
        () => buildEntryPreview(form),
        /splitQuestionForStorage/
    );
});

test('normalizeEntryOptions returns four independent slots with legacy falsy cleanup', () => {
    const source = Object.freeze(['A', 0, false, null, 'ignored']);

    assert.deepEqual(normalizeEntryOptions(source), ['A', '', '', '']);
    assert.deepEqual(normalizeEntryOptions(['A', 'B']), ['A', 'B', '', '']);
    assert.deepEqual(normalizeEntryOptions(null), ['', '', '', '']);
    assert.deepEqual(normalizeEntryOptions('ABCD'), ['', '', '', '']);
    assert.deepEqual(source, ['A', 0, false, null, 'ignored']);
    assert.notStrictEqual(normalizeEntryOptions(source), normalizeEntryOptions(source));
});

test('projectEntryKnowledge preserves personal-first legacy truthiness', () => {
    assert.deepEqual(projectEntryKnowledge({
        systemKnowledge: '函数',
        personalKnowledge: '易错题'
    }), {
        knowledge: '易错题',
        knowledgeType: 'personal',
        systemKnowledge: '函数',
        personalKnowledge: '易错题'
    });

    assert.deepEqual(projectEntryKnowledge({
        systemKnowledge: '函数',
        personalKnowledge: ''
    }), {
        knowledge: '函数',
        knowledgeType: 'system',
        systemKnowledge: '函数',
        personalKnowledge: ''
    });

    assert.deepEqual(projectEntryKnowledge({
        systemKnowledge: 0,
        personalKnowledge: false
    }), {
        knowledge: '',
        knowledgeType: 'system',
        systemKnowledge: '',
        personalKnowledge: ''
    });
});

test('projectEntryKnowledge is pure and does not rewrite legacy fields on the form', () => {
    const form = deepFreeze({
        knowledge: '旧值',
        knowledgeType: 'personal',
        systemKnowledge: '几何',
        personalKnowledge: ''
    });

    const result = projectEntryKnowledge(form);

    assert.deepEqual(result, {
        knowledge: '几何',
        knowledgeType: 'system',
        systemKnowledge: '几何',
        personalKnowledge: ''
    });
    assert.deepEqual(form, {
        knowledge: '旧值',
        knowledgeType: 'personal',
        systemKnowledge: '几何',
        personalKnowledge: ''
    });
});

test('validateEntryForm constructs the current empty-stem result', () => {
    assert.deepEqual(validateEntryForm({ stem: '  \n ' }), {
        valid: false,
        message: EMPTY_STEM_MESSAGE
    });
    assert.deepEqual(validateEntryForm({ stem: '  题目  ' }), {
        valid: true,
        message: ''
    });
});

test('validateEntryForm retains the current malformed-stem failure contract', () => {
    assert.throws(() => validateEntryForm({ stem: null }), TypeError);
    assert.throws(() => validateEntryForm({ stem: 0 }), TypeError);
    assert.throws(() => validateEntryForm({}), TypeError);
});
