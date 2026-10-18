(function (root, factory) {
    const duplicatePolicy = root?.Qisi?.QuestionDuplicatePolicy || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-question-duplicate-policy.js')
            : null
    );
    const snapshotPolicy = root?.Qisi?.BackupSnapshotPolicy || (
        typeof module !== 'undefined' && module.exports ? require('./qisi-backup-snapshot-policy.js') : null
    );
    const api = factory(duplicatePolicy, snapshotPolicy, work => {
        if (!root.Dexie?.waitFor) throw new Error('Transactional backup comparison is unavailable');
        return root.Dexie.waitFor(work);
    });
    root.Qisi = root.Qisi || {};
    root.Qisi.StorageRepository = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
    defaultDuplicatePolicy, defaultSnapshotPolicy, defaultSnapshotWaitFor
) {
    'use strict';

    const BACKUP_SCHEMA_VERSION = 'qisi.storage.v1';
    const BACKUP_TABLES = Object.freeze([
        'questions', 'images', 'customTemplates', 'personalKnowledge',
        'externalQuestions', 'importBatches', 'mergeBatches',
        'draftImportBatches', 'draftImportFiles', 'draftQuestions',
        'draftImages'
    ]);

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (isRecord(value)) {
            const prototype = Object.getPrototypeOf(value);
            if (prototype && prototype !== Object.prototype) return value;
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    };

    class StorageRepositoryError extends Error {
        constructor(code, message, details = {}) {
            super(message);
            this.name = 'StorageRepositoryError';
            this.code = code;
            this.stage = 'storage';
            this.recoverable = code !== 'corrupt-data';
            this.details = clone(details);
        }
    }

    const normalizeError = (error, operation = 'unknown') => {
        if (error instanceof StorageRepositoryError) return error;
        const name = String(error?.name || '');
        const message = String(error?.message || error || 'Storage failure');
        let code = 'storage-failure';
        if (/quota/i.test(`${name} ${message}`)) code = 'quota-exceeded';
        else if (/version/i.test(`${name} ${message}`)) {
            code = 'version-mismatch';
        } else if (/abort|interrupt|transactioninactive/i.test(
            `${name} ${message}`
        )) {
            code = 'interrupted-write';
        }
        return new StorageRepositoryError(code, message, {
            operation,
            causeName: name
        });
    };

    const requireId = (value, path = 'id') => {
        if (typeof value !== 'string' || !value.trim()) {
            throw new StorageRepositoryError(
                'missing-id',
                `${path} is required.`,
                { path }
            );
        }
        return value;
    };

    const createPreferenceFacade = (
        storage,
        { strict = true, onError = null } = {}
    ) => {
        const report = (error, operation, fallback) => {
            const normalized = normalizeError(error, operation);
            if (typeof onError === 'function') onError(normalized);
            if (strict) throw normalized;
            return fallback;
        };
        const get = (key, fallback = null) => {
            try {
                const value = storage?.getItem(String(key));
                return value == null ? fallback : value;
            } catch (error) {
                return report(error, `preference:get:${key}`, fallback);
            }
        };
        const set = (key, value) => {
            try {
                storage?.setItem(String(key), String(value));
                return true;
            } catch (error) {
                return report(error, `preference:set:${key}`, false);
            }
        };
        const remove = key => {
            try {
                storage?.removeItem(String(key));
                return true;
            } catch (error) {
                return report(error, `preference:remove:${key}`, false);
            }
        };
        const json = (key, fallback = null) => {
            const raw = get(key, null);
            if (raw === null) return clone(fallback);
            try {
                return JSON.parse(raw);
            } catch (_error) {
                return report(
                    new StorageRepositoryError(
                        'corrupt-data',
                        `Preference ${key} contains invalid JSON.`,
                        { key }
                    ),
                    `preference:json:${key}`,
                    clone(fallback)
                );
            }
        };
        const setJson = (key, value) => {
            let serialized;
            try {
                serialized = JSON.stringify(clone(value));
            } catch (error) {
                return report(error, `preference:serialize:${key}`, false);
            }
            return set(key, serialized);
        };
        return Object.freeze({ get, set, remove, json, setJson });
    };

    const validateBackup = backup => {
        if (!isRecord(backup) || !isRecord(backup.tables)) {
            throw new StorageRepositoryError(
                'corrupt-data',
                'Backup must contain a tables object.'
            );
        }
        if (backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
            throw new StorageRepositoryError(
                'version-mismatch',
                `Unsupported backup schema ${backup.schemaVersion || 'missing'}.`,
                {
                    expected: BACKUP_SCHEMA_VERSION,
                    actual: backup.schemaVersion || null
                }
            );
        }
        const tables = {};
        for (const name of BACKUP_TABLES) {
            const rows = backup.tables[name] ?? [];
            if (!Array.isArray(rows)) {
                throw new StorageRepositoryError(
                    'corrupt-data',
                    `Backup table ${name} must be an array.`,
                    { table: name }
                );
            }
            tables[name] = clone(rows);
        }
        return {
            schemaVersion: BACKUP_SCHEMA_VERSION,
            createdAt: backup.createdAt || null,
            tables
        };
    };

    const createRepository = (
        database,
        {
            clock = () => Date.now(),
            admission = {},
            duplicatePolicy = defaultDuplicatePolicy,
            waitFor = defaultSnapshotWaitFor
        } = {}
    ) => {
        if (!database || typeof database.table !== 'function') {
            throw new StorageRepositoryError(
                'database-unavailable',
                'A database with table(name) is required.'
            );
        }

        const table = name => database.table(name);
        const run = async (operation, work) => {
            try {
                return await work();
            } catch (error) {
                throw normalizeError(error, operation);
            }
        };
        const transaction = async (names, work, mode = 'rw') => {
            const uniqueNames = [...new Set(names || [])];
            return run('transaction', () => database.transaction(
                mode,
                ...uniqueNames.map(table),
                () => work(repository)
            ));
        };
        const listTable = (
            name,
            { orderBy = '', reverse = false, includeDeleted = true } = {}
        ) => run(`list:${name}`, async () => {
            let query = table(name);
            if (orderBy) query = query.orderBy(orderBy);
            if (reverse) query = query.reverse();
            const rows = await query.toArray();
            return clone(includeDeleted
                ? rows
                : rows.filter(row => !row?.deletedAt));
        });
        const get = (name, id) => run(
            `get:${name}`,
            async () => clone(await table(name).get(id))
        );
        const put = (name, value) => run(`put:${name}`, async () => {
            await table(name).put(clone(value));
            return clone(value);
        });
        const deleteMany = (name, ids) => run(
            `delete-many:${name}`,
            async () => {
                const normalized = clone(Array.isArray(ids) ? ids : []);
                const target = table(name);
                if (normalized.length && typeof target.bulkDelete === 'function') {
                    await target.bulkDelete(normalized);
                } else {
                    for (const id of normalized) await target.delete(id);
                }
                return { deletedCount: normalized.length };
            }
        );
        const update = (name, id, patch) => run(
            `update:${name}`,
            async () => {
                await table(name).update(id, clone(patch));
                return get(name, id);
            }
        );
        const findBy = (name, index, value, { sortBy = '' } = {}) => run(
            `find:${name}:${index}`,
            async () => {
                const query = table(name).where(index).equals(value);
                return clone(sortBy
                    ? await query.sortBy(sortBy)
                    : await query.toArray());
            }
        );
        const findAny = (name, index, values) => run(
            `find-any:${name}:${index}`,
            async () => clone(
                await table(name).where(index).anyOf(values).toArray()
            )
        );
        const loadImageRecords = ids => {
            const normalized = [...new Set(
                (ids || []).map(String).filter(Boolean)
            )];
            return normalized.length
                ? findAny('images', 'id', normalized)
                : Promise.resolve([]);
        };

        const loadLibrary = () => listTable('questions', {
            orderBy: 'createdAt', reverse: true, includeDeleted: false
        });

        const saveQuestion = async (
            question,
            {
                allowUpdate = false,
                expectedUpdatedAt,
                confirmationToken = '',
                imageRecords = []
            } = {}
        ) => {
            const input = clone(question);
            const id = requireId(input?.id, 'question.id');
            // 事务回调**不能是 async 函数**：async 永远返回原生 Promise，
            // Dexie 拿到原生 Promise 就判定事务结束并提交，于是第二次写抛
            // PrematureCommitError —— 而第一次写已经生效，老师看到「保存入库失败」
            // 但题目其实进库了，重试就多出一道重复题。
            // 所以这里直接对 Dexie 表操作，让每一步返回的都是 Dexie 自己的 Promise。
            imageRecords.forEach(image => requireId(image?.id, 'image.id'));
            return transaction(['questions', 'images'], () =>
                table('questions').get(id).then(existing => {
                    if (
                        existing && confirmationToken &&
                        existing.storageMeta?.confirmationToken === confirmationToken
                    ) {
                        return { question: existing, idempotent: true };
                    }
                    if (existing && !allowUpdate) {
                        throw new StorageRepositoryError(
                            'duplicate-id', `Question ${id} already exists.`, { id }
                        );
                    }
                    if (
                        existing && expectedUpdatedAt !== undefined &&
                        existing.updatedAt !== expectedUpdatedAt
                    ) {
                        throw new StorageRepositoryError(
                            'write-conflict',
                            `Question ${id} changed in another writer.`,
                            { id, expectedUpdatedAt, actualUpdatedAt: existing.updatedAt }
                        );
                    }
                    const now = clock();
                    const next = {
                        ...input,
                        createdAt: existing?.createdAt ?? input.createdAt ?? now,
                        updatedAt: now,
                        storageMeta: {
                            ...(isRecord(existing?.storageMeta)
                                ? existing.storageMeta
                                : {}),
                            ...(isRecord(input.storageMeta) ? input.storageMeta : {}),
                            ...(confirmationToken ? { confirmationToken } : {})
                        }
                    };
                    delete next.deletedAt;
                    delete next.deletedBy;
                    return table('questions').put(next).then(() => {
                        if (!imageRecords.length) {
                            return { question: clone(next), idempotent: false };
                        }
                        return table('images').bulkPut(imageRecords)
                            .then(() => ({ question: clone(next), idempotent: false }));
                    });
                })
            );
        };

        const updateQuestion = async (
            id,
            patch,
            { expectedUpdatedAt } = {}
        ) => {
            requireId(id);
            return transaction(['questions'], async tx => {
                const existing = await tx.get('questions', id);
                if (!existing) {
                    throw new StorageRepositoryError(
                        'not-found', `Question ${id} was not found.`, { id }
                    );
                }
                if (
                    expectedUpdatedAt !== undefined &&
                    existing.updatedAt !== expectedUpdatedAt
                ) {
                    throw new StorageRepositoryError(
                        'write-conflict',
                        `Question ${id} changed in another writer.`,
                        { id, expectedUpdatedAt, actualUpdatedAt: existing.updatedAt }
                    );
                }
                const next = { ...existing, ...clone(patch), updatedAt: clock() };
                next.id = id;
                await tx.put('questions', next);
                return clone(next);
            });
        };

        const softDeleteQuestion = async (id, deletedBy = 'user') => {
            const existing = await get('questions', requireId(id));
            if (!existing) return { deleted: false, reason: 'not-found' };
            if (existing.deletedAt) return { deleted: true, idempotent: true };
            await update('questions', id, {
                deletedAt: clock(), deletedBy, updatedAt: clock()
            });
            return { deleted: true, idempotent: false };
        };

        const restoreQuestion = async id => {
            const existing = await get('questions', requireId(id));
            if (!existing) {
                throw new StorageRepositoryError(
                    'not-found', `Question ${id} was not found.`, { id }
                );
            }
            delete existing.deletedAt;
            delete existing.deletedBy;
            existing.updatedAt = clock();
            await put('questions', existing);
            return clone(existing);
        };

        const listRecentTasks = () => listTable('draftImportBatches', {
            orderBy: 'createdAt', reverse: true
        });
        const saveDraft = draft => {
            requireId(draft?.id, 'draft.id');
            return put('draftQuestions', { ...clone(draft), updatedAt: clock() });
        };
        const loadDraft = id => get('draftQuestions', requireId(id));
        const loadDraftReview = (batchId, draftId) => transaction(
            ['draftImportBatches', 'draftQuestions', 'draftImages'],
            async () => ({
                batch: clone(await table('draftImportBatches').get(batchId)),
                draft: clone(await table('draftQuestions').get(draftId)),
                images: clone(await table('draftImages').where('questionId')
                    .equals(draftId).toArray())
            }),
            'r'
        );
        const refreshDraftBatchStats = (batchId, { buildUpdate, signal }) => {
            requireId(batchId, 'batch.id');
            const assertActive = () => {
                if (signal?.aborted) {
                    throw Object.assign(new Error('DRAFT_PERSISTENCE_CANCELLED'), {
                        name: 'AbortError'
                    });
                }
            };
            assertActive();
            return transaction(
                ['draftImportBatches', 'draftQuestions', 'draftImages'],
                async () => {
                    const batchTable = table('draftImportBatches');
                    const batch = await batchTable.get(batchId);
                    if (!batch) {
                        throw new StorageRepositoryError(
                            'draft-batch-not-found', 'DRAFT_BATCH_NOT_FOUND', { batchId }
                        );
                    }
                    const questions = await table('draftQuestions')
                        .where('batchId').equals(batchId).toArray();
                    const images = await table('draftImages')
                        .where('batchId').equals(batchId).toArray();
                    assertActive();
                    const { counts, batchPatch } = buildUpdate({ batch, questions, images });
                    assertActive();
                    await batchTable.update(batchId, clone(batchPatch));
                    assertActive();
                    const readback = await batchTable.get(batchId);
                    assertActive();
                    return { counts: clone(counts), readback: { batch: clone(readback) } };
                }
            );
        };
        const loadDraftBatch = async batchId => ({
            batch: await get('draftImportBatches', batchId),
            files: await findBy('draftImportFiles', 'batchId', batchId),
            questions: await findBy(
                'draftQuestions', 'batchId', batchId, { sortBy: 'order' }
            ),
            images: await findBy('draftImages', 'batchId', batchId)
        });
        const createDraftBatch = async ({ batch, files = [], signal } = {}) => {
            const batchId = requireId(batch?.id, 'batch.id');
            if (!Array.isArray(files)) {
                throw new StorageRepositoryError(
                    'invalid-record',
                    'Draft batch files must be an array.',
                    { batchId }
                );
            }
            const assertActive = () => {
                if (!signal?.aborted) return;
                const error = new StorageRepositoryError(
                    'draft-persistence-cancelled',
                    'Draft batch creation was cancelled before commit.',
                    { batchId }
                );
                error.name = 'AbortError';
                throw error;
            };
            assertActive();
            return run('create-draft-batch', () => database.transaction(
                'rw',
                table('draftImportBatches'),
                table('draftImportFiles'),
                async () => {
                    assertActive();
                    if (await table('draftImportBatches').get(batchId)) {
                        throw new StorageRepositoryError(
                            'duplicate-id',
                            `Draft batch ${batchId} already exists.`,
                            { batchId }
                        );
                    }
                    await table('draftImportBatches').put(clone(batch));
                    assertActive();
                    if (files.length) {
                        await table('draftImportFiles').bulkPut(clone(files));
                    }
                    assertActive();
                    return {
                        batch: clone(await table('draftImportBatches').get(batchId)),
                        files: clone(
                            await table('draftImportFiles')
                                .where('batchId')
                                .equals(batchId)
                                .toArray()
                        )
                    };
                }
            ));
        };
        const persistReviewDraftBatch = async ({
            batch, files = [], drafts = [], images, signal, expectedVersion
        }) => {
            requireId(batch?.id, 'batch.id');
            const assertActive = () => {
                if (!signal?.aborted) return;
                const error = new StorageRepositoryError(
                    'draft-persistence-cancelled',
                    'Draft persistence was cancelled before commit.',
                    { batchId: batch.id }
                );
                error.name = 'AbortError';
                throw error;
            };
            assertActive();
            return run('persist-review-draft-batch', () => database.transaction(
                'rw',
                table('draftQuestions'),
                table('draftImages'),
                table('draftImportFiles'),
                table('draftImportBatches'),
                async () => {
                    assertActive();
                    if (Number.isInteger(expectedVersion)) {
                        const currentBatch = await table('draftImportBatches')
                            .get(batch.id);
                        const actualVersion = Number.isInteger(
                            currentBatch?.draftPersistence?.version
                        )
                            ? currentBatch.draftPersistence.version
                            : 0;
                        if (actualVersion !== expectedVersion) {
                            throw new StorageRepositoryError(
                                'version-mismatch',
                                'Draft batch persistence version changed.',
                                {
                                    batchId: batch.id,
                                    expectedVersion,
                                    actualVersion
                                }
                            );
                        }
                    }
                    assertActive();
                    await table('draftQuestions').where('batchId')
                        .equals(batch.id).delete();
                    assertActive();
                    if (drafts.length) await table('draftQuestions').bulkPut(clone(drafts));
                    assertActive();
                    if (Array.isArray(images)) {
                        await table('draftImages').where('batchId')
                            .equals(batch.id).delete();
                        assertActive();
                        if (images.length) {
                            await table('draftImages').bulkPut(clone(images));
                            assertActive();
                        }
                    }
                    if (files.length) await table('draftImportFiles').bulkPut(clone(files));
                    assertActive();
                    await table('draftImportBatches').put(clone(batch));
                    assertActive();
                    return {
                        batch: clone(batch),
                        draftCount: drafts.length,
                        imageCount: Array.isArray(images) ? images.length : undefined
                    };
                }
            ));
        };
        const deleteDraftBatch = (batchId, { expectedVersion, signal } = {}) => transaction(
            [
                'draftImportBatches',
                'draftImportFiles',
                'draftQuestions',
                'draftImages'
            ],
            async () => {
                const assertActive = () => {
                    if (signal?.aborted) throw Object.assign(new Error('DRAFT_PERSISTENCE_CANCELLED'), { name: 'AbortError' });
                };
                assertActive();
                const current = await table('draftImportBatches').get(batchId);
                const actualVersion = current?.draftPersistence?.version || 0;
                if (Number.isInteger(expectedVersion) && actualVersion !== expectedVersion) {
                    throw new StorageRepositoryError('version-mismatch', 'Draft batch persistence version changed.',
                        { batchId, expectedVersion, actualVersion });
                }
                await table('draftImportBatches').delete(batchId);
                assertActive();
                for (const name of [
                    'draftImportFiles',
                    'draftQuestions',
                    'draftImages'
                ]) {
                    await table(name)
                        .where('batchId')
                        .equals(batchId)
                        .delete();
                    assertActive();
                }
            }
        );

        let formalConfirmationTail = Promise.resolve();
        const serializeFormalConfirmation = work => {
            const current = formalConfirmationTail.then(work, work);
            formalConfirmationTail = current.catch(() => undefined);
            return current;
        };

        const confirmDraftToQuestion = async (
            draftId,
            admissionDecision,
            {
                expectedDraftVersion,
                idempotencyKey = '',
                actorId = '',
                requestId = '',
                questionId = '',
                context: providedContext = {},
                imageRecords = []
            } = {}
        ) => {
            const id = requireId(draftId, 'draftId');
            if (!idempotencyKey) {
                throw new StorageRepositoryError(
                    'idempotency-required',
                    'Formal confirmation requires an idempotency key.',
                    { draftId: id }
                );
            }
            if (!actorId || !requestId) {
                throw new StorageRepositoryError(
                    'admission-invalid',
                    'Formal confirmation requires actor and request IDs.',
                    { draftId: id }
                );
            }
            if (!Number.isInteger(expectedDraftVersion)) {
                throw new StorageRepositoryError(
                    'draft-version-conflict',
                    'Expected draft version must be an integer.',
                    { draftId: id, expectedDraftVersion }
                );
            }
            const {
                evaluateDraftAdmission,
                validateAdmissionDecision,
                buildQuestionV2,
                validateQuestionV2
            } = admission;
            if (
                typeof evaluateDraftAdmission !== 'function' ||
                typeof validateAdmissionDecision !== 'function' ||
                typeof buildQuestionV2 !== 'function' ||
                typeof validateQuestionV2 !== 'function'
            ) {
                throw new StorageRepositoryError(
                    'admission-unavailable',
                    'Formal admission dependencies are unavailable.',
                    { draftId: id }
                );
            }

            if (typeof duplicatePolicy?.evaluate !== 'function') {
                throw new StorageRepositoryError(
                    'duplicate-policy-unavailable',
                    'Formal confirmation duplicate policy is unavailable.',
                    { draftId: id }
                );
            }

            return serializeFormalConfirmation(() => transaction(
                [
                    'draftQuestions',
                    'questions',
                    'images',
                    'draftImportBatches'
                ],
                async () => {
                    const draftTable = table('draftQuestions');
                    const questionTable = table('questions');
                    const imageTable = table('images');
                    const batchTable = table('draftImportBatches');
                    const fresh = clone(await draftTable.get(id));
                    if (!fresh) {
                        throw new StorageRepositoryError(
                            'draft-missing',
                            `Draft ${id} was not found.`,
                            { draftId: id }
                        );
                    }

                    if (fresh.status === 'submitted') {
                        if (
                            fresh.admissionAudit?.idempotencyKey ===
                            idempotencyKey
                        ) {
                            const committed = clone(
                                await questionTable.get(
                                    fresh.submittedQuestionId
                                )
                            );
                            if (!committed) {
                                throw new StorageRepositoryError(
                                    'corrupt-data',
                                    'Submitted draft references a missing question.',
                                    { draftId: id }
                                );
                            }
                            return {
                                question: committed,
                                draftId: id,
                                admissionDecisionId:
                                    fresh.admissionDecisionId || '',
                                idempotent: true,
                                committedAt:
                                    fresh.admissionAudit?.committedAt || '',
                                requestId:
                                    fresh.admissionAudit?.requestId || requestId
                            };
                        }
                        throw new StorageRepositoryError(
                            'draft-already-confirmed',
                            `Draft ${id} was already confirmed.`,
                            { draftId: id }
                        );
                    }
                    if (fresh.status !== 'reviewed') {
                        throw new StorageRepositoryError(
                            'draft-not-reviewed',
                            `Draft ${id} must be reviewed before formal confirmation.`,
                            { draftId: id, status: fresh.status || '' }
                        );
                    }

                    const actualVersion = fresh.version;
                    if (actualVersion !== expectedDraftVersion) {
                        throw new StorageRepositoryError(
                            'draft-version-conflict',
                            `Draft ${id} changed in another writer.`,
                            {
                                draftId: id,
                                expectedDraftVersion,
                                actualDraftVersion: actualVersion
                            }
                        );
                    }

                    const indexed = ['duplicateCoreV2', 'duplicateStemV2', 'formalRequestId', 'formalIdempotencyKey']
                        .every(key => questionTable.schema?.idxByName?.[key]) &&
                        typeof duplicatePolicy.canonicalCoreFingerprint === 'function' &&
                        typeof duplicatePolicy.canonicalStemFingerprint === 'function';
                    let existingQuestions, conflictingRequest;
                    if (indexed) {
                        const requestMatches = await questionTable.where('formalRequestId').equals(requestId)
                            .filter(question => question.admission?.draftId !== id).first();
                        const keyMatches = await questionTable.where('formalIdempotencyKey').equals(idempotencyKey)
                            .filter(question => question.admission?.draftId !== id).first();
                        conflictingRequest = [requestMatches, keyMatches].filter(Boolean)
                            .sort((left, right) => database.constructor.cmp(left.id, right.id))[0];
                        const exact = await questionTable.where('duplicateCoreV2')
                            .equals(duplicatePolicy.canonicalCoreFingerprint(fresh)).first();
                        const stem = duplicatePolicy.canonicalStemFingerprint(fresh);
                        const similar = !exact && stem ? await questionTable.where('duplicateStemV2').equals(stem).first() : null;
                        existingQuestions = exact ? [exact] : similar ? [similar] : [];
                    } else {
                        // Older repository ports/schemas retain the same transaction-local scan.
                        existingQuestions = await questionTable.toArray();
                        conflictingRequest = existingQuestions.find(question => !question?.deletedAt &&
                            (question?.admission?.requestId === requestId || question?.admission?.idempotencyKey === idempotencyKey) &&
                            question?.admission?.draftId !== id);
                    }
                    if (conflictingRequest) {
                        throw new StorageRepositoryError(
                            'idempotency-conflict',
                            'Formal request ID was already used by another draft.',
                            {
                                draftId: id,
                                matchedQuestionId: conflictingRequest.id
                            }
                        );
                    }
                    let duplicateDecision;
                    try {
                        duplicateDecision = duplicatePolicy.evaluate({
                            candidate: fresh,
                            existingQuestions
                        });
                    } catch (cause) {
                        throw new StorageRepositoryError(
                            'duplicate-policy-failed',
                            'Formal duplicate policy failed.',
                            { draftId: id, causeCode: cause?.code || '' }
                        );
                    }
                    if (duplicateDecision?.accepted !== true) {
                        throw new StorageRepositoryError(
                            duplicateDecision?.code || 'DUPLICATE_POLICY_REJECTED',
                            'Formal question was rejected as a duplicate.',
                            {
                                draftId: id,
                                duplicateDecision: clone(duplicateDecision)
                            }
                        );
                    }

                    const clockValue = clock();
                    const committedAt = new Date(clockValue).toISOString();
                    const context = {
                        ...clone(providedContext || {}),
                        mode:
                            providedContext?.mode ||
                            fresh.source?.mode || '',
                        actorId,
                        requestId,
                        idempotencyKey,
                        evaluatedAt:
                            providedContext?.evaluatedAt || committedAt,
                        source: {
                            ...clone(fresh.source || {}),
                            ...clone(providedContext?.source || {})
                        }
                    };

                    let evaluated;
                    let decisionValidation;
                    try {
                        evaluated = evaluateDraftAdmission(fresh, context);
                        decisionValidation = validateAdmissionDecision(
                            admissionDecision,
                            fresh,
                            context
                        );
                    } catch (cause) {
                        throw new StorageRepositoryError(
                            'admission-invalid',
                            cause?.message || 'Formal admission evaluation failed.',
                            { draftId: id, causeCode: cause?.code || '' }
                        );
                    }
                    if (
                        evaluated?.accepted !== true ||
                        decisionValidation?.valid !== true
                    ) {
                        throw new StorageRepositoryError(
                            'admission-invalid',
                            'Formal admission decision was rejected.',
                            {
                                draftId: id,
                                policyErrors: clone(evaluated?.errors || []),
                                decisionErrors: clone(
                                    decisionValidation?.errors || []
                                )
                            }
                        );
                    }

                    const formalId = requireId(
                        questionId,
                        'questionId'
                    );
                    if (await questionTable.get(formalId)) {
                        throw new StorageRepositoryError(
                            'duplicate-id',
                            `Question ${formalId} already exists.`,
                            { id: formalId }
                        );
                    }

                    let question;
                    try {
                        question = buildQuestionV2(
                            fresh,
                            evaluated,
                            {
                                id: formalId,
                                context,
                                createdAt: committedAt,
                                updatedAt: committedAt,
                                confirmedAt: committedAt
                            }
                        );
                    } catch (cause) {
                        throw new StorageRepositoryError(
                            'admission-invalid',
                            cause?.message || 'Question v2 construction failed.',
                            { draftId: id, causeCode: cause?.code || '' }
                        );
                    }
                    const schemaValidation = validateQuestionV2(question);
                    if (schemaValidation?.valid !== true) {
                        throw new StorageRepositoryError(
                            'question-schema-invalid',
                            'Formal question v2 failed schema validation.',
                            {
                                draftId: id,
                                errors: clone(schemaValidation?.errors || [])
                            }
                        );
                    }

                    for (const image of imageRecords || []) {
                        requireId(image?.id, 'image.id');
                        await imageTable.put(clone(image));
                    }
                    await questionTable.put(clone(question));
                    await draftTable.update(id, {
                        status: 'submitted',
                        submittedQuestionId: formalId,
                        admissionDecisionId: evaluated.decisionId,
                        version: actualVersion + 1,
                        updatedAt: clockValue,
                        admissionAudit: {
                            idempotencyKey,
                            actorId,
                            requestId,
                            decisionId: evaluated.decisionId,
                            committedAt
                        }
                    });

                    if (fresh.batchId) {
                        const submittedCount = draftTable.schema?.idxByName?.['[batchId+status]']
                            ? await draftTable.where('[batchId+status]').equals([fresh.batchId, 'submitted']).count()
                            : (await draftTable.where('batchId').equals(fresh.batchId).toArray())
                                .filter(item => item.status === 'submitted').length;
                        const batch = await batchTable.get(fresh.batchId);
                        const batchVersion = batch?.draftPersistence?.version || 0;
                        await batchTable.update(fresh.batchId, {
                            submittedCount,
                            updatedAt: clockValue,
                            lastAdmissionDecisionId: evaluated.decisionId,
                            draftPersistence: { ...batch?.draftPersistence, version: batchVersion + 1,
                                idempotencyKey: 'formal-commit:' + idempotencyKey,
                                signature: JSON.stringify([id, formalId, actualVersion + 1]) }
                        });
                    }

                    return {
                        question: clone(question),
                        draftId: id,
                        admissionDecisionId: evaluated.decisionId,
                        idempotent: false,
                        committedAt,
                        requestId
                    };
                }
            ));
        };

        const createBackup = async () => {
            const tables = {};
            for (const name of BACKUP_TABLES) {
                tables[name] = await listTable(name);
            }
            return {
                schemaVersion: BACKUP_SCHEMA_VERSION,
                createdAt: new Date(clock()).toISOString(),
                tables
            };
        };
        const restoreBackup = async (backup, { expectedSnapshot } = {}) => {
            const normalized = validateBackup(backup);
            // Legacy partial backups replace only explicitly provided tables. Empty means clear; absent means preserve.
            const providedTables = BACKUP_TABLES.filter(name => Object.hasOwn(backup.tables, name));
            await transaction(BACKUP_TABLES, async () => {
                if (expectedSnapshot !== undefined) {
                    if (!isRecord(expectedSnapshot) || Object.keys(expectedSnapshot).length !== BACKUP_TABLES.length ||
                        BACKUP_TABLES.some(name => !Array.isArray(expectedSnapshot[name]))) {
                        throw new StorageRepositoryError('corrupt-data', 'A complete safety snapshot is required.');
                    }
                    const values = await Promise.all(BACKUP_TABLES.map(name => table(name).toArray()));
                    const current = Object.fromEntries(BACKUP_TABLES.map((name, index) => [name, values[index]]));
                    try { await waitFor(defaultSnapshotPolicy.assertSameSnapshot(expectedSnapshot, current)); }
                    catch (cause) { throw new StorageRepositoryError('restore-conflict', 'Current data changed or could not be compared; restoration cancelled.', { causeCode: cause?.code || '' }); }
                }
                for (const name of providedTables) {
                    const target = table(name);
                    await target.clear();
                    if (normalized.tables[name].length) {
                        await target.bulkPut(clone(normalized.tables[name]));
                    }
                }
            });
            return { restored: true, tableCount: providedTables.length };
        };

        const repository = Object.freeze({
            transaction, listTable, get, put, deleteMany, update, findBy, findAny,
            loadImageRecords,
            loadLibrary, saveQuestion, updateQuestion, softDeleteQuestion,
            restoreQuestion, listRecentTasks, saveDraft, loadDraft,
            loadDraftBatch, loadDraftReview, refreshDraftBatchStats,
            createDraftBatch, persistReviewDraftBatch,
            deleteDraftBatch,
            confirmDraftToQuestion,
            createBackup, restoreBackup
        });
        return repository;
    };

    return Object.freeze({
        BACKUP_SCHEMA_VERSION,
        BACKUP_TABLES,
        StorageRepositoryError,
        normalizeError,
        createPreferenceFacade,
        validateBackup,
        createRepository
    });
});
