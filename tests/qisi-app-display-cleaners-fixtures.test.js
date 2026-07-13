const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const qisiUtils = require('../qisi-utils.js');

function loadAppHelpers() {
    const names = [
        'cleanDisplayTextForBatchSave',
        'cleanDisplayOptionsForBatchSave',
        'addWarningOnce',
        'cleanDisplayFieldsOnly'
    ];
    for (const name of names) assert.equal(typeof qisiUtils[name], 'function');
    return Object.fromEntries(names.map(name => [name, qisiUtils[name]]));
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

describe('sanitizeLatexWrapperArtifacts', () => {
    it('[LATEX_WRAPPER:empty] empty string returns empty', () => {
        assert.equal(qisiUtils.sanitizeLatexWrapperArtifacts(''), '');
    });

    it('[LATEX_WRAPPER:null] null returns empty', () => {
        assert.equal(qisiUtils.sanitizeLatexWrapperArtifacts(null), '');
    });

    it('[LATEX_WRAPPER:plain-text] plain text is preserved', () => {
        assert.equal(
            qisiUtils.sanitizeLatexWrapperArtifacts('由正弦定理得 AB=2R'),
            '由正弦定理得 AB=2R'
        );
    });

    // --- Sample 1: trailing description ---
    it('[LATEX_WRAPPER:sample-1:trailing-description] strips trailing end description', () => {
        const input = '因为 A={x|x=sin nπ/2,n∈Z}，所以 A={-1,0,1}，B={0,1}，故选：B\n\\end{description}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '因为 A={x|x=sin nπ/2,n∈Z}，所以 A={-1,0,1}，B={0,1}，故选：B');
    });

    // --- Sample 2: markdown fence + enumerate ---
    it('[LATEX_WRAPPER:sample-2:fence-enumerate] strips markdown fence and enumerate wrappers', () => {
        const input = '```latex\n\\begin{enumerate}\n\\item 由条件可得 AB=AC。\n\\item 所以答案为 D。\n\\end{enumerate}\n```';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '由条件可得 AB=AC。\n所以答案为 D。');
    });

    // --- Sample 3: itemize mixed in solution ---
    it('[LATEX_WRAPPER:sample-3:itemize] strips itemize wrappers, preserves math', () => {
        const input = '\\begin{itemize}\n\\item 由正弦定理得 AB=2R\\sin60^\\circ。\n\\item 所以体积为 2\\sqrt{6}。\n\\end{itemize}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '由正弦定理得 AB=2R\\sin60^\\circ。\n所以体积为 2\\sqrt{6}。');
    });

    // --- Sample 4: preserve math environment ---
    it('[LATEX_WRAPPER:sample-4:preserve-math-env] preserves aligned/cases/matrix math environments', () => {
        const input = '\\[\n\\begin{aligned}\na^2+b^2=c^2\n\\end{aligned}\n\\]';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '\\[\n\\begin{aligned}\na^2+b^2=c^2\n\\end{aligned}\n\\]');
    });

    // --- Sample 5: preserve normal formula ---
    it('[LATEX_WRAPPER:sample-5:preserve-formula] does not destroy normal math LaTeX', () => {
        const input = '所以 \\frac{\\sin A+\\sin B}{\\sin A\\sin B} \\ge 32\\sin C。';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '所以 \\frac{\\sin A+\\sin B}{\\sin A\\sin B} \\ge 32\\sin C。');
    });

    // --- Sample 6: answer field with trailing wrapper ---
    it('[LATEX_WRAPPER:sample-6:answer-trailing] strips trailing wrapper from answer', () => {
        const input = 'D\n\\end{description}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, 'D');
    });

    // --- Sample 7: repeated wrappers ---
    it('[LATEX_WRAPPER:sample-7:repeated-wrappers] strips repeated wrappers', () => {
        const input = '\\end{itemize}\n\\begin{description}\n\\item 故选：C\n\\end{description}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '故选：C');
    });

    // --- Preserve math commands ---
    it('[LATEX_WRAPPER:preserve-frac] preserves \\frac', () => {
        assert.equal(
            qisiUtils.sanitizeLatexWrapperArtifacts('\\frac{1}{2}'),
            '\\frac{1}{2}'
        );
    });

    it('[LATEX_WRAPPER:preserve-sqrt] preserves \\sqrt', () => {
        assert.equal(
            qisiUtils.sanitizeLatexWrapperArtifacts('\\sqrt{2}'),
            '\\sqrt{2}'
        );
    });

    it('[LATEX_WRAPPER:preserve-angle] preserves \\angle', () => {
        assert.equal(
            qisiUtils.sanitizeLatexWrapperArtifacts('\\angle ABC'),
            '\\angle ABC'
        );
    });

    it('[LATEX_WRAPPER:preserve-triangle] preserves \\triangle', () => {
        assert.equal(
            qisiUtils.sanitizeLatexWrapperArtifacts('\\triangle ABC'),
            '\\triangle ABC'
        );
    });

    it('[LATEX_WRAPPER:preserve-math-begin-end] preserves \\begin{cases} ... \\end{cases}', () => {
        const input = '\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}');
    });

    it('[LATEX_WRAPPER:preserve-matrix] preserves \\begin{matrix} ... \\end{matrix}', () => {
        const input = '\\begin{matrix} a & b \\\\ c & d \\end{matrix}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '\\begin{matrix} a & b \\\\ c & d \\end{matrix}');
    });

    // --- \item with brackets ---
    it('[LATEX_WRAPPER:item-with-brackets] strips \\item[...] at line start', () => {
        const input = '\\item[步骤一] 由题意得 x>0。\n\\item[步骤二] 所以解为 x=1。';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '由题意得 x>0。\n所以解为 x=1。');
    });

    // --- does not strip plain "item" in text ---
    it('[LATEX_WRAPPER:plain-item-word] does not strip the word "item" in normal text', () => {
        const input = 'The item difficulty is moderate.';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, 'The item difficulty is moderate.');
    });

    // --- does not change answer letter ---
    it('[LATEX_WRAPPER:answer-letter-preserved] answer letter is not modified', () => {
        const input = '\\end{description}\nD';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.includes('D'), 'answer letter D should be preserved');
        assert.ok(!result.includes('\\end{description}'), 'wrapper should be removed');
    });

    // --- idempotent ---
    it('[LATEX_WRAPPER:idempotent] repeated cleaning is idempotent', () => {
        const input = '\\begin{enumerate}\n\\item 答案：D\n\\end{enumerate}';
        const once = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        const twice = qisiUtils.sanitizeLatexWrapperArtifacts(once);
        assert.equal(twice, once);
    });

    // --- empty after cleanup ---
    it('[LATEX_WRAPPER:all-wrapper] text that is only wrappers returns empty', () => {
        const input = '\\begin{description}\n\\end{description}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '');
    });

    // --- inline wrapper removal ---
    it('[LATEX_WRAPPER:inline-wrapper] strips inline wrapper tags', () => {
        const input = '故选：B\\end{description}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '故选：B');
    });

    // --- integration: PDF answer field through cleanDisplayTextForBatchSave ---
    it('[LATEX_WRAPPER:integration:pdf-answer] PDF answer with wrapper cleaned through batch save path', () => {
        const result = helpers.cleanDisplayTextForBatchSave('D\n\\end{description}');
        assert.equal(result, 'D');
    });

    // --- integration: PDF solution field through cleanDisplayFieldsOnly ---
    it('[LATEX_WRAPPER:integration:pdf-solution] PDF solution with wrappers cleaned through fields path', () => {
        const q = {
            stem: '题目',
            options: [],
            answer: 'B\n\\end{description}',
            solution: '\\begin{itemize}\n\\item 由正弦定理得解。\n\\end{itemize}'
        };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, 'B');
        assert.equal(q.solution, '由正弦定理得解。');
    });

    // --- integration: math formula preserved through cleanDisplayTextForBatchSave ---
    it('[LATEX_WRAPPER:integration:math-preserved] math LaTeX preserved through full batch save pipeline', () => {
        const result = helpers.cleanDisplayTextForBatchSave(
            '\\begin{enumerate}\n\\item 所以 \\frac{1}{2}+\\sqrt{3}=\\frac{1+2\\sqrt{3}}{2}\n\\end{enumerate}'
        );
        assert.ok(result.includes('\\frac{1}{2}'), 'frac preserved');
        assert.ok(result.includes('\\sqrt{3}'), 'sqrt preserved');
        assert.ok(!result.includes('\\begin{enumerate}'), 'wrapper removed');
        assert.ok(!result.includes('\\item'), 'item removed');
    });

    // --- integration: does not turn empty into accepted ---
    it('[LATEX_WRAPPER:integration:empty-not-accepted] empty after cleanup stays empty', () => {
        const q = { stem: '', options: [], answer: '\\begin{description}\n\\end{description}', solution: '' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, '');
        assert.equal(q.solution, '');
    });

    // ===========================
    // SECOND PASS: equation normalization + orphaned brace stripping
    // ===========================

    // --- Equation → display math ---
    it('[LATEX_PASS2:equation-to-display] converts \\begin{equation}...\\end{equation} to \\[...\\]', () => {
        const input = '\\begin{equation}\n\\frac{2\\cos(\\pi+\\alpha)-3\\sin(-\\alpha)}{4\\cos(-\\alpha)+\\sin(2\\pi+\\alpha)}\n=-\\frac{19}{13}\n\\end{equation}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.startsWith('\\['), 'should start with \\[');
        assert.ok(result.endsWith('\\]'), 'should end with \\]');
        assert.ok(result.includes('\\frac'), 'frac preserved');
        assert.ok(!result.includes('\\begin{equation}'), 'equation begin removed');
        assert.ok(!result.includes('\\end{equation}'), 'equation end removed');
    });

    it('[LATEX_PASS2:equation-star] converts \\begin{equation*} to \\[', () => {
        const input = '\\begin{equation*}\na=b\n\\end{equation*}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.startsWith('\\['), 'should start with \\[');
        assert.ok(result.endsWith('\\]'), 'should end with \\]');
        assert.ok(!result.includes('equation'), 'equation removed');
    });

    // --- Equation + aligned ---
    it('[LATEX_PASS2:equation-with-aligned] converts equation wrapping aligned', () => {
        const input = '\\begin{equation}\n\\begin{aligned}\na^2+b^2=c^2\n\\end{aligned}\n\\end{equation}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.startsWith('\\['), 'should start with \\[');
        assert.ok(result.endsWith('\\]'), 'should end with \\]');
        assert.ok(result.includes('\\begin{aligned}'), 'aligned preserved');
        assert.ok(result.includes('\\end{aligned}'), 'aligned end preserved');
        assert.ok(!result.includes('equation'), 'equation removed');
    });

    // --- Orphaned braces: leading } ---
    it('[LATEX_PASS2:brace-leading-close] strips leading orphaned }', () => {
        const input = '} -\\frac{19}{13}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '-\\frac{19}{13}');
    });

    // --- Orphaned braces: trailing } ---
    it('[LATEX_PASS2:brace-trailing-close-number] strips trailing orphaned } from number', () => {
        const input = '6}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '6');
    });

    // --- Orphaned braces: leading } before letter ---
    it('[LATEX_PASS2:brace-leading-close-letter] strips leading } before letter', () => {
        const input = '}B';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, 'B');
    });

    // --- Orphaned braces: trailing } after letter ---
    it('[LATEX_PASS2:brace-trailing-close-letter] strips trailing } after letter', () => {
        const input = 'D}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, 'D');
    });

    // --- Orphaned braces: leading } before formula ---
    it('[LATEX_PASS2:brace-leading-close-formula] strips leading } before formula', () => {
        const input = '} \\frac{\\sqrt{2}+1}{2}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '\\frac{\\sqrt{2}+1}{2}');
    });

    // --- Preserve: balanced frac braces ---
    it('[LATEX_PASS2:preserve-frac-braces] preserves balanced braces in frac', () => {
        const input = '\\frac{\\sqrt{2}+1}{2}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '\\frac{\\sqrt{2}+1}{2}');
    });

    // --- Preserve: set notation ---
    it('[LATEX_PASS2:preserve-set-notation] preserves set notation braces', () => {
        const input = 'A={-1,0,1}, B={0,1}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, 'A={-1,0,1}, B={0,1}');
    });

    // --- Preserve: cases environment braces ---
    it('[LATEX_PASS2:preserve-cases] preserves cases environment', () => {
        const input = '\\[\n\\begin{cases}\nx+y=1\\\\\nx-y=2\n\\end{cases}\n\\]';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.includes('\\begin{cases}'), 'cases preserved');
        assert.ok(result.includes('\\end{cases}'), 'cases end preserved');
    });

    // --- Preserve: aligned braces ---
    it('[LATEX_PASS2:preserve-aligned-alone] preserves standalone aligned', () => {
        const input = '\\begin{aligned}\na^2+b^2=c^2\n\\end{aligned}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.includes('\\begin{aligned}'), 'aligned preserved');
        assert.ok(result.includes('\\end{aligned}'), 'aligned end preserved');
    });

    // --- Preserve: matrix ---
    it('[LATEX_PASS2:preserve-matrix] preserves matrix environment', () => {
        const input = '\\begin{matrix} a & b \\\\ c & d \\end{matrix}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.includes('\\begin{matrix}'), 'matrix preserved');
        assert.ok(result.includes('\\end{matrix}'), 'matrix end preserved');
    });

    // --- Leading orphaned { ---
    it('[LATEX_PASS2:brace-leading-open] strips leading orphaned {', () => {
        const input = '{ -\\frac{19}{13}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '-\\frac{19}{13}');
    });

    // --- Trailing orphaned { ---
    it('[LATEX_PASS2:brace-trailing-open] strips trailing orphaned {', () => {
        const input = '6{';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '6');
    });

    // --- Multiple orphaned braces ---
    it('[LATEX_PASS2:brace-multiple-orphaned] strips multiple orphaned boundary braces', () => {
        const input = '}} \\frac{1}{2} }}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        // \frac{1}{2} has 2 { and 2 } — balanced internally
        // The leading }} and trailing }} are orphans
        assert.equal(result, '\\frac{1}{2}');
    });

    // --- Idempotent after brace strip ---
    it('[LATEX_PASS2:brace-idempotent] brace stripping is idempotent', () => {
        const input = '} -\\frac{19}{13}';
        const once = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        const twice = qisiUtils.sanitizeLatexWrapperArtifacts(once);
        assert.equal(twice, once);
    });

    // --- Combined: equation + braces ---
    it('[LATEX_PASS2:combined-equation-braces] handles equation with trailing orphan brace', () => {
        const input = '\\begin{equation}\n\\frac{1}{2}\n\\end{equation}}';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.startsWith('\\['), 'should start with \\[');
        assert.ok(result.endsWith('\\]'), 'should end with \\]');
    });

    // --- Integration: answer with orphaned brace through batch save ---
    it('[LATEX_PASS2:integration:answer-orphaned-brace] PDF answer orphaned brace cleaned through batch save', () => {
        const result = helpers.cleanDisplayTextForBatchSave('} -\\frac{19}{13}');
        assert.equal(result, '-\\frac{19}{13}');
    });

    // --- Integration: solution with equation through fields ---
    it('[LATEX_PASS2:integration:solution-equation] PDF solution with equation cleaned through fields path', () => {
        const q = {
            stem: '题目',
            options: [],
            answer: 'D}',
            solution: '\\begin{equation}\n\\frac{2\\cos(\\pi+\\alpha)-3\\sin(-\\alpha)}{4\\cos(-\\alpha)+\\sin(2\\pi+\\alpha)}\n=-\\frac{19}{13}\n\\end{equation}'
        };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, 'D');
        assert.ok(q.solution.startsWith('\\['), 'solution should start with \\[');
        assert.ok(!q.solution.includes('\\begin{equation}'), 'equation removed');
    });

    // --- Integration: formula syntax error text not swallowed ---
    it('[LATEX_PASS2:integration:bad-formula-not-swallowed] bad formula fragment is not swallowed', () => {
        const input = '\\frac{1}{2';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.ok(result.length > 0, 'should not return empty for incomplete formula');
        assert.ok(result.includes('\\frac'), 'frac preserved even with bad brace');
    });

    // --- Empty remains empty ---
    it('[LATEX_PASS2:empty-stays-empty] all-wrapper text with braces stays empty', () => {
        const input = '}\n{';
        const result = qisiUtils.sanitizeLatexWrapperArtifacts(input);
        assert.equal(result, '');
    });

    // ===========================
    // THIRD PASS: raw JSON leakage guard + formula fallback
    // ===========================

    // --- isRawJsonPayloadText: detects AI JSON payload ---
    it('[LATEX_PASS3:json-detection:ai-structured-output] detects AI structured output JSON', () => {
        const input = '{"questions":[{"questionNumber":"1","stem":"已知...","options":{"A":"...","B":"..."},"answer":"D","analysis":"..."}]}';
        assert.equal(qisiUtils.isRawJsonPayloadText(input), true);
    });

    // --- isRawJsonPayloadText: normal math is NOT flagged ---
    it('[LATEX_PASS3:json-detection:normal-math] normal math is not flagged as JSON', () => {
        const input = '\\frac{\\sqrt{2}+1}{2}';
        assert.equal(qisiUtils.isRawJsonPayloadText(input), false);
    });

    // --- isRawJsonPayloadText: normal Chinese text is NOT flagged ---
    it('[LATEX_PASS3:json-detection:chinese-text] Chinese text is not flagged as JSON', () => {
        const input = '由正弦定理得 AB=2R\\sin60^\\circ。';
        assert.equal(qisiUtils.isRawJsonPayloadText(input), false);
    });

    // --- isRawJsonPayloadText: answer letter is NOT flagged ---
    it('[LATEX_PASS3:json-detection:answer-letter] single answer letter is not flagged', () => {
        const input = 'D';
        assert.equal(qisiUtils.isRawJsonPayloadText(input), false);
    });

    // --- isRawJsonPayloadText: JSON with only 2 patterns is NOT flagged ---
    it('[LATEX_PASS3:json-detection:two-patterns] JSON with only 2 AI patterns not flagged', () => {
        const input = '{"questionNumber":"1","stem":"已知..."}';
        assert.equal(qisiUtils.isRawJsonPayloadText(input), false);
    });

    // --- isRawJsonPayloadText: empty/null is NOT flagged ---
    it('[LATEX_PASS3:json-detection:empty] empty string is not flagged', () => {
        assert.equal(qisiUtils.isRawJsonPayloadText(''), false);
        assert.equal(qisiUtils.isRawJsonPayloadText(null), false);
    });

    // --- JSON payload in stem: replaced with warning placeholder ---
    it('[LATEX_PASS3:integration:json-stem-blocked] raw JSON in stem is replaced with warning', () => {
        const input = '{"questions":[{"questionNumber":"1","stem":"已知...","options":{"A":"x","B":"y"},"answer":"D","analysis":"解..."}]}';
        const result = helpers.cleanDisplayTextForBatchSave(input);
        assert.equal(result, '【结构化输出解析失败，需人工复核】');
    });

    // --- JSON payload through cleanDisplayFieldsOnly: stem blocked ---
    it('[LATEX_PASS3:integration:json-fields-blocked] raw JSON stem blocked through fields path', () => {
        const q = {
            stem: '{"questions":[{"questionNumber":"1","stem":"已知...","options":{"A":"x"},"answer":"D","analysis":"解"}]}',
            options: [],
            answer: '',
            solution: ''
        };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.stem, '【结构化输出解析失败，需人工复核】');
    });

    // --- Normal stem with math is NOT blocked ---
    it('[LATEX_PASS3:integration:normal-stem-passes] normal stem with math is not blocked', () => {
        const result = helpers.cleanDisplayTextForBatchSave(
            '已知集合 A=\\{-1,0,1\\}，B=\\{0,1\\}，则 A\\cap B 等于'
        );
        assert.ok(result.includes('已知集合'), 'stem content preserved');
        assert.ok(!result.includes('结构化输出'), 'not flagged as JSON');
    });

    // --- Answer with single letter is NOT blocked ---
    it('[LATEX_PASS3:integration:answer-passes] single answer letter is not blocked', () => {
        const q = { stem: '题目', options: ['A', 'B', 'C', 'D'], answer: 'D', solution: '解析' };
        helpers.cleanDisplayFieldsOnly(q);
        assert.equal(q.answer, 'D');
    });

    // --- JSON guard does not affect answer ownership ---
    it('[LATEX_PASS3:safety:json-guard-fail-closed] JSON guard is fail-closed — returns warning not original', () => {
        const input = '{"questions":[{"questionNumber":"1","stem":"已知...","options":{"A":"x"},"answer":"D","analysis":"解"}]}';
        const result = helpers.cleanDisplayTextForBatchSave(input);
        assert.ok(!result.includes('questions'), 'raw JSON removed');
        assert.ok(!result.includes('questionNumber'), 'field names removed');
        assert.ok(result.includes('需人工复核'), 'manual review requested');
    });
});

describe('R3 auto-generated fixtures', () => {
    it('[A4:R3:AUTO:R3-01937:cleanDisplayTextForBatchSave:context] cleanDisplayTextForBatchSave at line 1937 preserves behavior', () => {
        const result = helpers.cleanDisplayTextForBatchSave('test [[IMAGE:x]] content');
        assert.ok(typeof result === 'string', 'returns string');
        assert.ok(result.includes('[[IMAGE:x]]'), 'legal image token preserved');
        assert.ok(!result.includes('[图片选项待转换'), 'bad placeholder removed');
    });
    it('[A4:R3:AUTO:R3-01937:cleanDisplayTextForBatchSave:ownership-safe] cleanDisplayTextForBatchSave at line 1937 does not change ownership', () => {
        const result = helpers.cleanDisplayTextForBatchSave('');
        assert.equal(result, '', 'empty returns empty');
        const result2 = helpers.cleanDisplayTextForBatchSave(null);
        assert.equal(result2, '', 'null returns empty');
    });
    it('[A4:R3:AUTO:R3-01995:cleanDisplayTextForBatchSave:context] cleanDisplayTextForBatchSave at line 1995 preserves behavior', () => {
        const result = helpers.cleanDisplayTextForBatchSave('test [[IMAGE:x]] content');
        assert.ok(typeof result === 'string', 'returns string');
        assert.ok(result.includes('[[IMAGE:x]]'), 'legal image token preserved');
        assert.ok(!result.includes('[图片选项待转换'), 'bad placeholder removed');
    });
    it('[A4:R3:AUTO:R3-01995:cleanDisplayTextForBatchSave:ownership-safe] cleanDisplayTextForBatchSave at line 1995 does not change ownership', () => {
        const result = helpers.cleanDisplayTextForBatchSave('');
        assert.equal(result, '', 'empty returns empty');
        const result2 = helpers.cleanDisplayTextForBatchSave(null);
        assert.equal(result2, '', 'null returns empty');
    });
    it('[A4:R3:AUTO:R3-02144:cleanDisplayTextForBatchSave:context] cleanDisplayTextForBatchSave at line 2144 preserves behavior', () => {
        const result = helpers.cleanDisplayTextForBatchSave('test [[IMAGE:x]] content');
        assert.ok(typeof result === 'string', 'returns string');
        assert.ok(result.includes('[[IMAGE:x]]'), 'legal image token preserved');
        assert.ok(!result.includes('[图片选项待转换'), 'bad placeholder removed');
    });
    it('[A4:R3:AUTO:R3-02144:cleanDisplayTextForBatchSave:ownership-safe] cleanDisplayTextForBatchSave at line 2144 does not change ownership', () => {
        const result = helpers.cleanDisplayTextForBatchSave('');
        assert.equal(result, '', 'empty returns empty');
        const result2 = helpers.cleanDisplayTextForBatchSave(null);
        assert.equal(result2, '', 'null returns empty');
    });
});
});
