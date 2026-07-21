(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.SettingsComposable = api;

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
                throw new TypeError(`useSettings requires ${name}`);
            }
            return dependency;
        };

        const requireRecord = (dependencies, name) => {
            const dependency = dependencies[name];
            if (!dependency || typeof dependency !== 'object') {
                throw new TypeError(`useSettings requires ${name}`);
            }
            return dependency;
        };

        const requireSharedRef = (context, name) => {
            const sharedRef = context[name];
            if (!sharedRef || (typeof sharedRef !== 'object' && typeof sharedRef !== 'function') || !('value' in sharedRef)) {
                throw new TypeError(`useSettings requires context.${name} ref`);
            }
            return sharedRef;
        };

        const useSettings = (context = {}, dependencies = {}) => {
            const ref = requireFunction(dependencies, 'ref');
            const computed = requireFunction(dependencies, 'computed');
            if (!own(dependencies, 'DEFAULT_TEMPLATE')) {
                throw new TypeError('useSettings requires DEFAULT_TEMPLATE');
            }

            const PRESET_TEMPLATES = requireRecord(dependencies, 'PRESET_TEMPLATES');
            const EXAM_LAYOUT_PRESETS = requireRecord(dependencies, 'EXAM_LAYOUT_PRESETS');
            const KnowledgeTreeState = requireRecord(dependencies, 'KnowledgeTreeState');
            const hoverPersonalL1 = requireSharedRef(context, 'hoverPersonalL1');
            const selectedExamTemplate = requireSharedRef(context, 'selectedExamTemplate');

            const templateOverrides = ref(context.templateOverrides || {});
            const latexTemplate = ref(dependencies.DEFAULT_TEMPLATE);
            const currentPresetKey = ref('');
            const editTplName = ref('');

            const personalKnowledgeTree = ref(context.personalKnowledgeTree || []);
            const personalL1Name = ref('');
            const personalL2Name = ref('');
            const personalL3Name = ref('');
            const selectedPersonalL1Id = ref('');
            const selectedPersonalL2Id = ref('');

            const callTreeState = (name, ...args) => {
                const action = KnowledgeTreeState[name];
                if (typeof action !== 'function') {
                    throw new TypeError(`useSettings requires KnowledgeTreeState.${name}`);
                }
                return action(...args);
            };

            const getTemplateCard = (id, template) => {
                const override = templateOverrides.value[id] || {};
                return {
                    id,
                    name: override.name || template.name,
                    desc: template.desc,
                    code: override.code || template.code,
                    system: true
                };
            };

            const allTemplateCards = computed(() => Object.entries(PRESET_TEMPLATES)
                .map(([id, template]) => getTemplateCard(id, template)));

            const selectTemplateCard = template => {
                currentPresetKey.value = template.id;
                editTplName.value = template.name;
                latexTemplate.value = template.code;
                if (template.system && EXAM_LAYOUT_PRESETS[template.id]) {
                    selectedExamTemplate.value = template.id;
                }
            };

            const selectPresetTemplate = key => (
                selectTemplateCard(getTemplateCard(key, PRESET_TEMPLATES[key]))
            );

            const handleCodeInput = event => {
                latexTemplate.value = event.target.value;
            };

            const updateExistingCustomTemplate = async () => {
                if (!PRESET_TEMPLATES[currentPresetKey.value]) return;

                const ensureImagePackagesForLatex = requireFunction(
                    dependencies,
                    'ensureImagePackagesForLatex'
                );
                const validateStrictLatex = requireFunction(
                    dependencies,
                    'validateStrictLatex'
                );
                const nextCode = ensureImagePackagesForLatex(latexTemplate.value);
                const validation = validateStrictLatex(nextCode);

                if (!validation.ok) {
                    requireFunction(dependencies, 'notify')(
                        `模板未保存：\n${validation.issues.join('\n')}`
                    );
                    return;
                }

                const now = requireFunction(dependencies, 'now');
                const persistTemplateOverrides = requireFunction(
                    dependencies,
                    'persistTemplateOverrides'
                );
                const nextOverrides = {
                    ...templateOverrides.value,
                    [currentPresetKey.value]: {
                        name: editTplName.value,
                        code: nextCode,
                        updatedAt: now()
                    }
                };

                templateOverrides.value = nextOverrides;
                latexTemplate.value = nextOverrides[currentPresetKey.value].code;
                persistTemplateOverrides(nextOverrides);
                requireFunction(dependencies, 'notify')('A4 模板已更新');
            };

            const persistCurrentPersonalTree = async () => {
                const persistPersonalTree = requireFunction(
                    dependencies,
                    'persistPersonalTree'
                );
                const now = requireFunction(dependencies, 'now');
                await persistPersonalTree(personalKnowledgeTree.value, now());
            };

            const replacePersonalKnowledgeTree = nextTree => {
                const previousHover = hoverPersonalL1.value;
                personalKnowledgeTree.value = nextTree;
                if (previousHover?.id) {
                    hoverPersonalL1.value = callTreeState(
                        'findPersonalNodeById',
                        nextTree,
                        previousHover.id
                    ) || previousHover;
                }
            };

            const personalTreeRows = computed(() => callTreeState(
                'buildPersonalTreeRows',
                personalKnowledgeTree.value
            ));

            const createPersonalId = () => (
                requireFunction(dependencies, 'createId')('pk')
            );

            const togglePersonalExpanded = async node => {
                replacePersonalKnowledgeTree(callTreeState(
                    'togglePersonalNodeExpanded',
                    personalKnowledgeTree.value,
                    node
                ));
                await persistCurrentPersonalTree();
            };

            const addPersonalChild = async row => {
                const label = row.level === 1
                    ? '二级方向名称'
                    : '三级知识点名称';
                const name = requireFunction(dependencies, 'requestText')(label, '');
                if (!name || !name.trim()) return;

                const child = {
                    id: createPersonalId(),
                    name: name.trim(),
                    children: row.level === 1 ? [] : undefined,
                    expanded: true
                };
                replacePersonalKnowledgeTree(callTreeState(
                    'appendPersonalNode',
                    personalKnowledgeTree.value,
                    row.node,
                    child
                ));

                if (row.level === 1) {
                    selectedPersonalL1Id.value = row.node.id;
                    selectedPersonalL2Id.value = child.id;
                } else {
                    selectedPersonalL1Id.value = row.grandParent?.id || '';
                    selectedPersonalL2Id.value = row.node.id;
                }
                await persistCurrentPersonalTree();
            };

            const createPersonalL1 = async () => {
                const name = personalL1Name.value.trim();
                if (!name) return;

                const node = {
                    id: createPersonalId(),
                    name,
                    children: [],
                    expanded: true
                };
                replacePersonalKnowledgeTree(callTreeState(
                    'appendPersonalNode',
                    personalKnowledgeTree.value,
                    null,
                    node
                ));
                selectedPersonalL1Id.value = node.id;
                selectedPersonalL2Id.value = '';
                personalL1Name.value = '';
                await persistCurrentPersonalTree();
            };

            const createPersonalL2 = async () => {
                const parent = personalKnowledgeTree.value.find(
                    node => node.id === selectedPersonalL1Id.value
                );
                const name = personalL2Name.value.trim();
                if (!parent || !name) return;

                const node = {
                    id: createPersonalId(),
                    name,
                    children: [],
                    expanded: true
                };
                replacePersonalKnowledgeTree(callTreeState(
                    'appendPersonalNode',
                    personalKnowledgeTree.value,
                    parent,
                    node
                ));
                selectedPersonalL2Id.value = node.id;
                personalL2Name.value = '';
                await persistCurrentPersonalTree();
            };

            const createPersonalL3 = async () => {
                const levelOne = personalKnowledgeTree.value.find(
                    node => node.id === selectedPersonalL1Id.value
                );
                const parent = levelOne?.children?.find(
                    node => node.id === selectedPersonalL2Id.value
                );
                const name = personalL3Name.value.trim();
                if (!parent || !name) return;

                const node = {
                    id: createPersonalId(),
                    name
                };
                replacePersonalKnowledgeTree(callTreeState(
                    'appendPersonalNode',
                    personalKnowledgeTree.value,
                    parent,
                    node
                ));
                personalL3Name.value = '';
                await persistCurrentPersonalTree();
            };

            const renamePersonalNode = async node => {
                const name = requireFunction(dependencies, 'requestText')(
                    '新的知识点名称',
                    node.name
                );
                if (!name || !name.trim()) return;

                replacePersonalKnowledgeTree(callTreeState(
                    'renamePersonalNode',
                    personalKnowledgeTree.value,
                    node,
                    name.trim()
                ));
                await persistCurrentPersonalTree();
            };

            const deletePersonalNode = async (level, id, parentId = '') => {
                const confirmed = requireFunction(
                    dependencies,
                    'confirmAction'
                )('确定删除这个知识点及其下级吗？');
                if (!confirmed) return;

                replacePersonalKnowledgeTree(callTreeState(
                    'deletePersonalNode',
                    personalKnowledgeTree.value,
                    level,
                    id,
                    parentId
                ));
                if (level === 1) {
                    if (selectedPersonalL1Id.value === id) {
                        selectedPersonalL1Id.value = '';
                        selectedPersonalL2Id.value = '';
                    }
                } else if (level === 2) {
                    if (selectedPersonalL2Id.value === id) {
                        selectedPersonalL2Id.value = '';
                    }
                }
                await persistCurrentPersonalTree();
            };

            const deletePersonalRow = row => {
                const parentId = row.level === 1
                    ? ''
                    : row.parent?.id || '';
                deletePersonalNode(row.level, row.node.id, parentId);
            };

            return {
                templateOverrides,
                latexTemplate,
                currentPresetKey,
                editTplName,
                personalKnowledgeTree,
                personalL1Name,
                personalL2Name,
                personalL3Name,
                selectedPersonalL1Id,
                selectedPersonalL2Id,
                hoverPersonalL1,
                selectedExamTemplate,
                personalTreeRows,
                getTemplateCard,
                allTemplateCards,
                selectTemplateCard,
                selectPresetTemplate,
                handleCodeInput,
                updateExistingCustomTemplate,
                replacePersonalKnowledgeTree,
                togglePersonalExpanded,
                addPersonalChild,
                deletePersonalRow,
                createPersonalL1,
                createPersonalL2,
                createPersonalL3,
                renamePersonalNode,
                deletePersonalNode
            };
        };

        return {
            useSettings
        };
    }
);
