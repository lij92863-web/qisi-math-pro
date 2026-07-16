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

test('piecewise MathType LaTeX accepts row breaks before grouped rows', () => {
    const translated = String.raw`$f\left( x \right) = \left\{ {\begin{array}{*{20}{l}}
{\left| {{{\log }_2}\left( {x - 1} \right)} \right|,1 < x \le 3}\\
{{{\left( {x - 4} \right)}^2},x > 3}
\end{array}} \right.$`;

    const normalized = rich.normalizeLatexFragment(translated);

    assert.equal(normalized.ok, true, JSON.stringify(normalized));
    assert.match(normalized.latex, /\\begin\{array\}\{l\}/);
    assert.doesNotMatch(normalized.latex, /\*\{\d+\}/);
    assert.match(normalized.latex, /\\right\./);
});

test('redundant MathType mathop wrappers around large operators are KaTeX-compatible', () => {
    const normalized = rich.normalizeLatexFragment(
        String.raw`\mathop \sum \limits_{i=1}^5 x_i+\mathop\prod_{j=1}^n y_j`
    );

    assert.equal(normalized.ok, true, JSON.stringify(normalized));
    assert.equal(normalized.latex, String.raw`\sum \limits_{i=1}^5 x_i+\prod_{j=1}^n y_j`);
    assert.doesNotMatch(normalized.latex, /\\mathop/);
});

test('vertical bars used by flexible delimiters are not rewritten as mid relations', () => {
    const normalized = rich.normalizeLatexFragment(
        String.raw`f\left(x\right)=\left\{\begin{matrix}\left|log{2}_{}\left(x-1\right)\right|,1<x\le 3\\\left(x-4\right){}^{2},x>3\end{matrix}\right.`
    );

    assert.equal(normalized.ok, true, JSON.stringify(normalized));
    assert.match(normalized.latex, /\\left\|log/);
    assert.doesNotMatch(normalized.latex, /\\left\\mid/);
});

test('adjacent canonical math runs cannot collapse into a display delimiter', () => {
    const serialized = rich.serializeRichRuns([
        { kind: 'math', latex: 'a+b' },
        { kind: 'math', latex: '=c' }
    ]);

    assert.equal(serialized, '$a+b$\u200B$=c$');
    assert.doesNotMatch(serialized, /\$\$/);
});

test('multi-letter vectors use a full-width arrow while single-letter vectors keep vec', () => {
    assert.equal(
        rich.normalizeLatexFragment('\\vec{BC}+\\vec{a}').latex,
        '\\overrightarrow{BC}+\\vec{a}'
    );
});

test('split piecewise MathType fragments are validated after bounded run assembly', () => {
    const diagnostics = [];
    const serialized = rich.serializeRichRuns([
        { kind: 'text', text: '已知函数' },
        { kind: 'math', latex: 'f(x)=\\left\\{\\begin{array}{ll}x^2+2x-3,&x\\le 0\\\\' },
        { kind: 'text', text: '-2+\\ln x,&x>0' },
        { kind: 'math', latex: '\\end{array}\\right.' },
        { kind: 'text', text: '，令' },
        { kind: 'math', latex: 'h(x)=f(x)-k' }
    ], diagnostics);

    assert.deepEqual(diagnostics, []);
    assert.match(serialized, /\$f\(x\)=\\left\\\{\\begin\{array\}\{ll\}[\s\S]*\\end\{array\}\\right\.\$/);
    assert.doesNotMatch(serialized, /公式需要人工复核|\[公式语法错误/);
});

test('one balanced multiline formula is serialized without raw line breaks inside delimiters', () => {
    const serialized = rich.serializeRichRuns([{
        kind: 'math',
        latex: 'f(x)=\\left\\{\\begin{array}{l}x^2,&x\\le 0\\\\\n-2+\\ln x,&x>0\n\\end{array}\\right.'
    }]);

    assert.doesNotMatch(serialized, /\r|\n/);
    assert.match(serialized, /\\begin\{array\}[\s\S]*\\end\{array\}/);
});

test('plain geometry identifiers next to Chinese prose and equations become inline math', () => {
    const serialized = rich.serializeRichRuns([
        { kind: 'text', text: '如图，四棱锥PABCD中，底面ABCD为矩形，V=' },
        { kind: 'math', latex: '\\frac{\\sqrt{3}}{4}' }
    ]);

    assert.match(serialized, /四棱锥\$PABCD\$中/);
    assert.match(serialized, /底面\$ABCD\$为/);
    assert.match(serialized, /\$V=\$/);
    assert.doesNotMatch(serialized, /\$\$/);
});

test('soft-hyphen split geometry names and cross-run V equals are rejoined safely', () => {
    const serialized = rich.serializeRichRuns([
        { kind: 'text', text: '四棱锥P\u00ad' },
        { kind: 'math', latex: 'ABCD' },
        { kind: 'text', text: '的体积 V＝' },
        { kind: 'math', latex: '\\frac{\\sqrt{3}}{4}' }
    ]);

    assert.match(serialized, /四棱锥\$PABCD\$的体积/);
    assert.match(serialized, /\$V=\$/);
    assert.doesNotMatch(serialized, /\u00ad|\$\$/);
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

test('Chinese connective inside one balanced set expression stays within one renderable formula', () => {
    const serialized = rich.serializeRichRuns([{
        kind: 'math',
        latex: 'C{U}_{}A={x\\mid x<-3 或 x\\ge 1}'
    }]);

    assert.equal(serialized, '$C{U}_{}A={x\\mid x<-3 \\text{或} x\\ge 1}$');
    assert.equal(rich.normalizeLatexFragment(serialized).ok, true);
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

test('accepts half-open interval notation with intentionally mixed boundary delimiters', () => {
    assert.deepEqual(rich.normalizeLatexFragment('$x \\in [0,+\\infty)$'), {
        ok: true,
        code: 'LATEX_OK',
        latex: 'x \\in [0,+\\infty)',
        diagnostics: []
    });
    assert.equal(rich.normalizeLatexFragment('(-\\infty,1]').ok, true);
});

test('recovers exact TeX source stored in a MathType future record', () => {
    const source = '\\because f(0)=-1<0, f(1)=\\sin 1>0';
    const payload = Buffer.from(`TeX Input Language\0${source}\0`, 'latin1');
    const mtef = Buffer.concat([
        Buffer.from([5, 1, 0, 7, 8]),
        Buffer.from('DSMT7\0', 'latin1'),
        Buffer.from([1, 102, payload.length]),
        payload,
        Buffer.from([0])
    ]);

    assert.deepEqual(mtefReader.mtefToLatex(mtef), {
        ok: true,
        code: 'MTEF_LATEX_OK',
        latex: source,
        diagnostics: []
    });
    assert.equal(rich.normalizeLatexFragment(source).ok, true);
});
