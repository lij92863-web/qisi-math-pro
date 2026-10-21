(function initReviewSessionCommands(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewSessionCommands = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Review session commands: the switch decision and the single review-persistence
    // error boundary. Both are pure shells around owners the page passes in; they do
    // not read Vue refs, storage or the DOM.
    const resolveSelection = ({ currentId, nextId, dirty } = {}) => {
        if (!nextId || nextId === currentId) return 'noop';
        return dirty ? 'prompt' : 'switch';
    };

    const persistDraftCommand = async ({
        service, command, kind = 'draft', failureMessage = '草稿保存失败', notify
    } = {}) => {
        if (typeof notify !== 'function') {
            const error = new Error('REVIEW_SESSION_COMMAND_NOTIFY_REQUIRED');
            error.code = 'REVIEW_SESSION_COMMAND_NOTIFY_REQUIRED';
            throw error;
        }
        if (!service || typeof service.persistReviewDraftCommand !== 'function' ||
            typeof service.persistReviewImageCommand !== 'function') {
            const error = new Error('REVIEW_SESSION_COMMAND_SERVICE_REQUIRED');
            error.code = 'REVIEW_SESSION_COMMAND_SERVICE_REQUIRED';
            throw error;
        }
        try {
            return kind === 'image'
                ? await service.persistReviewImageCommand(command)
                : await service.persistReviewDraftCommand(command);
        } catch (error) {
            // Keep unsaved editor input; the persisted version is unchanged.
            notify(`${failureMessage}：${error?.code || error?.message || 'storage-failure'}`);
            return null;
        }
    };

    return Object.freeze({ resolveSelection, persistDraftCommand });
});
