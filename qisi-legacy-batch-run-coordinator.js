(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.LegacyBatchRunCoordinator = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    class LegacyBatchRunError extends Error {
        constructor(code, message, details = {}) {
            super(message);
            this.name = 'LegacyBatchRunError';
            this.code = code;
            this.stage = 'legacy-run';
            this.details = { ...details };
        }
    }

    const createLegacyBatchRunCoordinator = ({
        runLegacyBatch,
        loadBatchState
    } = {}) => {
        if (typeof runLegacyBatch !== 'function') {
            throw new TypeError('Legacy batch runner is required.');
        }
        if (typeof loadBatchState !== 'function') {
            throw new TypeError('Legacy batch state reader is required.');
        }
        const running = new Set();

        const run = async batchId => {
            const id = String(batchId || '').trim();
            if (!id) {
                throw new LegacyBatchRunError(
                    'missing-source', 'Batch ID is required.'
                );
            }
            if (running.has(id)) {
                throw new LegacyBatchRunError(
                    'duplicate-run', `Legacy batch ${id} is already running.`,
                    { batchId: id }
                );
            }
            running.add(id);
            try {
                try {
                    await runLegacyBatch(id);
                } catch (cause) {
                    throw new LegacyBatchRunError(
                        'legacy-run-failed',
                        cause?.message || 'Legacy batch run failed.',
                        { batchId: id }
                    );
                }
                const batch = await loadBatchState(id);
                if (!batch) {
                    throw new LegacyBatchRunError(
                        'legacy-state-missing',
                        'Legacy batch state is missing after the run.',
                        { batchId: id }
                    );
                }
                if (batch.status === 'failed') {
                    throw new LegacyBatchRunError(
                        'legacy-run-failed',
                        batch.errorMessage || 'Legacy batch run failed.',
                        { batchId: id, persistedStatus: batch.status }
                    );
                }
                if (!['review', 'completed'].includes(batch.status)) {
                    throw new LegacyBatchRunError(
                        'legacy-run-incomplete',
                        'Legacy batch run did not reach a reviewable state.',
                        { batchId: id, persistedStatus: batch.status }
                    );
                }
                return {
                    owner: 'LegacyBatchRunCoordinator',
                    boundary: 'legacy-business-and-persistence',
                    validationBoundary: false,
                    batch
                };
            } finally {
                running.delete(id);
            }
        };

        return Object.freeze({
            run,
            isRunning: batchId => running.has(String(batchId || ''))
        });
    };

    return Object.freeze({
        LegacyBatchRunError,
        createLegacyBatchRunCoordinator
    });
});
