const test = require('node:test');
const assert = require('node:assert/strict');

const reader = require('../qisi-docx-mtef-reader.js');
const oleReader = require('../qisi-docx-ole-reader.js');
const { buildOleContainer, equationNativeStream } = require('./helpers/ole-container.js');

test('MTEF subscript and superscript slots attach to the preceding base', () => {
    const char = c => Buffer.from([2, 0, 0x88, c.charCodeAt(0), 0]);
    const line = s => Buffer.concat([Buffer.from([1, 0]), ...[...s].map(char), Buffer.from([0])]);
    for (const [selector, sub, sup, expected] of [
        [27, 'A', '', 'C_{A}'], [28, '', '2', 'C^{2}'], [29, '1', '2', 'C_{1}^{2}']
    ]) {
        const bytes = Buffer.concat([
            Buffer.from([5, 1, 0, 7, 8]), Buffer.from('DSMT4\0'), Buffer.from([0, 1, 0]),
            char('C'), Buffer.from([3, 0, selector, 0, 0]), line(sub), line(sup), Buffer.from([0, 0, 0])
        ]);
        const result = reader.readFormulaFromOle(buildOleContainer('Equation Native', equationNativeStream(bytes)));
        assert.equal(result.status, 'extracted');
        assert.equal(result.latex, expected);
    }
});

// A structural MTEF line that renders the single character "x".
const reconstructedMtef = () => Buffer.concat([
    Buffer.from([5, 1, 0, 7, 8]),
    Buffer.from('DSMT4\0', 'latin1'),
    Buffer.from([0]),
    Buffer.from([1, 0]),            // line
    Buffer.from([2, 0, 0, 0x78, 0]), // character, MT code 0x0078 = 'x'
    Buffer.from([0]),                // end of the line's list
    Buffer.from([0])                 // end of the equation's list
]);

const texSourceMtef = source => {
    const payload = Buffer.from(`TeX Input Language\0${source}\0`, 'latin1');
    return Buffer.concat([
        Buffer.from([5, 1, 0, 7, 8]),
        Buffer.from('DSMT7\0', 'latin1'),
        Buffer.from([1, 102, payload.length]),
        payload,
        Buffer.from([0])
    ]);
};

// Real material from 简略版题目（只有一页）.docx, question 3 option D: MathType stored both a "TeX
// Input Language" record carrying `-1` and the rendered line for the same equation. Concatenating
// them produced the option "-1-1" instead of "-1".
const OPTION_D_MTEF = Buffer.from(
    '050100060944534d54360001661654655820496e707574204c616e6775616765002d3100'
    + '1357696e416c6c4261736963436f6465506167657300110554696d6573204e657720526f6d'
    + '616e00110353796d626f6c001105436f7572696572204e65770011044d5420457874726100'
    + '1357696e416c6c436f64655061676573001106cbcecce500120008210a5f458f442f4150f4'
    + '100f475f4150f21f1e4150f4150f4100f445f425f48f425f4100f4100f435f4100f48f45f4'
    + '2a5f48f48f4100f4100f40f48f417f48f4100f412a5f445f45f45f45f45f410f0c01000100'
    + '01020202020002000101010003000100040005000a010010000000000000000f0102048612'
    + '222d02008831000000',
    'hex'
);

test('an equation that stores both a TeX source and a rendered line yields one formula', () => {
    const result = reader.classifyMtef(OPTION_D_MTEF);

    assert.equal(result.status, 'extracted');
    assert.equal(result.latex, '-1', 'the option must not read "-1-1"');
    assert.equal(result.origin, 'tex-source');
    assert.equal(result.provenance.source, 'docx-mtef');
    assert.equal(result.provenance.status, 'deterministic-source');
});

test('a reliable TeX source is used verbatim instead of being reconstructed', () => {
    const source = '\\because f(0)=-1<0, f(1)=\\sin 1>0';

    const result = reader.classifyMtef(texSourceMtef(source));

    assert.equal(result.status, 'extracted');
    assert.equal(result.origin, 'tex-source');
    assert.equal(result.latex, source);
});

test('without a TeX source the structural rows are reconstructed deterministically', () => {
    const result = reader.classifyMtef(reconstructedMtef());

    assert.equal(result.status, 'extracted');
    assert.equal(result.origin, 'reconstruction');
    assert.equal(result.latex, 'x');
});

test('an unreliable TeX source is not trusted', () => {
    assert.equal(reader.isReliableTexSource('x^2+1'), true);
    assert.equal(reader.isReliableTexSource('\\frac{1}{2}'), true);
    assert.equal(reader.isReliableTexSource(''), false);
    assert.equal(reader.isReliableTexSource('x^{2'), false, 'unbalanced braces');
    assert.equal(reader.isReliableTexSource('x}\n{'), false, 'control characters and unbalanced braces');
    assert.equal(reader.isReliableTexSource('x'.repeat(400)), false, 'implausibly long');
});

test('an unreadable equation is unresolved instead of guessed', () => {
    const truncated = Buffer.from([5, 1, 0, 7, 8, 0x44, 0x53]);
    const result = reader.classifyMtef(truncated);

    assert.equal(result.status, 'unresolved');
    assert.equal(result.latex, '');
    assert.equal(result.provenance.status, 'unresolved');
    assert.match(result.code, /^MTEF_/);

    const wrongVersion = reader.classifyMtef(Buffer.from([4, 1, 0, 7, 8]));
    assert.equal(wrongVersion.status, 'unresolved');
    assert.equal(wrongVersion.provenance.status, 'unresolved');
});

test('an OLE container without an Equation Native stream is unresolved, not empty text', () => {
    const container = buildOleContainer('Some Other Stream', Buffer.from('not an equation'));
    const result = reader.readFormulaFromOle(container);

    assert.equal(result.status, 'unresolved');
    assert.equal(result.code, 'MTEF_MISSING_PAYLOAD');
});

// Real material: the vector questions of 题目.docx / 答案.docx write a coloured accent, and MathType
// stores the accent's colour *before* the accent itself inside the character's modifier list
// ("02 01 83 61 00 0f 00 06 00 0b 00" = the character a, a colour, the vector accent). Reading that
// list as "embellishment records only" threw on the colour and lost the whole equation, even though
// the bytes were readable. The colour carries no content, so it is skipped; the accent still decides
// the LaTeX.
const charWithModifiers = (code, modifiers) => Buffer.concat([
    Buffer.from([2, 1, 0x83, code, 0]),
    ...modifiers,
    Buffer.from([0])
]);
const mtefLine = chars => Buffer.concat([
    Buffer.from([5, 1, 0, 6, 9]),
    Buffer.from('DSMT6\0', 'latin1'),
    Buffer.from([0, 1, 0]),
    ...chars,
    Buffer.from([0, 0, 0])
]);

test('a colour inside a character\u2019s modifier list does not hide its accent', () => {
    const colour = Buffer.from([15, 0]);            // colour 0
    const vectorAccent = Buffer.from([6, 0, 11]);   // EMBELL 11 = the vector arrow
    const result = reader.classifyMtef(mtefLine([charWithModifiers(0x61, [colour, vectorAccent])]));

    assert.equal(result.status, 'extracted');
    assert.equal(result.origin, 'reconstruction');
    assert.equal(result.latex, '\\vec{a}');
});

test('an unknown accent or an unknown modifier still fails closed', () => {
    const unknownAccent = reader.classifyMtef(mtefLine([charWithModifiers(0x61, [Buffer.from([6, 0, 5])])]));
    assert.equal(unknownAccent.status, 'unresolved');
    assert.equal(unknownAccent.latex, '');

    // A SIZE record is not a modifier: the walk would be guessing if it were skipped.
    const unknownModifier = reader.classifyMtef(mtefLine([charWithModifiers(0x61, [Buffer.from([10])])]));
    assert.equal(unknownModifier.status, 'unresolved');
    assert.equal(unknownModifier.latex, '');
});

// The piecewise definition of 周二晚测.docx question 8 keeps its two rows in a PILE inside a brace
// template, so the template's own slot list is empty while the template clearly carried content. The
// reader used to emit `f(x)={ }` and drop both rows without a word; a question must not lose content
// silently, so the equation is left unresolved instead.
const mtefTemplate = (selector, variation, rows) => Buffer.concat([
    Buffer.from([3, 0, selector, variation, 0]),
    ...rows,
    Buffer.from([0])
]);
const mtefWithRows = rows => Buffer.concat([
    Buffer.from([5, 1, 0, 6, 9]),
    Buffer.from('DSMT6\0', 'latin1'),
    Buffer.from([0, 1, 0]),
    ...rows,
    Buffer.from([0, 0, 0])
]);

test('a template whose content never reached its slot is unresolved, not an empty shell', () => {
    const plainChar = code => Buffer.from([2, 0, 0x88, code, 0]);
    const lineOf = text => Buffer.concat([
        Buffer.from([1, 0]),
        ...[...text].map(character => plainChar(character.charCodeAt(0))),
        Buffer.from([0])
    ]);

    // Content the reader cannot place inside the fence: a bare character, no slot and no pile.
    const shell = reader.classifyMtef(mtefWithRows([mtefTemplate(2, 1, [plainChar(0x61)])]));
    assert.equal(shell.status, 'unresolved', 'the empty brace must not be offered as the formula');
    assert.equal(shell.latex, '');
    assert.equal(shell.code, 'MTEF_UNSUPPORTED_STRUCTURE');

    // The same template shape with its slot filled stays readable.
    const filled = reader.classifyMtef(mtefWithRows([
        mtefTemplate(2, 1, [lineOf('x')])
    ]));
    assert.equal(filled.status, 'extracted');
    assert.equal(filled.latex, '\\left\\{x\\right.');
});

// The piecewise definition of 周二晚测.docx question 8 keeps its two rows in a PILE inside the brace
// template. Before this rule the whole question had to be withheld (or, worse, read as "f(x)={ }").
test('a braced structure renders the rows it carries in a pile', () => {
    const plainChar = code => Buffer.from([2, 0, 0x88, code, 0]);
    const lineOf = text => Buffer.concat([
        Buffer.from([1, 0]),
        ...[...text].map(character => plainChar(character.charCodeAt(0))),
        Buffer.from([0])
    ]);
    const pile = Buffer.concat([
        Buffer.from([4, 0, 0, 0]),
        lineOf('a'),
        lineOf('b'),
        Buffer.from([0])
    ]);

    const result = reader.classifyMtef(mtefWithRows([mtefTemplate(2, 1, [pile])]));

    assert.equal(result.status, 'extracted');
    assert.equal(result.latex, '\\left\\{\\begin{matrix}a\\\\b\\end{matrix}\\right.');
});

// The vector accent of real material (周二晚测.docx question 3's options, "\\vec{BC}") is a MathType
// *vector template* whose base is the whole two-letter group. Written as the LaTeX accent `\\vec` it
// renders with the arrow over the first letter only - the teacher's "向量符号太小" report - so a base
// wider than one atom is written `\\overrightarrow`, which stretches over it.
test('a vector accent stretches over a multi-letter base and stays short over one letter', () => {
    const plainChar = code => Buffer.from([2, 0, 0x88, code, 0]);
    const lineOf = text => Buffer.concat([
        Buffer.from([1, 0]),
        ...[...text].map(character => plainChar(character.charCodeAt(0))),
        Buffer.from([0])
    ]);
    const vectorTemplate = text => mtefTemplate(31, 0, [lineOf(text)]);

    const wide = reader.classifyMtef(mtefWithRows([vectorTemplate('BC')]));
    assert.equal(wide.status, 'extracted');
    assert.equal(wide.latex, '\\overrightarrow{BC}');

    const narrow = reader.classifyMtef(mtefWithRows([vectorTemplate('a')]));
    assert.equal(narrow.status, 'extracted');
    assert.equal(narrow.latex, '\\vec{a}');
});

test('the equation is read out of a real OLE container', () => {
    const container = buildOleContainer(
        'Equation Native',
        equationNativeStream(texSourceMtef('-1'))
    );

    const result = reader.readFormulaFromOle(container);

    assert.equal(result.status, 'extracted');
    assert.equal(result.latex, '-1');
    assert.equal(result.provenance.source, 'docx-mtef');

    // The container half only locates bytes; it must not invent a formula.
    assert.equal(oleReader.extractMtefFromOle(container)[0], 5, 'MTEF starts with its version byte');
});

test('a malformed container is unresolved rather than throwing', () => {
    const result = reader.readFormulaFromOle(Buffer.from('not an OLE container at all'));
    assert.equal(result.status, 'unresolved');
    assert.equal(result.code, 'MTEF_CONTAINER_INVALID');
});

// Real MathType streams may carry more than one section: the structural terms end first and the
// equation's content follows after the terminators. Stopping at the first terminator reported such
// an equation as empty even though its bytes were right there (this is the shape of the 1:27
// equation of 简略版题目（只有一页）.docx, question 6 option D).
test('content in a later MTEF section is read instead of reporting an empty equation', () => {
    const twoSections = Buffer.concat([
        Buffer.from([5, 1, 0, 6, 9]),
        Buffer.from('DSMT6\0', 'latin1'),
        Buffer.from([0]),
        Buffer.from([0]),                   // the first section ends immediately: no content
        Buffer.from([2, 0, 0x88, 0x31, 0]), // character '1'
        Buffer.from([2, 0, 0x82, 0x3a, 0]), // character ':'
        Buffer.from([2, 0, 0x88, 0x32, 0]), // character '2'
        Buffer.from([2, 0, 0x88, 0x37, 0]), // character '7'
        Buffer.from([0])                    // end of the second section
    ]);

    const result = reader.readFormulaFromOle(
        buildOleContainer('Equation Native', equationNativeStream(twoSections))
    );

    assert.equal(result.status, 'extracted');
    assert.equal(result.origin, 'reconstruction');
    assert.equal(result.latex, '1:27');
});

test('a stream whose only section is empty stays unresolved', () => {
    const empty = Buffer.concat([
        Buffer.from([5, 1, 0, 6, 9]),
        Buffer.from('DSMT6\0', 'latin1'),
        Buffer.from([0]),
        Buffer.from([0])
    ]);

    const result = reader.readFormulaFromOle(
        buildOleContainer('Equation Native', equationNativeStream(empty))
    );

    assert.equal(result.status, 'unresolved');
    assert.equal(result.code, 'MTEF_EMPTY_EQUATION');
});
