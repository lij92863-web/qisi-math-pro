(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutModel = api;

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

        const HANDOUT_SCHEMA_VERSION = 1;
        const HANDOUT_STATUS = Object.freeze([
            'draft',
            'archived'
        ]);
        const HANDOUT_BLOCK_TYPES = Object.freeze([
            'heading',
            'body',
            'callout',
            'image',
            'page-break',
            'question'
        ]);
        const QUESTION_SNAPSHOT_VERSION = 1;
        const QUESTION_SNAPSHOT_FIELDS = Object.freeze([
            'title',
            'questionNumber',
            'grade',
            'diff',
            'type',
            'knowledge',
            'knowledgeType',
            'systemKnowledge',
            'personalKnowledge',
            'knowledgePoints',
            'tags',
            'source',
            'year',
            'stem',
            'options',
            'answer',
            'analysis',
            'solution',
            'teacherNote',
            'images',
            'layout',
            'meta',
            'sourceTrace'
        ]);
        const QUESTION_OVERRIDE_FIELDS = Object.freeze(
            QUESTION_SNAPSHOT_FIELDS.filter(field =>
                ![
                    'images',
                    'layout',
                    'meta',
                    'sourceTrace'
                ].includes(field)
            )
        );
        const CALLOUT_VARIANTS = Object.freeze([
            'method',
            'warning',
            'note',
            'teacher',
            'conclusion'
        ]);
        const IMAGE_PLACEMENTS = Object.freeze([
            'below-stem',
            'right-of-stem',
            'right-of-options',
            'block',
            'inline'
        ]);
        const IMAGE_ALIGNMENTS = Object.freeze([
            'left',
            'center',
            'right',
            'inline'
        ]);
        const IMAGE_WIDTH_UNITS = Object.freeze([
            'mm',
            'percent'
        ]);
        const OPTION_LAYOUT_MODES = Object.freeze([
            'auto',
            'one-row',
            'two-columns',
            'one-column'
        ]);
        const MULTI_IMAGE_LAYOUT_MODES = Object.freeze([
            'flow',
            'vertical',
            'row',
            'grid'
        ]);
        const DISPLAY_LABEL_TYPES = Object.freeze([
            'preset',
            'custom'
        ]);
        const INHERITED_VISIBILITY = Object.freeze([
            true,
            false,
            'inherit'
        ]);
        const CONTENT_PLACEMENTS = Object.freeze([
            'inherit',
            'hidden',
            'inline',
            'after-question',
            'end'
        ]);
        const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
        const MAX_TITLE_LENGTH = 160;
        const MAX_BLOCKS = 2000;
        const MAX_TEXT_LENGTH = 1_000_000;
        const MAX_IMAGES_PER_BLOCK = 100;

        const isPlainObject = value =>
            Boolean(value)
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.getPrototypeOf(value) === Object.prototype;

        const cloneValue = (value, ancestors = new WeakSet()) => {
            if (
                value == null
                || typeof value === 'string'
                || typeof value === 'boolean'
                || typeof value === 'undefined'
            ) {
                return value;
            }
            if (typeof value === 'number') {
                if (!Number.isFinite(value)) {
                    throw new TypeError(
                        'handout data contains a non-finite number'
                    );
                }
                return value;
            }
            if (
                typeof value !== 'object'
                || (!Array.isArray(value) && !isPlainObject(value))
            ) {
                throw new TypeError(
                    'handout data must contain only plain serializable values'
                );
            }
            if (ancestors.has(value)) {
                throw new TypeError('handout data must not contain cycles');
            }

            ancestors.add(value);

            let cloned;
            if (Array.isArray(value)) {
                cloned = value.map(item => cloneValue(item, ancestors));
            } else {
                cloned = Object.fromEntries(
                    Object.entries(value).map(([key, item]) => [
                        key,
                        cloneValue(item, ancestors)
                    ])
                );
            }

            ancestors.delete(value);
            return cloned;
        };

        const deepEqual = (left, right) => {
            if (Object.is(left, right)) return true;
            if (Array.isArray(left) || Array.isArray(right)) {
                return (
                    Array.isArray(left)
                    && Array.isArray(right)
                    && left.length === right.length
                    && left.every((item, index) => deepEqual(item, right[index]))
                );
            }
            if (isPlainObject(left) || isPlainObject(right)) {
                if (!isPlainObject(left) || !isPlainObject(right)) return false;

                const leftKeys = Object.keys(left).sort();
                const rightKeys = Object.keys(right).sort();

                return (
                    deepEqual(leftKeys, rightKeys)
                    && leftKeys.every(key => deepEqual(left[key], right[key]))
                );
            }
            return false;
        };

        const normalizeIdentifier = (value, label) => {
            const id = String(value || '').trim();

            if (!ID_PATTERN.test(id)) {
                throw new TypeError(`${label} is invalid`);
            }

            return id;
        };

        const normalizeTimestamp = (value, label) => {
            const timestamp = String(value || '').trim();
            const parsed = Date.parse(timestamp);

            if (!timestamp || !Number.isFinite(parsed)) {
                throw new TypeError(`${label} is invalid`);
            }

            return new Date(parsed).toISOString();
        };

        const normalizeTitle = value => {
            const title = String(value || '').replace(/\s+/g, ' ').trim();

            if (!title) {
                throw new TypeError('handout title must not be empty');
            }
            if (title.length > MAX_TITLE_LENGTH) {
                throw new RangeError(
                    `handout title exceeds ${MAX_TITLE_LENGTH} characters`
                );
            }

            return title;
        };

        const normalizeText = (
            value,
            label,
            {
                required = false,
                maxLength = MAX_TEXT_LENGTH
            } = {}
        ) => {
            const text = String(value == null ? '' : value);

            if (required && !text.trim()) {
                throw new TypeError(`${label} must not be empty`);
            }
            if (text.length > maxLength) {
                throw new RangeError(
                    `${label} exceeds ${maxLength} characters`
                );
            }

            return text;
        };

        const normalizeEnum = (value, allowed, label, fallback) => {
            const selected = value == null
                ? fallback
                : value;

            if (!allowed.includes(selected)) {
                throw new TypeError(`${label} is invalid`);
            }

            return selected;
        };

        const normalizeBoolean = (value, label, fallback) => {
            if (value == null) return fallback;
            if (typeof value !== 'boolean') {
                throw new TypeError(`${label} must be a boolean`);
            }
            return value;
        };

        const normalizeInteger = (
            value,
            label,
            {
                fallback,
                minimum,
                maximum
            }
        ) => {
            if (value == null) return fallback;

            const numeric = Number(value);
            if (
                !Number.isInteger(numeric)
                || numeric < minimum
                || numeric > maximum
            ) {
                throw new RangeError(
                    `${label} must be an integer from ${minimum} to ${maximum}`
                );
            }

            return numeric;
        };

        const normalizeQuestionSnapshotImage = (value, index) => {
            if (!isPlainObject(value)) {
                throw new TypeError(
                    `question snapshot image ${index} must be an object`
                );
            }

            return {
                ...cloneValue(value),
                sourceImageId: normalizeIdentifier(
                    value.sourceImageId,
                    `question snapshot image ${index} sourceImageId`
                ),
                assetId: normalizeIdentifier(
                    value.assetId,
                    `question snapshot image ${index} assetId`
                )
            };
        };

        const normalizeQuestionSnapshot = (value, blockId) => {
            if (!isPlainObject(value)) {
                throw new TypeError(
                    `question block ${blockId} is missing its snapshot`
                );
            }

            const version = Number(value.snapshotVersion);

            if (version !== QUESTION_SNAPSHOT_VERSION) {
                throw new TypeError(
                    `question block ${blockId} snapshot version is invalid`
                );
            }

            const images = Array.isArray(value.images)
                ? value.images
                : [];

            if (images.length > MAX_IMAGES_PER_BLOCK) {
                throw new RangeError(
                    `question block ${blockId} has too many snapshot images`
                );
            }

            const snapshot = {
                snapshotVersion: QUESTION_SNAPSHOT_VERSION,
                sourceQuestionId: normalizeIdentifier(
                    value.sourceQuestionId,
                    `question block ${blockId} snapshot sourceQuestionId`
                ),
                sourceUpdatedAt: value.sourceUpdatedAt
                    ? normalizeTimestamp(
                        value.sourceUpdatedAt,
                        `question block ${blockId} snapshot sourceUpdatedAt`
                    )
                    : '',
                capturedAt: normalizeTimestamp(
                    value.capturedAt,
                    `question block ${blockId} snapshot capturedAt`
                )
            };

            for (const field of QUESTION_SNAPSHOT_FIELDS) {
                snapshot[field] = field === 'images'
                    ? images.map(normalizeQuestionSnapshotImage)
                    : cloneValue(value[field]);
            }

            return snapshot;
        };

        const normalizeContentOverrides = (value, blockId) => {
            if (!isPlainObject(value || {})) {
                throw new TypeError(
                    `question block ${blockId} contentOverrides must be an object`
                );
            }

            const allowed = new Set(QUESTION_OVERRIDE_FIELDS);
            const overrides = {};

            for (const [field, next] of Object.entries(value || {})) {
                if (!allowed.has(field)) {
                    throw new TypeError(
                        `question block ${blockId} has unsupported content override ${field}`
                    );
                }
                overrides[field] = cloneValue(next);
            }

            return overrides;
        };

        const normalizeImageWidth = (value, label) => {
            const width = isPlainObject(value) ? value : {};
            const numeric = Number(width.value ?? width.width ?? 45);
            const unit = normalizeEnum(
                width.unit,
                IMAGE_WIDTH_UNITS,
                `${label} unit`,
                'mm'
            );
            const maximum = unit === 'percent' ? 100 : 190;

            if (!Number.isFinite(numeric) || numeric <= 0 || numeric > maximum) {
                throw new RangeError(
                    `${label} value must be greater than 0 and at most ${maximum} ${unit}`
                );
            }

            return {
                value: numeric,
                unit
            };
        };

        const normalizeImageInstance = (
            value,
            index,
            {
                defaultId,
                defaultPlacement = 'block'
            } = {}
        ) => {
            if (!isPlainObject(value)) {
                throw new TypeError(`image ${index} must be an object`);
            }

            return {
                id: normalizeIdentifier(
                    value.id || defaultId,
                    `image ${index} id`
                ),
                assetId: normalizeIdentifier(
                    value.assetId,
                    `image ${index} assetId`
                ),
                sourceImageId: value.sourceImageId
                    ? normalizeIdentifier(
                        value.sourceImageId,
                        `image ${index} sourceImageId`
                    )
                    : '',
                source: normalizeEnum(
                    value.source,
                    ['question', 'handout'],
                    `image ${index} source`,
                    value.sourceImageId ? 'question' : 'handout'
                ),
                placement: normalizeEnum(
                    value.placement,
                    IMAGE_PLACEMENTS,
                    `image ${index} placement`,
                    defaultPlacement
                ),
                width: normalizeImageWidth(
                    value.width || value.dimensions,
                    `image ${index} width`
                ),
                alignment: normalizeEnum(
                    value.alignment || value.align,
                    IMAGE_ALIGNMENTS,
                    `image ${index} alignment`,
                    'center'
                ),
                caption: normalizeText(
                    value.caption,
                    `image ${index} caption`,
                    { maxLength: 500 }
                ),
                order: normalizeInteger(
                    value.order,
                    `image ${index} order`,
                    {
                        fallback: index,
                        minimum: 0,
                        maximum: MAX_IMAGES_PER_BLOCK - 1
                    }
                ),
                keepAspectRatio: normalizeBoolean(
                    value.keepAspectRatio,
                    `image ${index} keepAspectRatio`,
                    true
                )
            };
        };

        const normalizeQuestionBlock = block => {
            const sourceQuestionId = String(
                block.sourceQuestionId
                || block.snapshot?.sourceQuestionId
                || ''
            ).trim();

            if (!sourceQuestionId) {
                throw new TypeError(
                    `question block ${block.id} is missing sourceQuestionId`
                );
            }
            const snapshot = normalizeQuestionSnapshot(
                block.snapshot,
                block.id
            );
            if (
                snapshot.sourceQuestionId
                !== sourceQuestionId
            ) {
                throw new Error(
                    `question block ${block.id} source identity is inconsistent`
                );
            }

            const rawSourceUpdatedAt = String(
                block.sourceUpdatedAt
                || snapshot.sourceUpdatedAt
                || ''
            );
            const sourceUpdatedAt = rawSourceUpdatedAt
                ? normalizeTimestamp(
                    rawSourceUpdatedAt,
                    `question block ${block.id} sourceUpdatedAt`
                )
                : '';

            if (
                block.sourceUpdatedAt
                && snapshot.sourceUpdatedAt
                && normalizeTimestamp(
                    block.sourceUpdatedAt,
                    `question block ${block.id} sourceUpdatedAt`
                )
                    !== snapshot.sourceUpdatedAt
            ) {
                throw new Error(
                    `question block ${block.id} source timestamp is inconsistent`
                );
            }

            const sourceImages = snapshot.images.map((image, index) =>
                normalizeImageInstance(
                    {
                        ...image,
                        source: 'question'
                    },
                    index,
                    {
                        defaultId: `${block.id}-image-${index + 1}`,
                        defaultPlacement: 'below-stem'
                    }
                )
            );
            const images = block.images == null
                ? sourceImages
                : block.images;

            if (!Array.isArray(images) || images.length > MAX_IMAGES_PER_BLOCK) {
                throw new TypeError(
                    `question block ${block.id} images must be a bounded array`
                );
            }

            const normalizedImages = images.map((image, index) =>
                normalizeImageInstance(
                    image,
                    index,
                    {
                        defaultId: `${block.id}-image-${index + 1}`,
                        defaultPlacement: 'below-stem'
                    }
                )
            );
            const imageIds = normalizedImages.map(image => image.id);

            if (new Set(imageIds).size !== imageIds.length) {
                throw new Error(
                    `question block ${block.id} contains duplicate image ids`
                );
            }

            const display = isPlainObject(block.display || {})
                ? block.display || {}
                : null;
            const questionLabel = isPlainObject(block.questionLabel || {})
                ? block.questionLabel || {}
                : null;
            const optionLayout = isPlainObject(block.optionLayout || {})
                ? block.optionLayout || {}
                : null;
            const imageLayout = isPlainObject(block.imageLayout || {})
                ? block.imageLayout || {}
                : null;
            const latexNormalization = isPlainObject(
                block.latexNormalization || {}
            )
                ? block.latexNormalization || {}
                : null;

            if (
                !display
                || !questionLabel
                || !optionLayout
                || !imageLayout
                || !latexNormalization
            ) {
                throw new TypeError(
                    `question block ${block.id} layout settings must be objects`
                );
            }
            if (
                block.displayLabels != null
                && (
                    !Array.isArray(block.displayLabels)
                    || block.displayLabels.length > 12
                )
            ) {
                throw new TypeError(
                    `question block ${block.id} display labels must be a bounded array`
                );
            }

            return {
                id: block.id,
                type: 'question',
                sourceQuestionId,
                sourceUpdatedAt,
                snapshot,
                contentOverrides: normalizeContentOverrides(
                    block.contentOverrides || block.overrides || {},
                    block.id
                ),
                display: {
                    showQuestionNumber: normalizeBoolean(
                        display.showQuestionNumber,
                        `question block ${block.id} showQuestionNumber`,
                        true
                    ),
                    showOptions: normalizeBoolean(
                        display.showOptions,
                        `question block ${block.id} showOptions`,
                        true
                    ),
                    showKnowledgePoints: normalizeEnum(
                        display.showKnowledgePoints,
                        INHERITED_VISIBILITY,
                        `question block ${block.id} showKnowledgePoints`,
                        'inherit'
                    ),
                    showSource: normalizeEnum(
                        display.showSource,
                        INHERITED_VISIBILITY,
                        `question block ${block.id} showSource`,
                        'inherit'
                    ),
                    showTags: normalizeEnum(
                        display.showTags,
                        INHERITED_VISIBILITY,
                        `question block ${block.id} showTags`,
                        'inherit'
                    ),
                    answerPlacement: normalizeEnum(
                        display.answerPlacement,
                        CONTENT_PLACEMENTS,
                        `question block ${block.id} answerPlacement`,
                        'inherit'
                    ),
                    analysisPlacement: normalizeEnum(
                        display.analysisPlacement,
                        CONTENT_PLACEMENTS,
                        `question block ${block.id} analysisPlacement`,
                        'inherit'
                    ),
                    solutionPlacement: normalizeEnum(
                        display.solutionPlacement,
                        CONTENT_PLACEMENTS,
                        `question block ${block.id} solutionPlacement`,
                        'inherit'
                    ),
                    answerSpaceLines: normalizeInteger(
                        display.answerSpaceLines,
                        `question block ${block.id} answerSpaceLines`,
                        {
                            fallback: 0,
                            minimum: 0,
                            maximum: 100
                        }
                    )
                },
                questionLabel: {
                    preset: normalizeText(
                        questionLabel.preset || 'none',
                        `question block ${block.id} label preset`,
                        {
                            required: true,
                            maxLength: 40
                        }
                    ),
                    customText: normalizeText(
                        questionLabel.customText,
                        `question block ${block.id} custom label`,
                        { maxLength: 80 }
                    )
                },
                displayLabels: (
                    block.displayLabels == null
                        ? []
                        : block.displayLabels
                ).map((label, index) => {
                    if (!isPlainObject(label)) {
                        throw new TypeError(
                            `question block ${block.id} display label ${index} must be an object`
                        );
                    }
                    return {
                        type: normalizeEnum(
                            label.type,
                            DISPLAY_LABEL_TYPES,
                            `question block ${block.id} display label ${index} type`,
                            'preset'
                        ),
                        value: normalizeText(
                            label.value,
                            `question block ${block.id} display label ${index} value`,
                            {
                                required: true,
                                maxLength: 80
                            }
                        )
                    };
                }),
                optionLayout: {
                    mode: normalizeEnum(
                        optionLayout.mode,
                        OPTION_LAYOUT_MODES,
                        `question block ${block.id} option layout`,
                        'auto'
                    )
                },
                imageLayout: {
                    mode: normalizeEnum(
                        imageLayout.mode,
                        MULTI_IMAGE_LAYOUT_MODES,
                        `question block ${block.id} image layout`,
                        'flow'
                    ),
                    columns: normalizeInteger(
                        imageLayout.columns,
                        `question block ${block.id} image columns`,
                        {
                            fallback: 2,
                            minimum: 1,
                            maximum: 4
                        }
                    ),
                    gapMm: normalizeInteger(
                        imageLayout.gapMm,
                        `question block ${block.id} image gap`,
                        {
                            fallback: 4,
                            minimum: 0,
                            maximum: 20
                        }
                    )
                },
                images: normalizedImages,
                latexNormalization: {
                    useDisplayFractions: normalizeBoolean(
                        latexNormalization.useDisplayFractions,
                        `question block ${block.id} useDisplayFractions`,
                        false
                    ),
                    normalizePunctuation: normalizeBoolean(
                        latexNormalization.normalizePunctuation,
                        `question block ${block.id} normalizePunctuation`,
                        false
                    ),
                    normalizeSpacing: normalizeBoolean(
                        latexNormalization.normalizeSpacing,
                        `question block ${block.id} normalizeSpacing`,
                        false
                    )
                }
            };
        };

        const normalizeNonQuestionBlock = block => {
            if (block.type === 'heading') {
                const level = Number(block.level);

                if (!Number.isInteger(level) || level < 1 || level > 3) {
                    throw new TypeError(
                        `heading block ${block.id} level must be 1, 2, or 3`
                    );
                }

                return {
                    id: block.id,
                    type: block.type,
                    level,
                    text: normalizeText(
                        block.text,
                        `heading block ${block.id} text`,
                        {
                            required: true,
                            maxLength: 500
                        }
                    )
                };
            }
            if (block.type === 'body') {
                return {
                    id: block.id,
                    type: block.type,
                    content: normalizeText(
                        block.content ?? block.text,
                        `body block ${block.id} content`,
                        { required: true }
                    )
                };
            }
            if (block.type === 'callout') {
                return {
                    id: block.id,
                    type: block.type,
                    variant: normalizeEnum(
                        block.variant,
                        CALLOUT_VARIANTS,
                        `callout block ${block.id} variant`,
                        'note'
                    ),
                    title: normalizeText(
                        block.title,
                        `callout block ${block.id} title`,
                        { maxLength: 160 }
                    ),
                    content: normalizeText(
                        block.content,
                        `callout block ${block.id} content`,
                        { required: true }
                    )
                };
            }
            if (block.type === 'image') {
                const image = normalizeImageInstance(
                    {
                        ...block,
                        id: block.imageId || `${block.id}-image`
                    },
                    0,
                    {
                        defaultId: `${block.id}-image`,
                        defaultPlacement: 'block'
                    }
                );

                return {
                    ...image,
                    id: block.id,
                    type: block.type,
                    imageId: image.id
                };
            }

            return {
                id: block.id,
                type: 'page-break'
            };
        };

        const normalizeBlock = (value, index) => {
            if (!isPlainObject(value)) {
                throw new TypeError(`handout block ${index} must be an object`);
            }

            const block = {
                ...cloneValue(value),
                id: normalizeIdentifier(value.id, `handout block ${index} id`),
                type: String(value.type || '').trim()
            };

            if (!HANDOUT_BLOCK_TYPES.includes(block.type)) {
                throw new TypeError(
                    `handout block ${block.id} has unsupported type ${block.type}`
                );
            }

            return block.type === 'question'
                ? normalizeQuestionBlock(block)
                : normalizeNonQuestionBlock(block);
        };

        const normalizeBlocks = value => {
            if (!Array.isArray(value)) {
                throw new TypeError('handout blocks must be an array');
            }
            if (value.length > MAX_BLOCKS) {
                throw new RangeError(
                    `handout blocks exceed the ${MAX_BLOCKS} item limit`
                );
            }

            const blocks = value.map(normalizeBlock);
            const ids = new Set();

            for (const block of blocks) {
                if (ids.has(block.id)) {
                    throw new Error(`duplicate handout block id: ${block.id}`);
                }
                ids.add(block.id);
            }

            return blocks;
        };

        const migrateLegacyRecord = value => ({
            schemaVersion: HANDOUT_SCHEMA_VERSION,
            id: value.id,
            title: value.title || value.name || '未命名讲义',
            status: value.status || 'draft',
            blocks: value.blocks || value.items || [],
            settings: value.settings || {},
            createdAt: value.createdAt,
            updatedAt: value.updatedAt || value.createdAt,
            revision: Number(value.revision || 0)
        });

        const migrateHandout = value => {
            if (!isPlainObject(value)) {
                throw new TypeError('handout record must be an object');
            }

            const version = value.schemaVersion == null
                ? 0
                : Number(value.schemaVersion);

            if (!Number.isInteger(version) || version < 0) {
                throw new TypeError('handout schemaVersion is invalid');
            }
            if (version > HANDOUT_SCHEMA_VERSION) {
                throw new Error(
                    `handout schema ${version} is newer than supported version ${HANDOUT_SCHEMA_VERSION}`
                );
            }

            return version === 0
                ? migrateLegacyRecord(value)
                : cloneValue(value);
        };

        const normalizeHandout = value => {
            const migrated = migrateHandout(value);
            const status = String(migrated.status || 'draft').trim();
            const revision = Number(migrated.revision || 0);

            if (!HANDOUT_STATUS.includes(status)) {
                throw new TypeError(`unsupported handout status: ${status}`);
            }
            if (!Number.isInteger(revision) || revision < 0) {
                throw new TypeError('handout revision must be a non-negative integer');
            }
            if (!isPlainObject(migrated.settings || {})) {
                throw new TypeError('handout settings must be an object');
            }

            return {
                schemaVersion: HANDOUT_SCHEMA_VERSION,
                id: normalizeIdentifier(migrated.id, 'handout id'),
                title: normalizeTitle(migrated.title),
                status,
                blocks: normalizeBlocks(migrated.blocks || []),
                settings: cloneValue(migrated.settings || {}),
                createdAt: normalizeTimestamp(
                    migrated.createdAt,
                    'handout createdAt'
                ),
                updatedAt: normalizeTimestamp(
                    migrated.updatedAt,
                    'handout updatedAt'
                ),
                revision
            };
        };

        const validateHandout = value => {
            try {
                return {
                    ok: true,
                    value: normalizeHandout(value),
                    errors: []
                };
            } catch (error) {
                return {
                    ok: false,
                    value: null,
                    errors: [String(error?.message || error)]
                };
            }
        };

        const assertValidHandout = value => {
            const result = validateHandout(value);

            if (!result.ok) {
                const error = new Error(
                    `Invalid handout: ${result.errors.join('; ')}`
                );
                error.code = 'HANDOUT_VALIDATION_FAILED';
                error.validationErrors = result.errors;
                throw error;
            }

            return result.value;
        };

        const createHandout = (
            value = {},
            {
                id,
                now
            } = {}
        ) => {
            const timestamp = normalizeTimestamp(
                now || new Date().toISOString(),
                'handout now'
            );

            return assertValidHandout({
                schemaVersion: HANDOUT_SCHEMA_VERSION,
                id: id || value.id,
                title: value.title || '未命名讲义',
                status: value.status || 'draft',
                blocks: value.blocks || [],
                settings: value.settings || {},
                createdAt: value.createdAt || timestamp,
                updatedAt: value.updatedAt || timestamp,
                revision: value.revision || 0
            });
        };

        return {
            HANDOUT_SCHEMA_VERSION,
            HANDOUT_STATUS,
            HANDOUT_BLOCK_TYPES,
            QUESTION_SNAPSHOT_VERSION,
            QUESTION_SNAPSHOT_FIELDS,
            QUESTION_OVERRIDE_FIELDS,
            IMAGE_PLACEMENTS,
            IMAGE_ALIGNMENTS,
            IMAGE_WIDTH_UNITS,
            OPTION_LAYOUT_MODES,
            MULTI_IMAGE_LAYOUT_MODES,
            DISPLAY_LABEL_TYPES,
            cloneValue,
            deepEqual,
            migrateHandout,
            normalizeHandout,
            validateHandout,
            assertValidHandout,
            createHandout
        };
    }
);
