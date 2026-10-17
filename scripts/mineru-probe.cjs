'use strict';
// MinerU 精准解析 API 探针：只做「上传 → 提交 → 轮询 → 取回 ZIP」，不写业务逻辑。
// 用法：node scripts/mineru-probe.cjs "<pdf 路径>"
// 结果落在 local-run-artifacts/mineru-probe/<时间戳>/

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), override: true });

const TOKEN = String(process.env.MINERU_TOKEN || '').trim();
const BASE = 'https://mineru.net';
const pdfPath = path.resolve(process.argv[2] || '');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(ROOT, 'local-run-artifacts', 'mineru-probe', STAMP);

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(pathname, init = {}) {
    const response = await fetch(BASE + pathname, {
        ...init,
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', ...(init.headers || {}) }
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 600) }; }
    return { status: response.status, body };
}

(async () => {
    if (!TOKEN) throw new Error('MINERU_TOKEN 未配置');
    if (!fs.existsSync(pdfPath)) throw new Error('PDF 不存在: ' + pdfPath);
    fs.mkdirSync(OUT, { recursive: true });
    const bytes = fs.readFileSync(pdfPath);

    const started = Date.now();
    log('申请上传地址', path.basename(pdfPath), (bytes.length / 1024 / 1024).toFixed(2) + 'MB');
    const applied = await api('/api/v4/file-urls/batch', {
        method: 'POST',
        body: JSON.stringify({
            enable_formula: true,
            enable_table: true,
            language: 'ch',
            model_version: 'vlm',
            files: [{ name: path.basename(pdfPath), is_ocr: true, data_id: 'probe-' + STAMP }]
        })
    });
    fs.writeFileSync(path.join(OUT, '01-apply.json'), JSON.stringify(applied, null, 2));
    if (applied.status !== 200 || applied.body.code !== 0) throw new Error('申请上传地址失败: ' + JSON.stringify(applied.body).slice(0, 400));

    const batchId = applied.body.data.batch_id;
    const uploadUrl = applied.body.data.file_urls[0];
    log('batch_id', batchId);

    const put = await fetch(uploadUrl, { method: 'PUT', body: bytes });
    log('上传', put.status, put.status === 200 ? 'ok' : await put.text());
    if (put.status !== 200) throw new Error('上传失败 HTTP ' + put.status);

    const submitStarted = Date.now();
    let result = null, lastState = '';
    for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(2000);
        const polled = await api('/api/v4/extract-results/batch/' + batchId);
        const row = polled.body?.data?.extract_result?.[0];
        const state = row?.state || 'unknown';
        if (state !== lastState) { log('状态', state, '已用', ((Date.now() - submitStarted) / 1000).toFixed(0) + 's'); lastState = state; }
        if (state === 'done') { result = row; break; }
        if (state === 'failed') { fs.writeFileSync(path.join(OUT, '02-failed.json'), JSON.stringify(polled, null, 2)); throw new Error('解析失败: ' + (row?.err_msg || JSON.stringify(polled.body).slice(0, 300))); }
    }
    if (!result) throw new Error('轮询超时');

    const total = ((Date.now() - started) / 1000).toFixed(1);
    log('解析完成，总耗时', total + 's', 'zip:', result.full_zip_url);
    fs.writeFileSync(path.join(OUT, '03-result.json'), JSON.stringify(result, null, 2));

    const zipResponse = await fetch(result.full_zip_url);
    const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
    const zipPath = path.join(OUT, 'result.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    log('ZIP 已保存', (zipBuffer.length / 1024).toFixed(0) + 'KB', zipPath);
    console.log('PROBE_OK ' + JSON.stringify({ batchId, seconds: Number(total), zip: zipPath, dir: OUT, pages: result.page_count || null }));
})().catch(error => {
    console.error('PROBE_FAILED', error && error.stack || error);
    process.exit(1);
});
