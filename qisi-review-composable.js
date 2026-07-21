(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewComposable = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function () {
        'use strict';

        const requireFunction = (dependencies, name) => {
            const dependency = dependencies && dependencies[name];
            if (typeof dependency !== 'function') {
                throw new TypeError(`useReview requires ${name}`);
            }
            return dependency;
        };

        const requireModuleFunction = (dependencies, moduleName, functionName) => {
            const module = dependencies && dependencies[moduleName];
            const dependency = module && module[functionName];
            if (typeof dependency !== 'function') {
                throw new TypeError(`useReview requires ${moduleName}.${functionName}`);
            }
            return dependency;
        };

        const requireSharedRef = (context, name) => {
            const sharedRef = context && context[name];
            if (
                !sharedRef ||
                (typeof sharedRef !== 'object' && typeof sharedRef !== 'function') ||
                !('value' in sharedRef)
            ) {
                throw new TypeError(`useReview requires context.${name} ref`);
            }
            return sharedRef;
        };

        const useReview = (context = {}, dependencies = {}) => {
            const ref = requireFunction(dependencies, 'ref');
            const computed = requireFunction(dependencies, 'computed');
            const batchImportBatches = requireSharedRef(context, 'batchImportBatches');
            const batchDraftQuestions = requireSharedRef(context, 'batchDraftQuestions');

            const batchImportMode = ref('list');
            const batchImportFilter = ref('all');
            const activeBatchId = ref('');
            const activeDraftQuestionId = ref('');
            const activeDraftTab = ref('stem');
            const batchToast = ref('');
            const unassignedImageModal = ref(false);
            const imagePositionMenuId = ref('');
            const activeDraftEditorBuffer = ref('');
            const activeDraftEditorOriginal = ref('');
            const activeDraftEditorQuestionId = ref('');
            const activeDraftEditorTextarea = ref(null);

            const recentBatchImportBatches = computed(() => (
                [...batchImportBatches.value]
                    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
                    .slice(0, 12)
            ));

            const activeBatch = computed(() => (
                batchImportBatches.value.find(batch => batch.id === activeBatchId.value) || null
            ));

            const activeDraftQuestion = computed(() => (
                batchDraftQuestions.value.find(
                    question => question.id === activeDraftQuestionId.value
                ) || batchDraftQuestions.value[0] || null
            ));

            const activeDraftEditorDirty = computed(() => (
                activeDraftEditorBuffer.value !== activeDraftEditorOriginal.value
            ));

            const buildDraftEditorSource = question => {
                if (!question) return '';

                const normalizeNewlines = requireModuleFunction(
                    dependencies,
                    'ReviewDraftState',
                    'normalizeDraftEditorNewlines'
                );
                if (
                    typeof question.editorSource === 'string' &&
                    question.editorSource.length > 0
                ) {
                    return normalizeNewlines(question.editorSource);
                }

                const mergeStemWithOptions = requireFunction(
                    dependencies,
                    'mergeStemWithOptions'
                );
                return normalizeNewlines(mergeStemWithOptions(
                    question.stem || '',
                    question.options || ['', '', '', ''],
                    question.type || '解答题'
                ));
            };

            const activeDraftEditorPreview = computed(() => (
                requireModuleFunction(
                    dependencies,
                    'ReviewDraftState',
                    'buildDraftEditorProjection'
                )(
                    activeDraftEditorBuffer.value,
                    activeDraftQuestion.value
                )
            ));

            const filteredDraftQuestions = computed(() => (
                requireModuleFunction(
                    dependencies,
                    'ReviewDraftState',
                    'filterDraftQuestions'
                )(
                    batchDraftQuestions.value,
                    batchImportFilter.value,
                    requireFunction(dependencies, 'draftQuestionProblems')
                )
            ));

            const toggleImagePositionMenu = (imageId = '') => {
                const id = String(imageId || '').trim();
                if (!id) {
                    imagePositionMenuId.value = '';
                    return;
                }
                imagePositionMenuId.value = imagePositionMenuId.value === id ? '' : id;
            };

            const discardActiveDraftEditorChanges = () => {
                activeDraftEditorBuffer.value = activeDraftEditorOriginal.value;
                requireFunction(dependencies, 'notify')('已放弃未保存修改。');
            };

            return {
                batchImportBatches,
                batchDraftQuestions,
                batchImportMode,
                batchImportFilter,
                activeBatchId,
                activeDraftQuestionId,
                activeDraftTab,
                batchToast,
                unassignedImageModal,
                imagePositionMenuId,
                activeDraftEditorBuffer,
                activeDraftEditorOriginal,
                activeDraftEditorQuestionId,
                activeDraftEditorTextarea,
                recentBatchImportBatches,
                activeBatch,
                activeDraftQuestion,
                activeDraftEditorDirty,
                activeDraftEditorPreview,
                filteredDraftQuestions,
                buildDraftEditorSource,
                toggleImagePositionMenu,
                discardActiveDraftEditorChanges
            };
        };

        return { useReview };
    }
);
