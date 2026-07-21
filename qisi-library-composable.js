(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryComposable = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const requireFunction = (dependencies, name) => {
            const dependency = dependencies && dependencies[name];
            if (typeof dependency !== 'function') {
                throw new TypeError(`useLibrary requires ${name}`);
            }
            return dependency;
        };

        const requireModuleFunction = (dependencies, moduleName, functionName) => {
            const dependency = dependencies && dependencies[moduleName];
            const action = dependency && dependency[functionName];
            if (typeof action !== 'function') {
                throw new TypeError(`useLibrary requires ${moduleName}.${functionName}`);
            }
            return action;
        };

        const requireSharedRef = (context, name) => {
            const sharedRef = context && context[name];
            if (
                !sharedRef ||
                (typeof sharedRef !== 'object' && typeof sharedRef !== 'function') ||
                !('value' in sharedRef)
            ) {
                throw new TypeError(`useLibrary requires context.${name} ref`);
            }
            return sharedRef;
        };

        const requireKnowledgeTree = context => {
            const tree = context && context.knowledgeTree;
            if (!Array.isArray(tree)) {
                throw new TypeError('useLibrary requires context.knowledgeTree array');
            }
            return tree;
        };

        const useLibrary = (context = {}, dependencies = {}) => {
            const ref = requireFunction(dependencies, 'ref');
            const reactive = requireFunction(dependencies, 'reactive');
            const computed = requireFunction(dependencies, 'computed');

            const questions = requireSharedRef(context, 'questions');
            const knowledgeTree = requireKnowledgeTree(context);
            const personalKnowledgeTree = requireSharedRef(context, 'personalKnowledgeTree');
            const activeExternalBatchId = requireSharedRef(context, 'activeExternalBatchId');
            const externalPickMode = requireSharedRef(context, 'externalPickMode');
            const selectedExternalIds = requireSharedRef(context, 'selectedExternalIds');

            const currentPage = ref(1);
            const pageSize = 10;
            const librarySearchInput = ref('');
            const librarySearchKeyword = ref('');
            const libraryFilters = reactive({
                type: '',
                diff: '',
                grade: '',
                answerState: '',
                imageState: ''
            });
            const coreFingerprintMap = ref(new Map());
            const stemFingerprintMap = ref(new Map());
            const activeKnowledge = ref(null);
            const activeKnowledgeType = ref('system');
            const libraryKnowledgeMode = ref('system');

            const buildQuestionFingerprintMaps = items => {
                const buildMaps = requireModuleFunction(
                    dependencies,
                    'LibraryViewState',
                    'buildQuestionFingerprintMaps'
                );
                const maps = buildMaps(items, {
                    coreFingerprint: requireFunction(
                        dependencies,
                        'questionCoreFingerprint'
                    ),
                    stemFingerprint: requireFunction(
                        dependencies,
                        'questionStemFingerprint'
                    )
                });
                coreFingerprintMap.value = maps.coreMap;
                stemFingerprintMap.value = maps.stemMap;
            };

            const resetLibraryFilters = () => {
                librarySearchInput.value = '';
                librarySearchKeyword.value = '';
                Object.assign(libraryFilters, {
                    type: '',
                    diff: '',
                    grade: '',
                    answerState: '',
                    imageState: ''
                });
                currentPage.value = 1;
            };

            const knowledgeCounts = computed(() => requireModuleFunction(
                dependencies,
                'UiEvents',
                'buildKnowledgeCounts'
            )(
                knowledgeTree,
                'system',
                questions.value,
                requireFunction(dependencies, 'getQuestionKnowledge')
            ));

            const personalKnowledgeCounts = computed(() => requireModuleFunction(
                dependencies,
                'UiEvents',
                'buildKnowledgeCounts'
            )(
                personalKnowledgeTree.value,
                'personal',
                questions.value,
                requireFunction(dependencies, 'getQuestionKnowledge')
            ));

            const activeKnowledgeTree = computed(() => (
                libraryKnowledgeMode.value === 'personal'
                    ? personalKnowledgeTree.value
                    : (libraryKnowledgeMode.value === 'external' ? [] : knowledgeTree)
            ));

            const activeKnowledgeCounts = computed(() => (
                libraryKnowledgeMode.value === 'personal'
                    ? personalKnowledgeCounts.value
                    : (libraryKnowledgeMode.value === 'external' ? {} : knowledgeCounts.value)
            ));

            const filteredQuestions = computed(() => requireModuleFunction(
                dependencies,
                'LibraryViewState',
                'filterLibraryQuestions'
            )(
                questions.value,
                {
                    activeKnowledge: activeKnowledge.value,
                    knowledgeType: activeKnowledgeType.value,
                    knowledgeTree: activeKnowledgeType.value === 'personal'
                        ? personalKnowledgeTree.value
                        : knowledgeTree,
                    findNode: requireModuleFunction(dependencies, 'Utils', 'findNode'),
                    getQuestionKnowledge: requireFunction(
                        dependencies,
                        'getQuestionKnowledge'
                    ),
                    questionMatchesLibraryFilters: requireModuleFunction(
                        dependencies,
                        'Utils',
                        'questionMatchesLibraryFilters'
                    ),
                    keyword: librarySearchKeyword.value,
                    filters: libraryFilters,
                    hasText: requireFunction(dependencies, 'hasText')
                }
            ));

            const totalPages = computed(() => (
                Math.ceil(filteredQuestions.value.length / pageSize) || 1
            ));

            const paginatedQuestions = computed(() => filteredQuestions.value.slice(
                (currentPage.value - 1) * pageSize,
                currentPage.value * pageSize
            ));

            const switchLibraryKnowledgeMode = mode => {
                libraryKnowledgeMode.value = mode;
                activeKnowledgeType.value = mode;
                activeKnowledge.value = null;
                currentPage.value = 1;
                if (mode !== 'external') {
                    activeExternalBatchId.value = null;
                    externalPickMode.value = false;
                    selectedExternalIds.value = [];
                }
            };

            const handleKnowledgeSelect = payload => {
                const name = typeof payload === 'object' ? payload.name : payload;
                const type = typeof payload === 'object'
                    ? payload.type
                    : libraryKnowledgeMode.value;
                activeKnowledge.value = name;
                activeKnowledgeType.value = type || libraryKnowledgeMode.value;
                currentPage.value = 1;
            };

            return {
                currentPage,
                pageSize,
                librarySearchInput,
                librarySearchKeyword,
                libraryFilters,
                coreFingerprintMap,
                stemFingerprintMap,
                activeKnowledge,
                activeKnowledgeType,
                libraryKnowledgeMode,
                filteredQuestions,
                totalPages,
                paginatedQuestions,
                knowledgeCounts,
                personalKnowledgeCounts,
                activeKnowledgeTree,
                activeKnowledgeCounts,
                buildQuestionFingerprintMaps,
                resetLibraryFilters,
                switchLibraryKnowledgeMode,
                handleKnowledgeSelect
            };
        };

        return {
            useLibrary
        };
    }
);
