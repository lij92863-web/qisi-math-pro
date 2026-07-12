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
                        return {
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

    return Object.freeze({ ExportError, safeFilename, createExportService });
});
