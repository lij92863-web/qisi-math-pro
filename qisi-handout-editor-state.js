(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const api = factory(model);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutEditorState = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function (model) {
        'use strict';

        if (!model) {
            throw new Error('Qisi.HandoutModel is required');
        }

        const HISTORY_LIMIT = 60;
        const COALESCE_WINDOW_MS = 800;
        const DEFAULT_SETTINGS = Object.freeze({
            page: Object.freeze({
                paper: 'a4',
                orientation: 'portrait',
                columns: 1,
                marginTopMm: 18,
                marginRightMm: 18,
                marginBottomMm: 18,
                marginLeftMm: 18,
                fontSizePt: 11,
                lineSpacing: 1.5,
                paragraphSpacingPt: 6,
                showPageNumber: true,
                separateFirstPage: false
            }),
            header: Object.freeze({
                enabled: true,
                scope: 'all',
                left: '{title}',
                center: '',
                right: '{teacher}',
                distanceMm: 9,
                heightMm: 8,
                slots: Object.freeze({
                    left: Object.freeze({
                        enabled: true,
                        text: '{title}',
                        assetId: '',
                        imageWidthMm: 10
                    }),
                    center: Object.freeze({
                        enabled: false,
                        text: '',
                        assetId: '',
                        imageWidthMm: 10
                    }),
                    right: Object.freeze({
                        enabled: true,
                        text: '{teacher}',
                        assetId: '',
                        imageWidthMm: 10
                    })
                }),
                background: Object.freeze({
                    enabled: false,
                    color: '#f1f5f9',
                    opacity: 0.12,
                    heightMm: 8,
                    bleed: false
                })
            }),
            footer: Object.freeze({
                enabled: true,
                scope: 'all',
                left: '{school}',
                center: '',
                right: '第 {page} 页',
                distanceMm: 9,
                heightMm: 8,
                slots: Object.freeze({
                    left: Object.freeze({
                        enabled: true,
                        text: '{school}',
                        assetId: '',
                        imageWidthMm: 10
                    }),
                    center: Object.freeze({
                        enabled: false,
                        text: '',
                        assetId: '',
                        imageWidthMm: 10
                    }),
                    right: Object.freeze({
                        enabled: true,
                        text: '第 {page} 页',
                        assetId: '',
                        imageWidthMm: 10
                    })
                }),
                background: Object.freeze({
                    enabled: false,
                    color: '#f1f5f9',
                    opacity: 0.12,
                    heightMm: 8,
                    bleed: false
                })
            }),
            editions: Object.freeze({
                student: Object.freeze({
                    showAnswer: false,
                    showAnalysis: false,
                    showSolution: false,
                    showTeacherNote: false
                }),
                teacher: Object.freeze({
                    showAnswer: true,
                    showAnalysis: true,
                    showSolution: true,
                    showTeacherNote: true
                })
            }),
            metadata: Object.freeze({
                subtitle: '',
                subject: '高中数学',
                grade: '',
                teacher: '',
                school: ''
            })
        });

        const clone = model.cloneValue;

        const mergeRecord = (defaults, value) => {
            const source = value && typeof value === 'object'
                && !Array.isArray(value)
                ? value
                : {};
            const result = clone(defaults);

            for (const [key, next] of Object.entries(source)) {
                if (
                    next
                    && typeof next === 'object'
                    && !Array.isArray(next)
                    && result[key]
                    && typeof result[key] === 'object'
                    && !Array.isArray(result[key])
                ) {
                    result[key] = mergeRecord(result[key], next);
                } else {
                    result[key] = clone(next);
                }
            }

            return result;
        };

        const migrateLegacyRegionForEditing = (
            mergedRegion,
            sourceRegion
        ) => {
            if (
                !sourceRegion
                || typeof sourceRegion !== 'object'
                || Array.isArray(sourceRegion)
                || (
                    sourceRegion.slots
                    && typeof sourceRegion.slots === 'object'
                    && !Array.isArray(sourceRegion.slots)
                )
            ) {
                return mergedRegion;
            }

            const alignment = [
                'left',
                'center',
                'right'
            ].includes(sourceRegion.alignment)
                ? sourceRegion.alignment
                : 'center';
            const slots = clone(mergedRegion.slots);

            for (const slotName of [
                'left',
                'center',
                'right'
            ]) {
                const legacyText = sourceRegion[slotName]
                    ?? (
                        slotName === alignment
                        && sourceRegion.text != null
                            ? sourceRegion.text
                            : undefined
                    );
                if (legacyText == null) continue;
                slots[slotName] = {
                    ...slots[slotName],
                    enabled: Boolean(legacyText),
                    text: String(legacyText)
                };
            }

            return {
                ...mergedRegion,
                slots
            };
        };

        const normalizeForEditing = handout => {
            const settings = mergeRecord(
                DEFAULT_SETTINGS,
                handout?.settings
            );
            settings.header = migrateLegacyRegionForEditing(
                settings.header,
                handout?.settings?.header
            );
            settings.footer = migrateLegacyRegionForEditing(
                settings.footer,
                handout?.settings?.footer
            );

            return model.assertValidHandout({
                ...handout,
                settings
            });
        };

        const persistentContent = handout => {
            const {
                createdAt,
                updatedAt,
                revision,
                ...content
            } = handout;

            return content;
        };

        const createEditorState = handout => ({
            handout: normalizeForEditing(handout),
            selectedBlockId: null,
            undoStack: [],
            redoStack: [],
            dirty: false,
            lastMutationKey: '',
            lastMutationAt: 0
        });

        const getSelectedBlock = state =>
            state.handout.blocks.find(
                block => block.id === state.selectedBlockId
            ) || null;

        const selectBlock = (state, blockId) => ({
            ...state,
            selectedBlockId: state.handout.blocks.some(
                block => block.id === blockId
            )
                ? blockId
                : null
        });

        const commitHandout = (
            state,
            nextHandout,
            {
                selectedBlockId = state.selectedBlockId,
                mutationKey = '',
                now = Date.now()
            } = {}
        ) => {
            const next = normalizeForEditing(nextHandout);

            if (model.deepEqual(state.handout, next)) {
                return selectBlock(state, selectedBlockId);
            }

            const coalesced = (
                mutationKey
                && mutationKey === state.lastMutationKey
                && now - state.lastMutationAt <= COALESCE_WINDOW_MS
            );
            const undoStack = coalesced
                ? state.undoStack
                : [
                    ...state.undoStack,
                    clone(state.handout)
                ].slice(-HISTORY_LIMIT);

            return {
                handout: next,
                selectedBlockId: next.blocks.some(
                    block => block.id === selectedBlockId
                )
                    ? selectedBlockId
                    : null,
                undoStack,
                redoStack: [],
                dirty: true,
                lastMutationKey: mutationKey,
                lastMutationAt: now
            };
        };

        const createBlock = (
            type,
            {
                id,
                assetId = ''
            } = {}
        ) => {
            const blockId = String(id || '').trim();

            if (!blockId) {
                throw new TypeError('block id is required');
            }

            const blocks = {
                heading: {
                    id: blockId,
                    type: 'heading',
                    level: 1,
                    text: '新标题'
                },
                body: {
                    id: blockId,
                    type: 'body',
                    content: '请输入正文内容'
                },
                callout: {
                    id: blockId,
                    type: 'callout',
                    variant: 'note',
                    title: '提示',
                    content: '请输入提示内容'
                },
                image: {
                    id: blockId,
                    type: 'image',
                    assetId,
                    source: 'handout',
                    placement: 'block',
                    width: {
                        value: 80,
                        unit: 'mm'
                    },
                    alignment: 'center',
                    caption: '',
                    keepAspectRatio: true
                },
                'page-break': {
                    id: blockId,
                    type: 'page-break'
                }
            };

            if (!blocks[type]) {
                throw new TypeError(`unsupported block type: ${type}`);
            }

            return clone(blocks[type]);
        };

        const insertBlock = (
            state,
            block,
            {
                afterBlockId = state.selectedBlockId
            } = {}
        ) => {
            const blocks = [...state.handout.blocks];
            const index = blocks.findIndex(
                item => item.id === afterBlockId
            );
            blocks.splice(
                index >= 0 ? index + 1 : blocks.length,
                0,
                block
            );

            return commitHandout(
                state,
                {
                    ...state.handout,
                    blocks
                },
                {
                    selectedBlockId: block.id,
                    mutationKey: `insert:${block.id}`
                }
            );
        };

        const updateBlock = (
            state,
            blockId,
            updater,
            {
                mutationKey = `block:${blockId}`
            } = {}
        ) => {
            let found = false;
            const blocks = state.handout.blocks.map(block => {
                if (block.id !== blockId) return block;
                found = true;
                const next = typeof updater === 'function'
                    ? updater(clone(block))
                    : {
                        ...block,
                        ...clone(updater)
                    };
                return next;
            });

            if (!found) {
                throw new Error(`handout block ${blockId} does not exist`);
            }

            return commitHandout(
                state,
                {
                    ...state.handout,
                    blocks
                },
                {
                    selectedBlockId: blockId,
                    mutationKey
                }
            );
        };

        const deleteBlock = (state, blockId) => {
            const index = state.handout.blocks.findIndex(
                block => block.id === blockId
            );

            if (index < 0) return state;

            const blocks = state.handout.blocks.filter(
                block => block.id !== blockId
            );
            const nextSelection = blocks[
                Math.min(index, blocks.length - 1)
            ]?.id || null;

            return commitHandout(
                state,
                {
                    ...state.handout,
                    blocks
                },
                {
                    selectedBlockId: nextSelection,
                    mutationKey: `delete:${blockId}`
                }
            );
        };

        const copyBlock = (
            state,
            blockId,
            {
                createId
            }
        ) => {
            if (typeof createId !== 'function') {
                throw new TypeError('createId is required');
            }

            const source = state.handout.blocks.find(
                block => block.id === blockId
            );

            if (!source) {
                throw new Error(`handout block ${blockId} does not exist`);
            }

            const copied = clone(source);
            copied.id = String(createId('block'));

            if (copied.type === 'image') {
                copied.imageId = `${copied.id}-image`;
            }
            if (copied.type === 'question') {
                copied.images = copied.images.map((image, index) => ({
                    ...image,
                    id: `${copied.id}-image-${index + 1}`
                }));
            }

            return insertBlock(
                state,
                copied,
                {
                    afterBlockId: blockId
                }
            );
        };

        const moveBlock = (state, blockId, offset) => {
            const blocks = [...state.handout.blocks];
            const index = blocks.findIndex(block => block.id === blockId);
            const target = index + Number(offset);

            if (
                index < 0
                || target < 0
                || target >= blocks.length
            ) {
                return state;
            }

            const [block] = blocks.splice(index, 1);
            blocks.splice(target, 0, block);

            return commitHandout(
                state,
                {
                    ...state.handout,
                    blocks
                },
                {
                    selectedBlockId: blockId,
                    mutationKey: `move:${blockId}:${target}`
                }
            );
        };

        const undo = state => {
            const previous = state.undoStack.at(-1);
            if (!previous) return state;

            return {
                ...state,
                handout: normalizeForEditing(previous),
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [
                    ...state.redoStack,
                    clone(state.handout)
                ].slice(-HISTORY_LIMIT),
                selectedBlockId: previous.blocks.some(
                    block => block.id === state.selectedBlockId
                )
                    ? state.selectedBlockId
                    : null,
                dirty: true,
                lastMutationKey: '',
                lastMutationAt: 0
            };
        };

        const redo = state => {
            const next = state.redoStack.at(-1);
            if (!next) return state;

            return {
                ...state,
                handout: normalizeForEditing(next),
                undoStack: [
                    ...state.undoStack,
                    clone(state.handout)
                ].slice(-HISTORY_LIMIT),
                redoStack: state.redoStack.slice(0, -1),
                selectedBlockId: next.blocks.some(
                    block => block.id === state.selectedBlockId
                )
                    ? state.selectedBlockId
                    : null,
                dirty: true,
                lastMutationKey: '',
                lastMutationAt: 0
            };
        };

        const updateQuestionOverride = (
            state,
            blockId,
            field,
            value
        ) => updateBlock(
            state,
            blockId,
            block => {
                if (block.type !== 'question') {
                    throw new TypeError(
                        `block ${blockId} is not a question`
                    );
                }

                const overrides = {
                    ...block.contentOverrides
                };

                if (model.deepEqual(block.snapshot[field], value)) {
                    delete overrides[field];
                } else {
                    overrides[field] = clone(value);
                }

                return {
                    ...block,
                    contentOverrides: overrides
                };
            },
            {
                mutationKey: `question:${blockId}:${field}`
            }
        );

        const restoreQuestionContent = (
            state,
            blockId,
            field
        ) => updateBlock(
            state,
            blockId,
            block => {
                const overrides = {
                    ...block.contentOverrides
                };

                if (field) {
                    delete overrides[field];
                } else {
                    for (const key of Object.keys(overrides)) {
                        delete overrides[key];
                    }
                }

                return {
                    ...block,
                    contentOverrides: overrides
                };
            },
            {
                mutationKey: `restore:${blockId}:${field || 'all'}`
            }
        );

        const restoreQuestionImages = (state, blockId) =>
            updateBlock(
                state,
                blockId,
                block => {
                    const next = {
                        ...block
                    };
                    delete next.images;
                    return next;
                },
                {
                    mutationKey: `restore-images:${blockId}`
                }
            );

        const updateSettings = (
            state,
            section,
            patch
        ) => commitHandout(
            state,
            {
                ...state.handout,
                settings: {
                    ...state.handout.settings,
                    [section]: {
                        ...state.handout.settings[section],
                        ...clone(patch)
                    }
                }
            },
            {
                mutationKey: `settings:${section}`
            }
        );

        const acknowledgeSave = (
            state,
            submittedHandout,
            savedHandout
        ) => {
            const unchangedSinceSubmit = model.deepEqual(
                persistentContent(state.handout),
                persistentContent(submittedHandout)
            );

            return {
                ...state,
                handout: unchangedSinceSubmit
                    ? normalizeForEditing(savedHandout)
                    : normalizeForEditing({
                        ...state.handout,
                        createdAt: savedHandout.createdAt,
                        updatedAt: savedHandout.updatedAt,
                        revision: savedHandout.revision
                    }),
                dirty: !unchangedSinceSubmit,
                lastMutationKey: '',
                lastMutationAt: 0
            };
        };

        const acceptPersistedChange = (
            state,
            handout,
            selectedBlockId = null
        ) => {
            const committed = commitHandout(
                state,
                handout,
                {
                    selectedBlockId,
                    mutationKey: `persisted:${handout.revision}`
                }
            );

            return {
                ...committed,
                dirty: false,
                lastMutationKey: '',
                lastMutationAt: 0
            };
        };

        return {
            HISTORY_LIMIT,
            COALESCE_WINDOW_MS,
            DEFAULT_SETTINGS,
            mergeRecord,
            normalizeForEditing,
            persistentContent,
            createEditorState,
            getSelectedBlock,
            selectBlock,
            commitHandout,
            createBlock,
            insertBlock,
            updateBlock,
            deleteBlock,
            copyBlock,
            moveBlock,
            undo,
            redo,
            updateQuestionOverride,
            restoreQuestionContent,
            restoreQuestionImages,
            updateSettings,
            acknowledgeSave,
            acceptPersistedChange
        };
    }
);
