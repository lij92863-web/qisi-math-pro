(function initImportRunCommands(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ImportRunCommands = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Run/cancel/rerun commands for the normal UI import. The controller owns the
    // state machine, locking and cancellation; this module only decides and reports.
    // Rerun deliberately reuses the same batch id and the same controller route:
    // it never switches to another producer chain.
    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    const runBatch = ({ batchId, controller, warn } = {}) => {
        if (!batchId) {
            const error = new Error('缺少批量录题任务 ID');
            error.code = 'IMPORT_BATCH_ID_REQUIRED';
            throw error;
        }
        const run = requireDependency(controller?.run, 'IMPORT_RUN_CONTROLLER_REQUIRED');
        const isRunning = typeof controller.isRunning === 'function' ? controller.isRunning(batchId) : false;
        if (isRunning && typeof warn === 'function') {
            warn('[BATCH_DEBUG][duplicate-run-blocked]', { batchId });
        }
        return run(batchId);
    };

    const cancelBatch = ({ batchId, controller, notify } = {}) => {
        const cancel = requireDependency(controller?.cancel, 'IMPORT_CANCEL_CONTROLLER_REQUIRED');
        const cancelled = cancel(batchId);
        if (!cancelled && typeof notify === 'function') {
            notify('当前任务没有可取消的识别请求。');
        }
        return cancelled;
    };

    const rerunBatch = async ({ batchId, confirmRerun, run, openReview, notify } = {}) => {
        if (!batchId) {
            if (typeof notify === 'function') notify('当前没有可重新识别的任务');
            return false;
        }
        if (typeof confirmRerun === 'function' && !confirmRerun(
            '重新识别会用新的规则更新当前草稿，已提交入库的正式题目不受影响。是否继续？'
        )) return false;
        await requireDependency(run, 'IMPORT_RERUN_RUN_REQUIRED')(batchId);
        await requireDependency(openReview, 'IMPORT_RERUN_OPEN_REVIEW_REQUIRED')(batchId);
        return true;
    };

    return Object.freeze({ runBatch, cancelBatch, rerunBatch });
});
