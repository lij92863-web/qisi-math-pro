(function initNormalUiImportController(root) {
    'use strict';

    class NormalUiImportControllerError extends Error {
        constructor(code, causeCode = '') {
            super(code);
            this.name = 'NormalUiImportControllerError';
            this.code = code;
            this.stage = 'normal-ui-import-controller';
            if (causeCode) this.causeCode = causeCode;
        }
    }

    const stableCode = value => {
        const code = String(value || '').trim();
        return /^[A-Z0-9_.:-]{1,100}$/i.test(code) ? code : 'IMPORT_FAILED';
    };

    const fail = (code, causeCode = '') =>
        new NormalUiImportControllerError(code, stableCode(causeCode));

    function createNormalUiImportController(ports = {}) {
        if (
            typeof ports.bridge?.run !== 'function' ||
            typeof ports.loadBatch !== 'function' ||
            typeof ports.applyReviewModel !== 'function'
        ) throw fail('NORMAL_UI_IMPORT_PORT_REQUIRED');
        const active = new Map();
        const setBusy = typeof ports.setBusy === 'function'
            ? ports.setBusy : () => {};
        const notifySuccess = typeof ports.notifySuccess === 'function'
            ? ports.notifySuccess : () => {};
        const notifyFailure = typeof ports.notifyFailure === 'function'
            ? ports.notifyFailure : () => {};

        async function execute(batchId, options, activity) {
            const controller = activity.controller;
            const batch = await ports.loadBatch(batchId);
            if (!batch || String(batch.id || '') !== batchId) {
                throw fail('NORMAL_UI_IMPORT_BATCH_MISSING');
            }
            const version = Number.isInteger(batch.draftPersistence?.version)
                ? batch.draftPersistence.version : 0;
            const sourceVersion = Number.isInteger(batch.sourceVersion)
                ? batch.sourceVersion : null;
            const previousRequestId = String(
                batch.draftPersistence?.idempotencyKey || ''
            );
            const retryPrefix =
                `normal-ui:${batchId}:source:${sourceVersion ?? 0}:draft:`;
            const mayReuseCommittedRequest = typeof ports.canReuseCommittedRequest !== 'function' ||
                ports.canReuseCommittedRequest(batch);
            const reusableRequestId = mayReuseCommittedRequest && batch.status === 'review' &&
                previousRequestId.startsWith(retryPrefix)
                ? previousRequestId
                : '';
            const requestId = String(options.requestId || reusableRequestId ||
                `${retryPrefix}${version + 1}`);
            const result = await ports.bridge.run({
                mode: 'production',
                batchId,
                requestId,
                ...(sourceVersion === null
                    ? {}
                    : { expectedSourceVersion: sourceVersion }),
                signal: controller.signal
            });
            activity.cancelable = false;
            if (
                result?.mode !== 'production' ||
                result?.state?.state !== 'WAITING_CONFIRMATION' ||
                !result?.readback?.batch ||
                !Array.isArray(result?.readback?.questions)
            ) throw fail('NORMAL_UI_IMPORT_RESULT_MALFORMED');
            await ports.applyReviewModel(result);
            notifySuccess({
                batchId,
                draftCount: result.readback.questions.length
            });
            return result;
        }

        function executeLocked(batchId, options, activity) {
            const locks = ports.lockManager || root?.navigator?.locks;
            if (typeof locks?.request !== 'function') return execute(batchId, options, activity);
            return locks.request(`qisi-normal-import:${batchId}`, { mode: 'exclusive', ifAvailable: true }, lock => {
                if (!lock) throw fail('IMPORT_RUNNING_IN_ANOTHER_WINDOW');
                if (activity.controller.signal.aborted) throw fail('IMPORT_CANCELLED');
                // Read current source/version and retain exclusivity through persistence and readback.
                return execute(batchId, options, activity);
            });
        }

        function run(batchIdValue, options = {}) {
            const batchId = String(batchIdValue || '').trim();
            if (!batchId) return Promise.reject(
                fail('NORMAL_UI_IMPORT_BATCH_ID_REQUIRED')
            );
            if (active.has(batchId)) return active.get(batchId).promise;
            const controller = new AbortController();
            const activity = { controller, cancelable: true, promise: null };
            setBusy({ batchId, busy: true });
            const promise = executeLocked(batchId, options, activity)
                .catch(error => {
                    const normalized = error?.code === 'IMPORT_CANCELLED'
                        ? fail('IMPORT_CANCELLED')
                        : fail(
                            stableCode(error?.code || 'NORMAL_UI_IMPORT_FAILED'),
                            error?.causeCode || error?.code || error?.name
                        );
                    const status = root?.Qisi?.ProductionImportStatusPort || (typeof module !== 'undefined' && module.exports
                        ? require('./qisi-production-import-status-port.js') : null);
                    const details = status.failureDetails({ ...error, code: normalized.code, causeCode: normalized.causeCode });
                    notifyFailure({ batchId, code: normalized.code, details, message: normalized.code === 'IMPORT_RUNNING_IN_ANOTHER_WINDOW' ? '此任务正在另一个窗口处理中，请等待完成后再查看。' : status.failureMessage(details) });
                    throw normalized;
                })
                .finally(() => {
                    if (active.get(batchId)?.promise === promise) {
                        active.delete(batchId);
                    }
                    setBusy({ batchId, busy: false });
                });
            activity.promise = promise;
            active.set(batchId, activity);
            return promise;
        }

        function cancel(batchIdValue) {
            const batchId = String(batchIdValue || '').trim();
            const current = active.get(batchId);
            if (!current || current.cancelable !== true) return false;
            current.cancelable = false;
            current.controller.abort();
            return true;
        }

        return Object.freeze({
            run,
            cancel,
            isRunning: batchId => active.has(String(batchId || '').trim())
        });
    }

    const api = Object.freeze({
        NormalUiImportControllerError,
        createNormalUiImportController
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.NormalUiImportController = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
