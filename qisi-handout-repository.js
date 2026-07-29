(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const questionInstance = root.Qisi?.HandoutQuestionInstance
        || (
            typeof require === 'function'
                ? require('./qisi-handout-question-instance.js')
                : null
        );
    const assetModule = root.Qisi?.HandoutAssetRepository
        || (
            typeof require === 'function'
                ? require('./qisi-handout-asset-repository.js')
                : null
        );
    const sourceUpdate = root.Qisi?.HandoutSourceUpdate
        || (
            typeof require === 'function'
                ? require('./qisi-handout-source-update.js')
                : null
        );
    const api = factory(
        model,
        questionInstance,
        assetModule,
        sourceUpdate
    );

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutRepository = api;

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
    function (model, questionInstance, assetModule, sourceUpdate) {
        'use strict';

        if (!model || !questionInstance || !assetModule) {
            throw new Error('handout repository dependencies are unavailable');
        }

        const DEFAULT_REVISION_LIMIT = 20;

        const randomId = prefix => {
            const suffix = globalThis.crypto?.randomUUID?.()
                || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

            return `${prefix}-${suffix}`;
        };

        const requireTable = (db, name) => {
            const table = db?.[name] || db?.table?.(name);

            if (!table) {
                throw new Error(`database table is unavailable: ${name}`);
            }

            return table;
        };

        const clone = model.cloneValue;
        const persistentContent = value => {
            const {
                createdAt,
                updatedAt,
                revision,
                ...content
            } = value;

            return content;
        };
        const samePersistentContent = (left, right) =>
            model.deepEqual(
                persistentContent(left),
                persistentContent(right)
            );

        const createRepositoryError = (code, message) => {
            const error = new Error(message);
            error.code = code;
            return error;
        };

        const requireSourceUpdate = () => {
            if (!sourceUpdate) {
                throw createRepositoryError(
                    'HANDOUT_SOURCE_UPDATE_UNAVAILABLE',
                    'source update policy is unavailable'
                );
            }
            return sourceUpdate;
        };

        const createHandoutRepository = ({
            db,
            clock = () => new Date().toISOString(),
            idFactory = randomId,
            revisionLimit = DEFAULT_REVISION_LIMIT
        }) => {
            if (!db || typeof db.transaction !== 'function') {
                throw new TypeError('Dexie-compatible database is required');
            }
            if (
                !Number.isInteger(revisionLimit)
                || revisionLimit < 1
                || revisionLimit > 200
            ) {
                throw new RangeError('revisionLimit must be between 1 and 200');
            }

            const handouts = requireTable(db, 'handouts');
            const assets = requireTable(db, 'handoutAssets');
            const revisions = requireTable(db, 'handoutRevisions');

            const now = () => new Date(clock()).toISOString();
            const nextId = prefix => String(idFactory(prefix)).trim();
            const inWriteTransaction = callback =>
                db.transaction(
                    'rw',
                    handouts,
                    assets,
                    revisions,
                    callback
                );

            const get = async id => {
                const record = await handouts.get(String(id || ''));
                return record ? model.assertValidHandout(record) : null;
            };

            const list = async () => {
                const rows = await handouts.toArray();
                return rows
                    .map(model.assertValidHandout)
                    .sort((left, right) =>
                        right.updatedAt.localeCompare(left.updatedAt)
                        || left.title.localeCompare(right.title, 'zh-CN')
                    );
            };

            const create = async value => {
                const timestamp = now();
                const handout = model.createHandout(value, {
                    id: value?.id || nextId('handout'),
                    now: timestamp
                });
                const graph = assetModule.verifyHandoutAssetGraph(
                    handout,
                    []
                );

                if (!graph.ok) {
                    throw createRepositoryError(
                        'HANDOUT_ASSET_GRAPH_INVALID',
                        `new handout references missing assets: ${graph.missingIds.join(', ')}`
                    );
                }

                await handouts.add(handout);
                return clone(handout);
            };

            const duplicate = (
                handoutId,
                {
                    title
                } = {}
            ) => inWriteTransaction(async () => {
                const sourceRecord = await handouts.get(
                    String(handoutId || '')
                );

                if (!sourceRecord) {
                    throw createRepositoryError(
                        'HANDOUT_NOT_FOUND',
                        `handout ${handoutId} does not exist`
                    );
                }

                const source = model.assertValidHandout(sourceRecord);
                const sourceAssets = await assets
                    .where('handoutId')
                    .equals(source.id)
                    .toArray();
                const timestamp = now();
                const targetId = nextId('handout');
                const assetIdMap = new Map(
                    sourceAssets.map(asset => [
                        asset.id,
                        nextId('asset')
                    ])
                );
                const copiedContent = assetModule.remapHandoutAssetIds(
                    source,
                    assetIdMap
                );
                const copy = model.assertValidHandout({
                    ...copiedContent,
                    id: targetId,
                    title: title || `${source.title}（副本）`,
                    status: 'draft',
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    revision: 0
                });
                const copiedAssets = sourceAssets.map(asset =>
                    assetModule.normalizeAssetRecord({
                        ...asset,
                        id: assetIdMap.get(asset.id),
                        handoutId: targetId,
                        blob: asset.blob,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    })
                );
                const graph = assetModule.verifyHandoutAssetGraph(
                    copy,
                    copiedAssets
                );

                if (!graph.ok) {
                    throw createRepositoryError(
                        'HANDOUT_ASSET_GRAPH_INVALID',
                        `copied handout asset graph is invalid: ${[
                            ...graph.missingIds,
                            ...graph.invalidBlobIds,
                            ...graph.ownershipMismatchIds,
                            ...graph.duplicateIds
                        ].join(', ')}`
                    );
                }

                await handouts.add(copy);
                if (copiedAssets.length) {
                    await assets.bulkPut(copiedAssets);
                }

                return clone(copy);
            });

            const assertConcurrency = (
                current,
                expectedUpdatedAt
            ) => {
                if (
                    expectedUpdatedAt
                    && current.updatedAt !== expectedUpdatedAt
                ) {
                    throw createRepositoryError(
                        'HANDOUT_CONFLICT',
                        `handout ${current.id} changed after it was opened`
                    );
                }
            };

            const writeRevision = async (
                current,
                reason,
                timestamp
            ) => {
                const record = {
                    id: nextId('revision'),
                    handoutId: current.id,
                    revision: current.revision,
                    reason: String(reason || 'save'),
                    snapshot: clone(current),
                    createdAt: timestamp
                };

                await revisions.add(record);
                return record;
            };

            const trimRevisions = async handoutId => {
                const rows = await revisions
                    .where('handoutId')
                    .equals(handoutId)
                    .toArray();
                const overflow = rows
                    .sort((left, right) =>
                        Number(right.revision) - Number(left.revision)
                        || String(right.createdAt).localeCompare(String(left.createdAt))
                    )
                    .slice(revisionLimit);

                if (overflow.length) {
                    await revisions.bulkDelete(
                        overflow.map(record => record.id)
                    );
                }
            };

            const saveWithinTransaction = async (
                value,
                {
                    expectedUpdatedAt,
                    reason = 'save'
                } = {}
            ) => {
                const proposed = model.assertValidHandout(value);
                const currentRecord = await handouts.get(proposed.id);

                if (!currentRecord) {
                    throw createRepositoryError(
                        'HANDOUT_NOT_FOUND',
                        `handout ${proposed.id} does not exist`
                    );
                }

                const current = model.assertValidHandout(currentRecord);
                assertConcurrency(current, expectedUpdatedAt);
                const assetRows = await assets
                    .where('handoutId')
                    .equals(current.id)
                    .toArray();
                const graph = assetModule.verifyHandoutAssetGraph(
                    proposed,
                    assetRows
                );

                if (!graph.ok) {
                    throw createRepositoryError(
                        'HANDOUT_ASSET_GRAPH_INVALID',
                        `handout asset graph is invalid: ${[
                            ...graph.missingIds,
                            ...graph.invalidBlobIds,
                            ...graph.ownershipMismatchIds,
                            ...graph.duplicateIds
                        ].join(', ')}`
                    );
                }
                if (samePersistentContent(current, proposed)) {
                    return current;
                }

                const timestamp = now();
                await writeRevision(current, reason, timestamp);

                const next = model.assertValidHandout({
                    ...proposed,
                    createdAt: current.createdAt,
                    updatedAt: timestamp,
                    revision: current.revision + 1
                });

                await handouts.put(next);
                await trimRevisions(next.id);
                return next;
            };

            const save = (value, options) =>
                inWriteTransaction(() =>
                    saveWithinTransaction(value, options)
                ).then(clone);

            const autosave = (value, options = {}) =>
                save(value, {
                    ...options,
                    reason: 'autosave'
                });

            const listRevisions = async handoutId => {
                const rows = await revisions
                    .where('handoutId')
                    .equals(String(handoutId || ''))
                    .toArray();

                return rows.sort((left, right) =>
                    Number(right.revision) - Number(left.revision)
                    || String(right.createdAt).localeCompare(String(left.createdAt))
                );
            };

            const restoreRevision = (
                handoutId,
                revisionId,
                options = {}
            ) => inWriteTransaction(async () => {
                const record = await revisions.get(String(revisionId || ''));

                if (
                    !record
                    || record.handoutId !== String(handoutId || '')
                ) {
                    throw createRepositoryError(
                        'HANDOUT_REVISION_NOT_FOUND',
                        `revision ${revisionId} does not belong to handout ${handoutId}`
                    );
                }

                return clone(await saveWithinTransaction(
                    record.snapshot,
                    {
                        ...options,
                        reason: 'restore'
                    }
                ));
            });

            const insertQuestionSnapshot = (
                handoutId,
                {
                    question,
                    sourceImages = [],
                    expectedUpdatedAt
                }
            ) => inWriteTransaction(async () => {
                const currentRecord = await handouts.get(String(handoutId || ''));

                if (!currentRecord) {
                    throw createRepositoryError(
                        'HANDOUT_NOT_FOUND',
                        `handout ${handoutId} does not exist`
                    );
                }

                const current = model.assertValidHandout(currentRecord);
                assertConcurrency(current, expectedUpdatedAt);

                const timestamp = now();
                const captured = questionInstance.captureQuestionForHandout({
                    handoutId: current.id,
                    question,
                    sourceImages,
                    createAssetId: () => nextId('asset'),
                    now: timestamp
                });
                const block = {
                    id: nextId('block'),
                    type: 'question',
                    sourceQuestionId: captured.snapshot.sourceQuestionId,
                    sourceUpdatedAt: captured.snapshot.sourceUpdatedAt,
                    snapshot: captured.snapshot,
                    contentOverrides: {}
                };
                const nextCandidate = {
                    ...current,
                    blocks: [
                        ...current.blocks,
                        block
                    ]
                };
                const existingAssets = await assets
                    .where('handoutId')
                    .equals(current.id)
                    .toArray();
                const graph = assetModule.verifyHandoutAssetGraph(
                    nextCandidate,
                    [
                        ...existingAssets,
                        ...captured.assets
                    ]
                );

                if (!graph.ok) {
                    throw createRepositoryError(
                        'HANDOUT_ASSET_GRAPH_INVALID',
                        `handout asset graph is invalid: ${[
                            ...graph.missingIds,
                            ...graph.invalidBlobIds,
                            ...graph.ownershipMismatchIds,
                            ...graph.duplicateIds
                        ].join(', ')}`
                    );
                }

                await writeRevision(
                    current,
                    'insert-question',
                    timestamp
                );
                if (captured.assets.length) {
                    await assets.bulkPut(
                        captured.assets.map(
                            assetModule.normalizeAssetRecord
                        )
                    );
                }

                const next = model.assertValidHandout({
                    ...nextCandidate,
                    updatedAt: timestamp,
                    revision: current.revision + 1
                });

                await handouts.put(next);
                await trimRevisions(next.id);

                return {
                    handout: clone(next),
                    blockId: block.id,
                    assetIds: captured.assets.map(asset => asset.id)
                };
            });

            const updateQuestionSnapshotFields = (
                handoutId,
                blockId,
                {
                    question,
                    sourceImages = [],
                    selectedFields,
                    acceptedConflictFields = [],
                    expectedUpdatedAt
                } = {}
            ) => inWriteTransaction(async () => {
                const id = String(handoutId || '').trim();
                const targetBlockId = String(blockId || '').trim();
                const currentRecord = await handouts.get(id);

                if (!currentRecord) {
                    throw createRepositoryError(
                        'HANDOUT_NOT_FOUND',
                        `handout ${id} does not exist`
                    );
                }

                const current = model.assertValidHandout(currentRecord);
                assertConcurrency(current, expectedUpdatedAt);
                const block = current.blocks.find(
                    item => item.id === targetBlockId
                );

                if (block?.type !== 'question') {
                    throw createRepositoryError(
                        'HANDOUT_BLOCK_NOT_FOUND',
                        `question block ${targetBlockId} does not exist`
                    );
                }

                const updatePolicy = requireSourceUpdate();
                const plan = updatePolicy.createSourceUpdatePlan(
                    block,
                    question,
                    {
                        selectedFields,
                        acceptedConflictFields
                    }
                );
                const timestamp = now();
                let copiedAssets = [];
                let refreshedImages;

                if (plan.requiresImages) {
                    const copied =
                        questionInstance.createQuestionAssetCopies({
                            handoutId: current.id,
                            question,
                            sourceImages,
                            createAssetId: () => nextId('asset'),
                            now: timestamp
                        });
                    copiedAssets = copied.assets;
                    refreshedImages =
                        questionInstance.createQuestionSnapshot(
                            question,
                            {
                                capturedAt: timestamp,
                                assetIdBySourceImageId:
                                    copied.assetIdBySourceImageId
                            }
                        ).images;
                }

                const nextBlock = updatePolicy.applySourceUpdatePlan(
                    block,
                    question,
                    plan,
                    {
                        refreshedImages,
                        now: timestamp
                    }
                );
                const nextCandidate = {
                    ...current,
                    blocks: current.blocks.map(item =>
                        item.id === targetBlockId
                            ? nextBlock
                            : item
                    )
                };
                const existingAssets = await assets
                    .where('handoutId')
                    .equals(current.id)
                    .toArray();
                const graph = assetModule.verifyHandoutAssetGraph(
                    nextCandidate,
                    [
                        ...existingAssets,
                        ...copiedAssets
                    ]
                );

                if (!graph.ok) {
                    throw createRepositoryError(
                        'HANDOUT_ASSET_GRAPH_INVALID',
                        `updated handout asset graph is invalid: ${[
                            ...graph.missingIds,
                            ...graph.invalidBlobIds,
                            ...graph.ownershipMismatchIds,
                            ...graph.duplicateIds
                        ].join(', ')}`
                    );
                }

                await writeRevision(
                    current,
                    'source-update',
                    timestamp
                );
                if (copiedAssets.length) {
                    await assets.bulkPut(
                        copiedAssets.map(
                            assetModule.normalizeAssetRecord
                        )
                    );
                }

                const next = model.assertValidHandout({
                    ...nextCandidate,
                    updatedAt: timestamp,
                    revision: current.revision + 1
                });
                await handouts.put(next);
                await trimRevisions(next.id);

                return {
                    handout: clone(next),
                    blockId: targetBlockId,
                    updatedFields: [...plan.selectedFields],
                    conflictFields: [
                        ...plan.acceptedConflictFields
                    ],
                    assetIds: copiedAssets.map(asset => asset.id)
                };
            });

            const importAsset = (
                handoutId,
                {
                    blob,
                    kind = 'handout-image',
                    sourceQuestionId = '',
                    sourceImageId = ''
                } = {}
            ) => inWriteTransaction(async () => {
                const id = String(handoutId || '').trim();
                const owner = await handouts.get(id);

                if (!owner) {
                    throw createRepositoryError(
                        'HANDOUT_NOT_FOUND',
                        `handout ${handoutId} does not exist`
                    );
                }

                const timestamp = now();
                const record = assetModule.normalizeAssetRecord({
                    id: nextId('asset'),
                    handoutId: id,
                    kind,
                    sourceQuestionId: String(sourceQuestionId || ''),
                    sourceImageId: String(sourceImageId || ''),
                    blob,
                    createdAt: timestamp,
                    updatedAt: timestamp
                });

                await assets.add(record);

                return {
                    id: record.id,
                    handoutId: record.handoutId,
                    kind: record.kind,
                    mimeType: record.mimeType,
                    byteSize: record.byteSize,
                    createdAt: record.createdAt
                };
            });

            const getAsset = assetId =>
                assets.get(String(assetId || ''));

            const listAssets = handoutId =>
                assets
                    .where('handoutId')
                    .equals(String(handoutId || ''))
                    .toArray();

            const remove = handoutId =>
                inWriteTransaction(async () => {
                    const id = String(handoutId || '');
                    await Promise.all([
                        handouts.delete(id),
                        assets.where('handoutId').equals(id).delete(),
                        revisions.where('handoutId').equals(id).delete()
                    ]);
                });

            return Object.freeze({
                create,
                duplicate,
                get,
                list,
                save,
                autosave,
                listRevisions,
                restoreRevision,
                insertQuestionSnapshot,
                updateQuestionSnapshotFields,
                importAsset,
                getAsset,
                listAssets,
                remove
            });
        };

        return {
            DEFAULT_REVISION_LIMIT,
            createHandoutRepository
        };
    }
);
