const test = require('node:test');
const assert = require('node:assert/strict');

const pipeline = require('../qisi-docx-pipeline.js');

// Verbatim shape of one MathType equation in the teacher's real files: the visible form is the
// preview image, and Word keeps its own control flag inside <o:LockedField>.
const MATH_TYPE_OBJECT = '<w:r><w:object w:dxaOrig="936" w:dyaOrig="540">'
    + '<v:shape id="_x0000_i1025" type="#_x0000_t75" style="width:46.5pt;height:27pt">'
    + '<v:imagedata r:id="rId5" o:title="eqIdd6808aecca7ade274cd949672daf973e"/>'
    + '<o:lock v:ext="edit" aspectratio="t"/><w10:wrap type="none"/><w10:anchorlock/>'
    + '</v:shape>'
    + '<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="_x0000_i1025" '
    + 'DrawAspect="Content" ObjectID="_1468075725" r:id="rId4">'
    + '<o:LockedField>false</o:LockedField></o:OLEObject></w:object></w:r>';

const PARAGRAPH = '<w:p><w:r><w:t>已知集合</w:t></w:r>'
    + MATH_TYPE_OBJECT
    + '<w:r><w:t>，</w:t></w:r>'
    + MATH_TYPE_OBJECT
    + '<w:r><w:t>则下列命题正确的是（ ）</w:t></w:r></w:p>';

test('an embedded MathType object does not leak its control flag into the text', () => {
    const text = pipeline.stripXmlTagsForDocxText(PARAGRAPH);

    assert.doesNotMatch(text, /false/i, `the OLE control flag leaked into: ${text}`);
    assert.equal(text, '已知集合 ， 则下列命题正确的是（ ）');
});

test('the option/paragraph extractor is clean as well', () => {
    const text = pipeline.extractPlainTextFromDocxOptionXmlFragment(PARAGRAPH);

    assert.doesNotMatch(text, /false/i, `the OLE control flag leaked into: ${text}`);
    assert.match(text, /已知集合/);
    assert.match(text, /则下列命题正确的是/);
});

test('the equations of a real-shaped document count as objects, not as text', () => {
    const document = `<w:document><w:body>${PARAGRAPH}${PARAGRAPH}</w:body></w:document>`;
    const text = pipeline.stripXmlTagsForDocxText(document);

    assert.equal((text.match(/false/gi) || []).length, 0, 'no equation may become the word false');
    // The marker the pipeline uses to notice an embedded object must still be visible in the XML.
    assert.match(document, /<w:object\b/);
    assert.match(document, /<v:imagedata\b/);
});

test('ordinary text and tabs are untouched', () => {
    const text = pipeline.stripXmlTagsForDocxText(
        '<w:p><w:r><w:t>第一行</w:t><w:tab/><w:t>第二段</w:t></w:r></w:p>'
    );
    assert.equal(text, '第一行 第二段');
});
