(function initReviewEditorCommit(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewEditorCommit = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Pure planning for "editor textarea -> question fields". It decides the next
    // editorSource/stem/options and whether the option warning must be cleared or
    // added; applying that decision stays in app.js with the existing controllers.
    const OPTION_WARNING = '题目编辑源码暂未识别出规范的 A/B/C/D 选项，请检查选项是否分别以行首 A.、B.、C.、D. 开始。';

    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    const planEditorCommit = ({ question, source, images = [], ...ports } = {}) => {
        if (!question) return null;
        const migrateImageTokens = requireDependency(ports.migrateImageTokens, 'REVIEW_EDITOR_COMMIT_MIGRATE_HELPER_REQUIRED');
        const normalizeDuplicates = requireDependency(ports.normalizeDuplicates, 'REVIEW_EDITOR_COMMIT_DUPLICATE_HELPER_REQUIRED');
        const normalizeNewlines = requireDependency(ports.normalizeNewlines, 'REVIEW_EDITOR_COMMIT_NORMALIZE_HELPER_REQUIRED');
        const buildProjection = requireDependency(ports.buildProjection, 'REVIEW_EDITOR_COMMIT_PROJECTION_REQUIRED');

        const migrated = migrateImageTokens(source, Array.isArray(images) ? images : []);
        const editorSource = normalizeNewlines(normalizeDuplicates(migrated));
        const projection = buildProjection(editorSource, question);
        const isChoice = question.type === '单选题' || question.type === '多选题';

        let stem;
        let options;
        let optionWarning = null;
        if (isChoice && projection.parsedOptions) {
            stem = projection.stem;
            options = projection.options.map(option => String(option || ''));
        } else if (isChoice) {
            stem = editorSource;
            options = ['', '', '', ''];
            optionWarning = OPTION_WARNING;
        } else {
            stem = editorSource;
            options = ['', '', '', ''];
        }

        return { editorSource, stem, options, optionWarning, projection };
    };

    return Object.freeze({ OPTION_WARNING, planEditorCommit });
});
