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
    let responses = [...(configuration.responses || [])];
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
        const response = responses.length
            ? responses.shift()
            : configuration.defaultResponse;
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
        const text = typeof response === 'string'
            ? response
            : typeof response?.text === 'string'
                ? response.text
                : JSON.stringify(response?.value ?? response ?? {});
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(proxyEnvelope(text))
        });
    };

    await page.route('**/api/ai/**', handler);
    return Object.freeze({
        realApiCalled: false,
        calls,
        setResponses(next) {
            responses = [...next];
        },
        release() {
            released = true;
            releaseHold();
        },
        async uninstall() {
            released = true;
            releaseHold();
            await page.unroute('**/api/ai/**', handler);
        }
    });
}

module.exports = { installBrowserEngineInjection };
