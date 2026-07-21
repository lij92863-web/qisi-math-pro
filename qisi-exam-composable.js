(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ExamComposable = api;

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

        const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

        const requireFunction = (dependencies, name) => {
            const dependency = dependencies[name];
            if (typeof dependency !== 'function') {
                throw new TypeError(`useExam requires ${name}`);
            }
            return dependency;
        };

        const requireRecord = (dependencies, name) => {
            const dependency = dependencies[name];
            if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
                throw new TypeError(`useExam requires ${name}`);
            }
            return dependency;
        };

        const requireArray = (dependencies, name) => {
            const dependency = dependencies[name];
            if (!Array.isArray(dependency)) {
                throw new TypeError(`useExam requires ${name}`);
            }
            return dependency;
        };

        const requireSharedRef = (context, name) => {
            const sharedRef = context[name];
            if (
                !sharedRef ||
                (typeof sharedRef !== 'object' && typeof sharedRef !== 'function') ||
                !('value' in sharedRef)
            ) {
                throw new TypeError(`useExam requires context.${name} ref`);
            }
            return sharedRef;
        };

        const requireInitialValue = (context, name) => {
            if (!own(context, name)) {
                throw new TypeError(`useExam requires context.${name}`);
            }
            return context[name];
        };

        const useExam = (context = {}, dependencies = {}) => {
            const ref = requireFunction(dependencies, 'ref');
            const reactive = requireFunction(dependencies, 'reactive');
            const computed = requireFunction(dependencies, 'computed');

            const questions = requireSharedRef(context, 'questions');
            const cart = requireSharedRef(context, 'cart');
            const view = requireSharedRef(context, 'view');
            const isCartOpen = requireSharedRef(context, 'isCartOpen');
            const selectedExamTemplate = requireSharedRef(context, 'selectedExamTemplate');
            const templateOverrides = requireSharedRef(context, 'templateOverrides');

            const PRESET_TEMPLATES = requireRecord(dependencies, 'PRESET_TEMPLATES');
            const EXAM_LAYOUT_PRESETS = requireRecord(dependencies, 'EXAM_LAYOUT_PRESETS');
            const DEFAULT_GROUP_CONFIG = requireRecord(dependencies, 'DEFAULT_GROUP_CONFIG');
            const QUESTION_TYPE_LABELS = requireRecord(dependencies, 'QUESTION_TYPE_LABELS');
            const EXAM_TYPE_ORDER = requireArray(dependencies, 'EXAM_TYPE_ORDER');
            const ExamGrouping = requireRecord(dependencies, 'ExamGrouping');
            if (!own(dependencies, 'DEFAULT_PRESET_KEY')) {
                throw new TypeError('useExam requires DEFAULT_PRESET_KEY');
            }
            const DEFAULT_PRESET_KEY = dependencies.DEFAULT_PRESET_KEY;
            const defaultPreset = EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY];
            if (!defaultPreset || !defaultPreset.config || typeof defaultPreset.config !== 'object') {
                throw new TypeError('useExam requires a default exam layout preset');
            }

            const examTitle = ref(requireInitialValue(context, 'initialExamTitle'));
            const exportMode = ref(requireInitialValue(context, 'initialExportMode'));
            const examConfig = reactive({ ...defaultPreset.config });
            const examQuestionMeta = reactive({});
            const examGroupConfig = reactive({});
            const draggingExamQuestionId = ref('');
            const dragOverExamQuestionId = ref('');
            const restoringExamConfig = ref(false);
            const printBusy = ref(false);

            const cartQuestionsOrdered = computed(() => cart.value
                .map(id => questions.value.find(question => question && question.id === id))
                .filter(Boolean));

            const examPresets = computed(() => Object.fromEntries(
                Object.entries(EXAM_LAYOUT_PRESETS).map(([id, preset]) => {
                    const override = templateOverrides.value[id] || {};
                    return [id, {
                        ...preset,
                        name: override.name || preset.name,
                        desc: PRESET_TEMPLATES[id]?.desc || preset.desc
                    }];
                })
            ));

            const selectedExamPreset = computed(() => (
                examPresets.value[selectedExamTemplate.value] ||
                examPresets.value[DEFAULT_PRESET_KEY]
            ));

            const getExamGroupsForQuestions = sourceQuestions => {
                const buildExamGroups = ExamGrouping.buildExamGroups;
                if (typeof buildExamGroups !== 'function') {
                    throw new TypeError('useExam requires ExamGrouping.buildExamGroups');
                }
                return buildExamGroups(sourceQuestions, {
                    typeOrder: EXAM_TYPE_ORDER,
                    groupConfig: examGroupConfig,
                    defaultGroupConfig: DEFAULT_GROUP_CONFIG,
                    typeLabels: QUESTION_TYPE_LABELS,
                    questionMeta: examQuestionMeta
                });
            };

            const activeExamGroups = computed(() => (
                getExamGroupsForQuestions(cartQuestionsOrdered.value)
            ));

            const templateFeatureOptions = computed(() => [
                { key: 'showHeaderFields', label: '显示班级 / 姓名 / 评分' },
                { key: 'showAnswerGrid', label: '显示晚测答题表' }
            ]);

            const groupSummaryText = group => {
                const formatExamGroupSummary = ExamGrouping.formatExamGroupSummary;
                if (typeof formatExamGroupSummary !== 'function') {
                    throw new TypeError('useExam requires ExamGrouping.formatExamGroupSummary');
                }
                return formatExamGroupSummary(group);
            };

            const getGroupCfg = type => {
                if (!examGroupConfig[type]) {
                    examGroupConfig[type] = {
                        ...(DEFAULT_GROUP_CONFIG[type] || {
                            title: QUESTION_TYPE_LABELS[type] || type || '其他题型',
                            points: 0
                        })
                    };
                }
                return examGroupConfig[type];
            };

            const syncExamMeta = () => {
                cartQuestionsOrdered.value.forEach((question, index) => {
                    const groupConfig = getGroupCfg(question.type);
                    if (!examQuestionMeta[question.id]) {
                        examQuestionMeta[question.id] = {
                            name: question.type || `第 ${index + 1} 题`,
                            points: Number(groupConfig.points || 0),
                            source: question.knowledge || question.meta?.knowledge || '',
                            note: ''
                        };
                    } else if (!examQuestionMeta[question.id].points) {
                        examQuestionMeta[question.id].points = Number(groupConfig.points || 0);
                    }
                });
            };

            const syncExamGroups = () => {
                activeExamGroups.value.forEach(group => {
                    const groupConfig = getGroupCfg(group.type);
                    if (!groupConfig.text) groupConfig.text = groupSummaryText(group);
                });
                syncExamMeta();
            };

            const openExamBuilder = () => {
                syncExamGroups();
                view.value = 'exam';
                isCartOpen.value = false;
            };

            const toggleCart = id => {
                if (cart.value.includes(id)) {
                    cart.value = cart.value.filter(itemId => itemId !== id);
                } else {
                    cart.value.push(id);
                    syncExamMeta();
                }
            };

            const reorderQuestionWithinType = (sourceId, targetIndex) => {
                const sourceQuestion = questions.value.find(question => question?.id === sourceId);
                if (!sourceQuestion) return false;

                const type = sourceQuestion.type || '其他题型';
                const typeIds = cart.value.filter(id => {
                    const question = questions.value.find(item => item?.id === id);
                    return question && (question.type || '其他题型') === type;
                });
                const currentIndex = typeIds.indexOf(sourceId);
                const withoutSource = typeIds.filter(id => id !== sourceId);
                const nextIndex = Math.max(0, Math.min(targetIndex, withoutSource.length));
                if (currentIndex === nextIndex) return false;

                withoutSource.splice(nextIndex, 0, sourceId);
                const queue = [...withoutSource];
                cart.value = cart.value.map(id => {
                    const question = questions.value.find(item => item?.id === id);
                    return question && (question.type || '其他题型') === type
                        ? queue.shift()
                        : id;
                });
                return true;
            };

            const moveCartQuestion = (id, direction) => {
                const question = questions.value.find(item => item?.id === id);
                if (!question) return;

                const type = question.type || '其他题型';
                const typeIds = cart.value.filter(cartId => {
                    const item = questions.value.find(candidate => candidate?.id === cartId);
                    return item && (item.type || '其他题型') === type;
                });
                const index = typeIds.indexOf(id);
                const nextIndex = index + direction;
                if (index < 0 || nextIndex < 0 || nextIndex >= typeIds.length) return;
                reorderQuestionWithinType(id, nextIndex);
            };

            const examDisplayIndex = id => {
                let index = 1;
                for (const group of activeExamGroups.value) {
                    for (const item of group.items) {
                        if (item.id === id) return index;
                        index += 1;
                    }
                }
                return index;
            };

            const dropExamQuestion = targetId => {
                const sourceId = draggingExamQuestionId.value;
                draggingExamQuestionId.value = '';
                dragOverExamQuestionId.value = '';
                if (!sourceId || sourceId === targetId) return;

                const sourceQuestion = questions.value.find(question => question.id === sourceId);
                const targetQuestion = questions.value.find(question => question.id === targetId);
                if (
                    !sourceQuestion ||
                    !targetQuestion ||
                    sourceQuestion.type !== targetQuestion.type
                ) return;

                const typeIds = cart.value.filter(id => {
                    const question = questions.value.find(item => item?.id === id);
                    return question && question.type === sourceQuestion.type;
                });
                const targetIndex = typeIds
                    .filter(id => id !== sourceId)
                    .indexOf(targetId);
                if (targetIndex >= 0) reorderQuestionWithinType(sourceId, targetIndex);
            };

            const resetExamOrder = () => {
                cart.value = [...cart.value].sort((left, right) => (
                    String(left).localeCompare(String(right))
                ));
            };

            const clearCart = () => {
                const confirmAction = requireFunction(dependencies, 'confirmAction');
                if (confirmAction('确定清空试卷篮吗？')) cart.value = [];
            };

            return {
                questions,
                cart,
                view,
                isCartOpen,
                selectedExamTemplate,
                templateOverrides,
                examTitle,
                exportMode,
                examConfig,
                examQuestionMeta,
                examGroupConfig,
                draggingExamQuestionId,
                dragOverExamQuestionId,
                restoringExamConfig,
                printBusy,
                cartQuestionsOrdered,
                examPresets,
                selectedExamPreset,
                activeExamGroups,
                templateFeatureOptions,
                getExamGroupsForQuestions,
                groupSummaryText,
                getGroupCfg,
                syncExamMeta,
                syncExamGroups,
                openExamBuilder,
                toggleCart,
                reorderQuestionWithinType,
                moveCartQuestion,
                examDisplayIndex,
                dropExamQuestion,
                resetExamOrder,
                clearCart
            };
        };

        return {
            useExam
        };
    }
);
