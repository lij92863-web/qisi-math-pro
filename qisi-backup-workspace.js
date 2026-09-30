(function (root, factory) {
    const api = factory(root); root.Qisi = root.Qisi || {}; root.Qisi.BackupWorkspace = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
    function createBackupWorkspace(ports, state = {}) {
        Object.assign(state, { automatic: false, busy: false, reading: false, restoring: false, folderReady: false,
            folderName: '', preview: null, confirmWord: '', confirmOverwrite: false, lastBackupAt: 0,
            lastSavedFile: '', pendingChanges: false, notice: '', error: '', supported: ports.supported === true });
        const timer = ports.setTimer || root.setTimeout, cancelTimer = ports.clearTimer || root.clearTimeout;
        const clock = ports.clock || Date.now, interval = ports.intervalMs || 60000;
        let folder, candidate, scheduled, revision = 0, savedRevision = 0, inFlight, disposed = false, started = false, selection = 0;
        const onWrites = parts => {
            if (Object.keys(parts).some(key => key.startsWith('idb://' + ports.database.name + '/'))) markDirty();
        };
        const translate = error => error?.code === 'restore-conflict' ? '当前数据发生变化，已取消恢复；请重新确认。' :
            error?.code === 'CONFIRMATION_REQUIRED' ? '请确认覆盖范围，并输入“恢复备份”。' :
            error?.code === 'FOLDER_REQUIRED' ? '请先选择备份文件夹，恢复前需要保存当前数据。' :
            error?.name === 'NotAllowedError' ? '文件夹权限不足，请重新选择文件夹。' :
            error?.code === 'UNSUPPORTED' ? '当前浏览器不支持选择文件夹，请用新版 Edge 或 Chrome 打开。' :
            error?.code === 'BACKUP_BUSY' ? '备份操作正在进行，请稍后再试。' : '操作未完成，请检查备份文件、文件夹权限及磁盘空间。';
        const reportFailure = error => { state.error = translate(error); return { ok: false, code: error?.code || error?.name || 'BACKUP_FAILED' }; };
        const pauseAutomatic = () => { state.automatic = false; if (scheduled !== undefined) cancelTimer(scheduled); scheduled = undefined; };
        const schedule = () => {
            state.pendingChanges = revision > savedRevision;
            if (disposed || !state.automatic || !state.pendingChanges || scheduled !== undefined) return;
            scheduled = timer(async () => {
                scheduled = undefined;
                if (!state.restoring && !state.reading && !state.busy) await backupToFolder();
                else schedule();
            }, interval);
        };
        const markDirty = () => { if (!disposed) { revision++; schedule(); } };
        function start() {
            if (started || disposed) return; started = true;
            ports.mutationEvents.subscribe(onWrites);
        }
        const writeNewFile = async (result, purpose) => {
            const identifier = (ports.uniqueId || (() => root.crypto.randomUUID()))();
            const stem = result.filename.slice(0, -4) + '-' + purpose + '-' + identifier;
            return (ports.withFileLock || (work => work()))(async () => {
                let filename;
                for (let index = 0; ; index++) {
                    const proposed = stem + (index ? '-' + index : '') + '.zip';
                    try { await folder.getFileHandle(proposed); }
                    catch (error) { if (error?.name !== 'NotFoundError') throw error; filename = proposed; break; }
                }
                const handle = await folder.getFileHandle(filename, { create: true });
                let writable;
                try { writable = await handle.createWritable(); await writable.write(result.blob); await writable.close(); }
                catch (error) { try { await writable?.abort?.(); } catch (_) {} throw error; }
                return filename;
            });
        };
        async function backupToFolder(purpose = 'auto') {
            if (inFlight) return inFlight;
            if (!folder) return reportFailure(Object.assign(new Error(), { code: 'FOLDER_REQUIRED' }));
            state.busy = true; state.error = ''; const capturedRevision = revision;
            inFlight = Promise.resolve().then(async () => {
                try {
                    const result = await ports.backup.createFullDatabaseBackup(ports.database);
                    const filename = await writeNewFile(result, purpose);
                    savedRevision = capturedRevision; state.lastBackupAt = clock(); state.lastSavedFile = filename;
                    state.notice = '完整备份已保存到所选文件夹。';
                    try { ports.recordReport?.(state.lastBackupAt, result.manifest.verification); }
                    catch (_) { state.notice = '备份文件已保存，但状态记录未能保存。'; }
                    return { ok: true, result, filename };
                } catch (error) { pauseAutomatic(); return reportFailure(error); }
                finally { state.busy = false; inFlight = null; schedule(); }
            });
            return inFlight;
        }
        const idle = () => { if (state.busy || state.reading || state.restoring || disposed) fail('BACKUP_BUSY'); };
        async function chooseFolder() {
            let acquired = false;
            try {
                idle(); if (!state.supported) fail('UNSUPPORTED');
                acquired = true; state.busy = true;
                const selected = await ports.pickDirectory({ mode: 'readwrite', id: 'qisi-auto-backups' });
                folder = selected; state.folderName = selected.name || '所选文件夹'; state.folderReady = true; state.automatic = true;
                return await backupToFolder('initial');
            } catch (error) { if (error?.name === 'AbortError') return { ok: false, cancelled: true }; return reportFailure(error); }
            finally { if (acquired) state.busy = false; schedule(); }
        }
        async function downloadBackup() {
            let acquired = false;
            try { idle(); acquired = true; state.busy = true; await ports.backup.exportFullDatabaseBackup(ports.database);
                state.notice = '已发起完整备份下载，请确认下载文件已保存。'; state.error = ''; return { ok: true };
            } catch (error) { return reportFailure(error); } finally { if (acquired) state.busy = false; schedule(); }
        }
        function cancelRestore() { selection++; candidate = null; state.preview = null; state.confirmWord = ''; state.confirmOverwrite = false; }
        async function inspectRestoreFile(file) {
            let acquired = false;
            try {
                idle(); acquired = true; cancelRestore(); const activeToken = selection; state.reading = true; state.error = '';
                const parsed = await ports.backup.readFullDatabaseBackupBlob(file);
                if (selection !== activeToken || disposed) return { ok: false, cancelled: true };
                if (parsed?.verification?.ok !== true || !parsed.backup?.tables) fail('INVALID_BACKUP');
                candidate = parsed;
                state.preview = { filename: String(file?.name || '所选备份'), exportedAt: parsed.manifest.exportedAt,
                    questionCount: parsed.verification.questionCount, imageCount: parsed.verification.imageCount,
                    tables: Object.entries(parsed.manifest.tables).map(([name, item]) => ({ name, count: item.count })),
                    absentTables: parsed.absentTables, warningCount: parsed.verification.warnings.length };
                return { ok: true };
            } catch (error) { if (acquired) { candidate = null; state.preview = null; } return reportFailure(error); }
            finally { if (acquired) state.reading = false; schedule(); }
        }
        async function restoreSelected() {
            let acquired = false, restored = false;
            try {
                idle(); if (!candidate || state.confirmWord !== '恢复备份' || state.confirmOverwrite !== true) fail('CONFIRMATION_REQUIRED');
                if (!folder) fail('FOLDER_REQUIRED');
                acquired = true; state.restoring = true; const selected = candidate;
                const safety = await backupToFolder('before-restore');
                if (!safety.ok) return safety;
                await ports.repository.restoreBackup(selected.backup, { expectedSnapshot: safety.result.snapshot });
                restored = true;
                cancelRestore(); state.notice = '备份恢复完成。'; pauseAutomatic();
                await ports.onRestored?.(); return { ok: true };
            } catch (error) { if (restored) { state.notice = '数据已恢复，请手动刷新页面。'; return { ok: true, refreshRequired: true }; } return reportFailure(error); }
            finally { if (acquired) state.restoring = false; schedule(); }
        }
        function dispose() {
            disposed = true; pauseAutomatic();
            if (started) ports.mutationEvents.unsubscribe(onWrites);
        }
        return Object.freeze({ start, dispose, chooseFolder, pauseAutomatic, downloadBackup, inspectRestoreFile,
            cancelRestore: () => { if (state.restoring) return reportFailure({ code: 'BACKUP_BUSY' }); cancelRestore(); return { ok: true }; }, restoreSelected, backupNow: () => {
                try { idle(); return backupToFolder('manual'); } catch (error) { return Promise.resolve(reportFailure(error)); }
            } });
    }
    return Object.freeze({ createBackupWorkspace });
});
