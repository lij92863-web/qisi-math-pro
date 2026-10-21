(function initReviewDraftReadModel(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewDraftReadModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // Display-only read model: it never writes to a draft, the database or a Vue ref.
    // Every rule below is a projection of fields that already exist on the draft.
    const IMAGE_TOKEN_SOURCE = '\\[\\[(?:IMAGE|FORMULA_IMAGE):[^\\]]+\\]\\]|\\\\includegraphics(?:\\[[^\\]]*\\])?\\{[^}]+\\}';
    const IMAGE_TOKEN = new RegExp(IMAGE_TOKEN_SOURCE);

    const draftHasImageToken = q => {
        const options = Array.isArray(q?.options) ? q.options : [];
        const text = [
            q?.stem,
            ...options,
            q?.answer,
            q?.solution
        ].map(value => String(value || '')).join('\n');
        return IMAGE_TOKEN.test(text);
    };

    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    // Callers pass the owning helpers explicitly. In the browser app.js passes the
    // existing owners (draft state, content policy, utils); tests pass fakes, so this
    // module never reaches into a Vue instance or a mutable global.
    const resolveHelpers = (helpers = {}) => {
        const state = helpers.reviewDraftState || root.Qisi?.ReviewDraftState || {};
        const utils = helpers.utils || root.Qisi?.Utils || {};
        return {
            questionNo: helpers.questionNo || ((q, index) =>
                requireDependency(state.draftSummaryQuestionNo, 'REVIEW_DRAFT_READ_MODEL_STATE_REQUIRED')(q, index)),
            countValidOptions: helpers.countValidOptions || (options =>
                requireDependency(helpers.countValidOptions, 'REVIEW_DRAFT_READ_MODEL_OPTION_HELPERS_REQUIRED')(options)),
            isChoiceDraft: helpers.isChoiceDraft || (q =>
                requireDependency(helpers.isChoiceDraft, 'REVIEW_DRAFT_READ_MODEL_OPTION_HELPERS_REQUIRED')(q)),
            cleanText: helpers.cleanText || (value =>
                requireDependency(utils.cleanRecognizedText, 'REVIEW_DRAFT_READ_MODEL_UTILS_REQUIRED')(value))
        };
    };

    const summarizeDrafts = (drafts, helpers = {}) => {
        const list = Array.isArray(drafts) ? drafts : [];
        const api = resolveHelpers(helpers);
        const missingAnswers = [];
        const missingSolutions = [];
        const missingOptions = [];
        let withOptions = 0;
        let withAnswers = 0;
        let withSolutions = 0;
        let withImageTokens = 0;

        list.forEach((q, index) => {
            const questionNo = api.questionNo(q, index);
            const optionCount = api.countValidOptions(q?.options);
            if (optionCount > 0) withOptions += 1;
            if (api.cleanText(q?.answer)) withAnswers += 1;
            else missingAnswers.push(questionNo);
            if (api.cleanText(q?.solution)) withSolutions += 1;
            else missingSolutions.push(questionNo);
            if (draftHasImageToken(q)) withImageTokens += 1;
            if (api.isChoiceDraft(q) && optionCount < 4) missingOptions.push(questionNo);
        });

        return {
            total: list.length,
            withOptions,
            withAnswers,
            withSolutions,
            withImageTokens,
            missingAnswers,
            missingSolutions,
            missingOptions
        };
    };

    const filterDrafts = (drafts, filter, problemsOf) => {
        const items = Array.isArray(drafts) ? drafts : [];
        if (filter === 'problems' && typeof problemsOf !== 'function') {
            const error = new Error('REVIEW_DRAFT_READ_MODEL_PROBLEMS_REQUIRED');
            error.code = 'REVIEW_DRAFT_READ_MODEL_PROBLEMS_REQUIRED';
            throw error;
        }
        const problems = typeof problemsOf === 'function' ? problemsOf : () => [];
        switch (filter) {
            case 'pending': return items.filter(q => q.status === 'pending');
            case 'reviewed': return items.filter(q => q.status === 'reviewed');
            case 'problems': return items.filter(q => problems(q).length > 0);
            case 'images': return items.filter(q => q.hasImage);
            case 'submitted': return items.filter(q => q.status === 'submitted');
            default: return items;
        }
    };

    return Object.freeze({
        IMAGE_TOKEN_SOURCE,
        draftHasImageToken,
        summarizeDrafts,
        filterDrafts
    });
});
