const test = require('node:test');
const assert = require('node:assert/strict');

const mtefReader = require('../qisi-docx-mtef-reader.js');
const oleReader = require('../qisi-docx-ole-reader.js');

// The pipeline reads the reader through the Qisi namespace, exactly as the browser does.
globalThis.Qisi = {
    ...(globalThis.Qisi || {}),
    DocxMtefReader: mtefReader,
    DocxOleReader: oleReader
};

const pipeline = require('../qisi-docx-pipeline.js');
const { buildOleContainer, equationNativeStream } = require('./helpers/ole-container.js');

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

const equationObject = (rid, progId = 'Equation.DSMT4') =>
    '<w:r><w:object w:dxaOrig="936" w:dyaOrig="540">'
    + '<v:shape id="_x0000_i1025" type="#_x0000_t75" style="width:46.5pt;height:27pt">'
    + `<v:imagedata r:id="${rid}" o:title="eq"/>`
    + '<o:lock v:ext="edit" aspectratio="t"/><w10:wrap type="none"/></v:shape>'
    + `<o:OLEObject Type="Embed" ProgID="${progId}" ShapeID="_x0000_i1025" `
    + `DrawAspect="Content" ObjectID="_1468075725" r:id="${rid}">`
    + '<o:LockedField>false</o:LockedField></o:OLEObject></w:object></w:r>';

const oleFor = source => buildOleContainer(
    'Equation Native',
    equationNativeStream(texSourceMtef(source))
);

const documentWith = (...paragraphs) =>
    `<w:document><w:body>${paragraphs.join('')}</w:body></w:document>`;

test('each MathType object contributes exactly one formula', () => {
    const oleBytes = new Map([
        ['rId4', oleFor('x^2+1')],
        ['rId5', oleFor('\\frac{1}{2}')]
    ]);
    const document = documentWith(
        `<w:p><w:r><w:t>已知集合</w:t></w:r>${equationObject('rId4')}<w:r><w:t>，则</w:t></w:r></w:p>`,
        `<w:p>${equationObject('rId5')}</w:p>`
    );

    const { text, formulas } = pipeline.expandDocxMathTypeFormulasForV2(document, oleBytes);

    assert.equal(formulas.length, 2, 'two objects, two formulas');
    assert.deepEqual(formulas.map(row => row.rid), ['rId4', 'rId5']);
    assert.deepEqual(formulas.map(row => row.status), ['extracted', 'extracted']);
    assert.deepEqual(formulas.map(row => row.latex), ['x^2+1', '\\frac{1}{2}']);
    assert.equal((text.match(/\$x\^2\+1\$/g) || []).length, 1, 'the first formula appears once');
    assert.equal((text.match(/\$\\frac\{1\}\{2\}\$/g) || []).length, 1, 'the second formula appears once');
});

test('every formula carries DOCX deterministic MTEF provenance', () => {
    const oleBytes = new Map([['rId4', oleFor('x')]]);
    const { formulas } = pipeline.expandDocxMathTypeFormulasForV2(
        documentWith(`<w:p>${equationObject('rId4')}</w:p>`), oleBytes
    );

    const [formula] = formulas;
    assert.equal(formula.source, 'docx-mtef');
    assert.equal(formula.evidenceRef, 'ole:rId4');
    assert.equal(formula.provenance.status, 'deterministic-source');
    assert.equal(formula.provenance.source, 'docx-mtef');
    assert.equal(formula.provenance.evidenceRef, 'ole:rId4');
    assert.equal(formula.origin, 'tex-source');
});

test('an unreadable equation is isolated to its own question', () => {
    const oleBytes = new Map([['rId4', oleFor('x')]]); // rId9 has no bytes at all
    const document = documentWith(
        `<w:p><w:r><w:t>第一题</w:t></w:r>${equationObject('rId4')}</w:p>`,
        `<w:p><w:r><w:t>第二题</w:t></w:r>${equationObject('rId9')}</w:p>`,
        '<w:p><w:r><w:t>第三题没有公式</w:t></w:r></w:p>'
    );

    const { text, formulas } = pipeline.expandDocxMathTypeFormulasForV2(document, oleBytes);

    assert.deepEqual(
        formulas.map(row => [row.rid, row.status]),
        [['rId4', 'extracted'], ['rId9', 'unresolved']]
    );
    assert.match(text, /第一题/, 'the readable question keeps its text');
    assert.match(text, /\$x\$/, 'the readable formula is present');
    assert.match(text, /\[\[MTEF_UNRESOLVED:rId9\]\]/, 'the unreadable one is explicit');
    assert.match(text, /第三题没有公式/, 'an unrelated question is untouched');
    assert.doesNotMatch(text, /false/, 'no OLE control text may reach the question');
});

test('a non-equation embedded object is left to the existing picture handling', () => {
    const document = documentWith(`<w:p>${equationObject('rId7', 'Excel.Sheet.12')}</w:p>`);

    const { text, formulas } = pipeline.expandDocxMathTypeFormulasForV2(document, new Map());

    assert.deepEqual(formulas, []);
    assert.equal(text, document, 'the object is returned unchanged');
    assert.doesNotMatch(text, /MTEF_UNRESOLVED/);
});

test('the resolver reports a MathType object even when its bytes are missing', () => {
    const resolved = pipeline.resolveDocxMathTypeObjectForV2(equationObject('rId4'), new Map());

    assert.equal(resolved.handled, true);
    assert.equal(resolved.formula.status, 'unresolved');
    assert.equal(resolved.formula.code, 'MTEF_MISSING_PAYLOAD');
    assert.match(resolved.text, /\[\[MTEF_UNRESOLVED:rId4\]\]/);

    const notAnEquation = pipeline.resolveDocxMathTypeObjectForV2(
        equationObject('rId4', 'Word.Document.8'), new Map()
    );
    assert.equal(notAnEquation.handled, false);
    assert.equal(notAnEquation.formula, null);
});

test('formula records stay aligned with the text they produced', () => {
    const oleBytes = new Map([['rId4', oleFor('x')]]);
    const { text, formulas } = pipeline.expandDocxMathTypeFormulasForV2(
        documentWith(`<w:p>${equationObject('rId4')}${equationObject('rId9')}</w:p>`),
        oleBytes
    );

    const records = pipeline.formulaRecordsForText(text, formulas);

    assert.deepEqual(records.map(row => row.status), ['extracted', 'unresolved']);
});

test('an unresolved formula is still recognised after option-evidence normalization', () => {
    // The tail of the token ("…UNRESOLVED:") looks exactly like the option label "D.", and the
    // option normalizer used to rewrite it into "D. ", which made the gap invisible.
    const block = pipeline.extractDocxQuestionBlockByNumber(
        '1. 已知圆锥 （ ）\nA. 甲 B. 乙 C. 丙 D. [[MTEF_UNRESOLVED:rId71]]',
        '1'
    );

    assert.match(block, /\[\[MTEF_UNRESOLVED:rId71\]\]/, 'the token keeps its own text');
    assert.doesNotMatch(block, /UNRESOLVED\. /, 'the label rule may not rewrite the token');
    assert.deepEqual(pipeline.collectUnresolvedFormulaTokens(block), ['rId71']);
});

test('the unresolved formula collector accepts the historical mangled form', () => {
    assert.deepEqual(
        pipeline.collectUnresolvedFormulaTokens('D. [[MTEF_UNRESOLVED:rId71]]'),
        ['rId71']
    );
    assert.deepEqual(
        pipeline.collectUnresolvedFormulaTokens('D. [[MTEF_UNRESOLVED. rId71]]'),
        ['rId71'],
        'a token a display cleaner already mangled must still be reported'
    );
    assert.deepEqual(
        pipeline.collectUnresolvedFormulaTokens('D. [[MTEF_UNRESOLVED:rId71]] 和 [[MTEF_UNRESOLVED:rId71]]'),
        ['rId71'],
        'the same formula is reported once'
    );
    assert.deepEqual(pipeline.collectUnresolvedFormulaTokens('A. 甲 B. 乙 C. 丙 D. 丁'), []);
    assert.deepEqual(pipeline.collectUnresolvedFormulaTokens(''), []);
});
