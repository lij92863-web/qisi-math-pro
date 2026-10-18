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
            'draftImages'
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
                .replace(/[\\/:*?"<>|]/g, '_')
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

            const text = await file.async('text');

            try {
                return JSON.parse(text);
            } catch (error) {
                throw new Error(`Backup file is not valid JSON: ${path}`);
            }
        };

        const encodeBinaryFields = (row, table, rowIndex, zip, references) => {
            const walk = (value, path = []) => {
                if (path.length > 64) throw new Error('Backup metadata nesting limit exceeded');
                if (value instanceof Blob) {
                    const file = `image-blobs/extra-${table}-${rowIndex}-${references.length}.bin`;
                    zip.file(file, value.arrayBuffer());
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
        const inspectBackup = async blob => {
            if (!(blob instanceof Blob)) throw new Error('Backup verification target is not a Blob');
            if (!globalThis.JSZip) throw new Error('JSZip is not loaded; backup cannot be verified');
            const loaded = await globalThis.Qisi.ArchiveSecurity.load(globalThis.JSZip,
                await blob.arrayBuffer(), 'full-backup', { name: blob.name || '', type: blob.type || '' },
                {});
            // load 失败时返回的是 {ok:false, code}，不是一个 zip。
            // 直接往下走会在 readZipJson 里炸成一条看不懂的异常，
            // 老师会以为是自己电脑坏了。这里把它转成带错误码的正常失败。
            if (!loaded || loaded.ok === false) {
                const error = new Error(loaded?.code || 'ARCHIVE_UNREADABLE');
                error.code = loaded?.code || 'ARCHIVE_UNREADABLE';
                error.details = loaded?.details;
                throw error;
            }
            const zip = loaded;
            const errors = [], warnings = [], missingBlobFiles = [], tables = {};
            const manifest = await readZipJson(zip, 'manifest.json');
            if (manifest?.format !== 'qisi-full-backup' || manifest?.version !== 1 ||
                !manifest.tables || typeof manifest.tables !== 'object' || Array.isArray(manifest.tables)) {
                throw new Error('Unsupported full backup manifest');
            }
            if (manifest.preferences !== undefined && (!manifest.preferences || typeof manifest.preferences !== 'object' ||
                Array.isArray(manifest.preferences) || Object.entries(manifest.preferences).some(([key, value]) =>
                    !PREFERENCE_KEYS.includes(key) || (value !== null && typeof value !== 'string')))) errors.push('Invalid backup preferences');
            for (const required of ['questions', 'images']) {
                if (!Object.hasOwn(manifest.tables, required)) errors.push(`Required table missing: ${required}`);
            }
            for (const name of Object.keys(manifest.tables)) {
                if (!TABLE_NAMES.includes(name)) { errors.push(`Unknown backup table: ${name}`); continue; }
                const rows = await readZipJson(zip, `tables/${name}.json`);
                const count = manifest.tables[name]?.count;
                if (!Array.isArray(rows) || !Number.isSafeInteger(count) || count < 0 || count !== rows.length) {
                    errors.push(`Table count or shape mismatch: ${name}`); continue;
                }
                const ids = new Set();
                for (const row of rows) {
                    const validId = typeof row?.id === 'string' ? row.id.trim().length > 0 :
                        typeof row?.id === 'number' && Number.isFinite(row.id);
                    const key = typeof row?.id + ':' + row?.id;
                    if (!row || typeof row !== 'object' || Array.isArray(row) || !validId || ids.has(key)) {
                        errors.push(`Invalid or duplicate record ID: ${name}`); break;
                    }
                    ids.add(key);
                }
                tables[name] = rows;
            }
            for (const file of Object.values(zip.files)) {
                const match = /^tables\/(.+)\.json$/.exec(file.name);
                if (!file.dir && match && !Object.hasOwn(manifest.tables, match[1])) errors.push('Unlisted table file');
            }
            const images = tables.images || [], blobRefs = new Set();
            for (const image of images) {
                const file = image.blobFile || '';
                if (!file) { warnings.push('Image record has no Blob file'); continue; }
                if (typeof file !== 'string' || !/^image-blobs\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp|svg|bmp|bin)$/i.test(file) ||
                    !zip.file(file) || blobRefs.has(file)) {
                    missingBlobFiles.push({ imageId: image.id, blobFile: file }); continue;
                }
                blobRefs.add(file);
                const bytes = await zip.file(file).async('uint8array');
                if (!Number.isSafeInteger(image.blobSize) || image.blobSize !== bytes.byteLength ||
                    typeof image.blobType !== 'string') errors.push('Image Blob metadata mismatch');
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
                    if ((await zip.file(file).async('uint8array')).byteLength !== size) errors.push('Binary field size mismatch');
                    paths.add(identity); blobRefs.add(file);
                }
            }
            const verification = { ok: !errors.length, errors, warnings, checkedAt: new Date().toISOString(),
                questionCount: tables.questions?.length || 0, imageCount: images.length,
                blobCount: blobRefs.size, missingBlobFiles };
            return { zip, manifest, tables, verification };
        };

        const verifyFullDatabaseBackupBlob = async blob => {
            try { return (await inspectBackup(blob)).verification; }
            catch (error) { return { ok: false, errors: [error?.code || error?.message || 'Backup validation failed'], warnings: [], checkedAt: new Date().toISOString() }; }
        };

        const readFullDatabaseBackupBlob = async blob => {
            const result = await inspectBackup(blob);
            if (!result.verification.ok) throw new Error('Full backup verification failed: ' + result.verification.errors.join('; '));
            const tables = { ...result.tables };
            for (const { table, rowIndex, path, file, type } of result.manifest.binaryFields || []) {
                let target = tables[table][rowIndex];
                for (const key of path.slice(0, -1)) target = target[key];
                target[path.at(-1)] = new Blob([await result.zip.file(file).async('uint8array')], { type });
            }
            tables.images = await Promise.all(tables.images.map(async row => {
                const { blobFile, blobType, blobSize, ...metadata } = row;
                if (!blobFile) return metadata;
                const bytes = await result.zip.file(blobFile).async('uint8array');
                return { ...metadata, blob: new Blob([bytes], { type: blobType }) };
            }));
            return { backup: { schemaVersion: 'qisi.storage.v1', createdAt: result.manifest.exportedAt, tables },
                preferences: result.manifest.preferences,
                manifest: result.manifest, verification: result.verification,
                absentTables: TABLE_NAMES.filter(name => !Object.hasOwn(tables, name)) };
        };

        const createFullDatabaseBackup = async db => {
            if (!db) {
                throw new Error('Missing database instance');
            }

            if (!globalThis.JSZip) {
                throw new Error('JSZip is not loaded');
            }

            const zip = new globalThis.JSZip();
            const binaryFields = [];

            const manifest = {
                format: 'qisi-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                databaseName: db.name || '',
                preferences: snapshotPreferences(),
                tables: {},
                binaryEncoding: 'qisi.blob-fields.v1', binaryFields
            };

            const snapshot = await snapshotDatabase(db);
            const existingNames = new Set(Object.keys(snapshot));

            for (const tableName of TABLE_NAMES) {
                if (!existingNames.has(tableName)) {
                    continue;
                }

                const rows = snapshot[tableName];

                if (tableName !== 'images') {
                    zip.file(
                        `tables/${tableName}.json`,
                        JSON.stringify(rows.map((row, index) => encodeBinaryFields(row, tableName, index, zip, binaryFields)), null, 2)
                    );

                    manifest.tables[tableName] = {
                        count: rows.length
                    };

                    continue;
                }

                const imageRows = [];

                for (const [index, record] of rows.entries()) {
                    const { blob, ...metadata } = record;
                    const next = {
                        ...metadata,
                        blobFile: ''
                    };

                    if (blob instanceof Blob) {
                        const extension = mimeExtension(blob.type);
                        const blobFile = `image-blobs/${safeName(record.id)}-${index}.${extension}`;

                        zip.file(blobFile, blob.arrayBuffer());

                        next.blobFile = blobFile;
                        next.blobType = blob.type || '';
                        next.blobSize = blob.size || 0;
                    }

                    imageRows.push(encodeBinaryFields(next, tableName, index, zip, binaryFields));
                }

                zip.file(
                    'tables/images.json',
                    JSON.stringify(imageRows, null, 2)
                );

                manifest.tables.images = {
                    count: imageRows.length,
                    blobCount: imageRows.filter(row => row.blobFile).length
                };
            }

            zip.file(
                'manifest.json',
                JSON.stringify(manifest, null, 2)
            );

            // 生成方必须主动满足校验方，而不是给自己发一张免检证。
            //
            // 一个备份唯一的用处是「将来能恢复」，所以创建时的校验和恢复时的校验
            // 必须是同一套。以前的做法是创建时把上限全设成 Infinity，
            // 于是出现「备份成功、校验通过、真要恢复时被拒」。
            //
            // 但直接把上限统一也有代价：极少数内容（例如题干里出现上兆的重复字符）
            // 压缩比会超过 100，属于安全上的压缩炸弹特征，此时不该放宽限制，
            // 而应降级为不压缩重新打包 —— 备份要的是能恢复，不是省那点空间。
            const buildBlob = async compression => {
                const bytes = await zip.generateAsync(compression === 'STORE'
                    ? { type: 'uint8array', compression: 'STORE' }
                    : { type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
                return new Blob([bytes], { type: 'application/zip' });
            };

            let blob = await buildBlob('DEFLATE');
            let verification;
            try {
                verification = (await inspectBackup(blob)).verification;
            } catch (error) {
                if (error?.code !== 'ARCHIVE_COMPRESSION_RATIO_LIMIT') throw error;
                console.warn('[QISI_BACKUP][compression-fallback] 压缩比超过安全上限，改用不压缩重打包');
                blob = await buildBlob('STORE');
                verification = (await inspectBackup(blob)).verification;
            }

            console.log('[QISI_BACKUP][verification]', verification);

            if (!verification.ok) {
                throw new Error(
                    `Full backup verification failed: ${verification.errors.join('; ')}`
                );
            }

            const filename = `qisi-full-backup-${Date.now()}.zip`;

            manifest.verification = verification;
            manifest.filename = filename;
            return { blob, filename, manifest, snapshot };
        };

        const exportFullDatabaseBackup = async db => {
            const result = await createFullDatabaseBackup(db);
            downloadBlob(result.blob, result.filename);
            localStorage.setItem('qisi_last_full_backup_at', String(Date.now()));
            localStorage.setItem('qisi_last_full_backup_report', JSON.stringify(result.manifest.verification));
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
                localStorage.getItem('qisi_last_full_backup_at') || 0
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
