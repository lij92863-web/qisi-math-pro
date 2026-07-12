(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrEngineRegistry = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const createRegistry = ({ timeoutMs = 30000 } = {}) => {
        const engines = new Map();
        let defaultEngine = '';

        const registerEngine = (name, engine, { makeDefault = false } = {}) => {
            const key = String(name || '').trim();
            if (!key || !engine) throw new TypeError('Engine name and implementation are required.');
            if (engines.has(key)) throw new Error(`OCR engine already registered: ${key}`);
            for (const method of ['healthCheck', 'getCapabilities', 'recognizePage', 'recognizeDocument', 'cancel']) {
                if (typeof engine[method] !== 'function') {
                    throw new TypeError(`OCR engine ${key} is missing ${method}.`);
                }
            }
            engines.set(key, engine);
            if (makeDefault || !defaultEngine) defaultEngine = key;
            return engine;
        };
        const getEngine = name => engines.get(String(name || defaultEngine)) || null;
        const listEngines = () => [...engines.entries()].map(([name, engine]) => ({
            name,
            isDefault: name === defaultEngine,
            capabilities: engine.getCapabilities()
        }));
        const setDefault = name => {
            if (!engines.has(name)) throw new Error(`Unknown OCR engine: ${name}`);
            defaultEngine = name;
        };
        const withTimeout = (promise, ms, requestId, engine) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                engine.cancel(requestId);
                const error = new Error(`OCR timeout after ${ms}ms`);
                error.code = 'ocr-timeout';
                reject(error);
            }, ms);
            Promise.resolve(promise).then(
                value => { clearTimeout(timer); resolve(value); },
                error => { clearTimeout(timer); reject(error); }
            );
        });
        const recognize = (method, input, options = {}) => {
            const engine = getEngine(options.engine);
            if (!engine) throw new Error('No OCR engine is available.');
            const requestId = options.requestId || `ocr_${Date.now()}`;
            return withTimeout(
                engine[method](input, { ...options, requestId }),
                options.timeoutMs || timeoutMs,
                requestId,
                engine
            );
        };

        return Object.freeze({
            registerEngine,
            getEngine,
            listEngines,
            setDefault,
            healthCheck: name => getEngine(name)?.healthCheck() || Promise.resolve({ ok: false }),
            recognizePage: (input, options) => recognize('recognizePage', input, options),
            recognizeDocument: (input, options) => recognize('recognizeDocument', input, options),
            cancel: (requestId, name) => getEngine(name)?.cancel(requestId) || false
        });
    };

    return Object.freeze({ createRegistry });
});
