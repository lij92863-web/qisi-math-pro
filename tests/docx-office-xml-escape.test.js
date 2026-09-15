const test = require('node:test');
const assert = require('node:assert/strict');

const pipeline = require('../qisi-docx-pipeline.js');

// Real leak shape: an Office OLE / VML element reaching the question text as raw XML. The namespace
// prefixes are o: (OLE) and v: (VML), which the previous w:/m:/wp:/a: enumeration did not cover.
const OLE_OBJECT = '<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ObjectID="_1468075749" r:id="rId4">C</o:OLEObject>';
const VML_SHAPE = '<v:shape id="_x0000_i1025" style="width:46.5pt" o:ole="t"><v:imagedata r:id="rId129"/></v:shape>';
const LOCKED_FIELD = '<w:object><v:shape id="_x0000_i1"/><o:OLEObject ObjectID="_1" r:id="rId4"><o:LockedField>false</o:LockedField></o:OLEObject></w:object>';

test('an OLE element hiding in a w:t node is treated as leaked markup', () => {
    assert.equal(pipeline.hasOfficeXmlMarkup(`已知 ${OLE_OBJECT} 则`), true);
});

test('a VML element is treated as leaked markup as well', () => {
    assert.equal(pipeline.hasOfficeXmlMarkup(VML_SHAPE), true);
});

test('ordinary prose and maths are not mistaken for markup', () => {
    for (const text of [
        '已知 a<b 且 x>y，则（ ）',
        '设 $a<b$，比较大小',
        '答案 1234567890123 保持不变',
        '不等式 x^2-3x+2\\le 0',
        ''
    ]) {
        assert.equal(pipeline.hasOfficeXmlMarkup(text), false, text);
    }
});

test('stripping leaked markup removes the tag names and the attribute values', () => {
    const stripped = pipeline.stripXmlTagsForDocxText(`已知 ${OLE_OBJECT} 则`);

    assert.doesNotMatch(stripped, /o:OLEObject/);
    assert.doesNotMatch(stripped, /ObjectID=/);
    assert.doesNotMatch(stripped, /r:id=/);
    assert.match(stripped, /已知/);
    assert.match(stripped, /C/);
});

test('a leaked OLE object never contributes its control field to the text', () => {
    const stripped = pipeline.stripXmlTagsForDocxText(`选项 ${LOCKED_FIELD} 说`);

    assert.doesNotMatch(stripped, /false/i);
    assert.doesNotMatch(stripped, /LockedField/);
    assert.match(stripped, /选项/);
});

test('the same helper still strips a plain namespaced tag such as w:t', () => {
    assert.equal(pipeline.hasOfficeXmlMarkup('<w:t>甲</w:t>'), true);
    assert.equal(pipeline.stripXmlTagsForDocxText('<w:t>甲</w:t>'), '甲');
});
