(function initReviewEditorProjection(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewEditorProjection = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Read-only projection between a draft and the editor textarea. It never writes
    // to the draft or the buffer; the page owns both and passes the helper owners.
    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    const buildEditorSource = ({ question, ...ports } = {}) => {
        if (!question) return '';
        const pdfContract = typeof ports.pdfContract === 'function' ? ports.pdfContract : () => null;
        const mergeStemWithOptions = requireDependency(ports.mergeStemWithOptions, 'REVIEW_EDITOR_PROJECTION_MERGE_HELPER_REQUIRED');
        const normalizeNewlines = requireDependency(ports.normalizeNewlines, 'REVIEW_EDITOR_PROJECTION_NORMALIZE_HELPER_REQUIRED');

        const contract = pdfContract(question);
        if (contract) return question.editorSource || contract.editorSource(question);
        if (typeof question.editorSource === 'string' && question.editorSource.length > 0) {
            return normalizeNewlines(question.editorSource);
        }
        return normalizeNewlines(mergeStemWithOptions(
            question.stem || '',
            question.options || ['', '', '', ''],
            question.type || '解答题'
        ));
    };

    const buildEditorProjection = ({ source, question, ...ports } = {}) => {
        const pdfContract = typeof ports.pdfContract === 'function' ? ports.pdfContract : () => null;
        const contract = pdfContract(question);
        if (contract) return contract.projectEditorSource(source, question);

        const normalizeNewlines = requireDependency(ports.normalizeNewlines, 'REVIEW_EDITOR_PROJECTION_NORMALIZE_HELPER_REQUIRED');
        const text = normalizeNewlines(source);
        const type = String(question?.type || '解答题').trim();
        const isChoice = type === '单选题' || type === '多选题';

        if (!isChoice) {
            return { stem: text, options: ['', '', '', ''], type, parsedOptions: false };
        }

        const splitChoiceSource = requireDependency(ports.splitChoiceSource, 'REVIEW_EDITOR_PROJECTION_SPLIT_HELPER_REQUIRED');
        const split = splitChoiceSource(text);
        if (split) {
            return {
                stem: split.stem,
                options: split.options.map(option => String(option || '')),
                type,
                parsedOptions: true
            };
        }

        const normalizePreviewOptions = requireDependency(ports.normalizePreviewOptions, 'REVIEW_EDITOR_PROJECTION_OPTIONS_HELPER_REQUIRED');
        return { stem: text, options: normalizePreviewOptions(question), type, parsedOptions: false };
    };

    return Object.freeze({ buildEditorSource, buildEditorProjection });
});
