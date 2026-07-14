'use strict';

const traces = new WeakMap();

async function installImportStageTrace(page) {
    const events = [];
    traces.set(page, events);
    page.on('console', async message => {
        if (!message.text().startsWith('[QISI_IMPORT_DIAGNOSTICS]')) return;
        const value = await message.args()[1]?.jsonValue().catch(() => null);
        if (value && typeof value === 'object') events.push(value);
    });
    await page.addInitScript(() => {
        window.__qisiImportStageTrace = [];
        const original = console.info.bind(console);
        console.info = (...args) => {
            if (
                args[0] === '[QISI_IMPORT_DIAGNOSTICS]' &&
                args[1] && typeof args[1] === 'object'
            ) {
                window.__qisiImportStageTrace.push(
                    JSON.parse(JSON.stringify(args[1]))
                );
            }
            original(...args);
        };
    });
}

async function activateImportStageTrace(page) {
    await page.evaluate(() => {
        const owner = window.Qisi?.ImportDiagnostics;
        if (
            !owner || owner.__stageTraceWrapped === true ||
            typeof owner.createImportDiagnostics !== 'function'
        ) return;
        window.Qisi.ImportDiagnostics = Object.freeze({
            ...owner,
            __stageTraceWrapped: true,
            createImportDiagnostics(options) {
                const diagnostics = owner.createImportDiagnostics(options);
                const capture = method => input => {
                    const event = diagnostics[method](input);
                    window.__qisiImportStageTrace.push(
                        JSON.parse(JSON.stringify(event))
                    );
                    return event;
                };
                return Object.freeze({
                    start: capture('start'),
                    record: capture('record'),
                    fail(error, input) {
                        const event = diagnostics.fail(error, input);
                        window.__qisiImportStageTrace.push(
                            JSON.parse(JSON.stringify(event))
                        );
                        return event;
                    },
                    snapshot: diagnostics.snapshot
                });
            }
        });
    });
}

const readImportStageTrace = async (page, batchId = '') => {
    await page.waitForTimeout(0);
    const captured = traces.get(page) || [];
    if (captured.length) {
        return captured.filter(event => !batchId || event.batchId === batchId);
    }
    return page.evaluate(id =>
        (window.__qisiImportStageTrace || []).filter(event =>
            !id || event.batchId === id
        ), batchId
    );
};

module.exports = {
    installImportStageTrace,
    activateImportStageTrace,
    readImportStageTrace
};
