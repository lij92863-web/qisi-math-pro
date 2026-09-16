const test = require('node:test');
const assert = require('node:assert/strict');
const Inspection = require('../qisi-pdf-inspection.js');

const decode = (value, fontName, seen = new Set(), x = 0) =>
    Inspection.decodeGlyphRun(value, fontName, seen, x);

// Word exports a MathType/Equation preview with the Symbol and MT Extra fonts, and both write their
// private-use code points into the PDF's ToUnicode. Every one of these glyphs used to reach the draft as
// [[PDF_UNMAPPED]], so a whole question read as a wall of markers.
test('symbol font glyphs are read back from the font encoding instead of being marked unmapped', () => {
    assert.equal(decode('A \uf03d B', 'ABSEKN+SymbolMT').text, 'A = B');
    assert.equal(decode('\uf02b', 'TZCMBP+SymbolMT').text, '+');
    assert.equal(decode('\uf02d1', 'TZCMBP+SymbolMT').text, '−1');
    assert.equal(decode('n \uf0ce Z', 'TZCMBP+SymbolMT').text, 'n ∈ Z');
    assert.equal(decode('B \uf0cd A', 'TZCMBP+SymbolMT').text, 'B ⊆ A');
    assert.equal(decode('A \uf0c7 B', 'TZCMBP+SymbolMT').text, 'A ∩ B');
    assert.equal(decode('\uf0d0ABC', 'TZCMBP+SymbolMT').text, '∠ABC');
    assert.equal(decode('120\uf06f', 'MUFUVC+MT-Extra').text, '120°');
    assert.equal(decode('\uf056ABC', 'MUFUVC+MT-Extra').text, '△ABC');
    assert.equal(decode('\uf07b0,1\uf07d', 'TZCMBP+SymbolMT').text, '{0,1}');
    assert.equal(decode('a \uf0d7 b', 'TZCMBP+SymbolMT').text, 'a ⋅ b');
});

test('a glyph code the encoding does not prove stays unmapped', () => {
    // 0x0000 is the font's own notdef entry and carries no readable character.
    assert.equal(decode('\uf000', 'TZCMBP+SymbolMT').text, '\uf000');
    assert.equal(decode('\uf049', 'MUFUVC+MT-Extra').text, '∩');
    assert.equal(decode('\uf400', 'MUFUVC+MT-Extra').text, '\uf400');
});

test('a character from an ordinary text font is never rewritten by the symbol table', () => {
    assert.equal(decode('已知集合 A', 'LNUHNF+SimSun').text, '已知集合 A');
    assert.equal(decode('\uf03d', 'LNUHNF+SimSun').text, '\uf03d');
});

// A stretched brace, bracket or radical is drawn as stacked pieces at one x. The reader sees one
// character, so one character is what the text gets - the rest of that column is structure.
test('stacked delimiter and radical pieces collapse to the single character they draw', () => {
    const seen = new Set();
    const first = decode('\uf0ec', 'TZCMBP+SymbolMT', seen, 167.0);
    const middle = decode('\uf0ed', 'TZCMBP+SymbolMT', seen, 167.0);
    const bottom = decode('\uf0ee', 'TZCMBP+SymbolMT', seen, 167.2);
    assert.equal(first.text, '{');
    assert.equal(first.structural, true);
    assert.equal(middle.text, '');
    assert.equal(bottom.text, '', 'the pieces of one column draw one brace');
    const other = decode('\uf0ec', 'TZCMBP+SymbolMT', seen, 300);
    assert.equal(other.text, '{', 'a second brace further right is its own character');
    assert.equal(decode('\uf0e6', 'TZCMBP+SymbolMT', new Set(), 541.9).text, '√');
    assert.equal(decode('\uf0e6', 'TZCMBP+SymbolMT', new Set(), 100).structural, true);
});

// Vector arrows and the wide arc are marks drawn over other characters; they carry no character of their
// own, and pretending otherwise would put a wrong symbol into the stem.
test('drawn marks are recorded as structure instead of characters', () => {
    for (const code of ['\uf072', '\uf075', '\uf0bb']) {
        const decoded = decode(`字母${code}`, 'MUFUVC+MT-Extra');
        assert.equal(decoded.text, '字母');
        assert.equal(decoded.structural, true);
    }
    assert.equal(decode('\uf0be', 'TZCMBP+SymbolMT').text, '', 'the overbar extender is not a character');
});

test('a page whose formulas are stacked pieces is still flagged for visual review', () => {
    const lines = [{ text: '1. A question with a stretched radical and enough words to classify.', structural: true }];
    assert.equal(Inspection.classify({ lines }).kind, 'mixed');
    assert.equal(Inspection.classify({ lines }).reason, 'stacked-formula-glyphs');
});

test('block evidence keeps the page code points even after the display text was decoded', () => {
    const page = { pageNo: 1, kind: 'mixed', width: 600, height: 840,
        lines: [{ text: '1. 已知集合 A = {x}', rawText: '1. 已知集合 A \uf03d \uf07bx\uf07d',
            bbox: [90, 100, 500, 112] }] };
    page.anchors = Inspection.collectAnchors(page);
    const block = Inspection.segment([page]).blocks[0];
    assert.equal(block.text, '1. 已知集合 A = {x}');
    assert.equal(block.rawText, '1. 已知集合 A \uf03d \uf07bx\uf07d');
    assert.equal(block.structuralGlyphs, false);
});
