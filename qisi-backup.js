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
            'draftImages',
            'handouts',
            'handoutAssets',
            'handoutRevisions'
        ];

        const BLOB_TABLES = Object.freeze({
            images: Object.freeze({
                directory: 'image-blobs',
                requireBlob: false
            }),
            handoutAssets: Object.freeze({
                directory: 'handout-asset-blobs',
                requireBlob: true
            })
        });

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

        const collectHandoutAssetIds = handout => {
            const ids = new Set();
            const addImages = images => {
                for (const image of Array.isArray(images) ? images : []) {
                    const assetId = String(image?.assetId || '').trim();
                    if (assetId) ids.add(assetId);
                }
            };

            for (const block of handout?.blocks || []) {
                if (block?.type === 'image') {
                    const assetId = String(block.assetId || '').trim();
                    if (assetId) ids.add(assetId);
                }
                if (block?.type === 'question') {
                    addImages(block.snapshot?.images);
                    addImages(block.images);
                }
            }

            return [...ids];
        };

        const verifyBlobTable = async (
            zip,
            tableName,
            rows,
            warnings
        ) => {
            const policy = BLOB_TABLES[tableName];
            const missingBlobFiles = [];
            const invalidBlobFiles = [];
            let blobCount = 0;

            for (const row of rows || []) {
                const blobFile = String(row?.blobFile || '').trim();

                if (!blobFile) {
                    const message = `${tableName} ${row?.id || 'unknown'} has no Blob file`;
                    if (policy.requireBlob) {
                        missingBlobFiles.push({
                            tableName,
                            recordId: row?.id || '',
                            blobFile: ''
                        });
                    } else {
                        warnings.push(message);
                    }
                    continue;
                }

                const zipEntry = zip.file(blobFile);

                if (!zipEntry) {
                    missingBlobFiles.push({
                        tableName,
                        recordId: row?.id || '',
                        blobFile
                    });
                    continue;
                }

                const bytes = await zipEntry.async('uint8array');
                const expectedSize = Number(row?.blobSize);

                if (
                    bytes.byteLength < 1
                    || (
                        Number.isFinite(expectedSize)
                        && expectedSize !== bytes.byteLength
                    )
                ) {
                    invalidBlobFiles.push({
                        tableName,
                        recordId: row?.id || '',
                        blobFile,
                        expectedSize: Number.isFinite(expectedSize)
                            ? expectedSize
                            : null,
                        actualSize: bytes.byteLength
                    });
                    continue;
                }

                blobCount += 1;
            }

            return {
                blobCount,
                missingBlobFiles,
                invalidBlobFiles
            };
        };

        const verifyHandoutReferences = (
            handouts,
            revisions,
            handoutAssets
        ) => {
            const assetsById = new Map();
            const duplicateAssetIds = [];
            const handoutIds = new Set(
                (handouts || []).map(handout =>
                    String(handout?.id || '').trim()
                ).filter(Boolean)
            );
            const missing = [];
            const ownershipMismatches = [];
            const missingAssetOwners = [];
            const revisionOwnershipMismatches = [];

            for (const asset of handoutAssets || []) {
                const assetId = String(asset?.id || '').trim();
                const ownerId = String(asset?.handoutId || '').trim();

                if (!assetId) continue;
                if (assetsById.has(assetId)) {
                    duplicateAssetIds.push(assetId);
                }
                assetsById.set(assetId, asset);
                if (!handoutIds.has(ownerId)) {
                    missingAssetOwners.push({
                        assetId,
                        handoutId: ownerId
                    });
                }
            }

            const check = (handout, source) => {
                const handoutId = String(handout?.id || '').trim();

                for (const assetId of collectHandoutAssetIds(handout)) {
                    const asset = assetsById.get(assetId);

                    if (!asset) {
                        missing.push({
                            source,
                            handoutId,
                            assetId
                        });
                    } else if (String(asset.handoutId || '') !== handoutId) {
                        ownershipMismatches.push({
                            source,
                            handoutId,
                            assetId,
                            assetHandoutId: String(asset.handoutId || '')
                        });
                    }
                }
            };

            for (const handout of handouts || []) {
                check(handout, 'handouts');
            }
            for (const revision of revisions || []) {
                if (revision?.snapshot) {
                    if (
                        String(revision.handoutId || '').trim()
                        !== String(revision.snapshot.id || '').trim()
                    ) {
                        revisionOwnershipMismatches.push({
                            revisionId: String(revision.id || ''),
                            handoutId: String(revision.handoutId || ''),
                            snapshotHandoutId:
                                String(revision.snapshot.id || '')
                        });
                    }
                    check(revision.snapshot, 'handoutRevisions');
                }
            }

            return {
                missing,
                ownershipMismatches,
                duplicateAssetIds:
                    [...new Set(duplicateAssetIds)].sort(),
                missingAssetOwners,
                revisionOwnershipMismatches
            };
        };

        const verifyFullDatabaseBackupBlob = async blob => {
            if (!(blob instanceof Blob)) {
                throw new Error('Backup verification target is not a Blob');
            }

            if (!globalThis.JSZip) {
                throw new Error('JSZip is not loaded; backup cannot be verified');
            }

            const zip = await globalThis.JSZip.loadAsync(
                await blob.arrayBuffer()
            );
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
            const tableRows = {};

            try {
                manifest = await readZipJson(zip, 'manifest.json');
                const manifestTableNames = Object.keys(
                    manifest?.tables || {}
                );

                for (const tableName of new Set([
                    'questions',
                    'images',
                    ...manifestTableNames
                ])) {
                    tableRows[tableName] = await readZipJson(
                        zip,
                        `tables/${tableName}.json`
                    );
                }
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

            for (const [tableName, rows] of Object.entries(tableRows)) {
                if (!Array.isArray(rows)) {
                    errors.push(`tables/${tableName}.json is not an array`);
                    continue;
                }

                const expectedCount = Number(
                    manifest?.tables?.[tableName]?.count
                );

                if (
                    Number.isFinite(expectedCount)
                    && expectedCount !== rows.length
                ) {
                    errors.push(
                        `${tableName} count mismatch: manifest=${expectedCount}, actual=${rows.length}`
                    );
                }
            }

            const blobReports = {};
            const missingBlobFiles = [];
            const invalidBlobFiles = [];

            for (const tableName of Object.keys(BLOB_TABLES)) {
                const rows = tableRows[tableName];
                if (!Array.isArray(rows)) continue;

                const report = await verifyBlobTable(
                    zip,
                    tableName,
                    rows,
                    warnings
                );
                blobReports[tableName] = report;
                missingBlobFiles.push(...report.missingBlobFiles);
                invalidBlobFiles.push(...report.invalidBlobFiles);

                const expectedBlobCount = Number(
                    manifest?.tables?.[tableName]?.blobCount
                );

                if (
                    Number.isFinite(expectedBlobCount)
                    && expectedBlobCount !== report.blobCount
                ) {
                    errors.push(
                        `${tableName} Blob count mismatch: manifest=${expectedBlobCount}, actual=${report.blobCount}`
                    );
                }
            }

            if (missingBlobFiles.length) {
                errors.push(
                    `${missingBlobFiles.length} referenced Blob files are missing`
                );
            }
            if (invalidBlobFiles.length) {
                errors.push(
                    `${invalidBlobFiles.length} referenced Blob files have invalid byte sizes`
                );
            }

            const handoutReferenceReport = verifyHandoutReferences(
                tableRows.handouts,
                tableRows.handoutRevisions,
                tableRows.handoutAssets
            );

            if (handoutReferenceReport.missing.length) {
                errors.push(
                    `${handoutReferenceReport.missing.length} handout asset references are missing`
                );
            }
            if (handoutReferenceReport.ownershipMismatches.length) {
                errors.push(
                    `${handoutReferenceReport.ownershipMismatches.length} handout asset ownership records are invalid`
                );
            }
            if (handoutReferenceReport.duplicateAssetIds.length) {
                errors.push(
                    `${handoutReferenceReport.duplicateAssetIds.length} handout asset ids are duplicated`
                );
            }
            if (handoutReferenceReport.missingAssetOwners.length) {
                errors.push(
                    `${handoutReferenceReport.missingAssetOwners.length} handout assets have no owning handout`
                );
            }
            if (handoutReferenceReport.revisionOwnershipMismatches.length) {
                errors.push(
                    `${handoutReferenceReport.revisionOwnershipMismatches.length} handout revisions have invalid snapshot ownership`
                );
            }

            return {
                ok: errors.length === 0,
                errors,
                warnings,
                checkedAt: new Date().toISOString(),
                questionCount: Array.isArray(tableRows.questions)
                    ? tableRows.questions.length
                    : 0,
                imageCount: Array.isArray(tableRows.images)
                    ? tableRows.images.length
                    : 0,
                blobCount: blobReports.images?.blobCount || 0,
                handoutCount: Array.isArray(tableRows.handouts)
                    ? tableRows.handouts.length
                    : 0,
                handoutAssetCount: Array.isArray(tableRows.handoutAssets)
                    ? tableRows.handoutAssets.length
                    : 0,
                handoutAssetBlobCount:
                    blobReports.handoutAssets?.blobCount || 0,
                missingBlobFiles,
                invalidBlobFiles,
                handoutReferenceReport
            };
        };

        const createFullDatabaseBackupBlob = async db => {
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

                const blobPolicy = BLOB_TABLES[tableName];

                if (!blobPolicy) {
                    zip.file(
                        `tables/${tableName}.json`,
                        JSON.stringify(rows, null, 2)
                    );

                    manifest.tables[tableName] = {
                        count: rows.length
                    };

                    continue;
                }

                const blobRows = [];

                for (const record of rows) {
                    const { blob, ...metadata } = record;
                    const next = {
                        ...metadata,
                        blobFile: ''
                    };

                    if (blob instanceof Blob) {
                        const extension = mimeExtension(blob.type);
                        const blobFile = `${blobPolicy.directory}/${safeName(record.id)}.${extension}`;

                        zip.file(blobFile, await blob.arrayBuffer());

                        next.blobFile = blobFile;
                        next.blobType = blob.type || '';
                        next.blobSize = blob.size || 0;
                    }

                    blobRows.push(next);
                }

                zip.file(
                    `tables/${tableName}.json`,
                    JSON.stringify(blobRows, null, 2)
                );

                manifest.tables[tableName] = {
                    count: blobRows.length,
                    blobCount: blobRows.filter(row => row.blobFile).length
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

            return {
                blob,
                manifest
            };
        };

        const exportFullDatabaseBackup = async db => {
            const {
                blob,
                manifest
            } = await createFullDatabaseBackupBlob(db);
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
            createFullDatabaseBackupBlob,
            exportFullDatabaseBackup,
            verifyFullDatabaseBackupBlob,
            getLastFullBackupReport,
            hasRecentFullBackup
        };
    }
);
