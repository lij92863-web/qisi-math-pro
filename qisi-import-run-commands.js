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

    const createWorkspace = ({ createController, bridge, storage, session,
        canReuseCommittedRequest, sourceFor, afterRender, notify } = {}) => {
        for (const port of [createController, bridge?.run, storage?.get, session?.captureNavigation,
            session?.adoptImportResult, canReuseCommittedRequest, sourceFor, afterRender, notify]) {
            requireDependency(port, 'IMPORT_WORKSPACE_PORT_REQUIRED');
        }
        const pending = new Map();
        let disposed = false;
        const controller = createController({
            bridge, canReuseCommittedRequest,
            loadBatch: batchId => storage.get('draftImportBatches', batchId),
            applyReviewModel: async result => {
                const activity = pending.get(result.batchId);
                if (!activity || disposed) return;
                activity.completed = true;
                activity.applied = await session.adoptImportResult(result, activity.visit, { sourceFor, afterRender });
            },
            notifySuccess: ({ batchId, draftCount }) => {
                if (disposed) return;
                notify(`批量识别完成：生成 ${draftCount} 道草稿。` +
                    (pending.get(batchId)?.applied ? '' : '当前页面有更新，请从任务列表打开审核。'));
            },
            notifyFailure: ({ batchId, code, message }) => {
                if (!disposed) notify((pending.get(batchId)?.completed
                    ? '草稿已生成，审核页面加载未完成：' : '批量识别失败：') + (message || code));
            }
        });
        for (const name of ['run', 'cancel', 'isRunning']) requireDependency(controller?.[name], 'IMPORT_WORKSPACE_CONTROLLER_REQUIRED');
        const run = (batchId, options) => {
            if (disposed) return Promise.reject(Object.assign(new Error('IMPORT_WORKSPACE_DISPOSED'), { code: 'IMPORT_WORKSPACE_DISPOSED' }));
            if (pending.has(batchId)) {
                return pending.get(batchId).promise;
            }
            const activity = { visit: session.captureNavigation(), completed: false, applied: false, promise: null };
            pending.set(batchId, activity);
            try {
                activity.promise = Promise.resolve(controller.run(batchId, options)).finally(() => {
                    if (pending.get(batchId) === activity) pending.delete(batchId);
                });
                return activity.promise;
            } catch (error) { pending.delete(batchId); return Promise.reject(error); }
        };
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            for (const batchId of pending.keys()) controller.cancel(batchId);
            pending.clear();
        };
        return Object.freeze({ run, cancel: batchId => controller.cancel(batchId),
            isRunning: batchId => controller.isRunning(batchId), dispose });
    };

    return Object.freeze({ runBatch, cancelBatch, rerunBatch, createWorkspace });
});
