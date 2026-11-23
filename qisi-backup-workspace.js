(function (root, factory) {
    const api = factory(root); root.Qisi = root.Qisi || {}; root.Qisi.BackupWorkspace = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
    // 「上次完整备份」的持久记录。qisi-backup.js 的 exportFullDatabaseBackup
    // 在下载备份时会写同一个键；这里在文件夹备份成功时也写，
    // 让「距离上次备份多久」跨会话仍然准确 —— 这是给界面提醒用的。
    const readLastFullBackupAt = () => {
        try { return Number(root.localStorage?.getItem?.('qisi_last_full_backup_at') || 0) || 0; }
        catch { return 0; }
    };
    const writeLastFullBackupAt = value => {
        try { root.localStorage?.setItem?.('qisi_last_full_backup_at', String(value)); } catch { /* 空间不足不致命 */ }
    };
    function createBackupWorkspace(ports, state = {}) {
        Object.assign(state, { automatic: false, busy: false, reading: false, restoring: false, folderReady: false,
            folderName: '', preview: null, confirmWord: '', confirmOverwrite: false,
            lastBackupAt: readLastFullBackupAt(),
            lastSavedFile: '', pendingChanges: false, notice: '', error: '', supported: ports.supported === true });
        const timer = ports.setTimer || root.setTimeout, cancelTimer = ports.clearTimer || root.clearTimeout;
        const clock = ports.clock || Date.now, interval = ports.intervalMs || 60000;
        const automaticCopies = 7;
        const uuidPattern = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
        const validUuid = new RegExp('^' + uuidPattern + '$', 'i');
        const rotationScope = () => {
            const key = 'qisi_auto_backup_rotation_owner';
            try {
                const existing = root.localStorage?.getItem(key);
                if (validUuid.test(existing)) return existing;
                const value = root.crypto.randomUUID();
                root.localStorage.setItem(key, value);
                return value;
            } catch (_) { return ''; }
        };
        let folder, candidate, scheduled, revision = 0, savedRevision = 0, inFlight, disposed = false, started = false, selection = 0;
        let retryDelay = 0, blockedRevision = -1;
        const onWrites = parts => {
            if (Object.keys(parts).some(key => key.startsWith('idb://' + ports.database.name + '/'))) markDirty();
        };
        // 错误码 → 老师能看懂的话。用表而不是三元链：加一个错误码只加一行，
        // 不会再出现「找不到对应分支就掉进兜底文案」的误导。
        // 尤其那几个 ARCHIVE_* 上限：以前一律显示「请检查文件夹权限及磁盘空间」，
        // 而真实原因是「这份备份大到恢复不了」。
        const FAILURE_MESSAGES = Object.freeze({
            'restore-conflict': '当前数据发生变化，已取消恢复；请重新确认。',
            CONFIRMATION_REQUIRED: '请确认覆盖范围，并输入“恢复备份”。',
            FOLDER_REQUIRED: '请先选择备份文件夹，恢复前需要保存当前数据。',
            BACKUP_BUSY: '备份操作正在进行，请稍后再试。',
            UNSUPPORTED: '当前浏览器不支持选择文件夹，请用新版 Edge 或 Chrome 打开。',
            NotAllowedError: '文件夹权限不足，请重新选择文件夹。',
            ARCHIVE_TOTAL_SIZE_LIMIT: '完整备份的数据超过 2 GiB。请分批导出题库数据，或减少大附件后重试。',
            ARCHIVE_ENTRY_COUNT_LIMIT: '完整备份超过 6 万个归档条目。请分批导出题库数据，或减少附件后重试。',
            ARCHIVE_ENTRY_SIZE_LIMIT: '有单个归档条目超过 64 MiB，请检查大附件。',
            ARCHIVE_ENTRY_CORRUPT: '备份文件的内容校验失败，请选择另一份备份。',
            ARCHIVE_COMPRESSION_RATIO_LIMIT: '这份备份的压缩比异常（可能已损坏），恢复时会被拒绝。',
            ARCHIVE_PATH_TRAVERSAL: '这份备份内含异常的路径，已拒绝处理。',
            ARCHIVE_UNREADABLE: '这个文件不是有效的备份压缩包，或已经损坏。'
        });
        const translate = error => FAILURE_MESSAGES[error?.code] || FAILURE_MESSAGES[error?.name] ||
            ('操作未完成（' + (error?.code || error?.name || '未知原因') + '），请把这条信息告诉维护者。');
        const reportFailure = error => { state.error = translate(error); return { ok: false, code: error?.code || error?.name || 'BACKUP_FAILED' }; };
        const pauseAutomatic = () => { state.automatic = false; if (scheduled !== undefined) cancelTimer(scheduled); scheduled = undefined; };
        const schedule = () => {
            state.pendingChanges = revision > savedRevision;
            if (disposed || !state.automatic || !state.pendingChanges || revision === blockedRevision || scheduled !== undefined) return;
            scheduled = timer(async () => {
                scheduled = undefined;
                if (!state.restoring && !state.reading && !state.busy) await backupToFolder();
                else schedule();
            }, Math.max(interval, retryDelay));
        };
        const markDirty = () => { if (!disposed) { revision++; schedule(); } };
        function start() {
            if (started || disposed) return; started = true;
            ports.mutationEvents.subscribe(onWrites);
        }
        const writeNewFile = async (result, purpose) => {
            const identifier = (ports.uniqueId || (() => root.crypto.randomUUID()))();
            return (ports.withFileLock || (work => work()))(async () => {
                const scope = purpose === 'auto' && (ports.rotationScope || rotationScope)();
                const managed = validUuid.test(scope);
                const suffix = managed ? 'auto-managed-' + scope : purpose;
                const stem = result.filename.slice(0, -4) + '-' + suffix + '-' + identifier;
                let filename;
                for (let index = 0; ; index++) {
                    const proposed = stem + (index ? '-' + index : '') + '.zip';
                    try { await folder.getFileHandle(proposed); }
                    catch (error) { if (error?.name !== 'NotFoundError') throw error; filename = proposed; break; }
                }
                const handle = await folder.getFileHandle(filename, { create: true });
                let writable;
                try {
                    writable = await handle.createWritable();
                    await writable.write(result.blob);
                    await writable.close();
                    if (typeof handle.getFile === 'function' && (await handle.getFile()).size !== result.blob.size) fail('ARCHIVE_ENTRY_CORRUPT');
                } catch (error) {
                    try { await writable?.abort?.(); } catch (_) {}
                    try { await folder.removeEntry?.(filename); } catch (_) {}
                    throw error;
                }
                let retentionFailed = false;
                if (managed && typeof folder.entries === 'function' && typeof folder.removeEntry === 'function') {
                    try {
                        const archives = [];
                        const ownArchive = new RegExp('^qisi-full-backup-(\\d+)-auto-managed-' + scope + '-' + uuidPattern + '(?:-\\d+)?\\.zip$', 'i');
                        const currentStamp = Number(ownArchive.exec(filename)?.[1]);
                        if (!Number.isSafeInteger(currentStamp)) fail('BACKUP_FILENAME_INVALID');
                        for await (const [name, entry] of folder.entries()) {
                            const stamp = ownArchive.exec(name)?.[1];
                            if (stamp && name !== filename && entry.kind === 'file') archives.push({ name, stamp: Number(stamp) });
                        }
                        archives.sort((a, b) => b.stamp - a.stamp || b.name.localeCompare(a.name));
                        for (const archive of archives.slice(automaticCopies - 1)) {
                            if (archive.stamp > currentStamp) continue;
                            await folder.removeEntry(archive.name);
                        }
                    } catch (_) { retentionFailed = true; }
                }
                return { filename, retentionFailed };
            });
        };
        async function backupToFolder(purpose = 'auto') {
            if (inFlight) return inFlight;
            if (!folder) return reportFailure(Object.assign(new Error(), { code: 'FOLDER_REQUIRED' }));
            state.busy = true; state.error = ''; const capturedRevision = revision;
            inFlight = Promise.resolve().then(async () => {
                try {
                    const result = await ports.backup.createFullDatabaseBackup(ports.database);
                    const { filename, retentionFailed } = await writeNewFile(result, purpose);
                    savedRevision = capturedRevision; retryDelay = 0; blockedRevision = -1;
                    state.lastBackupAt = clock(); state.lastSavedFile = filename;
                    writeLastFullBackupAt(state.lastBackupAt);
                    state.notice = retentionFailed ? '完整备份已保存，旧自动备份清理失败。' : '完整备份已保存到所选文件夹。';
                    try { ports.recordReport?.(state.lastBackupAt, result.manifest.verification); }
                    catch (_) { state.notice = '备份文件已保存，但状态记录未能保存。'; }
                    return { ok: true, result, filename };
                } catch (error) {
                    if (['ARCHIVE_TOTAL_SIZE_LIMIT', 'ARCHIVE_ENTRY_COUNT_LIMIT', 'ARCHIVE_ENTRY_SIZE_LIMIT'].includes(error?.code)) {
                        blockedRevision = capturedRevision;
                        state.notice = '上次成功备份已保留。数据再次变更后会自动重试，也可手动重试。';
                    } else if (['NotAllowedError', 'SecurityError'].includes(error?.name)) {
                        pauseAutomatic();
                        state.notice = '自动备份已暂停，请重新选择备份文件夹。';
                    } else {
                        retryDelay = Math.min(15 * 60000, Math.max(interval, retryDelay) * 2);
                        state.notice = '上次成功备份已保留。自动备份稍后会重试。';
                    }
                    return reportFailure(error);
                }
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
                revision++;
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
                const rollbackPreferences = selected.preferences === undefined ? () => {} :
                    ports.backup.restorePreferences(selected.preferences);
                try { await ports.repository.restoreBackup(selected.backup, { expectedSnapshot: safety.result.snapshot }); }
                catch (cause) { rollbackPreferences(); throw cause; }
                restored = true;
                cancelRestore(); state.notice = '备份恢复完成。'; pauseAutomatic();
                await ports.onRestored?.(selected.preferences !== undefined); return { ok: true };
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
