'use strict';

// A question file whose second question carries a MathType equation the DOCX reader cannot read:
// the relationship points at an embedding that is not in the package, so the pipeline reports the
// formula as unresolved instead of guessing. Question 1 is a healthy control question.
const paragraph = inner => `<w:p>${inner}</w:p>`;
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;

const UNREADABLE_EQUATION =
    '<w:r><w:object w:dxaOrig="936" w:dyaOrig="540">'
    + '<v:shape id="_x0000_i1033" type="#_x0000_t75" style="width:39.75pt;height:12.75pt">'
    + '<v:imagedata r:id="rId5" o:title=""/><o:lock v:ext="edit" aspectratio="t"/>'
    + '<w10:wrap type="none"/></w:shape>'
    + '<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="_x0000_i1033" '
    + 'DrawAspect="Content" ObjectID="_1468075733" r:id="rId4">'
    + '<o:LockedField>false</o:LockedField></o:OLEObject></w:object></w:r>';

const documentXml = '<w:document><w:body>'
    + paragraph(run('一、选择题（本题共2小题，每小题5分，共10分）'))
    + paragraph(run('1. 已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）'))
    + paragraph(run('A. 1 B. 2 C. 3 D. 4'))
    + paragraph(run('2. 已知经过圆锥 $SO$ 的轴的截面是正三角形，则体积之比是（ ）'))
    // Option D is the equation the reader cannot read; it must stay visible as an explicit gap.
    + paragraph(run('A. $1:8$ B. $1:9$ C. $1:26$ D. ') + UNREADABLE_EQUATION)
    + '</w:body></w:document>';

const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';

const rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';

// rId4 (the equation payload) has no part in the package on purpose.
const documentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/oleObject1.bin"/>'
    + '</Relationships>';

module.exports = {
    documentXml,
    contentTypesXml,
    rootRelsXml,
    documentRelsXml,
    affectedQuestion: '2',
    controlQuestion: '1'
};
