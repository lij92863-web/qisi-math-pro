(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.SecureLogger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const SAFE_TOKEN = /^[a-zA-Z0-9_.:-]{1,80}$/;
    const METHODS = [
        'log', 'warn', 'error', 'info', 'debug', 'table',
        'group', 'groupCollapsed', 'dir', 'trace'
    ];

    const safeToken = value => {
        const text = String(value ?? '').trim();
        return SAFE_TOKEN.test(text) ? text : '';
    };

    const stageFromEvent = value => {
        const source = String(value || '');
        const prefix = source.match(/^\s*((?:\[[a-zA-Z0-9_-]+\])+)/)?.[1] || '';
        const parts = [...prefix.matchAll(/\[([a-zA-Z0-9_-]+)\]/g)].map(match => match[1]);
        return parts.length ? parts.join('.') : 'application';
    };

    const sanitizeLogArgs = args => {
        const payload = { stage: stageFromEvent(args?.[0]) };
        for (const item of args || []) {
            if (!item || typeof item !== 'object') continue;

            const requestId = safeToken(item.requestId);
            const stage = safeToken(item.stage || item.route);
            const engine = safeToken(item.engine || item.model);
            const code = safeToken(item.code || item.errorCode);
            const duration = Number(item.duration ?? item.durationMs);

            if (requestId) payload.requestId = requestId;
            if (stage) payload.stage = stage;
            if (Number.isFinite(duration) && duration >= 0) payload.duration = duration;
            if (engine) payload.engine = engine;
            if (code) payload.code = code;
        }
        return ['[QISI_LOG]', {
            ...(payload.requestId ? { requestId: payload.requestId } : {}),
            stage: payload.stage,
            ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
            ...(payload.engine ? { engine: payload.engine } : {}),
            ...(payload.code ? { code: payload.code } : {})
        }];
    };

    const createSecureLogger = target => {
        const consoleTarget = target || {};
        const originals = {};
        let installed = false;

        return {
            install() {
                if (installed) return consoleTarget;
                installed = true;
                for (const method of METHODS) {
                    if (typeof consoleTarget[method] !== 'function') continue;
                    originals[method] = consoleTarget[method].bind(consoleTarget);
                    consoleTarget[method] = (...args) =>
                        originals[method](...sanitizeLogArgs(args));
                }
                return consoleTarget;
            }
        };
    };

    return { createSecureLogger, sanitizeLogArgs };
});
