(function initPrintResources(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PrintResources = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Print-time resource hydration: clone the paper questions and attach data URLs
    // for their image blobs. The page owns the database read and the blob encoder.
    const collectImageIds = questions => [...new Set((Array.isArray(questions) ? questions : [])
        .flatMap(question => (question?.images || []).map(image => image?.id))
        .filter(Boolean))];

    const hydrateQuestionsForPrint = async ({ questions, loadImageRows, blobToDataUrl } = {}) => {
        if (typeof loadImageRows !== 'function' || typeof blobToDataUrl !== 'function') {
            const error = new Error('PRINT_RESOURCES_DEPENDENCY_REQUIRED');
            error.code = 'PRINT_RESOURCES_DEPENDENCY_REQUIRED';
            throw error;
        }
        const list = Array.isArray(questions) ? questions : [];
        const ids = collectImageIds(list);
        const imageRows = ids.length ? await loadImageRows(ids) : [];
        return Promise.all(list.map(async question => {
            const clone = {
                ...question,
                meta: question.meta ? { ...question.meta } : undefined,
                options: [...(question.options || [])]
            };
            clone.images = await Promise.all((question.images || []).map(async image => {
                const row = imageRows.find(item => item.id === image.id);
                if (row?.blob) return { ...image, url: await blobToDataUrl(row.blob) };
                return { ...image };
            }));
            return clone;
        }));
    };

    const createState = ({ ref }) => Object.freeze({ busy: ref(false) });
    const PRINT_FONT_STACKS = {
                    '思源宋体': '"SimSun", "Songti SC", serif',
                    '霞鹜文楷': '"KaiTi", "STKaiti", serif',
                    '黑体': '"SimHei", "Heiti SC", sans-serif',
                    '微软雅黑': '"Microsoft YaHei", "PingFang SC", sans-serif'
                };
    const PRINT_FONT_SIZES = { '三号': '21px', '四号': '19px', '小四': '16px', '五号': '14px', '小五': '12px' };
    const buildWindowHtml = ({ content, title, paper, assetUrl, lease, escapeHtml }) => {
        const examConfig = paper?.config || {};
        const safeTheme = /^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(examConfig.themeColor || '') ? examConfig.themeColor : '#1f9d45';
        const safePaperSize = /^(?:A[0-6]|B[0-6]|Letter|Legal)$/i.test(examConfig.paperSize || '') ? examConfig.paperSize : 'A4';
        const bootstrap = '(' + runPrintDocument.toString() + ')(document,window,' + JSON.stringify(lease).replace(/</g,'\\u003c') + ');';
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<script>${bootstrap}</script>
<link id="printMathStyles" onerror="this.dataset.failed='1'" rel="stylesheet" href="${escapeHtml(assetUrl)}"/>
<style>
body {
    font-family: ${PRINT_FONT_STACKS[examConfig.fontFamily] || PRINT_FONT_STACKS['思源宋体']};
    padding:24px;
    color:#111;
    line-height:1.8;
    font-size:${PRINT_FONT_SIZES[examConfig.fontSize] || PRINT_FONT_SIZES['小四']};
}
.subtitle,.organizer { font-size:14px; color:#333; }
.notice { margin:12px auto 0; padding:0; border:0; text-align:left; font-size:13px; }
.exam-notice { max-width:100%; line-height:1.55; }
.exam-notice b { display:block; margin-bottom:3px; }
.exam-notice ol { margin:0; padding-left:1.8em; text-align:left; }
.secret-mark { font-weight:bold; margin-bottom:12px; }
.header { text-align:center; margin-bottom:24px; border-bottom:0; padding-bottom:0; }
.quiz-sheet-header { margin-bottom:16px; }
.student-fields { display:flex; justify-content:center; gap:14mm; margin:8px 0 6px; font-weight:bold; }
.student-fields span { display:inline-flex; align-items:flex-end; gap:2mm; white-space:nowrap; }
.student-fields i { display:inline-block; width:34mm; border-bottom:1px solid #111; transform:translateY(-2px); }
.answer-grid-wrap { display:flex; flex-direction:column; align-items:center; gap:4mm; margin:4px 0 7mm; }
.answer-grid { border-collapse:collapse; font-weight:bold; }
.answer-grid th,.answer-grid td { border:1px solid #111; min-width:12mm; height:8mm; text-align:center; padding:0 2mm; }
.answer-grid th { min-width:13mm; }
.answer-lines { display:grid; grid-template-columns:repeat(3, 1fr); gap:8mm; width:82%; font-weight:bold; }
.answer-lines span { display:flex; align-items:flex-end; gap:2mm; }
.answer-lines i { flex:1; border-bottom:2px solid #111; transform:translateY(-2px); }
.corner-marks i { position:fixed; width:7mm; height:7mm; z-index:0; }
.corner-marks i:nth-child(1) { left:18mm; top:14mm; border-right:1px solid #bbb; border-bottom:1px solid #bbb; }
.corner-marks i:nth-child(2) { right:18mm; top:14mm; border-left:1px solid #bbb; border-bottom:1px solid #bbb; }
.corner-marks i:nth-child(3) { left:18mm; bottom:14mm; border-right:1px solid #bbb; border-top:1px solid #bbb; }
.corner-marks i:nth-child(4) { right:18mm; bottom:14mm; border-left:1px solid #bbb; border-top:1px solid #bbb; }
.group-title { break-after:avoid; page-break-after:avoid; margin:24px 0 10px; font-weight:bold; border:0; padding:0; font-size:17px; }
.paper-compact .group-title { margin:14px 0 8px; }
.exam-question { margin-bottom:28px; break-inside:avoid; page-break-inside:avoid; display:flow-root; overflow:visible; }
.paper-compact .exam-question { margin-bottom:16px; }
.question-row { display:grid; grid-template-columns:2.4em minmax(0, 1fr); column-gap:0; align-items:start; }
.q-index { font-weight:bold; line-height:1.8; }
.question-stem { margin-bottom:12px; min-width:0; line-break:strict; text-wrap:pretty; display:flow-root; overflow:visible; }
.question-stem::after,.exam-question::after { content:""; display:block; clear:both; }
.question-flow-body { min-width:0; overflow:visible; line-break:strict; text-wrap:pretty; }
.question-flow-body::after { content:""; display:block; clear:both; }
.gaokao-options { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); column-gap:14px; row-gap:8px; margin-top:10px; padding-left:2.2em; width:100%; box-sizing:border-box; }
.gaokao-options:has(.option-content .katex-display), .gaokao-options.long-options { grid-template-columns:repeat(2, minmax(0, 1fr)); }
.question-flow-body .qisi-flow-options { clear:none !important; display:block !important; width:auto !important; margin-top:10px; padding-left:2.2em; }
.question-flow-body .qisi-flow-options .gaokao-option { display:block; margin-bottom:5px; }
.question-flow-body .qisi-flow-options .option-label { display:inline-block; width:1.8em; margin-right:0; }
.question-flow-body .qisi-flow-options .option-content { display:inline; } .question-flow-body .qisi-flow-options .option-content:has(img) { display:inline-block; vertical-align:top; }
.question-head { display:none; }
.print-toolbar { position:sticky; top:0; margin:-24px -24px 18px; padding:10px 24px; background:#f8fafc; border-bottom:1px solid #e5e7eb; font-family:"Microsoft YaHei", sans-serif; }
.print-toolbar button { border:0; background:#1a73e8; color:#fff; border-radius:6px; padding:8px 14px; font-weight:700; cursor:pointer; }
.print-toolbar button:disabled { background:#94a3b8; cursor:wait; }
@media print { .print-toolbar { display:none; } }
.q-note { margin-top:8px; font-size:13px; color:#555; border-left:3px solid ${safeTheme}; padding-left:8px; }
.print-answer,.print-solution { clear:both; margin-top:8px; padding:8px 10px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:4px; }
.answer-section.new-page { break-before:page; }
.answer-section h2 { break-after:avoid; page-break-after:avoid; text-align:center; margin-bottom:20px; }
.answer-item { margin-bottom:12px; break-inside:avoid; page-break-inside:avoid; }
.answer-solution { margin-top:4px; color:#333; }
.gaokao-option { display:flex; align-items:flex-start; min-width:0; break-inside:avoid; page-break-inside:avoid; }
.option-label { margin-right:6px; font-weight:bold; line-height:1.8; }
.option-content { flex:1; min-width:0; line-height:1.8; overflow-wrap:normal; word-break:normal; }
.option-content .katex, .katex { font-size:1.04em; white-space:nowrap; }
.katex-display { margin:.5em 0; overflow-x:auto; overflow-y:hidden; }
.answer-blank,.nowrap { display:inline-block; white-space:nowrap; break-inside:avoid; }
.answer-blank { min-width:2.4em; text-align:center; }
.print-image { max-width:82mm; max-height:48mm; width:auto; height:auto; object-fit:contain; page-break-inside:avoid; break-inside:avoid; }
.print-image.centered { display:block; margin:8px auto 10px; }
.print-image.float-left { float:left; margin:4px 12px 8px 0; }
.print-image.float-right { float:right; margin:4px 0 8px 12px; }
.missing-image { color:#dc2626; font-size:12px; }
@page { size:${safePaperSize}; margin:18mm 16mm; }
</style>
</head>
<body>
<div class="print-toolbar"><button id="printBtn" onclick="window.print()" disabled>正在准备图片...</button></div>
${content}

</body>
</html>`;
    };
    // Runs only inside the generated preview. Every image is already portable;
    // opener isolation remains intact and the channel carries lifecycle signals.
    const runPrintDocument = (document, window, lease) => {
        let channel, stopped = false, readyTimer = null;
        const cleanups = [];
        try { channel = new window.BroadcastChannel(lease.channel); } catch (_) { /* readiness still controls the local button */ }
        const send = kind => { try { channel?.postMessage({ kind, token: lease.token }); } catch (_) {} };
        const listen = (target, event, callback) => { target.addEventListener(event, callback); cleanups.push(() => target.removeEventListener(event, callback)); };
        if (channel) channel.onmessage = event => { if (event.data?.token === lease.token && event.data.kind === 'probe') send('alive'); };
        send('loaded');
        listen(window, 'pagehide', event => {
            if (event.persisted) { send('suspended'); return; }
            stopped = true; send('closed'); if (readyTimer) window.clearTimeout(readyTimer); cleanups.splice(0).forEach(cleanup => cleanup()); channel?.close();
        });
        listen(window, 'pageshow', () => send('alive'));
        const start = async () => {
            const button = document.getElementById('printBtn');
            const fail = kind => {
                if (stopped || !button) return;
                button.disabled = true;
                button.textContent = kind === 'images' ? '图片未能完整加载，请修复后重新生成' : '字体或样式未能完整加载，请修复后重新生成';
                send('resource-error');
            };
            const images = [...document.images], style = document.getElementById('printMathStyles');
            const imageReady = Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
                const done = () => resolve(); listen(image, 'load', done); listen(image, 'error', done);
            })));
            const styleReady = !style || style.sheet ? Promise.resolve() : style.dataset.failed ? Promise.reject(new Error('styles')) : new Promise((resolve, reject) => {
                listen(style, 'load', resolve); listen(style, 'error', () => reject(new Error('styles')));
            });
            const resources = Promise.all([imageReady, styleReady]).then(() => {
                void document.body.offsetWidth;
                return document.fonts?.ready || undefined;
            });
            const deadline = new Promise((resolve, reject) => { readyTimer = window.setTimeout(() => reject(new Error('styles')), 30000); });
            try {
                await Promise.race([resources, deadline]);
                if (stopped || !button) return;
                if (images.some(image => !image.naturalWidth) || document.querySelector('.missing-image')) { fail('images'); return; }
                if (document.fonts && [...document.fonts].some(font => font.status === 'error')) { fail('styles'); return; }
                button.disabled = false; button.textContent = '渲染已就绪，打印 / 另存为 PDF'; send('ready');
            } catch (_) { fail('styles'); }
            finally { if (readyTimer) window.clearTimeout(readyTimer); readyTimer = null; }
        };
        if (document.readyState === 'loading') listen(document, 'DOMContentLoaded', start); else start();
    };

    const createOutputWorkspace = ({ createChannel, createBlob, createUrl, revokeUrl, openLink, makeId, schedule, cancelScheduled,
        assetUrl, escapeHtml, observePageHide = () => () => {}, openDeadlineMs = 30000, closeGraceMs = 500 } = {}) => {
        let disposed = false, pending = null;
        const records = new Map(), delayed = new Map();
        const cancelClose = record => { if (record.closeTimer != null) cancelScheduled(record.closeTimer); record.closeTimer = null; };
        const settle = (record, result) => { if (!record.settled) { record.settled = true; record.resolve(result); } };
        const release = (record, reason = 'closed') => {
            if (!records.delete(record.id)) return;
            cancelClose(record); if (record.openTimer != null) cancelScheduled(record.openTimer);
            record.channel.onmessage = null; record.channel.close(); revokeUrl(record.url);
            settle(record, { ok: false, reason });
        };
        const open = (output, paper) => new Promise((resolve, reject) => {
            if (disposed) { resolve({ ok:false,reason:'disposed' }); return; }
            const id = makeId(), token = makeId(), name = 'qisi-print-' + id;
            let channel, url;
            try {
                channel = createChannel(name);
                const html = buildWindowHtml({ content:output.content, title:output.title, paper, assetUrl, escapeHtml, lease:{ channel:name,token } });
                url = createUrl(createBlob(['\uFEFF' + html], { type:'text/html;charset=utf-8' }));
                const record = { id, token, channel, url, resolve, settled:false, openTimer:null, closeTimer:null, state:'opening' };
                records.set(id, record);
                channel.onmessage = event => {
                    if (disposed || !records.has(id) || event.data?.token !== token) return;
                    const kind = event.data.kind;
                    if (['loaded','alive','ready','suspended'].includes(kind)) {
                        cancelClose(record); if (record.openTimer != null) cancelScheduled(record.openTimer); record.openTimer = null;
                        record.state = kind;
                        if (kind === 'ready') settle(record, { ok:true,reason:'ready' });
                    } else if (kind === 'resource-error') release(record, 'resource-error');
                    else if (kind === 'closed') {
                        cancelClose(record);
                        record.closeTimer = schedule(() => {
                            record.channel.postMessage({kind:'probe',token});
                            record.closeTimer = schedule(() => release(record), closeGraceMs);
                        }, closeGraceMs);
                    }
                };
                record.openTimer = schedule(() => release(record, 'open-unconfirmed'), openDeadlineMs);
                openLink(url);
            } catch (error) {
                const record = records.get(id);
                if (record) release(record, 'open-failed');
                else { channel?.close(); if (url) revokeUrl(url); }
                reject(error);
            }
        });
        const publish = (outputs, paper) => {
            if (disposed) return Promise.resolve({ok:false,results:[]});
            if (pending) return pending.promise;
            const entry = {}; pending = entry;
            entry.promise = Promise.all(outputs.map((output,index) => index === 0 ? open(output,paper) : new Promise(resolve => {
                const id = schedule(() => { delayed.delete(id); open(output,paper).then(resolve, error => resolve({ok:false,reason:error.message})); },600*index);
                delayed.set(id,resolve);
            }))).then(results => ({ok:results.every(result=>result.ok),results})).finally(()=>{if(pending===entry)pending=null;});
            return entry.promise;
        };
        const dispose = () => {
            if (disposed) return; disposed = true;
            for (const [id,resolve] of delayed) { cancelScheduled(id);resolve({ok:false,reason:'disposed'}); } delayed.clear();
            for (const record of [...records.values()]) release(record,'disposed');stopPageHide();
        };
        const stopPageHide = observePageHide(dispose);
        return Object.freeze({ publish, dispose, activeCount:() => records.size });
    };

    const createBrowserPort = ({ document, window, URL, Blob, BroadcastChannel, crypto }) => ({
        createChannel: name => new BroadcastChannel(name), createBlob:(parts,options) => new Blob(parts,options),
        createUrl: blob => URL.createObjectURL(blob), revokeUrl: url => URL.revokeObjectURL(url), makeId:() => crypto.randomUUID(),
        schedule:(callback,delay) => window.setTimeout(callback,delay), cancelScheduled:id => window.clearTimeout(id),
        assetUrl:new URL('./vendor/katex/katex.min.css',window.location.href).href,
        observePageHide:callback => { const listener=event=>{if(!event.persisted)callback();};window.addEventListener('pagehide',listener);return()=>window.removeEventListener('pagehide',listener); },
        openLink:url => {
            const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.style.display='none';document.body.appendChild(link);
            try { link.click(); } finally { link.remove(); }
        }
    });
    const createBlobEncoder = ({ FileReader }) => {
        let disposed=false;const readers=new Set();
        const read=blob=>new Promise((resolve,reject)=>{
            if(disposed){reject(new Error('PRINT_ENCODER_DISPOSED'));return;}
            const reader=new FileReader();readers.add(reader);
            const cleanup=()=>{readers.delete(reader);reader.onload=reader.onerror=reader.onabort=null;};
            reader.onload=()=>{const value=reader.result;cleanup();resolve(value);};
            reader.onerror=()=>{cleanup();reject(new Error('打印图片读取失败。'));};
            reader.onabort=()=>{cleanup();reject(new Error('PRINT_ENCODER_DISPOSED'));};
            try{reader.readAsDataURL(blob);}catch(error){cleanup();reject(error);}
        });
        const dispose=()=>{if(disposed)return;disposed=true;for(const reader of [...readers])reader.abort();};
        return Object.freeze({read,dispose});
    };
    const createPrintWorkspace = ({ busy, capture, loadImageRows, blobToDataUrl, imagePort, validateFormulas, builder, output, notify,
        hydrate = hydrateQuestionsForPrint } = {}) => {
        let disposed=false,pending=null;
        const print = () => {
            if(disposed)return Promise.resolve(false);if(pending)return pending;
            let paper;try{paper=capture();}catch(error){notify(`打印准备失败：${error?.message||error}`);return Promise.resolve(false);}
            busy.value=true;
            pending=Promise.resolve().then(async()=>{
                if(disposed)return false;
                const hydrated=await hydrate({questions:paper.questions,loadImageRows,blobToDataUrl:imagePort?.read||blobToDataUrl});
                // Missing stored bytes stay visible as a missing-image error in
                // the preview; the print document cannot borrow another URL lease.
                const questions=hydrated.map(question=>({...question,images:(question.images||[]).map(image=>({...image,
                    url:typeof image.url==='string'&&/^data:image\//i.test(image.url)?image.url:''
                }))}));
                if(disposed)return false;
                if(!validateFormulas(questions,{includeAnswer:paper.config.showAnswer||['split','withAnswers'].includes(paper.mode),includeSolution:paper.config.showSolution||['split','withAnswers'].includes(paper.mode)}))return false;
                const document=builder.buildPaper({paper,questions});const result=await output.publish(document.documents,paper);
                if(!result.ok&&!disposed){
                    if(result.results.some(item=>item.reason==='open-unconfirmed'))notify('打印预览未能确认打开，请允许弹出窗口后重新生成。');
                    else if(result.results.some(item=>item.reason==='resource-error'))notify('打印预览资源未能完整加载，已禁止打印，请修复后重新生成。');
                    else if(result.results.some(item=>item.reason==='open-failed'))notify('打印预览未能打开，请检查浏览器后重新生成。');
                }
                return result.ok;
            }).catch(error=>{if(!disposed)notify(`打印准备失败：${error?.message||error}`);return false;}).finally(()=>{pending=null;busy.value=false;});
            return pending;
        };
        const dispose=()=>{if(disposed)return;disposed=true;output.dispose();imagePort?.dispose();busy.value=false;};
        return Object.freeze({print,dispose});
    };

    return Object.freeze({ collectImageIds, hydrateQuestionsForPrint, createState, buildWindowHtml, createOutputWorkspace, createBrowserPort, createBlobEncoder, createPrintWorkspace });
});
