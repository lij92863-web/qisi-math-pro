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
    const api = factory(model, questionInstance, assetModule);

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
    function (model, questionInstance, assetModule) {
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
                get,
                list,
                save,
                autosave,
                listRevisions,
                restoreRevision,
                insertQuestionSnapshot,
                remove
            });
        };

        return {
            DEFAULT_REVISION_LIMIT,
            createHandoutRepository
        };
    }
);
