const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, assertNoRuntimeErrors } = require('./browser-harness');

test('retained PDF region renderer preserves crop pixels and dimensions across rotation and scale', { timeout: 45000 }, async () => {
    const h = await startBrowserApp(32842);
    try {
        const observations = await h.page.evaluate(async () => {
            const file = rotation => {
                const stream = '1 0 0 rg\n24 40 24 24 re f\n';
                const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
                    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
                    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Rotate ${rotation} /Resources << >> /Contents 4 0 R >>`,
                    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
                let text = '%PDF-1.4\n'; const offsets = [0];
                objects.forEach((body, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${body}\nendobj\n`; });
                const xref = text.length;
                text += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
                    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
                return { filename: 'synthetic-crop.pdf', uploadPath: 'data:application/pdf;base64,' + btoa(text) };
            };
            const renderer = window.Qisi.BrowserPdfRenderer.createBrowserPdfRenderer({
                dataUrlToBlob: async url => new Blob([Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0))], { type: 'application/pdf' }),
                getBatchFileRoles: () => ['full'], logBatchPdfDiag() {}, batchHasQuestionRole: () => true,
                estimateVisionCalls: () => 0, recordRenderedPages() {}, showBatchToast() {}, getRecognitionMode: () => 'mock'
            });
            const results = [];
            for (const rotation of [0, 90]) for (const scale of [2, 3]) {
                // renderPdfRegion's retained contract uses normalized 0..1000
                // coordinates. No retired producer or page-evidence wrapper runs.
                const bbox = rotation ? [500, 200, 800, 400] : [200, 200, 400, 500];
                const crop = await renderer.renderPdfRegion(file(rotation), { pageNo: 1, bbox, scale });
                const image = new Image(); image.src = crop.url; await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
                const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
                results.push({ rotation, scale, width: crop.width, height: crop.height,
                    pixel: [...context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data] });
            }
            for (const input of [{ pageNo: 2, bbox: [200, 200, 400, 500] }, { pageNo: 1, bbox: null }, { pageNo: 1, bbox: [0, 0, 100, 100] }]) {
                try { await renderer.renderPdfRegion(file(0), input); results.push({ unexpectedSuccess: input }); }
                catch (error) { results.push({ rejected: true, message: error.message }); }
            }
            return results;
        });
        assert.equal(observations.length, 7);
        for (const item of observations.slice(0, 4)) {
            assert.equal(item.width, 24 * item.scale);
            assert.equal(item.height, 24 * item.scale);
            assert.deepEqual(item.pixel, [255, 0, 0, 255]);
        }
        assert.ok(observations.slice(4).every(item => item.rejected));
        assert.match(observations[5].message, /PDF_V1_BBOX_INVALID/);
        assert.match(observations[6].message, /PDF_V1_CROP_EMPTY/);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
