(function initReviewImageCommands(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewImageCommands = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Pure plans for the review image commands. app.js applies them to the reactive
    // draft/image rows and still owns the persistence call and the UI refresh.
    const CONFIRM_WARNING_MARKERS = Object.freeze(['图片需要确认', '图片尚未确认']);

    const planConfirmImages = ({ question, images = [] } = {}) => {
        if (!question) return null;
        return {
            warnings: (question.warnings || []).filter(warning =>
                !CONFIRM_WARNING_MARKERS.some(marker => String(warning).includes(marker))),
            imageUpdates: (Array.isArray(images) ? images : []).map(image => ({
                id: image?.id,
                status: 'bound',
                confidence: Math.max(image?.confidence || 0, 0.9)
            }))
        };
    };

    const planImageDeletion = ({ question, imageId, currentSource, removeToken } = {}) => {
        if (!question || !imageId) return null;
        const remove = typeof removeToken === 'function' ? removeToken : null;
        if (!remove) {
            const error = new Error('REVIEW_IMAGE_COMMAND_TOKEN_HELPER_REQUIRED');
            error.code = 'REVIEW_IMAGE_COMMAND_TOKEN_HELPER_REQUIRED';
            throw error;
        }
        return {
            images: (question.images || []).filter(image => image.id !== imageId),
            stem: remove(question.stem || '', imageId),
            editorSource: remove(String(currentSource || ''), imageId)
        };
    };

    return Object.freeze({ CONFIRM_WARNING_MARKERS, planConfirmImages, planImageDeletion });
});
