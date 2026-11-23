(function initReviewDraftBuilder(root) {
    'use strict';

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );

    const cloneValue = value => {
        if (Array.isArray(value)) return value.map(cloneValue);
        if (isRecord(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
            );
        }
        return value;
    };

    const freezeValue = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(freezeValue);
        return Object.freeze(value);
    };

    const immutable = value => freezeValue(cloneValue(value));

    const createError = code => {
        const error = new Error(code);
        error.code = code;
        return error;
    };

    const buildReviewDrafts = (validatedDrafts, context = {}) => {
        if (!Array.isArray(validatedDrafts) || !validatedDrafts.length) {
            throw createError('REVIEW_DRAFT_INPUT_INVALID');
        }
        const batchId = String(context.batchId || '').trim();
        const now = Number(context.now);
        if (!batchId || !Number.isFinite(now) || now < 0) {
            throw createError('REVIEW_DRAFT_CONTEXT_INVALID');
        }

        const reviewDrafts = validatedDrafts.map((draft, index) => {
            if (!isRecord(draft)) {
                throw createError('REVIEW_DRAFT_ITEM_INVALID');
            }
            if (draft.warnings !== undefined && !Array.isArray(draft.warnings)) {
                throw createError('REVIEW_DRAFT_ITEM_INVALID');
            }
            if (
                draft.fieldProvenance !== undefined &&
                !isRecord(draft.fieldProvenance)
            ) {
                throw createError('REVIEW_DRAFT_ITEM_INVALID');
            }
            return {
                ...cloneValue(draft),
                id: draft.id || `draft_${batchId}_${index + 1}`,
                batchId,
                version: Number.isInteger(draft.version) ? draft.version : 1,
                order: index + 1,
                status: 'pending',
                duplicateStatus: 'none',
                selected: true,
                createdAt: draft.createdAt || now,
                updatedAt: now
            };
        });

        return immutable(reviewDrafts);
    };

    const api = Object.freeze({ buildReviewDrafts });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ReviewDraftBuilder = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
