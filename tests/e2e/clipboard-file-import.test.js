const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { startBrowserApp, getDbSnapshot, assertNoRuntimeErrors } = require('./browser-harness');

const fixture = name => fs.readFileSync(path.join(__dirname, '../fixtures/true-import', name)).toString('base64');
const openPage = (page, name) => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();

function paste(target, sources, itemsOnly = false) {
    return target.evaluate(async (element, { sources, itemsOnly }) => {
        const transfer = new DataTransfer();
        for (const source of sources) {
            let bytes;
            if (source.base64) bytes = Uint8Array.from(atob(source.base64), value => value.charCodeAt(0));
            else {
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = source.height ?? 240;
                const context = canvas.getContext('2d');
                context.fillRect(20, 30, 250, 130);
                bytes = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            }
            transfer.items.add(new File([bytes], source.name, { type: source.type }));
        }
        const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true });
        if (itemsOnly) Object.defineProperty(event, 'clipboardData', { value: { files: [], items: transfer.items } });
        element.dispatchEvent(event);
        return event.defaultPrevented;
    }, { sources, itemsOnly });
}

const screenshot = { name: '剪贴截图.png', type: 'image/png' };
const pasteButton = page => page.getByRole('button', { name: '粘贴图片或文件', exact: true });

test('单题录入的 Ctrl＋滚轮缩放原卷，缩放后仍能准确框选', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32356);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 1450, height: 900 });
        await openPage(page, '单题录入');
        assert.equal(await paste(pasteButton(page), [{ ...screenshot, height: 850 }]), true);
        const source = page.locator('.v-single-entry .v-source');
        const preview = source.locator('.v-source-scroll');
        const image = preview.locator('.v-source-page');
        await image.waitFor();
        await source.getByRole('button', { name: /暂停截图识别/ }).click();
        await preview.click({ position: { x: 8, y: 180 } });
        assert.equal(await preview.evaluate(el => document.activeElement === el), true);

        const previewBox = await preview.boundingBox();
        const mouseY = previewBox.y + 180;
        const before = await image.boundingBox();
        const pageScale = () => page.evaluate(() => [innerWidth, devicePixelRatio]);
        const scale = await pageScale();
        const zoomButton = percent => source.getByRole('button', { name: `原卷缩放 ${percent}%`, exact: true });
        const zoom = async (delta, percent) => {
            await page.keyboard.down('Control');
            try {
                await page.mouse.wheel(0, delta);
                await zoomButton(percent).waitFor();
            } finally { await page.keyboard.up('Control'); }
        };
        await page.mouse.move(previewBox.x + 8, mouseY);
        await zoom(-120, 110);
        const larger = await image.boundingBox();
        assert.ok(larger.width > before.width);
        const imagePoint = (mouseY - before.y) / before.height;
        assert.ok(Math.abs(larger.y + imagePoint * larger.height - mouseY) < 3);
        await zoom(120, 100);
        await zoom(120, 90);
        assert.ok((await image.boundingBox()).width < before.width);
        assert.deepEqual(await pageScale(), scale);

        const scrollTop = await preview.evaluate(el => el.scrollTop);
        await page.mouse.wheel(0, 120);
        await page.waitForFunction(top => document.querySelector('.v-single-entry .v-source-scroll').scrollTop > top, scrollTop);
        assert.equal(await zoomButton(90).count(), 1);

        await page.getByRole('textbox', { name: '单题 LaTeX 源码' }).fill('已有题干');
        await preview.evaluate(el => { el.scrollTop = 0; });
        await page.evaluate(() => {
            Qisi.Runtime.getRuntimeDependency('AppProxy').videoRecognizeCrop = async () => '框选结果';
        });
        await source.getByRole('button', { name: /开启截图识别/ }).click();
        const canvas = source.locator('.cropper-canvas');
        await canvas.waitFor();
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.08);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2, { steps: 8 });
        await page.mouse.up();
        await source.getByRole('button', { name: '确认识别', exact: true }).click();
        const selection = await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').video.region?.bbox);
        const bbox = await selection.jsonValue();
        [0.2, 0.08, 0.5, 0.2].forEach((coordinate, index) => {
            assert.ok(Math.abs(bbox[index] - coordinate) < 0.02, JSON.stringify(bbox));
        });
        await page.locator('.v-result-preview').getByText('框选结果').waitFor();
        await source.locator('.cropper-crop-box').waitFor({ state: 'hidden' });
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('单题录入将剪贴板截图和 PDF 打开为原卷，文本输入保留粘贴处理', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32352);
    const { page } = harness;
    try {
        await openPage(page, '单题录入');
        await pasteButton(page).click();
        assert.equal(await paste(pasteButton(page), [screenshot], true), true);
        await page.getByRole('button', { name: screenshot.name, exact: true }).waitFor();
        assert.equal(await page.locator('.v-source-scroll .v-paper-wrap').count(), 1);

        const pdf = { name: '粘贴原卷.pdf', type: 'application/pdf', base64: fixture('pdf-question.pdf') };
        assert.equal(await paste(page.locator('body'), [pdf]), true);
        await page.getByRole('button', { name: pdf.name, exact: true }).waitFor();
        assert.ok(await page.locator('.v-source-scroll .v-paper-wrap').count() > 0);

        const source = page.getByRole('textbox', { name: '单题 LaTeX 源码' });
        const textPaste = await source.evaluate(el => el.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(), bubbles: true, cancelable: true
        })));
        assert.equal(textPaste, true);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('原卷 PDF 按需绘制，翻走释放页面，缩放保留页面节点', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32357);
    const { page } = harness;
    try {
        const pdf = await PDFDocument.create();
        for (let i = 0; i < 12; i++) pdf.addPage().drawText(`Page ${i + 1}`, { x: 25, y: 50 });
        await openPage(page, '单题录入');
        const source = page.locator('.v-single-entry .v-source');
        await source.locator('input[type=file]').setInputFiles({
            name: 'lazy-original.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save())
        });
        const first = source.locator('[data-page="1"] .v-source-page');
        const last = source.locator('[data-page="12"] .v-source-page');
        const raster = ':scope > img[draggable="false"]';
        await first.locator(raster).waitFor({ state: 'attached' });
        assert.equal(await last.locator(raster).count(), 0);
        const element = await first.elementHandle();
        await source.getByRole('button', { name: '原卷缩放 100%' }).click();
        await source.getByRole('button', { name: '原卷缩放 125%' }).waitFor();
        assert.equal(await element.evaluate(el => el.isConnected), true);
        await last.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await last.locator(raster).waitFor({ state: 'attached' });
        await first.locator(raster).waitFor({ state: 'detached' });
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('批量录题从任务列表粘贴截图，从创建页粘贴 DOCX 并逐一确认用途', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32353);
    const { page } = harness;
    try {
        await openPage(page, '批量录题');
        await pasteButton(page).click();
        assert.equal(await paste(pasteButton(page), [screenshot]), true);
        const purpose = page.locator('.batch-purpose-modal');
        await purpose.getByText(/剪贴截图\.pdf｜PDF/).waitFor();
        await purpose.getByRole('checkbox').first().check();
        await purpose.getByRole('button', { name: '确认添加' }).click();
        const create = page.locator('.v-batch-create');
        await create.locator('.batch-file-card').getByText('剪贴截图.pdf', { exact: true }).waitFor();
        const pageGeometry = await page.evaluate(async () => {
            const file = Qisi.Runtime.getRuntimeDependency('AppProxy').batchCreateFiles[0];
            const bytes = Uint8Array.from(atob(file.uploadPath.split(',')[1]), value => value.charCodeAt(0));
            const job = pdfjsLib.getDocument({ data: bytes, isEvalSupported: false });
            try {
                const doc = await job.promise;
                const page = await doc.getPage(1);
                return { count: doc.numPages, view: page.view };
            } finally { await job.destroy(); }
        });
        assert.deepEqual(pageGeometry, { count: 1, view: [0, 0, 240, 180] });

        const docx = { name: '粘贴文件.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            base64: fixture('docx-question.docx') };
        assert.equal(await paste(pasteButton(page), [docx]), true);
        await purpose.getByText(/粘贴文件\.docx｜Word/).waitFor();
        await purpose.getByRole('checkbox').nth(1).check();
        await purpose.getByRole('button', { name: '确认添加' }).click();
        await create.locator('.batch-file-card').getByText(docx.name, { exact: true }).waitFor();
        assert.equal((await getDbSnapshot(page)).batches.length, 0);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});
