const test = require('node:test');
const assert = require('node:assert/strict');

const rich = require('../qisi-docx-rich-content.js');
const mtefReader = require('../qisi-docx-mtef-reader.js');

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

test('canonical LaTeX accepts mixed left-right delimiters for half-open intervals', () => {
    const normalized = rich.normalizeLatexFragment(
        '\\[\\left( { - \\infty ,0} \\right) \\cup \\left( {0,1} \\right]\\]'
    );

    assert.equal(normalized.ok, true);
    assert.equal(
        normalized.latex,
        '\\left({-\\infty,0}\\right) \\cup \\left({0,1}\\right]'
    );
    assert.equal(rich.normalizeLatexFragment('(a+b]').ok, false);
    assert.equal(rich.normalizeLatexFragment('\\right]x').ok, false);
    assert.equal(rich.normalizeLatexFragment('\\left\\frac{1}{2}\\right)').ok, false);
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

test('adjacent canonical math runs cannot collapse into a display delimiter', () => {
    const serialized = rich.serializeRichRuns([
        { kind: 'math', latex: 'a+b' },
        { kind: 'math', latex: '=c' }
    ]);

    assert.equal(serialized, '$a+b$\u200B$=c$');
    assert.doesNotMatch(serialized, /\$\$/);
});

test('mixed Chinese MathType output keeps prose outside math delimiters', () => {
    const serialized = rich.serializeRichRuns([{
        kind: 'math',
        latex: '故\\triangle ABC的面积S=\\frac{1}{2}bc\\sin A'
    }]);

    assert.equal(serialized, '故$\\triangle ABC$的面积$S=\\frac{1}{2}bc\\sin A$');
    const mathSegments = [...serialized.matchAll(/\$([^$]*)\$/g)].map(match => match[1]);
    assert.equal(mathSegments.some(segment => /[\u3400-\u9fff]/.test(segment)), false);
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

test('MTEF fallback deterministically preserves triangle and arc constructs rejected by legacy MathType', () => {
    const triangle = Buffer.from('BQEABglEU01UNgAAE1dpbkFsbEJhc2ljQ29kZVBhZ2VzABEFVGltZXMgTmV3IFJvbWFuABEDU3ltYm9sABEDRXVjbGlkIFN5bWJvbAARBUNvdXJpZXIgTmV3ABEETVQgRXh0cmEAEQVBcmlhbAASAAghL0WPRC9BUPQQD0dfQVDyHx5BUPQVD0EA9EX0JfSPQl9BAPQQD0NfQQD0j0X0Kl9I9I9BAPQQD0D0j0F/SPQQD0EqX0RfRfRfRfRfQQ8MAQABAAECAgICAAMBAQEBAAQAAQAFAAYACgEAAgSLsyVWAgCDQQACAINCAAIAg0MAAAA=', 'base64');
    const arcs = Buffer.from('BQEABglEU01UNgABE1dpbkFsbEJhc2ljQ29kZVBhZ2VzABEFVGltZXMgTmV3IFJvbWFuABEDU3ltYm9sABEFQ291cmllciBOZXcAEQRNVCBFeHRyYQATV2luQWxsQ29kZVBhZ2VzABEGy87M5QASAAghLyfyXyGPIS9HX0FQ8h8eQVD0FQ9BAPRF9CX0j0JfQQD0EA9DX0EA8h8gpfIKJfSPIfQQD0EA9A9I9Bf0j0EA8hpfRF9F9F9F9F9BDwwBAAEAAQICAgIAAgABAQEAAwABAAQABQAKAQADACIAAAEAEAAAAAAAAAAPAQIAg0QAAgCDRQAADwACAJYiIwAPAQIAgiwADwADACIAAAEADwECAINBAAIAg0MAAA8AAgCWIiMAAAA=', 'base64');

    assert.deepEqual(mtefReader.mtefToLatex(triangle), {
        ok: true,
        code: 'MTEF_LATEX_OK',
        latex: '\\triangle ABC',
        diagnostics: []
    });
    assert.equal(mtefReader.mtefToLatex(arcs).latex, '\\widehat{DE},\\widehat{AC}');
});
