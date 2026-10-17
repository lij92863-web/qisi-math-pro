'use strict';
// 整卷验收跑道：用真实试卷 PDF 一次性跑完正常 UI 导入，不改任何业务代码。
//
// 用法（需要本机 .env 已配置识别服务凭据）：
//   node scripts/real-full-paper-acceptance.cjs "<PDF 绝对路径>"
//
// 它与 e2e 跑步机的区别只有两点：不拦截 /api/ai/**、不伪造模型响应。
// 因此这条跑道会真实计费，只在显式执行时使用。

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.ACCEPTANCE_PORT || 32190);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const POLL_MS = 5000;
const MAX_WAIT_MS = Number(process.env.ACCEPTANCE_MAX_MS || 45 * 60 * 1000);
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(ROOT, 'local-run-artifacts', 'real-full-paper-' + STAMP);
const pdfPath = path.resolve(process.argv[2] || '');

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForHealth(child) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (child.exitCode != null) throw new Error('本地服务提前退出');
        try {
            const response = await fetch(ORIGIN + '/api/health');
            if (response.ok) return response.json();
        } catch (_) { /* 服务尚未就绪 */ }
        await sleep(500);
    }
    throw new Error('本地服务健康检查超时');
}

// 只读快照：批次、文件证据、草稿。用于肉眼核对，不参与业务逻辑。
const readState = page => page.evaluate(async () => {
    const db = new window.Dexie('QisiMathVueDB');
    await db.open();
    try {
        const batches = await db.table('draftImportBatches').toArray();
        const files = await db.table('draftImportFiles').toArray();
        const drafts = await db.table('draftQuestions').toArray();
        return { batches, files, drafts };
    } finally { db.close(); }
});

(async () => {
    if (!pdfPath || !fs.existsSync(pdfPath)) throw new Error('试卷 PDF 不存在: ' + pdfPath);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const serverOut = [];
    const child = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT, windowsHide: true,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => serverOut.push(String(chunk)));
    child.stderr.on('data', chunk => serverOut.push(String(chunk)));

    let browser = null;
    const consoleLog = [];
    try {
        const health = await waitForHealth(child);
        log('服务就绪', JSON.stringify(health));
        const ai = await (await fetch(ORIGIN + '/api/ai/health')).json();
        log('识别服务凭据状态', JSON.stringify(ai));
        if (ai.configured !== true) throw new Error('识别服务未配置凭据，整卷验收无法执行');

        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ acceptDownloads: true });
        const page = await context.newPage();
        page.on('console', message => consoleLog.push(message.type() + ': ' + message.text()));
        page.on('pageerror', error => consoleLog.push('pageerror: ' + error.message));
        // 不拦截任何请求：整卷验收必须走真实链路。

        await page.goto(ORIGIN + '/main.html', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('nav .nav-item', { timeout: 60000 });

        const enabled = await page.evaluate(() => {
            const config = window.Qisi?.Config?.pdfExternal;
            if (!config) return { ok: false, reason: 'pdfExternal 配置缺失' };
            config.enabled = true;
            return { ok: config.enabled === true, model: config.model, profile: config.profileVersion };
        });
        if (!enabled.ok) throw new Error('无法开启 PDF 识别：' + JSON.stringify(enabled));
        log('识别开关已开启', JSON.stringify(enabled));

        await page.evaluate(async () => {
            const db = new window.Dexie('QisiMathVueDB');
            await db.open();
            try {
                for (const name of ['questions', 'draftImportBatches', 'draftImportFiles', 'draftQuestions', 'draftImages']) {
                    await db.table(name).clear();
                }
            } finally { db.close(); }
        });

        const before = await readState(page);
        const existing = new Set(before.batches.map(row => row.id));

        log('上传试卷', pdfPath);
        await page.locator('nav .nav-item').nth(1).click();
        await page.locator('.batch-home-upload').click();
        await page.locator('input[type="file"][accept*=".docx"]').setInputFiles([pdfPath]);
        const modal = page.locator('.batch-purpose-modal').filter({ has: page.locator('.batch-purpose-options') });
        await modal.waitFor({ state: 'visible' });
        const roleNames = ['question', 'answer', 'solution', 'full', 'supplemental_image'];
        for (let index = 0; index < roleNames.length; index += 1) {
            await modal.locator('.batch-purpose-options input').nth(index).setChecked(roleNames[index] === 'full');
        }
        await modal.locator('.flex.justify-end .material-primary-btn').click();
        await page.locator('.batch-create-actions .material-primary-btn').click();
        log('识别任务已创建，等待整卷完成');

        const startedAt = Date.now();
        let state = null;
        let lastNote = '';
        while (Date.now() - startedAt < MAX_WAIT_MS) {
            state = await readState(page);
            const batch = state.batches.find(row => !existing.has(row.id));
            if (!batch) { await sleep(POLL_MS); continue; }
            const file = state.files.find(row => row.batchId === batch.id);
            const tasks = file?.pdfExternalEvidence?.tasks || [];
            const note = [
                'status=' + batch.status,
                'tasks=' + tasks.length,
                'states=' + [...new Set(tasks.map(task => task.state))].join('/'),
                'drafts=' + state.drafts.filter(row => row.batchId === batch.id).length
            ].join(' ');
            if (note !== lastNote) { log(note); lastNote = note; }
            if (['review', 'failed'].includes(batch.status)) break;
            await sleep(POLL_MS);
        }

        const finished = await readState(page);
        const batch = finished.batches.find(row => !existing.has(row.id));
        const file = finished.files.find(row => row.batchId === batch?.id);
        const drafts = finished.drafts.filter(row => row.batchId === batch?.id);
        const evidence = file?.pdfExternalEvidence || {};
        const tasks = evidence.tasks || [];
        const report = {
            pdf: pdfPath,
            batchId: batch?.id || null,
            status: batch?.status || 'timeout',
            elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
            taskCount: tasks.length,
            taskStates: tasks.map(task => ({ state: task.state, pages: task.pages, calls: task.calls, cost: task.cost, error: task.error || null })),
            attempts: tasks.flatMap(task => task.attempts || []).map(attempt => ({ operation: attempt.operation, state: attempt.state, model: attempt.model, cost: attempt.cost })),
            evidenceErrors: evidence.errors || [],
            unassigned: (evidence.unassigned || []).map(item => ({ pages: item.source_pages, kind: item.kind, text: String(item.text || '').slice(0, 120) })),
            drafts: drafts.map(draft => ({
                no: draft.questionNumber,
                type: draft.type,
                stem: String(draft.stem || '').slice(0, 160),
                optionCount: (draft.options || []).length,
                answer: String(draft.answer || '').slice(0, 80),
                solutionLength: String(draft.solution || '').length,
                images: (draft.images || []).length,
                states: draft.pdfExternal?.states || null,
                sequenceGate: draft.pdfExternal?.sequenceGate ? { mode: draft.pdfExternal.sequenceGate.mode, safe: draft.pdfExternal.sequenceGate.safeQuestionNumbers } : null,
                problems: draft.pdfExternal?.taskProblems || [],
                warnings: (draft.warnings || []).slice(0, 6)
            }))
        };
        fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
        fs.writeFileSync(path.join(OUT_DIR, 'console.log'), consoleLog.join('\n'));
        fs.writeFileSync(path.join(OUT_DIR, 'server.log'), serverOut.join(''));
        log('完成', JSON.stringify({
            status: report.status, drafts: report.drafts.length, tasks: report.taskCount,
            withAnswer: report.drafts.filter(draft => draft.answer).length,
            seconds: report.elapsedSeconds
        }));
        console.log('REPORT ' + path.join(OUT_DIR, 'report.json'));
    } finally {
        if (browser) await browser.close().catch(() => {});
        if (child.exitCode == null) {
            child.kill('SIGKILL');
            await sleep(500);
        }
    }
})().catch(error => {
    console.error('ACCEPTANCE_FAILED', error && error.stack || error);
    process.exit(1);
});
