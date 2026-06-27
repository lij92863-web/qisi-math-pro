const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { HELPERS, extractHelpers } = require('../scripts/bm-a4-helper-extract');
const qisiUtils = require('../qisi-utils.js');

function loadAppHelpers() {
    const extracted = extractHelpers('app.js');
    assert.equal(extracted.ok, true, extracted.errors.join('\n'));
    const sandbox = {
        window: {
            Qisi: {
                Utils: qisiUtils
            }
        },
        console
    };
    vm.createContext(sandbox);
    const source = HELPERS.map((helper) => extracted.helpers[helper].source).join('\n') +
        `\nglobalThis.__helpers = { ${HELPERS.join(', ')} };`;
    vm.runInContext(source, sandbox, { timeout: 1000 });
    return sandbox.__helpers;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function norm(value) {
    return JSON.parse(JSON.stringify(value));
}

const helpers = loadAppHelpers();

describe('cleanDisplayTextForBatchSave fixtures', () => {
    it('[A4:text:empty] empty string returns empty', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave(''), '');
    });

    it('[A4:text:null] null returns empty', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave(null), '');
    });

    it('[A4:text:undefined] undefined returns empty', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave(undefined), '');
    });

    it('[A4:text:plain] plain text is preserved', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('  hello  '), 'hello');
    });

    it('[A4:text:bad-placeholder] bad placeholder is stripped', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('A [图片选项待转换: wmf] B'), 'A B');
    });

    it('[A4:text:legal-image-token] legal image token is preserved', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('[[IMAGE:abc]]'), '[[IMAGE:abc]]');
    });

    it('[A4:text:legal-formula-token] legal formula token is preserved', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('[[FORMULA_IMAGE:abc]]'), '[[FORMULA_IMAGE:abc]]');
    });

    it('[A4:text:includegraphics] includegraphics is preserved', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('\\includegraphics{fig.png}'), '\\includegraphics{fig.png}');
    });

    it('[A4:text:literal-pollution] literal pollution follows current cleaning behavior', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('[object Object]'), '[object Object]');
    });

    it('[A4:text:mixed-spacing] mixed spacing is normalized around removed placeholder', () => {
        assert.equal(helpers.cleanDisplayTextForBatchSave('A   [图片选项待转换: bin]   ，B'), 'A，B');
    });

    it('[A4:text:idempotent] repeated text cleaning is idempotent', () => {
        const once = helpers.cleanDisplayTextForBatchSave('A [图片选项待转换: wmf] B');
        assert.equal(helpers.cleanDisplayTextForBatchSave(once), once);
    });
});

describe('cleanDisplayOptionsForBatchSave fixtures', () => {
    it('[A4:options:non-array] non-array input returns four empty options', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(null)), ['', '', '', '']);
    });

    it('[A4:options:empty-array] empty array returns four empty options', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave([])), ['', '', '', '']);
    });

    it('[A4:options:short-array] short array is padded to four options', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['A', 'B'])), ['A', 'B', '', '']);
    });

    it('[A4:options:extra-options] extra options beyond four are ignored', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['A', 'B', 'C', 'D', 'E'])), ['A', 'B', 'C', 'D']);
    });

    it('[A4:options:plain] plain options are cleaned', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['  A  ', 'B', 'C', 'D'])), ['A', 'B', 'C', 'D']);
    });

    it('[A4:options:bad-placeholder] bad placeholder option is stripped to empty', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['[图片选项待转换: wmf]', 'B', 'C', 'D'])), ['', 'B', 'C', 'D']);
    });

    it('[A4:options:legal-image-token] legal image token option is preserved', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['[[IMAGE:abc]]'])), ['[[IMAGE:abc]]', '', '', '']);
    });

    it('[A4:options:legal-formula-token] legal formula token option is preserved', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['[[FORMULA_IMAGE:abc]]'])), ['[[FORMULA_IMAGE:abc]]', '', '', '']);
    });

    it('[A4:options:mixed-token-text] mixed token text is preserved', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave(['x [[IMAGE:abc]]'])), ['x [[IMAGE:abc]]', '', '', '']);
    });

    it('[A4:options:mutation] original options array is not mutated', () => {
        const options = ['A [图片选项待转换: wmf]', 'B'];
        const before = clone(options);
        helpers.cleanDisplayOptionsForBatchSave(options);
        assert.deepEqual(options, before);
    });

    it('[A4:options:malformed-entry] malformed option entry follows string conversion path', () => {
        assert.deepEqual(norm(helpers.cleanDisplayOptionsForBatchSave([{ x: 1 }])), ['', '', '', '']);
    });
});

describe('addWarningOnce fixtures', () => {
    it('[A4:warning:null-question] null question is a no-op', () => {
        assert.equal(helpers.addWarningOnce(null, 'x'), undefined);
    });

    it('[A4:warning:empty-message] empty message is a no-op', () => {
        const q = {};
        helpers.addWarningOnce(q, '');
        assert.deepEqual(q, {});
    });

    it('[A4:warning:create-array] first warning creates array', () => {
        const q = {};
        helpers.addWarningOnce(q, 'a');
        assert.deepEqual(norm(q.warnings), ['a']);
    });

    it('[A4:warning:dedupe] repeated warning is deduped', () => {
        const q = { warnings: ['a'] };
        helpers.addWarningOnce(q, 'a');
        assert.deepEqual(norm(q.warnings), ['a']);
    });

    it('[A4:warning:second-warning] second warning is appended', () => {
        const q = { warnings: ['a'] };
        helpers.addWarningOnce(q, 'b');
        assert.deepEqual(norm(q.warnings), ['a', 'b']);
    });

    it('[A4:warning:preserve-existing] existing warnings are preserved', () => {
        const q = { warnings: ['a', 'b'] };
        helpers.addWarningOnce(q, 'c');
        assert.deepEqual(norm(q.warnings), ['a', 'b', 'c']);
    });

    it('[A4:warning:non-array] non-array warnings follow spread behavior', () => {
        const q = { warnings: 'ab' };
        helpers.addWarningOnce(q, 'c');
        assert.deepEqual(norm(q.warnings), ['a', 'b', 'c']);
    });

    it('[A4:warning:mutation] question object is mutated', () => {
        const q = {};
        helpers.addWarningOnce(q, 'a');
        assert.ok(Object.hasOwn(q, 'warnings'));
    });

    it('[A4:warning:return-value] return value is undefined', () => {
        const q = {};
        assert.equal(helpers.addWarningOnce(q, 'a'), undefined);
    });

    it('[A4:warning:preserve-fields] non-warning fields are preserved', () => {
        const q = { stem: 'x' };
        helpers.addWarningOnce(q, 'a');
        assert.equal(q.stem, 'x');
    });
});

describe('cleanDisplayFieldsOnly fixtures', () => {
    it('[A4:fields:null] null returns null', () => {
        assert.equal(helpers.cleanDisplayFieldsOnly(null), null);
    });

    it('[A4:fields:undefined] undefined returns undefined', () => {
        assert.equal(helpers.cleanDisplayFieldsOnly(undefined), undefined);
    });

    it('[A4:fields:return-reference] returns same object reference', () => {
        const q = { stem: 'x', options: [], answer: '', solution: '' };
        assert.equal(helpers.cleanDisplayFieldsOnly(q), q);
    });

    it('[A4:fields:stem] stem is cleaned', () => {
        const q = { stem: ' A [图片选项待转换: wmf] ', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, 'A');
    });

    it('[A4:fields:options] options are cleaned', () => {
        const q = { stem: '', options: [' A ', '[图片选项待转换: wmf]'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.deepEqual(norm(q.options), ['A', '', '', '']);
    });

    it('[A4:fields:answer] answer is cleaned', () => {
        const q = { stem: '', options: [], answer: ' A ', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, 'A');
    });

    it('[A4:fields:solution] solution is cleaned', () => {
        const q = { stem: '', options: [], answer: '', solution: ' S [图片选项待转换: bin] ' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.solution, 'S');
    });

    it('[A4:fields:legal-token] legal token is preserved', () => {
        const q = { stem: '[[IMAGE:x]]', options: ['[[FORMULA_IMAGE:y]]'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '[[IMAGE:x]]');
        assert.equal(q.options[0], '[[FORMULA_IMAGE:y]]');
    });

    it('[A4:fields:bad-placeholder] bad placeholder is removed', () => {
        const q = { stem: '[图片选项待转换: wmf]', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '');
    });

    it('[A4:fields:preserve-extra] extra fields are preserved', () => {
        const q = { stem: 'x', options: [], answer: '', solution: '', id: 'q1' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.id, 'q1');
    });

    it('[A4:fields:mutation] object fields are mutated in place', () => {
        const q = { stem: ' x ', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, 'x');
    });

    it('[A4:fields:no-attachment-inference] answer and solution are only cleaned, not inferred', () => {
        const q = { stem: 'x', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
        assert.equal(q.solution, '');
    });

    it('[A4:fields:malformed-options] malformed options normalize to four empty options', () => {
        const q = { stem: 'x', options: null, answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.deepEqual(norm(q.options), ['', '', '', '']);
    });
});

describe('integration fixtures', () => {
    it('[A4:integration:docx-normal] DOCX normal draft fields remain stable', () => {
        const q = { stem: '题干', options: ['A', 'B', 'C', 'D'], answer: 'A', solution: '解析' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.deepEqual(norm(q), { stem: '题干', options: ['A', 'B', 'C', 'D'], answer: 'A', solution: '解析' });
    });

    it('[A4:integration:docx-image-option] DOCX image option token is preserved', () => {
        const options = helpers.cleanDisplayOptionsForBatchSave(['[[IMAGE:opt-a]]', 'B', 'C', 'D']);
        assert.equal(options[0], '[[IMAGE:opt-a]]');
    });

    it('[A4:integration:missing-options] missing options remain missing', () => {
        const options = helpers.cleanDisplayOptionsForBatchSave(['A']);
        assert.deepEqual(norm(options), ['A', '', '', '']);
    });

    it('[A4:integration:pdf-draft] PDF draft cleanup does not attach answer or solution', () => {
        const q = { stem: 'PDF stem', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
        assert.equal(q.solution, '');
    });

    it('[A4:integration:no-runner] fixture sandbox has no runner capability', () => {
        assert.equal(typeof helpers.pdfMasterBrowserRunner, 'undefined');
    });

    it('[A4:integration:no-ai-ocr] fixture sandbox does not expose AI/OCR calls', () => {
        assert.equal(typeof helpers.callDashScopeOcrTask, 'undefined');
    });
});

describe('qisi-utils implementation parity', () => {
    it('[A4:impl-compare:text] qisi-utils text cleaner matches extracted app helper', () => {
        const cases = [
            '',
            null,
            undefined,
            '  hello  ',
            'A [鍥剧墖閫夐」寰呰浆鎹? wmf] B',
            '[[IMAGE:abc]]',
            '[[FORMULA_IMAGE:abc]]',
            '\\includegraphics{fig.png}',
            '[object Object]'
        ];

        for (const value of cases) {
            assert.equal(
                qisiUtils.cleanDisplayTextForBatchSave(value),
                helpers.cleanDisplayTextForBatchSave(value)
            );
        }
    });

    it('[A4:impl-compare:options] qisi-utils options cleaner matches extracted app helper', () => {
        const cases = [
            null,
            [],
            ['A', 'B'],
            ['A', 'B', 'C', 'D', 'E'],
            ['  A  ', 'B', 'C', 'D'],
            ['[鍥剧墖閫夐」寰呰浆鎹? wmf]', 'B', 'C', 'D'],
            ['[[IMAGE:abc]]'],
            ['[[FORMULA_IMAGE:abc]]'],
            ['x [[IMAGE:abc]]'],
            [{ x: 1 }]
        ];

        for (const value of cases) {
            assert.deepEqual(
                norm(qisiUtils.cleanDisplayOptionsForBatchSave(clone(value))),
                norm(helpers.cleanDisplayOptionsForBatchSave(clone(value)))
            );
        }
    });

    it('[A4:impl-compare:warning] qisi-utils warning helper matches extracted app helper', () => {
        const cases = [
            [{}, 'a'],
            [{ warnings: ['a'] }, 'a'],
            [{ warnings: ['a'] }, 'b'],
            [{ warnings: ['a', 'b'], stem: 'x' }, 'c'],
            [{ warnings: 'ab' }, 'c'],
            [{}, '']
        ];

        for (const [input, message] of cases) {
            const expected = clone(input);
            const actual = clone(input);
            assert.equal(qisiUtils.addWarningOnce(actual, message), helpers.addWarningOnce(expected, message));
            assert.deepEqual(norm(actual), norm(expected));
        }
    });

    it('[A4:impl-compare:fields] qisi-utils field cleaner matches extracted app helper', () => {
        const cases = [
            { stem: ' A [鍥剧墖閫夐」寰呰浆鎹? wmf] ', options: [], answer: '', solution: '' },
            { stem: '', options: [' A ', '[鍥剧墖閫夐」寰呰浆鎹? wmf]'], answer: '', solution: '' },
            { stem: '[[IMAGE:x]]', options: ['[[FORMULA_IMAGE:y]]'], answer: ' A ', solution: ' S ' },
            { stem: 'x', options: null, answer: '', solution: '', id: 'q1' },
            { stem: 'PDF stem', options: [], answer: '', solution: '' }
        ];

        for (const value of cases) {
            const expected = clone(value);
            const actual = clone(value);
            assert.equal(qisiUtils.cleanDisplayFieldsOnly(actual), actual);
            assert.equal(helpers.cleanDisplayFieldsOnly(expected), expected);
            assert.deepEqual(norm(actual), norm(expected));
        }
    });
});
