(function initReviewImageProjection(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewImageProjection = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Display-only projection of draft image rows. Nothing here writes to a draft,
    // mutates a row or touches a Vue instance; the page passes the owning helpers.
    const QUESTION_FIGURE_SOURCES = Object.freeze([
        'auto-figure-crop',
        'pdf-layout-figure-crop',
        'manual-crop',
        'uploaded-question-image',
        'docx-inline-figure'
    ]);

    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    const dependencies = (ports = {}, required = ['isRealFigureRow', 'isPreviewable', 'mergeById']) => {
        const codes = {
            isRealFigureRow: 'REVIEW_IMAGE_PROJECTION_FIGURE_HELPER_REQUIRED',
            isPreviewable: 'REVIEW_IMAGE_PROJECTION_PREVIEW_HELPER_REQUIRED',
            mergeById: 'REVIEW_IMAGE_PROJECTION_MERGE_HELPER_REQUIRED'
        };
        for (const name of required) requireDependency(ports[name], codes[name]);
        return {
            isRealFigureRow: ports.isRealFigureRow,
            isPreviewable: ports.isPreviewable,
            mergeById: ports.mergeById,
            pdfContract: typeof ports.pdfContract === 'function' ? ports.pdfContract : () => null,
            pdfMeta: typeof ports.pdfMeta === 'function' ? ports.pdfMeta : () => null
        };
    };

    const boundFor = (question, boundImages, deps) => boundImages
        .filter(image => image.questionId === question.id)
        .filter(deps.isRealFigureRow);

    const pdfBound = (question, bound) =>
        bound.filter(image => question.images.some(item => item.id === image.id));

    const projectActiveImages = ({ question, boundImages = [], ...ports } = {}) => {
        const deps = dependencies(ports);
        if (!question?.id) return [];
        const bound = boundFor(question, Array.isArray(boundImages) ? boundImages : [], deps);
        const inline = (question.images || []).filter(deps.isPreviewable).filter(deps.isRealFigureRow);
        return deps.mergeById(inline, deps.pdfContract(question) ? pdfBound(question, bound) : bound);
    };

    const projectRealQuestionImages = ({ question, boundImages = [], ...ports } = {}) => {
        const deps = dependencies(ports);
        if (!question?.id) return [];
        const bound = boundFor(question, Array.isArray(boundImages) ? boundImages : [], deps);
        const inline = (question.images || [])
            .filter(deps.isPreviewable)
            .filter(image => QUESTION_FIGURE_SOURCES.includes(String(image.source || '')));
        return deps.mergeById(inline, deps.pdfContract(question) ? pdfBound(question, bound) : bound);
    };

    const projectSourcePageImages = ({ question, batchId = '', ...ports } = {}) => {
        const deps = dependencies(ports, ['isRealFigureRow', 'isPreviewable']);
        if (!question?.id) return [];
        if (deps.pdfContract(question)) {
            return deps.pdfMeta(question).sourcePageImages.map((image, index) => ({
                ...image,
                id: question.id + '_source_' + index,
                batchId: question.batchId,
                questionId: question.id,
                sourcePage: image.pageNo,
                source: 'source-page',
                status: 'need_confirm'
            }));
        }
        if (question.sourcePageImage) {
            return [{
                id: question.id + '_source_page',
                batchId: question.batchId || batchId || '',
                questionId: question.id,
                url: question.sourcePageImage,
                sourceFileId: question.sourceQuestionFileId || question.sourceFileId || '',
                sourcePage: question.sourcePage || question.pageIndex || 0,
                bbox: question.sourceBbox || [],
                confidence: question.confidence || 0.6,
                description: '来源整页图',
                status: 'need_confirm',
                source: 'source-page'
            }].filter(deps.isPreviewable);
        }
        if (question.sourceTrace?.sourcePageImage) {
            return [{
                id: question.id + '_trace_page',
                batchId: question.batchId || batchId || '',
                questionId: question.id,
                url: question.sourceTrace.sourcePageImage,
                sourceFileId: question.sourceTrace.sourceFileId || '',
                sourcePage: question.sourceTrace.sourcePage || question.sourceTrace.pageIndex || 0,
                bbox: [],
                confidence: question.confidence || 0.6,
                description: '来源整页图',
                status: 'need_confirm',
                source: 'source-page'
            }].filter(deps.isPreviewable);
        }
        return [];
    };

    const projectPreviewImages = ({ question, realQuestionImages = [], ...ports } = {}) => {
        const deps = dependencies(ports, ['mergeById']);
        if (!question) return [];
        return deps.mergeById(question.images || [], realQuestionImages || []);
    };

    return Object.freeze({
        QUESTION_FIGURE_SOURCES,
        projectActiveImages,
        projectRealQuestionImages,
        projectSourcePageImages,
        projectPreviewImages
    });
});
