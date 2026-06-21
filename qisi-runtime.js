(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.Runtime = api.Runtime;
    root.Qisi.flags = Object.assign(
        {},
        api.defaultFlags,
        root.Qisi.flags || {}
    );

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const defaultFlags = Object.freeze({
            batchEngine: 'legacy',
            enableBatchV2: false,
            enableBatchV2Shadow: false,
            enableGoldenChecks: false,
            useLocalAiProxy: true
        });

        const REQUIRED_GLOBALS = [
            'Vue',
            'Dexie',
            'JSZip',
            'pdfjsLib',
            'katex'
        ];

        const escapeHtml = value => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const assertDependencies = () => {
            const missing = REQUIRED_GLOBALS.filter(
                name => typeof globalThis[name] === 'undefined'
            );

            if (missing.length) {
                throw new Error(
                    `Missing runtime dependencies: ${missing.join(', ')}`
                );
            }

            return true;
        };

        const assertQisiModules = (moduleNames = []) => {
            const root = globalThis.Qisi || {};
            const missing = moduleNames.filter(name => !root[name]);

            if (missing.length) {
                throw new Error(
                    `Missing Qisi modules: ${missing.join(', ')}`
                );
            }

            return true;
        };

        const showFatalError = error => {
            const message = error?.message || String(error);

            console.error('[QISI_RUNTIME][fatal]', error);

            const appRoot = document.getElementById('app');
            if (!appRoot) return;

            appRoot.innerHTML = `
                <div style="
                    margin:40px;
                    padding:24px;
                    border:1px solid #f3b8b8;
                    border-radius:12px;
                    background:#fff4f4;
                    color:#9f1c1c;
                    font-family:sans-serif;
                ">
                    <strong>System initialization failed</strong>
                    <div style="margin-top:10px">${escapeHtml(message)}</div>
                </div>
            `;
        };

        const boot = (start, options = {}) => {
            try {
                assertDependencies();
                assertQisiModules(options.requiredModules || []);

                if (typeof start !== 'function') {
                    throw new Error('Invalid application start function');
                }

                return start();
            } catch (error) {
                showFatalError(error);
                return null;
            }
        };

        const runtimeDependencies = {};

        const getRuntimeDependency = name => {
            if (runtimeDependencies.hasOwnProperty(name)) {
                return runtimeDependencies[name];
            }

            const root = globalThis.Qisi || {};

            if (root[name]) return root[name];

            return null;
        };

        const setRuntimeDependency = (name, value) => {
            if (runtimeDependencies.hasOwnProperty(name)) {
                throw new Error(`Runtime dependency already registered: ${name}`);
            }
            runtimeDependencies[name] = value;
        };

        const Runtime = {
            assertDependencies,
            assertQisiModules,
            getRuntimeDependency,
            setRuntimeDependency,
            showFatalError,
            boot
        };

        return {
            Runtime,
            defaultFlags
        };
    }
);
