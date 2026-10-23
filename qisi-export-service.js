(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ExportService = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    class ExportError extends Error {
        constructor(code, message, cause = null) {
            super(message);
            this.name = 'ExportError';
            this.code = code;
            this.stage = 'export';
            this.recoverable = code !== 'invalid-question';
            this.cause = cause;
        }
    }

    const safeFilename = value => String(value || '题库数据')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60);

    const rekeyQuestionImageTokens = (question, imageIdMap) => {
        const rekey = value => typeof value !== 'string' ? value : value.replace(
            /\[\[(IMAGE|FORMULA_IMAGE):([^\]\r\n]+)\]\]|(\\includegraphics(?:\[[^\]]*\])?\{)([^}]+)\}/g,
            (whole, kind, tokenId, prefix, graphicsId) => {
                const oldId = tokenId ?? graphicsId;
                if (!imageIdMap.has(oldId)) return whole;
                const nextId = imageIdMap.get(oldId);
                return kind ? `[[${kind}:${nextId}]]` : `${prefix}${nextId}}`;
            });
        const next = { ...question };
        for (const field of ['stem', 'answer', 'solution']) {
            if (Object.prototype.hasOwnProperty.call(question, field)) next[field] = rekey(question[field]);
        }
        if (Array.isArray(question.options)) next.options = question.options.map(rekey);
        return next;
    };

    const createPackageService = ({ loadArchive, listImportBatches, coreFingerprint, stemFingerprint,
        clock = Date.now, random = Math.random }) => {
        const read = async (file) => {
            const zip = await loadArchive(file);
            const manifestText = await zip.file('manifest.json')?.async('string');
            const questionsText = await zip.file('questions.json')?.async('string');
            if (!questionsText) throw new Error('题库数据包格式不正确：缺少 questions.json。');
        
            const manifest = manifestText ? JSON.parse(manifestText) : {};
            const rawQuestions = JSON.parse(questionsText);
            if (!Array.isArray(rawQuestions)) throw new Error('题库数据包格式不正确：questions.json 不是数组。');
        
            const sourceTeacher = manifest?.createdBy?.name || '外部教师';
            const batchTitle = manifest?.title || file.name.replace(/\.zip$/i, '') || '导入题库';
            const exportedAt = manifest?.exportedAt || '';
            const imagePayloads = [];
            const preparedQuestions = [];
        
            let importOrder = 0;
            for (const raw of rawQuestions) {
                const cleanImages = [];
                for (const img of raw.images || []) {
                    const oldId = img.id;
                    const newImgId = `img_pending_${importOrder}_${cleanImages.length}`;
                    const filePath = img.file || (oldId ? `images/${oldId}.png` : '');
                    const imgFile = filePath ? zip.file(filePath) : null;
                    if (!imgFile) throw new Error('题库包缺少图片文件：' + filePath);
                    if (imgFile) {
                        imagePayloads.push({ tempId: newImgId, oldId, filePath, blob: await imgFile.async('blob') });
                    }
                    cleanImages.push({ ...img, tempId: newImgId, oldId, align: img.align || 'center' });
                }
                preparedQuestions.push({ raw, cleanImages, importOrder });
                importOrder += 1;
            }
        
            const duplicateCandidates = await listImportBatches();
            const mayDuplicate = duplicateCandidates.some(batch => {
                const sameTeacher = (batch.sourceTeacher || '') === sourceTeacher;
                const sameTitle = (batch.title || '') === batchTitle;
                const sameCount = Number(batch.questionCount || 0) === rawQuestions.length;
                const sameExport = exportedAt && batch.exportedAt && Math.abs(new Date(batch.exportedAt).getTime() - new Date(exportedAt).getTime()) < 60 * 1000;
                return sameTeacher && sameTitle && sameCount && (!exportedAt || sameExport);
            });
        
            return {
                file,
                manifest,
                rawQuestions,
                preparedQuestions,
                imagePayloads,
                sourceTeacher,
                batchTitle,
                exportedAt,
                schemaVersion: manifest?.schemaVersion || 'unknown',
                mayDuplicate
            };
        };
        const project = parsedPackage => {
            const { file, rawQuestions, preparedQuestions, imagePayloads, sourceTeacher,
                batchTitle, exportedAt, schemaVersion } = parsedPackage;
            const importedAt = clock();
            const batchId = `batch_${importedAt}_${random().toString(36).slice(2, 8)}`;
            const batch = { id: batchId, sourceTeacher, title: batchTitle, fileName: file.name,
                importedAt, questionCount: rawQuestions.length, imageCount: imagePayloads.length,
                exportedAt, schemaVersion, importStatus: 'success' };
            const imageIdMap = new Map();
            imagePayloads.forEach((image, index) => {
                if (imageIdMap.has(image.tempId)) throw new Error('题库图片临时标识重复，无法安全导入。');
                // Index makes IDs distinct within this package even when source IDs repeat.
                imageIdMap.set(image.tempId, `ext_${batchId}_${index}_${image.oldId || 'image'}`);
            });
            const imageRows = imagePayloads.map(image => ({
                id: imageIdMap.get(image.tempId), blob: image.blob, createdAt: importedAt
            }));
            const questionRows = preparedQuestions.map(prepared => {
                const { raw, importOrder } = prepared;
                const sourceQuestionId = raw.id || `source_${importOrder}`;
                const extId = `ext_${batchId}_${sourceQuestionId}_${importOrder}`;
                const cleanImages = prepared.cleanImages.map(image => {
                    const id = imageIdMap.get(image.tempId);
                    if (!id) throw new Error('题库图片缺少已读取的字节，无法安全导入。');
                    return { ...image, id, align: image.align || 'center' };
                });
                const tokenIds = new Map();
                for (const image of cleanImages) {
                    for (const oldId of [image.oldId, image.file].filter(Boolean)) {
                        if (tokenIds.has(oldId) && tokenIds.get(oldId) !== image.id) {
                            throw new Error('题库图片标识冲突，无法确定正文引用：' + oldId);
                        }
                        tokenIds.set(oldId, image.id);
                    }
                }
                const external = {
                    ...rekeyQuestionImageTokens(raw, tokenIds),
                    id: extId, sourceQuestionId, sourceTeacher, batchId, importOrder, importedAt,
                    processStatus: 'unprocessed', detectedStatus: '', linkedQuestionId: '', images: cleanImages,
                    meta: { ...(raw.meta || {}), external: true, sourceTeacher, batchId },
                    sourceFingerprint: coreFingerprint(raw), sourceStemFingerprint: stemFingerprint(raw)
                };
                delete external.exportFingerprint;
                delete external.exportStemFingerprint;
                return external;
            });
            return { batch, images: imageRows, questions: questionRows };
        };

        return Object.freeze({ read, project });
    };

    const createExportService = ({
        coreFingerprint = () => '',
        stemFingerprint = () => '',
        resolveImages = async () => [],
        clock = () => new Date()
    } = {}) => {
        const build = async (
            questions,
            {
                teacherName = '我的题库',
                signal,
                onProgress = () => {}
            } = {}
        ) => {
            if (!Array.isArray(questions)) {
                throw new ExportError(
                    'invalid-question',
                    'Questions must be an array.'
                );
            }
            const ensureActive = () => {
                if (signal?.aborted) {
                    throw new ExportError('cancelled', 'Export was cancelled.');
                }
            };
            ensureActive();
            const imageIds = new Set();
            const mappedQuestions = questions.map((question, index) => {
                ensureActive();
                if (!question || typeof question !== 'object' || !question.id) {
                    throw new ExportError(
                        'invalid-question',
                        `Question at index ${index} is invalid.`
                    );
                }
                const copy = JSON.parse(JSON.stringify(question));
                copy.images = Array.isArray(copy.images)
                    ? copy.images.filter(image => image?.id).map(image => {
                        imageIds.add(image.id);
                        // Retain portable source/crop metadata; runtime URLs and bytes live outside JSON.
                        const { url, blob, ...metadata } = image;
                        return {
                            ...metadata,
                            id: image.id,
                            align: image.align || 'center',
                            file: `images/${image.id}.png`
                        };
                    })
                    : [];
                copy.exportFingerprint = coreFingerprint(copy);
                copy.exportStemFingerprint = stemFingerprint(copy);
                onProgress({ stage: 'mapping', completed: index + 1, total: questions.length });
                return copy;
            });
            ensureActive();
            let imageRows;
            try {
                imageRows = await resolveImages([...imageIds]);
            } catch (error) {
                throw new ExportError(
                    'image-resolution-failed',
                    error?.message || 'Image resolution failed.',
                    error
                );
            }
            ensureActive();
            const resolvedIds = new Set(
                (imageRows || []).filter(row => row?.blob).map(row => row.id)
            );
            const missingImageIds = [...imageIds].filter(id => !resolvedIds.has(id));
            const now = clock();
            const iso = now.toISOString();
            const date = iso.slice(0, 10).replace(/-/g, '');
            onProgress({ stage: 'complete', completed: questions.length, total: questions.length });
            return {
                manifest: {
                    schemaVersion: '1.0',
                    packageType: 'qisi-question-bank',
                    exportedAt: iso,
                    createdBy: { name: teacherName },
                    questionCount: mappedQuestions.length
                },
                questions: mappedQuestions,
                images: (imageRows || []).filter(row => row?.blob),
                missingImageIds,
                filename: `高中数学题库数据_${safeFilename(teacherName)}_${date}.zip`
            };
        };

        return Object.freeze({ build });
    };

    return Object.freeze({ ExportError, safeFilename, rekeyQuestionImageTokens, createPackageService, createExportService });
});
