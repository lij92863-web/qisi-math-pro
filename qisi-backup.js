(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.Backup = api;

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

        const scriptUrl = globalThis.document?.currentScript?.src;
        const archiveWork = (kind, args, local) => {
            if (!/^https?:/.test(scriptUrl || '') || typeof globalThis.Worker !== 'function') return local(...args);
            const imports = ['./vendor/zip-js/zip.min.js', './qisi-archive-security.js', scriptUrl]
                .map(path => JSON.stringify(new URL(path, scriptUrl).href)).join(',');
            const url = URL.createObjectURL(new Blob([`importScripts(${imports});`], { type: 'text/javascript' }));
            let worker;
            try { worker = new Worker(url, { name: 'qisi-backup' }); }
            catch (_) { URL.revokeObjectURL(url); return local(...args); }
            return new Promise((resolve, reject) => {
                const finish = (done, value) => { worker.terminate(); URL.revokeObjectURL(url); done(value); };
                worker.onmessage = ({ data }) => {
                    if (data.ok) finish(resolve, data.value);
                    else finish(reject, Object.assign(new Error(data.message), { code: data.code }));
                };
                worker.onerror = () => finish(reject, Object.assign(new Error('备份后台处理失败。'), { code: 'BACKUP_WORKER_FAILED' }));
                worker.onmessageerror = worker.onerror;
                try { worker.postMessage({ kind, args }); } catch (error) { finish(reject, error); }
            });
        };

        const TABLE_NAMES = [
            'questions',
            'images',
            'customTemplates',
            'personalKnowledge',
            'externalQuestions',
            'importBatches',
            'mergeBatches',
            'draftImportBatches',
            'draftImportFiles',
            'draftQuestions',
            'draftImages',
            'handoutEntries'
        ];

        const PREFERENCE_KEYS = Object.freeze(['qisi_exam_cart', 'qisi_exam_question_meta', 'qisi_exam_config',
            'qisi_exam_group_config', 'qisi_exam_template', 'qisi_teacher_name', 'qisi_template',
            'qisi_template_overrides', 'qisi_draft_v2', 'qisi_export_mode', 'qisi_last_view']);
        const snapshotPreferences = (storage = globalThis.localStorage) => !storage ? undefined :
            Object.fromEntries(PREFERENCE_KEYS.map(key => [key, storage.getItem(key)]));
        const restorePreferences = (preferences, storage = globalThis.localStorage) => {
            if (preferences === undefined) return () => {};
            if (!storage) throw new Error('Local preferences storage is unavailable');
            const original = snapshotPreferences(storage);
            const apply = values => { for (const [key, value] of Object.entries(values)) {
                if (!PREFERENCE_KEYS.includes(key) || (value !== null && typeof value !== 'string')) throw new Error('Invalid backup preferences');
                if (value === null) storage.removeItem(key); else storage.setItem(key, value);
            } };
            try { apply(preferences); } catch (cause) { apply(original); throw cause; }
            return () => apply(original);
        };

        const safeName = value =>
            String(value || 'item')
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .slice(0, 120);

        const mimeExtension = mime => ({
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg'
        }[String(mime || '').toLowerCase()] || 'bin');

        const downloadBlob = (blob, filename) => {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');

            anchor.href = url;
            anchor.download = filename;

            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1500);
        };

        const readZipJson = async (zip, path) => {
            const file = zip.file(path);

            if (!file) {
                throw new Error(`Backup is missing file: ${path}`);
            }

            const text = await (await globalThis.Qisi.ArchiveSecurity.readCheckedEntry(file)).text();

            try {
                return JSON.parse(text);
            } catch (error) {
                throw new Error(`Backup file is not valid JSON: ${path}`);
            }
        };

        const encodeBinaryFields = (row, table, rowIndex, addEntry, references) => {
            const walk = (value, path = []) => {
                if (path.length > 64) throw new Error('Backup metadata nesting limit exceeded');
                if (value instanceof Blob) {
                    const file = `image-blobs/extra-${table}-${rowIndex}-${references.length}.bin`;
                    addEntry(file, value);
                    references.push({ table, rowIndex, path, file, type: value.type, size: value.size });
                    return null;
                }
                if (Array.isArray(value)) return value.map((item, index) => walk(item, [...path, String(index)]));
                if (value && Object.getPrototypeOf(value) === Object.prototype) {
                    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, [...path, key])]));
                }
                return value;
            };
            return walk(row);
        };

        const snapshotDatabase = async db => {
            if (!db?.transaction || !db?.table) throw new Error('Missing transactional database instance');
            const existing = new Set(db.tables.map(table => table.name));
            if (!existing.has('questions') || !existing.has('images')) throw new Error('Required backup tables missing');
            const names = TABLE_NAMES.filter(name => existing.has(name));
            // Only IndexedDB reads run here; compression and Blob I/O run after it commits.
            return db.transaction('r', names.map(name => db.table(name)), async () => {
                const values = await Promise.all(names.map(name => db.table(name).toArray()));
                return Object.fromEntries(names.map((name, index) => [name, values[index]]));
            });
        };

        // 备份只有一个标准：能通过恢复时的全部校验，才算备份。
        // 以前这里有个 generatedHere 开关，对自己刚生成的文件把上限全设为 Infinity，
        // 于是出现「备份成功、校验通过、真要恢复时被拒」——等于给老师假的救命绳。
        // 现在删掉这个例外：自己生成的也必须过同一道闸。
        const inspectBackup = async (blob, { restore = false } = {}) => {
            if (!(blob instanceof Blob)) throw new Error('Backup verification target is not a Blob');
            const archive = globalThis.Qisi.ArchiveSecurity;
            const policy = archive.createArchivePolicy('full-backup');
            const zip = await globalThis.Qisi.ArchiveSecurity.openBlob(blob, 'full-backup');
            const errors = [], warnings = [], missingBlobFiles = [], tables = {};
            const manifest = await readZipJson(zip, 'manifest.json');
            if (manifest?.format !== 'qisi-full-backup' || ![1, 2].includes(manifest?.version) ||
                !manifest.tables || typeof manifest.tables !== 'object' || Array.isArray(manifest.tables)) {
                throw new Error('Unsupported full backup manifest');
            }
            if (manifest.preferences !== undefined && (!manifest.preferences || typeof manifest.preferences !== 'object' ||
                Array.isArray(manifest.preferences) || Object.entries(manifest.preferences).some(([key, value]) =>
                    !PREFERENCE_KEYS.includes(key) || (value !== null && typeof value !== 'string')))) errors.push('Invalid backup preferences');
            for (const required of ['questions', 'images']) {
                if (!Object.hasOwn(manifest.tables, required)) errors.push(`Required table missing: ${required}`);
            }
            const tableFiles = new Set();
            for (const name of Object.keys(manifest.tables)) {
                if (!TABLE_NAMES.includes(name)) { errors.push(`Unknown backup table: ${name}`); continue; }
                const table = manifest.tables[name];
                const parts = manifest.version === 2 ? (table?.parts ?? 1) : 1;
                const count = table?.count;
                if (!Number.isSafeInteger(parts) || parts < 1 || parts > policy.maxEntries ||
                    !Number.isSafeInteger(count) || count < 0) {
                    errors.push(`Table count or shape mismatch: ${name}`); continue;
                }
                const ids = new Set();
                const rows = [];
                for (let index = 0; index < parts; index++) {
                    const path = tablePath(name, index);
                    tableFiles.add(path);
                    const values = await readZipJson(zip, path);
                    if (!Array.isArray(values) || values.length + rows.length > count) {
                        errors.push(`Table count or shape mismatch: ${name}`); break;
                    }
                    for (const row of values) {
                        const validId = typeof row?.id === 'string' ? row.id.trim().length > 0 :
                            typeof row?.id === 'number' && Number.isFinite(row.id);
                        if (!row || typeof row !== 'object' || Array.isArray(row) || !validId || ids.has(row.id)) {
                            errors.push(`Invalid or duplicate record ID: ${name}`); break;
                        }
                        ids.add(row.id);
                        rows.push(row);
                    }
                }
                if (rows.length !== count) errors.push(`Table count or shape mismatch: ${name}`);
                tables[name] = rows;
            }
            for (const file of Object.values(zip.files)) {
                if (!file.dir && file.name.startsWith('tables/') && !tableFiles.has(file.name)) errors.push('Unlisted table file');
            }
            const images = tables.images || [], blobRefs = new Set();
            for (const [index, image] of images.entries()) {
                if (!image || typeof image !== 'object') continue;
                const { blobFile: file, blobType, blobSize, ...metadata } = image;
                if (!file) { warnings.push('Image record has no Blob file'); if (restore) images[index] = metadata; continue; }
                if (typeof file !== 'string' || !/^image-blobs\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp|svg|bmp|bin)$/i.test(file) ||
                    !zip.file(file) || blobRefs.has(file)) {
                    missingBlobFiles.push({ imageId: image.id, blobFile: file }); continue;
                }
                blobRefs.add(file);
                const entry = zip.file(file);
                if (!Number.isSafeInteger(blobSize) || blobSize !== entry.uncompressedSize ||
                    typeof blobType !== 'string') { errors.push('Image Blob metadata mismatch'); continue; }
                const checked = await archive.readCheckedEntry(entry, { collect: restore, type: blobType });
                if (restore) images[index] = { ...metadata, blob: checked };
            }
            if (missingBlobFiles.length) errors.push('Missing, duplicate or invalid image Blob references');
            if (manifest.tables.images?.blobCount !== blobRefs.size) errors.push('Image Blob count mismatch');
            const fields = manifest.binaryFields || [];
            if (!Array.isArray(fields) || (fields.length && manifest.binaryEncoding !== 'qisi.blob-fields.v1')) {
                errors.push('Unsupported binary field encoding');
            } else {
                const paths = new Set();
                for (const reference of fields) {
                    const { table, rowIndex, path, file, type, size } = reference || {};
                    let target = tables[table]?.[rowIndex];
                    if (!TABLE_NAMES.includes(table) || !Number.isInteger(rowIndex) || rowIndex < 0 ||
                        !Array.isArray(path) || !path.length || path.length > 64 ||
                        !path.every(key => typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key)) ||
                        typeof file !== 'string' || !/^image-blobs\/[a-zA-Z0-9._-]+\.bin$/.test(file) ||
                        !zip.file(file) || blobRefs.has(file) || typeof type !== 'string' || !Number.isSafeInteger(size) || size < 0) {
                        errors.push('Invalid binary field reference'); continue;
                    }
                    for (const key of path.slice(0, -1)) {
                        target = target && typeof target === 'object' && Object.hasOwn(target, key) ? target[key] : null;
                    }
                    const key = path.at(-1), identity = JSON.stringify([table, rowIndex, path]);
                    if (!target || typeof target !== 'object' || !Object.hasOwn(target, key) || target[key] !== null || paths.has(identity)) {
                        errors.push('Binary field target is invalid or duplicated'); continue;
                    }
                    const entry = zip.file(file);
                    if (entry.uncompressedSize !== size) { errors.push('Binary field size mismatch'); continue; }
                    const checked = await archive.readCheckedEntry(entry, { collect: restore, type });
                    if (restore) target[key] = checked;
                    paths.add(identity); blobRefs.add(file);
                }
            }
            for (const file of Object.values(zip.files)) {
                if (!file.dir && file.name.startsWith('image-blobs/') && !blobRefs.has(file.name)) errors.push('Unlisted binary file');
            }
            const verification = { ok: !errors.length, errors, warnings, checkedAt: new Date().toISOString(),
                questionCount: tables.questions?.length || 0, imageCount: images.length,
                blobCount: blobRefs.size, missingBlobFiles };
            return { manifest, tables, verification };
        };

        const verifyBackup = async blob => {
            try { return (await inspectBackup(blob)).verification; }
            catch (error) { return { ok: false, errors: [error?.code || error?.message || 'Backup validation failed'], warnings: [], checkedAt: new Date().toISOString() }; }
        };

        const readBackup = async blob => {
            const result = await inspectBackup(blob, { restore: true });
            if (!result.verification.ok) throw new Error('Full backup verification failed: ' + result.verification.errors.join('; '));
            const { tables } = result;
            return { backup: { schemaVersion: 'qisi.storage.v1', createdAt: result.manifest.exportedAt, tables },
                preferences: result.manifest.preferences,
                manifest: result.manifest, verification: result.verification,
                absentTables: TABLE_NAMES.filter(name => !Object.hasOwn(tables, name)) };
        };

        const tablePath = (name, index) => `tables/${name}${index ? '-' + index : ''}.json`;
        const createBackupArchive = async (snapshot, databaseName, preferences) => {
            const binaryFields = [];
            const archive = globalThis.Qisi.ArchiveSecurity;
            const policy = archive.createArchivePolicy('full-backup');
            const entries = [];
            const encoder = new TextEncoder();
            let totalBytes = 0;
            const addEntry = (path, source) => {
                const bytes = source instanceof Blob ? source.size : source.byteLength;
                totalBytes += bytes;
                const code = bytes > policy.maxEntryUncompressedBytes ? 'ARCHIVE_ENTRY_SIZE_LIMIT' :
                    entries.length >= policy.maxEntries ? 'ARCHIVE_ENTRY_COUNT_LIMIT' :
                    totalBytes > policy.maxTotalUncompressedBytes ? 'ARCHIVE_TOTAL_SIZE_LIMIT' : '';
                if (code) throw Object.assign(new Error(code), { code });
                entries.push({ path, source });
            };

            const manifest = {
                format: 'qisi-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                databaseName,
                preferences,
                tables: {},
                binaryEncoding: 'qisi.blob-fields.v1', binaryFields
            };

            for (const tableName of TABLE_NAMES) {
                if (!Object.hasOwn(snapshot, tableName)) continue;
                const rows = snapshot[tableName];
                const table = manifest.tables[tableName] = { count: rows.length };
                let part = 0, items = [], bytes = 2;
                if (tableName === 'images') table.blobCount = 0;
                const flush = () => {
                    addEntry(tablePath(tableName, part++), encoder.encode('[' + items.join(',') + ']'));
                    items = [];
                    bytes = 2;
                };
                for (const [index, record] of rows.entries()) {
                    let row = record;
                    if (tableName === 'images') {
                        const { blob, ...metadata } = record;
                        row = { ...metadata, blobFile: '' };
                        if (blob instanceof Blob) {
                            row.blobFile = `image-blobs/${safeName(record.id)}-${index}.${mimeExtension(blob.type)}`;
                            row.blobType = blob.type || '';
                            row.blobSize = blob.size;
                            table.blobCount++;
                            addEntry(row.blobFile, blob);
                        }
                    }
                    const json = JSON.stringify(encodeBinaryFields(row, tableName, index, addEntry, binaryFields));
                    const size = encoder.encode(json).byteLength;
                    if (items.length && bytes + size + 1 > 8 * 1024 * 1024) flush();
                    bytes += size + (items.length ? 1 : 0);
                    items.push(json);
                }
                flush();
                if (part > 1) { manifest.version = 2; table.parts = part; }
            }
            addEntry('manifest.json', encoder.encode(JSON.stringify(manifest)));
            let blob;
            try {
                blob = await archive.writeBlob(entries, 'full-backup');
            } catch (error) {
                if (error?.code !== 'ARCHIVE_COMPRESSION_RATIO_LIMIT') throw error;
                blob = await archive.writeBlob(entries, 'full-backup', { store: true });
            }
            const { verification } = await inspectBackup(blob);

            console.log('[QISI_BACKUP][verification]', verification);

            if (!verification.ok) {
                throw new Error(
                    `Full backup verification failed: ${verification.errors.join('; ')}`
                );
            }

            const filename = `qisi-full-backup-${Date.now()}.zip`;

            manifest.verification = verification;
            manifest.filename = filename;
            return { blob, filename, manifest };
        };

        const createFullDatabaseBackup = async db => {
            const snapshot = await snapshotDatabase(db);
            const result = await archiveWork('create', [snapshot, db.name || '', snapshotPreferences()], createBackupArchive);
            return { ...result, snapshot };
        };
        const verifyFullDatabaseBackupBlob = blob => archiveWork('verify', [blob], verifyBackup);
        const readFullDatabaseBackupBlob = blob => archiveWork('read', [blob], readBackup);
        if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
            const operations = new Map([['create', createBackupArchive], ['verify', verifyBackup], ['read', readBackup]]);
            globalThis.addEventListener('message', async ({ data }) => {
                try {
                    const value = await operations.get(data.kind)(...data.args);
                    globalThis.postMessage({ ok: true, value });
                } catch (error) {
                    globalThis.postMessage({ ok: false, message: error?.message || '备份处理失败。', code: error?.code });
                }
            });
        }

        const exportFullDatabaseBackup = async db => {
            const result = await createFullDatabaseBackup(db);
            downloadBlob(result.blob, result.filename);
            return result.manifest;
        };

        const getLastFullBackupReport = () => {
            try {
                const raw = localStorage.getItem('qisi_last_full_backup_report');
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                console.warn('[QISI_BACKUP][read-report-failed]', error);
                return null;
            }
        };

        const hasRecentFullBackup = (
            maxAgeMs = 24 * 60 * 60 * 1000
        ) => {
            const timestamp = Number(
                localStorage.getItem('qisi_last_verified_full_backup_at') || 0
            );

            return (
                timestamp > 0 &&
                Date.now() - timestamp < maxAgeMs
            );
        };

        return {
            PREFERENCE_KEYS, snapshotPreferences, restorePreferences,
            TABLE_NAMES: Object.freeze([...TABLE_NAMES]),
            snapshotDatabase,
            createFullDatabaseBackup,
            readFullDatabaseBackupBlob,
            exportFullDatabaseBackup,
            verifyFullDatabaseBackupBlob,
            getLastFullBackupReport,
            hasRecentFullBackup
        };
    }
);
