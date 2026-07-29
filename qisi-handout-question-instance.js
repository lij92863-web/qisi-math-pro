(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const api = factory(model);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutQuestionInstance = api;

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

        const QUESTION_SNAPSHOT_VERSION =
            model.QUESTION_SNAPSHOT_VERSION;
        const SNAPSHOT_FIELDS = model.QUESTION_SNAPSHOT_FIELDS;
        const OVERRIDABLE_FIELDS = new Set(
            model.QUESTION_OVERRIDE_FIELDS
        );

        const isPlainObject = value =>
            Boolean(value)
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.getPrototypeOf(value) === Object.prototype;

        const isBlob = value =>
            typeof Blob !== 'undefined'
            && value instanceof Blob;

        const cloneBlob = blob =>
            blob.slice(0, blob.size, blob.type || 'application/octet-stream');

        const clone = model.cloneValue;
        const normalizeTimestamp = (value, label, { optional = false } = {}) => {
            const source = value instanceof Date
                ? value
                : String(value ?? '').trim();

            if (
                (
                    source === ''
                    || source == null
                )
                && optional
            ) {
                return '';
            }

            let parsed;
            if (source instanceof Date) {
                parsed = source.getTime();
            } else if (
                typeof value === 'number'
                && Number.isFinite(value)
            ) {
                parsed = value;
            } else if (/^\d{10}$/.test(source)) {
                parsed = Number(source) * 1_000;
            } else if (/^\d{13}$/.test(source)) {
                parsed = Number(source);
            } else {
                parsed = Date.parse(source);
            }
            if (
                !Number.isFinite(parsed)
                || !Number.isFinite(new Date(parsed).getTime())
            ) {
                throw new TypeError(`${label} is invalid`);
            }

            return new Date(parsed).toISOString();
        };

        const sourceImageIdOf = image => String(
            typeof image === 'string'
                ? image
                : image?.sourceImageId || image?.imageId || image?.id || ''
        ).trim();

        const cleanImageEvidence = (image, sourceImageId, assetId) => {
            const value = isPlainObject(image) ? image : {};
            const {
                blob,
                dataUrl,
                objectUrl,
                url,
                id,
                imageId,
                ...evidence
            } = value;

            return {
                ...clone(evidence),
                sourceImageId,
                assetId
            };
        };

        const createQuestionSnapshot = (
            question,
            {
                capturedAt,
                assetIdBySourceImageId = {}
            } = {}
        ) => {
            if (!isPlainObject(question)) {
                throw new TypeError('source question must be an object');
            }

            const sourceQuestionId = String(question.id || '').trim();

            if (!sourceQuestionId) {
                throw new TypeError('source question is missing its id');
            }

            const images = Array.isArray(question.images)
                ? question.images.map(image => {
                    const sourceImageId = sourceImageIdOf(image);
                    const assetId = String(
                        assetIdBySourceImageId[sourceImageId] || ''
                    ).trim();

                    if (!sourceImageId || !assetId) {
                        const error = new Error(
                            `question ${sourceQuestionId} image ${sourceImageId || 'unknown'} was not copied`
                        );
                        error.code = 'HANDOUT_ASSET_MISSING';
                        throw error;
                    }

                    return cleanImageEvidence(image, sourceImageId, assetId);
                })
                : [];
            const snapshot = {
                snapshotVersion: QUESTION_SNAPSHOT_VERSION,
                sourceQuestionId,
                sourceUpdatedAt: normalizeTimestamp(
                    question.updatedAt || question.createdAt,
                    `question ${sourceQuestionId} source timestamp`,
                    { optional: true }
                ),
                capturedAt: normalizeTimestamp(
                    capturedAt || new Date().toISOString(),
                    `question ${sourceQuestionId} capture timestamp`
                ),
                images
            };

            for (const field of SNAPSHOT_FIELDS) {
                if (field === 'images') continue;
                snapshot[field] = clone(question[field]);
            }

            return snapshot;
        };

        const createQuestionAssetCopies = (
            {
                handoutId,
                question,
                sourceImages,
                createAssetId,
                now
            }
        ) => {
            const normalizedHandoutId = String(handoutId || '').trim();
            const sourceQuestionId = String(question?.id || '').trim();
            const timestamp = String(now || new Date().toISOString());
            const sourceById = new Map();
            const assetIdBySourceImageId = {};
            const assets = [];
            const usedAssetIds = new Set();

            if (!normalizedHandoutId || !sourceQuestionId) {
                throw new TypeError(
                    'handoutId and source question id are required'
                );
            }
            if (
                question.images != null
                && !Array.isArray(question.images)
            ) {
                throw new TypeError('source question images must be an array');
            }
            if (!Array.isArray(sourceImages)) {
                throw new TypeError('sourceImages must be an array');
            }

            for (const record of sourceImages) {
                const id = String(record?.id || '').trim();

                if (!id) continue;
                if (sourceById.has(id)) {
                    throw new Error(`duplicate source image record: ${id}`);
                }
                sourceById.set(id, record);
            }

            for (const image of question?.images || []) {
                const sourceImageId = sourceImageIdOf(image);

                if (assetIdBySourceImageId[sourceImageId]) {
                    continue;
                }

                const source = sourceById.get(sourceImageId);

                if (!source || !isBlob(source.blob) || source.blob.size < 1) {
                    const error = new Error(
                        `source image ${sourceImageId || 'unknown'} is unavailable`
                    );
                    error.code = 'HANDOUT_ASSET_MISSING';
                    throw error;
                }

                const assetId = String(createAssetId()).trim();
                if (!assetId || usedAssetIds.has(assetId)) {
                    throw new Error(
                        `asset id factory returned an invalid or duplicate id: ${assetId || 'empty'}`
                    );
                }
                usedAssetIds.add(assetId);
                const blob = cloneBlob(source.blob);

                assetIdBySourceImageId[sourceImageId] = assetId;
                assets.push({
                    id: assetId,
                    handoutId: normalizedHandoutId,
                    kind: 'question-image',
                    sourceQuestionId,
                    sourceImageId,
                    blob,
                    mimeType: blob.type || '',
                    byteSize: blob.size,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });
            }

            return {
                assets,
                assetIdBySourceImageId
            };
        };

        const captureQuestionForHandout = options => {
            if (typeof options?.createAssetId !== 'function') {
                throw new TypeError('createAssetId is required');
            }

            const copied = createQuestionAssetCopies(options);
            const snapshot = createQuestionSnapshot(options.question, {
                capturedAt: options.now,
                assetIdBySourceImageId: copied.assetIdBySourceImageId
            });

            return {
                snapshot,
                assets: copied.assets
            };
        };

        const normalizeOverrides = value => {
            if (!isPlainObject(value || {})) {
                throw new TypeError('question overrides must be an object');
            }

            const overrides = {};

            for (const [field, next] of Object.entries(value || {})) {
                if (!OVERRIDABLE_FIELDS.has(field)) {
                    throw new TypeError(`unsupported question override: ${field}`);
                }
                overrides[field] = clone(next);
            }

            return overrides;
        };

        const applyQuestionOverrides = (snapshot, value = {}) => {
            if (!isPlainObject(snapshot)) {
                throw new TypeError('question snapshot must be an object');
            }

            return {
                ...clone(snapshot),
                ...normalizeOverrides(value)
            };
        };

        const deriveQuestionOverrides = (snapshot, edited) => {
            if (!isPlainObject(snapshot) || !isPlainObject(edited)) {
                throw new TypeError('snapshot and edited question must be objects');
            }

            const overrides = {};

            for (const field of OVERRIDABLE_FIELDS) {
                if (
                    Object.prototype.hasOwnProperty.call(edited, field)
                    && !model.deepEqual(snapshot[field], edited[field])
                ) {
                    overrides[field] = clone(edited[field]);
                }
            }

            return overrides;
        };

        const sourceComparableValue = (field, question) => {
            if (field !== 'images') {
                return clone(question?.[field]);
            }

            return (question?.images || []).map(image => {
                const value = isPlainObject(image) ? image : {};
                const {
                    blob,
                    dataUrl,
                    objectUrl,
                    url,
                    assetId,
                    id,
                    imageId,
                    ...evidence
                } = value;

                return {
                    ...clone(evidence),
                    sourceImageId: sourceImageIdOf(image)
                };
            });
        };

        const snapshotComparableValue = (field, snapshot) => {
            if (field !== 'images') {
                return clone(snapshot?.[field]);
            }

            return (snapshot?.images || []).map(image => {
                const {
                    assetId,
                    ...evidence
                } = image || {};

                return clone(evidence);
            });
        };

        const compareQuestionSource = (
            snapshot,
            sourceQuestion,
            value = {}
        ) => {
            if (!isPlainObject(snapshot)) {
                throw new TypeError('question snapshot must be an object');
            }
            if (!sourceQuestion) {
                return {
                    status: 'missing',
                    changedFields: [],
                    conflictFields: [],
                    sourceTimestampChanged: false
                };
            }
            if (
                String(sourceQuestion.id || '').trim()
                !== String(snapshot.sourceQuestionId || '').trim()
            ) {
                const error = new Error(
                    `source question identity mismatch: expected ${snapshot.sourceQuestionId}, received ${sourceQuestion.id || 'unknown'}`
                );
                error.code = 'HANDOUT_SOURCE_ID_MISMATCH';
                throw error;
            }

            const overrides = normalizeOverrides(value);
            const changedFields = SNAPSHOT_FIELDS.filter(field =>
                !model.deepEqual(
                    snapshotComparableValue(field, snapshot),
                    sourceComparableValue(field, sourceQuestion)
                )
            );
            const conflictFields = changedFields.filter(field =>
                Object.prototype.hasOwnProperty.call(overrides, field)
            );

            return {
                status: changedFields.length ? 'updated' : 'unchanged',
                changedFields,
                conflictFields,
                sourceTimestampChanged: (
                    String(snapshot.sourceUpdatedAt || '')
                    !== normalizeTimestamp(
                        sourceQuestion.updatedAt || sourceQuestion.createdAt,
                        `question ${sourceQuestion.id} source timestamp`,
                        { optional: true }
                    )
                )
            };
        };

        return {
            QUESTION_SNAPSHOT_VERSION,
            SNAPSHOT_FIELDS,
            createQuestionSnapshot,
            createQuestionAssetCopies,
            captureQuestionForHandout,
            normalizeOverrides,
            applyQuestionOverrides,
            deriveQuestionOverrides,
            compareQuestionSource
        };
    }
);
