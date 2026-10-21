'use strict';

const AI_URL = /\/api\/ai\/(?:chat|ocr|health)(?:\?|$)/;

const proxyEnvelope = text => ({
    output: {
        choices: [{
            message: { content: [{ text: String(text) }] }
        }]
    }
});

async function installBrowserEngineInjection(page, configuration = {}) {
    const calls = [];
    // Any MinerU endpoint that this fixture cannot answer is aborted and
    // recorded here; it must never escape to the real network.
    const blockedRequests = [];
    let responses = [...(configuration.responses || [])];
    const responsesBySource = new Map();
    const extractionCache = new Map();
    let released = false;
    let releaseHold;
    const hold = new Promise(resolve => { releaseHold = resolve; });

    const handler = async route => {
        const request = route.request();
        const url = request.url();
        if (!AI_URL.test(url)) return route.fallback();
        let body = null;
        try {
            body = request.postDataJSON();
        } catch (_error) {
            body = request.postData() || '';
        }
        const call = {
            index: calls.length + 1,
            endpoint: new URL(url).pathname,
            method: request.method(),
            model: body?.model || '',
            task: body?.parameters?.ocr_options?.task || ''
        };
        calls.push(call);
        if (call.endpoint.endsWith('/health')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, configured: true })
            });
        }
        const engineCallIndex = calls.filter(item =>
            !item.endpoint.endsWith('/health')
        ).length;
        const holdAtCall = Number(configuration.holdAtCall || 0);
        if (
            holdAtCall > 0 && engineCallIndex >= holdAtCall &&
            !released
        ) await hold;
        const selectedResponse = responses.length
            ? responses.shift()
            : configuration.defaultResponse;
        const response = typeof selectedResponse === 'function' ? await selectedResponse({ body, call }) : selectedResponse;
        if (response?.abort === true) return route.abort('failed');
        if (response?.status && response.status >= 400) {
            return route.fulfill({
                status: response.status,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: { code: response.code || 'MOCK_ENGINE_FAILED' }
                })
            });
        }
        let text = typeof response === 'string'
            ? response
            : typeof response?.text === 'string'
                ? response.text
                : JSON.stringify(response?.value ?? response ?? {});
        const prompt = body?.messages?.find(m => m.role === 'user')?.content?.find?.(c => c.type === 'text')?.text;
        const matched = typeof prompt === 'string' && prompt.match(/request_metadata:\r?\n([\s\S]*?)\r?\n\r?\nresult_schema:/);
        if (matched) {
            const metadata = JSON.parse(matched[1]), source = metadata.sources[0];
            let legacy; try { legacy = JSON.parse(text); } catch (_) { legacy = null; }
            if (legacy && !legacy.pages && ['questions','answers','solutions'].every(s => Array.isArray(legacy[s]))) {
                // Explicit test-only adaptation of frozen V1 fixture envelopes to the new wire.
                // Preserve malformed source fields; this is never reachable from production.
                const types = { single:'single_choice', multi:'multiple_choice', fill:'fill_blank', long:'free_response', proof:'free_response', unknown:'unknown' };
                const output = { ...legacy, unassigned: [], pages: source.input_pages.map(page => ({source_id:source.source_id,page,state:source.context_only_pages.includes(page)?'context_only':'content',issues:[]})), warnings:legacy.warnings||[] };
                for (const stream of ['questions','answers','solutions']) output[stream] = legacy[stream].map((item, index) => {
                    const figures = (item.figures||[]).map((f,i) => ({id:stream+'-'+index+'-'+i,page:f.page,field:f.belongs_to?.startsWith('option:')?'option':f.belongs_to,option_label:f.belongs_to?.startsWith('option:')?f.belongs_to.slice(7):null,asset_id:null,bbox:f.bbox?.map(v=>v/1000)}));
                    const next = {source_id:source.source_id,scope_id:source.scope_id,question_no:item.question_no,number_text:item.question_no,number_page:item.source_pages?.[0],source_pages:item.source_pages,status:item.status==='complete'?'observed_complete':item.status==='partial'?'open_end':item.status==='unreadable'?'uncertain':item.status,figures,issues:item.warnings||[]};
                    if(stream==='questions'){next.type=types[item.type]||item.type;next.stem=item.stem;next.options=Array.isArray(item.options)?item.options.map(option=>({...option})):item.options;}
                    else next.text=item[stream==='answers'?'answer':'solution'];
                    for(const f of figures){const token=' [[figure:'+f.id+']]';if(f.field==='option'){const o=Array.isArray(next.options)&&next.options.find(o=>o.label===f.option_label);if(o&&typeof o.text==='string')o.text+=token;}else if(stream==='questions'&&typeof next.stem==='string')next.stem+=token;else if(typeof next.text==='string')next.text+=token;}
                    return next;
                });
                text=JSON.stringify(output);
            }
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body?.response_format?.type === 'json_object'
                ? { choices: [{ message: { content: text }, finish_reason: 'stop' }], model: body.model, usage: { prompt_tokens: 0, completion_tokens: 0 } }
                : proxyEnvelope(text))
        });
    };

    const mineruHandler = async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/mineru/status') return route.fulfill({ json: { configured: configuration.externalDisabled !== true } });
        if (url.pathname !== '/api/mineru/parse') {
            blockedRequests.push(request.url());
            return route.abort('blockedbyclient');
        }
        const crypto = require('node:crypto'), C = require('../../qisi-mineru-client').internals;
        const body = request.postDataBuffer(), boundary = request.headers()['content-type'].match(/boundary=(.+)$/)[1];
        const start = body.indexOf(Buffer.from('\r\n\r\n')) + 4, end = body.indexOf(Buffer.from('\r\n--' + boundary), start);
        const sha256 = crypto.createHash('sha256').update(body.subarray(start, end)).digest('hex');
        if (extractionCache.has(sha256)) return route.fulfill({ json: extractionCache.get(sha256) });
        if (responsesBySource.size && !responsesBySource.has(sha256)) {
            blockedRequests.push(request.url());
            return route.abort('blockedbyclient');
        }
        const call = { index: calls.length + 1, endpoint: url.pathname, method: 'POST', model: 'offline-mineru', task: '' }; calls.push(call);
        if (configuration.holdAtCall > 0 && calls.length >= configuration.holdAtCall && !released) await hold;
        const selected = responsesBySource.has(sha256)
            ? responsesBySource.get(sha256)
            : responses.length ? responses.shift() : configuration.defaultResponse;
        const response = typeof selected === 'function' ? await selected({ body: null, call }) : selected;
        if (response?.abort) return route.abort('failed');
        if (response?.status >= 400) return route.fulfill({ status: response.status, json: { code: 'MINERU_REQUEST_FAILED' } });
        // Migrate frozen synthetic fixtures to source blocks at the HTTP boundary.
        // No application route/config, candidate or persistence function is replaced.
        const value = response?.value;
        if (!value || !['questions', 'answers', 'solutions'].every(key => Array.isArray(value[key]))) return route.fulfill({ status: 502, json: { code: 'MINERU_RESPONSE_INVALID' } });
        const items = [], text = value => items.push({ page_idx: 0, type: 'text', text: value });
        for (const q of value.questions) {
            text(({ single: '一、单项选择题', multi: '二、多项选择题', fill: '三、填空题', long: '四、解答题' })[q.type] || '题目');
            text(q.question_no + '. ' + q.stem + '\n' + (q.options || []).map(o => o.label + '. ' + o.text).join('\n'));
        }
        if (value.answers.length || value.solutions.length) text('参考答案');
        const used = new Set();
        for (const a of value.answers) {
            text(a.question_no + '【答案】' + (a.status === 'complete' ? a.answer : ''));
            for (const [i, s] of value.solutions.entries()) if (!used.has(i) && s.question_no === a.question_no) { text('【解析】' + s.solution); used.add(i); }
        }
        for (const [i, s] of value.solutions.entries()) if (!used.has(i)) text(s.question_no + '【解析】' + s.solution);
        const parsed = C.parseContentList(items, { sourceId: sha256 });
        const result = { protocol: 'mineru-blocks-v1', job: sha256, source: { sha256, pages: parsed.pages.length }, ...parsed, answerTable: null, receipt: { state: 'ready' } };
        extractionCache.set(sha256, result);
        return route.fulfill({ json: result });
    };
    await page.route('**/api/ai/**', handler);
    await page.route('**/api/mineru/**', mineruHandler);
    return Object.freeze({
        realApiCalled: false,
        calls,
        blockedRequests,
        setResponses(next, sourceFiles = []) {
            responses = [...next];
            extractionCache.clear();
            responsesBySource.clear();
            if (sourceFiles.length) {
                if (sourceFiles.length !== responses.length) throw new Error('Offline source/response count mismatch');
                const fs = require('node:fs'), crypto = require('node:crypto');
                for (const [index, file] of sourceFiles.entries()) {
                    const key = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
                    if (responsesBySource.has(key)) throw new Error('Duplicate offline source identity');
                    responsesBySource.set(key, responses[index]);
                }
            }
        },
        release() {
            released = true;
            releaseHold();
        },
        async uninstall() {
            released = true;
            releaseHold();
            await page.unroute('**/api/ai/**', handler);
            await page.unroute('**/api/mineru/**', mineruHandler);
        }
    });
}

module.exports = { installBrowserEngineInjection };
