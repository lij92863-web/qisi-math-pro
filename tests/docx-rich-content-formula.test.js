const test = require('node:test');
const assert = require('node:assert/strict');

const rich = require('../qisi-docx-rich-content.js');

test('canonical LaTeX owns no delimiters and rejects nested delimiters', () => {
    assert.deepEqual(
        rich.normalizeLatexFragment('$\\frac{1330\\sqrt{2}}{3}\\pi$'),
        {
            ok: true,
            code: 'LATEX_OK',
            latex: '\\frac{1330\\sqrt{2}}{3}\\pi',
            diagnostics: []
        }
    );

    const broken = rich.normalizeLatexFragment('\\frac{1330$$\\sqrt{2}}{3}\\pi');
    assert.equal(broken.ok, false);
    assert.equal(broken.code, 'NESTED_MATH_DELIMITER');
});

test('MathType translator output is canonicalized before rich serialization', () => {
    const translated = '$A = \\left\\{ {x|x = \\sin \\frac{{n{\\rm{\\pi }}}}{2},n \\in {\\bf{Z}}} \\right\\}$';
    const normalized = rich.normalizeLatexFragment(translated);

    assert.equal(normalized.ok, true);
    assert.doesNotMatch(normalized.latex, /\\rm|\\bf|\$/);
    assert.match(normalized.latex, /\\pi/);
    assert.match(normalized.latex, /\\mathbb\{Z\}/);

    const serialized = rich.serializeRichRuns([
        { kind: 'text', text: '已知集合' },
        { kind: 'math', latex: normalized.latex }
    ]);
    assert.equal((serialized.match(/\$/g) || []).length, 2);
});

test('structured OMML conversion keeps fraction, radical, and trig structure', () => {
    const xml = [
        '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
        '<m:f><m:num><m:r><m:t>1330</m:t></m:r><m:rad><m:e><m:r><m:t>2</m:t></m:r></m:e></m:rad></m:num>',
        '<m:den><m:r><m:t>3</m:t></m:r></m:den></m:f>',
        '<m:r><m:t>π</m:t></m:r>',
        '</m:oMath>'
    ].join('');

    assert.equal(
        rich.ommlToLatexBody(xml),
        '\\frac{1330\\sqrt{2}}{3}\\pi'
    );
});

test('WMF AppsMFC extraction returns the embedded MTEF payload', () => {
    const signature = Buffer.from('AppsMFC', 'ascii');
    const company = Buffer.from('Design Science, Inc.\0', 'ascii');
    const mtef = Buffer.from([5, 1, 0, 6, 9, 68, 83, 77, 84, 54, 0]);
    const bytes = Buffer.alloc(32 + signature.length + 18 + company.length + mtef.length);
    const signatureOffset = 32;
    signature.copy(bytes, signatureOffset);
    bytes.writeInt32LE(mtef.length, signatureOffset + 14);
    company.copy(bytes, signatureOffset + 18);
    mtef.copy(bytes, signatureOffset + 18 + company.length);

    assert.deepEqual(
        Buffer.from(rich.extractMtefFromWmf(bytes)),
        mtef
    );
});
