(function initLibraryExternalMerge(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryExternalMerge = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // External-library page commands; domain rules and durable writes stay in their services.
    const UNRESOLVED_STATUSES = Object.freeze(['similar', 'answerConflict']);

    const countUnresolved = items => (Array.isArray(items) ? items : [])
        .filter(item => UNRESOLVED_STATUSES.includes(item?.status) && item?.action === 'skip')
        .length;

    const buildMergeOperations = ({ items, findQuestion, getMatchInfo, fillQuestion, copyQuestion } = {}) => {
        const requireDependency = (value, code) => {
            if (typeof value !== 'function') {
                const error = new Error(code);
                error.code = code;
                throw error;
            }
            return value;
        };
        const getInfo = requireDependency(getMatchInfo, 'LIBRARY_EXTERNAL_MERGE_MATCH_HELPER_REQUIRED');
        const fill = requireDependency(fillQuestion, 'LIBRARY_EXTERNAL_MERGE_FILL_HELPER_REQUIRED');
        const copy = requireDependency(copyQuestion, 'LIBRARY_EXTERNAL_MERGE_COPY_HELPER_REQUIRED');
        const find = typeof findQuestion === 'function' ? findQuestion : () => null;

        const operations = [];
        for (const item of Array.isArray(items) ? items : []) {
            const external = item?.question;
            if (!external) continue;
            if (item.action === 'skip') {
                operations.push({ action: 'skip', externalId: external.id });
                continue;
            }
            if (item.action === 'fill') {
                const matchInfo = getInfo(external);
                const local = matchInfo?.matchedQuestion || find(item.matchedQuestionId);
                if (local) {
                    operations.push({
                        action: 'fill',
                        externalId: external.id,
                        question: fill(local, external, item),
                        expectedUpdatedAt: local.updatedAt
                    });
                    continue;
                }
            }
            if (item.action === 'add' || item.action === 'fill') {
                operations.push({ action: 'add', externalId: external.id, question: copy(external, item) });
            }
        }
        return operations;
    };

    const createExternalState = ({ ref }) => Object.freeze({
        activeExternalBatchId: ref(null), externalPickMode: ref(false), selectedExternalIds: ref([]),
        confirmItems: ref([]), batchPersonalKnowledge: ref(''), batchSystemKnowledge: ref(''),
        pendingImportPreview: ref(null)
    });

    const createWorkspace = ({ state, library, packages, model, repository, read, refresh,
        notify, confirm, navigate, observeNavigation = () => () => {},
        defaultAction, clock = Date.now, random = Math.random } = {}) => {
        let disposed = false, visit = 0, previewEpoch = 0, pending = null;
        const stopNavigation = observeNavigation(() => { visit += 1; });
        const tell = message => { if (!disposed) notify(message); };
        const plain = value => JSON.parse(JSON.stringify(value));
        const current = token => !disposed && token === visit;
        const mutate = (key, work) => {
            if (disposed) return Promise.resolve(false);
            if (pending) {
                if (pending.key === key) return pending.promise;
                tell('当前处理尚未完成，请稍后操作。');
                return Promise.resolve(false);
            }
            const entry = { key };
            pending = entry;
            entry.promise = Promise.resolve().then(() => disposed ? false : work()).finally(() => { if (pending === entry) pending = null; });
            return entry.promise;
        };
        const refreshCommitted = async (domain, label) => {
            if (disposed) return false;
            try { await refresh[domain](); return !disposed; }
            catch (error) {
                tell(`${label}已写入，但页面刷新失败，请刷新页面查看；请勿重复提交：${error?.message || error}`);
                return false;
            }
        };
        const preview = async file => {
            const epoch = ++previewEpoch, token = visit;
            try {
                const parsed = await packages.read(file);
                if (epoch !== previewEpoch || !current(token)) return false;
                state.pendingImportPreview.value = parsed;
                return true;
            } catch (error) {
                if (epoch === previewEpoch && current(token)) tell(`解析题库数据失败：${error?.message || error}`);
                return false;
            }
        };
        const handleFileChange = async event => {
            const file = event.target.files?.[0]; event.target.value = null;
            return file ? preview(file) : false;
        };
        const cancelPreview = () => { previewEpoch += 1; state.pendingImportPreview.value = null; };
        const confirmImport = () => mutate('import', async () => {
            const parsed = state.pendingImportPreview.value, token = visit;
            if (!parsed) return false;
            if (parsed.mayDuplicate && !confirm('这份题库数据可能已经导入过，是否继续？')) return false;
            let command;
            try {
                command = packages.project(parsed);
                await repository.importExternalBatch(command);
            } catch (error) {
                tell(`导入失败，未写入题库数据：${error?.message || error}`); return false;
            }
            if (!disposed && state.pendingImportPreview.value === parsed) state.pendingImportPreview.value = null;
            if (!await refreshCommitted('external', '导入')) return { committed: true, refreshed: false };
            if (current(token)) {
                state.activeExternalBatchId.value = command.batch.id;
                navigate('imported');
            }
            tell(`导入完成：已进入外部题库。\n来源：${command.batch.sourceTeacher}\n题目数量：${command.questions.length}`);
            return { committed: true, refreshed: true };
        });
        const clearSelection = () => { state.selectedExternalIds.value = []; };
        const leaveExternal = () => {
            state.activeExternalBatchId.value = null; state.externalPickMode.value = false; clearSelection();
        };
        const pickModeChanged = enabled => { if (!enabled) clearSelection(); };
        const togglePick = id => {
            if (!read.externalQuestions().some(q => q.id === id)) return false;
            state.selectedExternalIds.value = state.selectedExternalIds.value.includes(id)
                ? state.selectedExternalIds.value.filter(value => value !== id) : [...state.selectedExternalIds.value, id];
            return true;
        };
        const selectAllOnPage = () => {
            state.selectedExternalIds.value = [...new Set([...state.selectedExternalIds.value,
                ...read.pagedExternalQuestions().map(q => q.id)])];
        };
        const openConfirm = () => {
            const selected = new Set(state.selectedExternalIds.value);
            const candidates = read.externalQuestions().filter(q => selected.has(q.id));
            if (!candidates.length) { tell('请先选择有效的外部题目。'); return false; }
            state.confirmItems.value = candidates.map(question => {
                const info = model.getMatchInfo(question);
                return { externalId: question.id, question, status: info.status,
                    matchedQuestionId: info.matchedQuestion?.id || '',
                    matchedQuestion: info.matchedQuestion ? plain(info.matchedQuestion) : null,
                    reason: info.reason, action: defaultAction(info.status), personalKnowledge: '', systemKnowledge: '', expanded: false };
            });
            state.batchPersonalKnowledge.value = ''; state.batchSystemKnowledge.value = '';
            navigate('confirm'); return true;
        };
        const applyBatchKnowledge = type => {
            if (!['personal', 'system'].includes(type)) return;
            const field = type === 'personal' ? 'personalKnowledge' : 'systemKnowledge';
            const value = type === 'personal' ? state.batchPersonalKnowledge.value : state.batchSystemKnowledge.value;
            state.confirmItems.value.forEach(item => { item[field] = value; });
        };
        const commit = () => mutate('merge', async () => {
            const token = visit, sourceItems = state.confirmItems.value, items = plain(sourceItems);
            const unresolved = countUnresolved(items);
            if (unresolved && !confirm(`还有 ${unresolved} 道疑似同题或答案冲突题未处理。是否跳过这些题并继续？`)) return false;
            let result;
            try {
                let byId;
                const findQuestion = read.questionById || (id => {
                    byId ||= new Map(read.questions().map(question => [question.id, question]));
                    return byId.get(id);
                });
                const operations = buildMergeOperations({ items, findQuestion,
                    getMatchInfo: model.getMatchInfo, fillQuestion: model.fillQuestion, copyQuestion: model.copyQuestion });
                if (!operations.length) { tell('没有有效的待处理题目。'); return false; }
                const now = clock();
                result = await library.commitExternalMerge({ id: `merge_${now}_${random().toString(36).slice(2, 8)}`, createdAt: now, operations });
            } catch (error) { tell(`加入个人题库失败：${error?.message || error}`); return false; }
            const sameDecisions = state.confirmItems.value === sourceItems && JSON.stringify(sourceItems) === JSON.stringify(items);
            if (!disposed) {
                const completed = new Set(items.map(item => item.externalId));
                state.selectedExternalIds.value = state.selectedExternalIds.value.filter(id => !completed.has(id));
                if (sameDecisions) state.confirmItems.value = [];
            }
            if (!await refreshCommitted('banks', '加入个人题库')) return { committed: true, refreshed: false };
            if (current(token) && sameDecisions) {
                if (!state.selectedExternalIds.value.length) state.externalPickMode.value = false;
                navigate('merged');
            }
            const { added = 0, filled = 0, skipped = 0 } = result.summary || {};
            tell(`处理完成：新增 ${added} 道，补全 ${filled} 道，跳过 ${skipped} 道。`);
            return { committed: true, refreshed: true };
        });
        const undo = () => mutate('undo', async () => {
            try {
                const latest = await library.getLatestReversibleExternalMerge();
                if (!latest) { tell('暂无可撤销的加入记录。'); return false; }
                if (disposed || !confirm(`确定撤销最近一次加入吗？\n新增 ${latest.summary?.added || 0} 道、补全 ${latest.summary?.filled || 0} 道、跳过 ${latest.summary?.skipped || 0} 道将恢复到处理前状态。`)) return false;
                await library.undoExternalMerge({ mergeBatchId: latest.id, revertedAt: clock() });
            } catch (error) { tell(`撤销失败：${error?.message || error}`); return false; }
            if (!await refreshCommitted('banks', '撤销')) return { committed: true, refreshed: false };
            tell('已撤销最近一次加入。'); return { committed: true, refreshed: true };
        });
        const deleteBatch = batchId => mutate('delete', async () => {
            const batch = read.importBatches().find(row => row.id === batchId);
            if (!batch || !confirm(`确定删除导入批次「${batch.title || '导入题库'}」吗？\n只会删除外部题库暂存题，不会删除正式题库。`)) return false;
            try { await repository.deleteExternalBatch(batchId); }
            catch (error) { tell(`删除外部批次失败：${error?.message || error}`); return false; }
            if (!disposed && state.activeExternalBatchId.value === batchId) state.activeExternalBatchId.value = null;
            return refreshCommitted('external', '删除外部批次');
        });
        const recalculate = batchId => mutate('recalculate', async () => {
            try { await repository.recalcExternalBatchStatus(batchId, row => ({ detectedStatus: model.getMatchInfo(row).status })); }
            catch (error) { tell(`重新计算失败：${error?.message || error}`); return false; }
            if (!await refreshCommitted('external', '重新计算')) return { committed: true, refreshed: false };
            tell('已重新计算本批次题目状态。'); return true;
        });
        const dispose = () => { if (disposed) return; disposed = true; previewEpoch += 1; stopNavigation(); };
        return Object.freeze({ preview, handleFileChange, cancelPreview, confirmImport, clearSelection, leaveExternal,
            pickModeChanged, togglePick, selectAllOnPage, openConfirm, applyBatchKnowledge, commit, undo, deleteBatch, recalculate, dispose });
    };

    return Object.freeze({ createExternalState, createWorkspace, UNRESOLVED_STATUSES, countUnresolved, buildMergeOperations });
});
