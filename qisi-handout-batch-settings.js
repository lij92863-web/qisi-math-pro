(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const api = factory(model);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutBatchSettings = api;

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

        const ALLOWED_PATCH_SECTIONS = Object.freeze([
            'display',
            'questionLabel',
            'displayLabels',
            'optionLayout',
            'imageLayout',
            'images'
        ]);
        const ALLOWED_DISPLAY_FIELDS = Object.freeze([
            'showKnowledgePoints',
            'answerPlacement',
            'analysisPlacement',
            'solutionPlacement',
            'answerSpaceLines'
        ]);
        const ALLOWED_IMAGE_FIELDS = Object.freeze([
            'placement',
            'width',
            'alignment'
        ]);

        const isPlainObject = value =>
            Boolean(value)
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.getPrototypeOf(value) === Object.prototype;

        const assertKeys = (value, allowed, label) => {
            if (!isPlainObject(value)) {
                throw new TypeError(`${label} must be an object`);
            }
            for (const key of Object.keys(value)) {
                if (!allowed.includes(key)) {
                    throw new TypeError(
                        `${label} contains unsupported field: ${key}`
                    );
                }
            }
        };

        const normalizePatch = value => {
            assertKeys(value, ALLOWED_PATCH_SECTIONS, 'batch patch');
            const patch = model.cloneValue(value);

            if (patch.display != null) {
                assertKeys(
                    patch.display,
                    ALLOWED_DISPLAY_FIELDS,
                    'batch display patch'
                );
            }
            if (patch.questionLabel != null) {
                assertKeys(
                    patch.questionLabel,
                    ['preset', 'customText'],
                    'batch question label patch'
                );
            }
            if (
                patch.displayLabels != null
                && !Array.isArray(patch.displayLabels)
            ) {
                throw new TypeError(
                    'batch displayLabels patch must be an array'
                );
            }
            if (patch.optionLayout != null) {
                assertKeys(
                    patch.optionLayout,
                    ['mode'],
                    'batch option layout patch'
                );
            }
            if (patch.imageLayout != null) {
                assertKeys(
                    patch.imageLayout,
                    ['mode', 'columns', 'gapMm'],
                    'batch image layout patch'
                );
            }
            if (patch.images != null) {
                assertKeys(
                    patch.images,
                    ALLOWED_IMAGE_FIELDS,
                    'batch image patch'
                );
            }
            if (!Object.keys(patch).length) {
                throw new TypeError('batch patch must not be empty');
            }

            return patch;
        };

        const applyQuestionPatch = (block, patch) => {
            const next = {
                ...block
            };

            for (const section of [
                'display',
                'questionLabel',
                'optionLayout',
                'imageLayout'
            ]) {
                if (patch[section] == null) continue;
                next[section] = {
                    ...next[section],
                    ...model.cloneValue(patch[section])
                };
            }
            if (patch.displayLabels != null) {
                next.displayLabels = model.cloneValue(
                    patch.displayLabels
                );
            }
            if (patch.images != null) {
                next.images = next.images.map(image => ({
                    ...image,
                    ...model.cloneValue(patch.images)
                }));
            }

            return next;
        };

        const applyBatchQuestionSettings = (
            handoutValue,
            questionBlockIds,
            patchValue
        ) => {
            const handout = model.assertValidHandout(handoutValue);
            const ids = [
                ...new Set(
                    (Array.isArray(questionBlockIds)
                        ? questionBlockIds
                        : [])
                        .map(value => String(value || '').trim())
                        .filter(Boolean)
                )
            ];
            const patch = normalizePatch(patchValue);

            if (!ids.length) {
                throw new TypeError(
                    'at least one question block must be selected'
                );
            }

            const targets = new Set(ids);
            const existing = new Set(
                handout.blocks
                    .filter(block => block.type === 'question')
                    .map(block => block.id)
            );
            const missing = ids.filter(id => !existing.has(id));

            if (missing.length) {
                throw new Error(
                    `batch question blocks do not exist: ${missing.join(', ')}`
                );
            }

            return model.assertValidHandout({
                ...handout,
                blocks: handout.blocks.map(block =>
                    block.type === 'question' && targets.has(block.id)
                        ? applyQuestionPatch(block, patch)
                        : block
                )
            });
        };

        return {
            ALLOWED_PATCH_SECTIONS,
            ALLOWED_DISPLAY_FIELDS,
            ALLOWED_IMAGE_FIELDS,
            normalizePatch,
            applyBatchQuestionSettings
        };
    }
);
