const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');

test('long batch review keeps navigation and preview rails pinned with independent scrolling', { timeout: 30_000 }, async () => {
    const css = fs.readFileSync(path.join(ROOT, 'app.css'), 'utf8');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        const questionButtons = Array.from({ length: 60 }, (_, index) => (
            `<button class="batch-question-nav-item"><span>第 ${index + 1} 题</span><small>滚动性能验收题</small></button>`
        )).join('');
        const editorCards = Array.from({ length: 36 }, (_, index) => (
            `<div class="batch-editor-card" style="min-height:130px">题目编辑区 ${index + 1}</div>`
        )).join('');
        const previewCards = Array.from({ length: 8 }, (_, index) => (
            `<div class="batch-preview-card" style="min-height:210px">预览卡片 ${index + 1}</div>`
        )).join('');

        await page.setContent(`
            <style>${css}</style>
            <div class="app-container">
                <header class="sidebar">TEX题库</header>
                <main class="main-content">
                    <div class="batch-review-shell">
                        <div class="batch-review-top">审核工具栏</div>
                        <div class="batch-recognition-summary">识别摘要</div>
                        <div class="batch-review-grid">
                            <aside class="batch-question-nav">${questionButtons}</aside>
                            <section class="batch-editor">${editorCards}</section>
                            <aside class="batch-preview-panel">${previewCards}</aside>
                        </div>
                        <div class="batch-bottom-bar"><span>当前题目</span><button>一键提交</button></div>
                    </div>
                </main>
            </div>
        `);

        const result = await page.evaluate(async () => {
            const scroller = document.querySelector('.main-content');
            const navigation = document.querySelector('.batch-question-nav');
            const preview = document.querySelector('.batch-preview-panel');
            scroller.scrollTop = 500;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const pinned = {
                navigationTop: navigation.getBoundingClientRect().top,
                previewTop: preview.getBoundingClientRect().top
            };

            scroller.scrollTop = 1100;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const previewStyle = getComputedStyle(preview);
            const navigationStyle = getComputedStyle(navigation);
            const after = {
                navigationTop: navigation.getBoundingClientRect().top,
                previewTop: preview.getBoundingClientRect().top
            };
            const previewScrollable = preview.scrollHeight > preview.clientHeight;
            preview.scrollTop = 320;

            return {
                pageScrollTop: scroller.scrollTop,
                navigationDelta: Math.abs(after.navigationTop - pinned.navigationTop),
                previewDelta: Math.abs(after.previewTop - pinned.previewTop),
                navigationPosition: navigationStyle.position,
                previewPosition: previewStyle.position,
                previewOverflowY: previewStyle.overflowY,
                previewScrollable,
                previewScrollTop: preview.scrollTop,
                previewHeight: preview.getBoundingClientRect().height,
                viewportHeight: innerHeight,
                editorWidth: document.querySelector('.batch-editor').getBoundingClientRect().width,
                previewWidth: preview.getBoundingClientRect().width
            };
        });

        assert.ok(result.pageScrollTop >= 1000, JSON.stringify(result));
        assert.equal(result.navigationPosition, 'sticky', JSON.stringify(result));
        assert.equal(result.previewPosition, 'sticky', JSON.stringify(result));
        assert.ok(result.navigationDelta <= 2, JSON.stringify(result));
        assert.ok(result.previewDelta <= 2, JSON.stringify(result));
        assert.equal(result.previewOverflowY, 'auto', JSON.stringify(result));
        assert.equal(result.previewScrollable, true, JSON.stringify(result));
        assert.ok(result.previewScrollTop > 0, JSON.stringify(result));
        assert.ok(result.previewHeight < result.viewportHeight, JSON.stringify(result));
        assert.ok(result.previewWidth / result.editorWidth >= 0.58, JSON.stringify(result));
        assert.ok(result.previewWidth / result.editorWidth <= 0.82, JSON.stringify(result));
    } finally {
        await browser.close();
    }
});

test('manual entry reserves a balanced readable rail for OCR and preview', { timeout: 30_000 }, async () => {
    const css = fs.readFileSync(path.join(ROOT, 'app.css'), 'utf8');
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
        await page.setContent(`
            <style>${css}</style>
            <div class="entry-layout">
                <main class="entry-main" style="min-height:600px"></main>
                <aside class="entry-side-panel" style="min-height:600px"></aside>
            </div>
        `);

        const result = await page.evaluate(() => {
            const main = document.querySelector('.entry-main').getBoundingClientRect();
            const side = document.querySelector('.entry-side-panel').getBoundingClientRect();
            return {
                mainWidth: main.width,
                sideWidth: side.width,
                sideToMainRatio: side.width / main.width,
                sameRow: Math.abs(side.top - main.top) < 2
            };
        });

        assert.equal(result.sameRow, true, JSON.stringify(result));
        assert.ok(result.sideWidth >= 520, JSON.stringify(result));
        assert.ok(result.sideToMainRatio >= 0.52, JSON.stringify(result));
        assert.ok(result.sideToMainRatio <= 0.72, JSON.stringify(result));
    } finally {
        await browser.close();
    }
});
