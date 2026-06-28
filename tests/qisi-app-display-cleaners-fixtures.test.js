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

describe('R2 callsite-specific fixtures — OPTION_REPAIR_PATH', () => {
    // --- Line 3739: addWarningOnce in option extraction context ---

    it('[A4:R2:option-repair:3739] option repair warning preserves legal image token', () => {
        const q = { stem: '[[IMAGE:abc]]', options: ['[[IMAGE:opt]]', '', '', ''], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '[[IMAGE:abc]]');
        assert.equal(q.options[0], '[[IMAGE:opt]]');
    });

    it('[A4:R2:option-repair:3739] option repair does not infer answer', () => {
        const q = { stem: 'x', options: ['A', 'B', 'C', 'D'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
    });

    it('[A4:R2:option-repair:3739] option repair does not infer support attachment', () => {
        const q = { stem: 'x', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.solution, '');
    });

    it('[A4:R2:option-repair:3739] option repair removes bad placeholder from stem', () => {
        const q = { stem: '[图片选项待转换: wmf] x', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.ok(!q.stem.includes('图片选项待转换'));
    });

    // --- Line 19632: addWarningOnce in editor projection context ---

    it('[A4:R2:option-repair:19632] editor projection warning preserves legal formula token', () => {
        const q = { warnings: [] };
        helpers.addWarningOnce(q, '选项格式异常: [[FORMULA_IMAGE:abc]]');
        assert.deepEqual(norm(q.warnings), ['选项格式异常: [[FORMULA_IMAGE:abc]]']);
    });

    it('[A4:R2:option-repair:19632] editor projection does not guess options', () => {
        const q = { stem: 'x', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.deepEqual(norm(q.options), ['', '', '', '']);
    });

    // --- Line 20021: addWarningOnce in batch preprocessing context ---

    it('[A4:R2:option-repair:20021] batch preprocessing does not synthesize missing options', () => {
        const q = { stem: 'x', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.options[1], '');
        assert.equal(q.options[2], '');
        assert.equal(q.options[3], '');
    });

    it('[A4:R2:option-repair:20021] batch preprocessing does not invent answer', () => {
        const q = { stem: 'x', options: ['A', 'B', 'C', 'D'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
    });

    // --- Line 20329: cleanDisplayFieldsOnly in rows iteration ---

    it('[A4:R2:option-repair:20329] display cleaning in rows preserves non-display fields', () => {
        const q = { stem: ' x ', options: ['A'], answer: '', solution: '', id: 'q1', type: '单选题' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.id, 'q1');
        assert.equal(q.type, '单选题');
    });

    it('[A4:R2:option-repair:20329] display cleaning does not attach support', () => {
        const q = { stem: 'x', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.solution, '');
    });
});

describe('R2 callsite-specific fixtures — FINAL_VALIDATION_PATH', () => {
    // --- Line 20021: addWarningOnce in validation context ---

    it('[A4:R2:final-validation:20021] final validation does not synthesize missing answer', () => {
        const q = { stem: 'x', options: ['A', 'B', 'C', 'D'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
    });

    it('[A4:R2:final-validation:20021] final validation does not convert empty to valid', () => {
        const q = { stem: '', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '');
        assert.deepEqual(norm(q.options), ['', '', '', '']);
        assert.equal(q.answer, '');
        assert.equal(q.solution, '');
    });

    it('[A4:R2:final-validation:20021] final validation preserves legal media tokens', () => {
        const q = { stem: '[[IMAGE:x]]', options: ['[[FORMULA_IMAGE:y]]', '', '', ''], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '[[IMAGE:x]]');
        assert.equal(q.options[0], '[[FORMULA_IMAGE:y]]');
    });

    it('[A4:R2:final-validation:20021] final validation warning behavior preserves existing warnings', () => {
        const q = { warnings: ['existing-warning'], stem: 'x', options: [], answer: '', solution: '' };
        helpers.addWarningOnce(q, 'new-warning');
        assert.deepEqual(norm(q.warnings), ['existing-warning', 'new-warning']);
    });
});

describe('R2 callsite-specific fixtures — VISUAL_REPAIR_PATH', () => {
    // --- Line 20042: addWarningOnce in no-source-image context ---

    it('[A4:R2:visual-repair:20042] visual repair preserves legal tokens', () => {
        const q = { stem: '[[IMAGE:p1]] visual text', options: ['A'], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.ok(q.stem.includes('[[IMAGE:p1]]'));
    });

    it('[A4:R2:visual-repair:20042] visual repair removes bad placeholders only', () => {
        const q = { stem: '[图片选项待转换: bin] good text', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.ok(q.stem.includes('good text'));
        assert.ok(!q.stem.includes('图片选项待转换'));
    });

    it('[A4:R2:visual-repair:20042] visual repair does not attach image or support', () => {
        const q = { stem: 'visual stem', options: [], answer: '', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
        assert.equal(q.solution, '');
    });

    it('[A4:R2:visual-repair:20042] visual repair non-target fields preserved', () => {
        const q = { stem: 'x', options: [], answer: '', solution: '', sourceFileId: 'f1', status: 'draft' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.sourceFileId, 'f1');
        assert.equal(q.status, 'draft');
    });
});

describe('R2 callsite-specific fixtures — WARNING_MUTATION_PATH', () => {
    // --- Line 3739: addWarningOnce in option extraction context ---

    it('[A4:R2:warning-mutation:3739] option extraction warning mutates only warnings', () => {
        const q = { stem: 'x', options: ['A'], answer: 'A', solution: 'sol' };
        const snapshot = clone(q);
        helpers.addWarningOnce(q, 'test warning');
        assert.equal(q.stem, snapshot.stem);
        assert.deepEqual(norm(q.options), norm(snapshot.options));
        assert.equal(q.answer, snapshot.answer);
        assert.equal(q.solution, snapshot.solution);
    });

    it('[A4:R2:warning-mutation:3739] option extraction duplicate warning not added', () => {
        const q = { warnings: ['test warning'] };
        helpers.addWarningOnce(q, 'test warning');
        assert.equal(q.warnings.length, 1);
    });

    // --- Line 19632: addWarningOnce in editor projection context ---

    it('[A4:R2:warning-mutation:19632] editor projection warning preserves existing non-warning fields', () => {
        const q = { stem: 'original stem', options: ['A'], answer: '', solution: '' };
        helpers.addWarningOnce(q, 'format warning');
        assert.equal(q.stem, 'original stem');
    });

    // --- Line 20021: addWarningOnce in batch preprocessing context ---

    it('[A4:R2:warning-mutation:20021] batch preprocessing warning malformed warnings follows current behavior', () => {
        const q = { warnings: null };
        helpers.addWarningOnce(q, 'a');
        assert.deepEqual(norm(q.warnings), ['a']);
    });

    it('[A4:R2:warning-mutation:20021] batch preprocessing warning preserves other fields', () => {
        const q = { warnings: ['old'], answer: 'B', solution: 'sol text' };
        helpers.addWarningOnce(q, 'new warning');
        assert.equal(q.answer, 'B');
        assert.equal(q.solution, 'sol text');
    });

    // --- Line 20042: addWarningOnce in no-source-image context ---

    it('[A4:R2:warning-mutation:20042] visual repair warning existing warning preserved', () => {
        const q = { warnings: ['prior'] };
        helpers.addWarningOnce(q, 'no source image');
        assert.equal(q.warnings[0], 'prior');
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
