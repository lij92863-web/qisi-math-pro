'use strict';
// 把 PDF 逐页渲染成图片，供人工/视觉逐页比对使用。
// 用法：node scripts/render-pdf-pages.cjs "<pdf>" [输出目录] [scale]
// 与业务代码无关：只加载本地 vendor/pdfjs，不访问网络。

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const pdfPath = path.resolve(process.argv[2] || '');
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'local-run-artifacts', 'page-images'));
const scale = Number(process.argv[4] || 2.5);

(async () => {
    if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error('PDF 不存在: ' + pdfPath);
    fs.mkdirSync(outDir, { recursive: true });
    const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
    const pdfjs = fs.readFileSync(path.join(ROOT, 'vendor/pdfjs/pdf.min.js'), 'utf8');
    const worker = fs.readFileSync(path.join(ROOT, 'vendor/pdfjs/pdf.worker.min.js'), 'utf8');

    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.addScriptTag({ content: pdfjs });
        const pages = await page.evaluate(async ({ data, workerSource, scale }) => {
            const blob = new Blob([workerSource], { type: 'text/javascript' });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
            const bytes = Uint8Array.from(atob(data), ch => ch.charCodeAt(0));
            const pdf = await window.pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
            const out = [];
            for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
                const pdfPage = await pdf.getPage(pageNo);
                const viewport = pdfPage.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                await pdfPage.render({ canvasContext: ctx, viewport }).promise;
                out.push({ pageNo, width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/jpeg', 0.92) });
            }
            return out;
        }, { data: pdfBase64, workerSource: worker, scale });

        for (const page of pages) {
            const file = path.join(outDir, 'page-' + String(page.pageNo).padStart(2, '0') + '.jpg');
            fs.writeFileSync(file, Buffer.from(page.dataUrl.split(',')[1], 'base64'));
            console.log('page ' + page.pageNo + ' ' + page.width + 'x' + page.height + ' -> ' + file);
        }
        console.log('PAGES ' + pages.length + ' DIR ' + outDir);
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error('RENDER_FAILED', error && error.stack || error);
    process.exit(1);
});
