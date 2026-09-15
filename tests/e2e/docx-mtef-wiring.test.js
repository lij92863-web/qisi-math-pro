const assert = require('node:assert/strict');
const test = require('node:test');

const { startBrowserApp } = require('./browser-harness.js');
const { buildOleContainer, equationNativeStream } = require('../helpers/ole-container.js');

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

// The product runtime must be able to read a MathType equation out of a DOCX it unzips itself.
test('the browser runtime reads a MathType formula out of a DOCX', {
    timeout: 90_000
}, async () => {
    const harness = await startBrowserApp(32124);
    const { page } = harness;
    const oleBytes = buildOleContainer('Equation Native', equationNativeStream(texSourceMtef('-1')));

    try {
        const report = await page.evaluate(async payload => {
            const modules = {
                oleReader: Boolean(window.Qisi?.DocxOleReader?.extractMtefFromOle),
                mtefReader: Boolean(window.Qisi?.DocxMtefReader?.readFormulaFromOle),
                pipeline: Boolean(window.Qisi?.DocxPipeline?.expandDocxMathTypeFormulasForV2)
            };

            const documentXml = '<w:document><w:body><w:p><w:r><w:t>已知集合</w:t></w:r>'
                + '<w:r><w:object w:dxaOrig="936" w:dyaOrig="540"><v:shape id="_x0000_i1025">'
                + '<v:imagedata r:id="rId4" o:title="eq"/></v:shape>'
                + '<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="_x0000_i1025" '
                + 'DrawAspect="Content" ObjectID="_1" r:id="rId4">'
                + '<o:LockedField>false</o:LockedField></o:OLEObject></w:object></w:r>'
                + '<w:r><w:t>，则</w:t></w:r></w:p></w:body></w:document>';

            // Round-trip the bytes through the same unzip path the importer uses.
            const zip = new window.JSZip();
            zip.file('word/document.xml', documentXml);
            zip.file('word/_rels/document.xml.rels',
                '<Relationships><Relationship Id="rId4" '
                + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" '
                + 'Target="embeddings/oleObject1.bin"/></Relationships>');
            zip.file('word/embeddings/oleObject1.bin',
                Uint8Array.from(atob(payload.oleBase64), character => character.charCodeAt(0)));
            const bytes = await zip.generateAsync({ type: 'uint8array' });

            const loaded = await window.JSZip.loadAsync(bytes);
            const xml = await loaded.file('word/document.xml').async('string');
            const rels = await loaded.file('word/_rels/document.xml.rels').async('string');
            const relMap = window.Qisi.DocxPipeline.parseDocxRelationshipMap(rels);
            const oleBytesByRid = new Map();
            for (const [rid, rel] of relMap.entries()) {
                const entry = loaded.file(String(rel.target).replace(/^\/+/, ''));
                if (entry) oleBytesByRid.set(rid, new Uint8Array(await entry.async('arraybuffer')));
            }

            const { text, formulas } = window.Qisi.DocxPipeline.expandDocxMathTypeFormulasForV2(
                xml, oleBytesByRid
            );
            const { paragraphs } = window.Qisi.DocxPipeline.splitDocxParagraphsForOptionMap(text);

            return {
                modules,
                oleBytesRead: oleBytesByRid.size,
                formulas,
                paragraphText: paragraphs.map(paragraph => paragraph.text)
            };
        }, { oleBase64: Buffer.from(oleBytes).toString('base64') });

        assert.deepEqual(report.modules, { oleReader: true, mtefReader: true, pipeline: true });
        assert.equal(report.oleBytesRead, 1, 'the embedding is reachable from the zip');
        assert.equal(report.formulas.length, 1);
        assert.equal(report.formulas[0].status, 'extracted');
        assert.equal(report.formulas[0].latex, '-1');
        assert.equal(report.formulas[0].provenance.source, 'docx-mtef');
        assert.equal(report.paragraphText.length, 1);
        assert.match(report.paragraphText[0], /已知集合 \$-1\$ ?，则/, 'the formula reaches the text');
        assert.doesNotMatch(report.paragraphText[0], /false/i, 'no OLE control text');
        assert.deepEqual(harness.pageErrors, []);
    } finally {
        await harness.close();
    }
});
