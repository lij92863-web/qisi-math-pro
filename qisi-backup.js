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

        const REQUIRED_BACKUP_FILES = [
            'manifest.json',
            'tables/questions.json',
            'tables/images.json'
        ];

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

        const verifyFullDatabaseBackupBlob = async blob => {
            if (!(blob instanceof Blob)) {
                throw new Error('Backup verification target is not a Blob');
            }

            if (!globalThis.JSZip) {
                throw new Error('JSZip is not loaded; backup cannot be verified');
            }

            const zip = await globalThis.JSZip.loadAsync(blob);
            const errors = [];
            const warnings = [];

            for (const path of REQUIRED_BACKUP_FILES) {
                if (!zip.file(path)) {
                    errors.push(`Missing required file: ${path}`);
                }
            }

            if (errors.length) {
                return {
                    ok: false,
                    errors,
                    warnings,
                    checkedAt: new Date().toISOString()
                };
            }

            let manifest;
            let questions;
            let images;

            try {
                manifest = await readZipJson(zip, 'manifest.json');
                questions = await readZipJson(zip, 'tables/questions.json');
                images = await readZipJson(zip, 'tables/images.json');
            } catch (error) {
                errors.push(error?.message || String(error));
                return {
                    ok: false,
                    errors,
                    warnings,
                    checkedAt: new Date().toISOString()
                };
            }

            if (manifest?.format !== 'qisi-full-backup') {
                errors.push('manifest.format is invalid');
            }

            if (Number(manifest?.version) !== 1) {
                errors.push(`Unsupported backup version: ${manifest?.version}`);
            }

            if (!Array.isArray(questions)) {
                errors.push('tables/questions.json is not an array');
            }

            if (!Array.isArray(images)) {
                errors.push('tables/images.json is not an array');
            }

            const missingBlobFiles = [];

            for (const image of images || []) {
                const blobFile = String(image?.blobFile || '').trim();

                if (!blobFile) {
                    warnings.push(`Image ${image?.id || 'unknown'} has no Blob file`);
                    continue;
                }

                if (!zip.file(blobFile)) {
                    missingBlobFiles.push({
                        imageId: image?.id || '',
                        blobFile
                    });
                }
            }

            if (missingBlobFiles.length) {
                errors.push(`${missingBlobFiles.length} image Blob files are missing`);
            }

            const expectedQuestionCount = Number(manifest?.tables?.questions?.count);

            if (
                Number.isFinite(expectedQuestionCount) &&
                expectedQuestionCount !== questions.length
            ) {
                errors.push(
                    `Question count mismatch: manifest=${expectedQuestionCount}, questions.json=${questions.length}`
                );
            }

            const expectedImageCount = Number(manifest?.tables?.images?.count);

            if (
                Number.isFinite(expectedImageCount) &&
                expectedImageCount !== images.length
            ) {
                errors.push(
                    `Image count mismatch: manifest=${expectedImageCount}, images.json=${images.length}`
                );
            }

            const actualBlobCount = images.filter(
                image => image?.blobFile && zip.file(image.blobFile)
            ).length;

            const expectedBlobCount = Number(manifest?.tables?.images?.blobCount);

            if (
                Number.isFinite(expectedBlobCount) &&
                expectedBlobCount !== actualBlobCount
            ) {
                errors.push(
                    `Image Blob count mismatch: manifest=${expectedBlobCount}, actual=${actualBlobCount}`
                );
            }

            return {
                ok: errors.length === 0,
                errors,
                warnings,
                checkedAt: new Date().toISOString(),
                questionCount: Array.isArray(questions) ? questions.length : 0,
                imageCount: Array.isArray(images) ? images.length : 0,
                blobCount: actualBlobCount,
                missingBlobFiles
            };
        };

        const exportFullDatabaseBackup = async db => {
            if (!db) {
                throw new Error('Missing database instance');
            }

            if (!globalThis.JSZip) {
                throw new Error('JSZip is not loaded');
            }

            const zip = new globalThis.JSZip();

            const manifest = {
                format: 'qisi-full-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                databaseName: db.name || '',
                tables: {}
            };

            const existingNames = new Set(
                db.tables.map(table => table.name)
            );

            for (const tableName of TABLE_NAMES) {
                if (!existingNames.has(tableName)) {
                    continue;
                }

                const rows = await db.table(tableName).toArray();

                if (tableName !== 'images') {
                    zip.file(
                        `tables/${tableName}.json`,
                        JSON.stringify(rows, null, 2)
                    );

                    manifest.tables[tableName] = {
                        count: rows.length
                    };

                    continue;
                }

                const imageRows = [];

                for (const record of rows) {
                    const { blob, ...metadata } = record;
                    const next = {
                        ...metadata,
                        blobFile: ''
                    };

                    if (blob instanceof Blob) {
                        const extension = mimeExtension(blob.type);
                        const blobFile = `image-blobs/${safeName(record.id)}.${extension}`;

                        zip.file(blobFile, blob);

                        next.blobFile = blobFile;
                        next.blobType = blob.type || '';
                        next.blobSize = blob.size || 0;
                    }

                    imageRows.push(next);
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

            const blob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });

            const verification = await verifyFullDatabaseBackupBlob(blob);

            console.log('[QISI_BACKUP][verification]', verification);

            if (!verification.ok) {
                throw new Error(
                    `Full backup verification failed: ${verification.errors.join('; ')}`
                );
            }

            const filename = `tex-question-bank-backup-${Date.now()}.zip`;

            downloadBlob(blob, filename);

            localStorage.setItem(
                'qisi_last_full_backup_at',
                String(Date.now())
            );

            localStorage.setItem(
                'qisi_last_full_backup_report',
                JSON.stringify(verification)
            );

            manifest.verification = verification;
            manifest.filename = filename;

            console.log('[QISI_BACKUP][created]', {
                filename,
                manifest
            });

            return manifest;
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
            exportFullDatabaseBackup,
            verifyFullDatabaseBackupBlob,
            getLastFullBackupReport,
            hasRecentFullBackup
        };
    }
);
