const test = require('node:test');
const assert = require('node:assert/strict');

const reader = require('../qisi-docx-mtef-reader.js');
const oleReader = require('../qisi-docx-ole-reader.js');
const { buildOleContainer, equationNativeStream } = require('./helpers/ole-container.js');

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
