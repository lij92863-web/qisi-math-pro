(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.StorageRepository = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
            admission = {}
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
            const existing = await get('questions', id);
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
            await transaction(['questions', 'images'], async tx => {
                for (const image of imageRecords) {
                    requireId(image?.id, 'image.id');
                    await tx.put('images', image);
                }
                await tx.put('questions', next);
            });
            return { question: clone(next), idempotent: false };
        };

        const updateQuestion = async (
            id,
            patch,
            { expectedUpdatedAt } = {}
        ) => {
            requireId(id);
            const existing = await get('questions', id);
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
            await put('questions', next);
            return clone(next);
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
        const loadDraftBatch = async batchId => ({
            batch: await get('draftImportBatches', batchId),
            files: await findBy('draftImportFiles', 'batchId', batchId),
            questions: await findBy(
                'draftQuestions', 'batchId', batchId, { sortBy: 'order' }
            ),
            images: await findBy('draftImages', 'batchId', batchId)
        });
        const persistReviewDraftBatch = async ({
            batch, files = [], drafts = [], images
        }) => {
            requireId(batch?.id, 'batch.id');
            return run('persist-review-draft-batch', () => database.transaction(
                'rw',
                table('draftQuestions'),
                table('draftImages'),
                table('draftImportFiles'),
                table('draftImportBatches'),
                async () => {
                    await table('draftQuestions').where('batchId')
                        .equals(batch.id).delete();
                    if (drafts.length) await table('draftQuestions').bulkPut(clone(drafts));
                    if (Array.isArray(images)) {
                        await table('draftImages').where('batchId')
                            .equals(batch.id).delete();
                        if (images.length) {
                            await table('draftImages').bulkPut(clone(images));
                        }
                    }
                    if (files.length) await table('draftImportFiles').bulkPut(clone(files));
                    await table('draftImportBatches').put(clone(batch));
                    return {
                        batch: clone(batch),
                        draftCount: drafts.length,
                        imageCount: Array.isArray(images) ? images.length : undefined
                    };
                }
            ));
        };
        const deleteDraftBatch = batchId => transaction(
            [
                'draftImportBatches',
                'draftImportFiles',
                'draftQuestions',
                'draftImages'
            ],
            async () => {
                await table('draftImportBatches').delete(batchId);
                for (const name of [
                    'draftImportFiles',
                    'draftQuestions',
                    'draftImages'
                ]) {
                    await table(name)
                        .where('batchId')
                        .equals(batchId)
                        .delete();
                }
            }
        );

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

            return transaction(
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
                        const drafts = await draftTable
                            .where('batchId')
                            .equals(fresh.batchId)
                            .toArray();
                        const submittedCount = drafts.filter(
                            item => item.status === 'submitted'
                        ).length;
                        await batchTable.update(fresh.batchId, {
                            submittedCount,
                            updatedAt: clockValue,
                            lastAdmissionDecisionId: evaluated.decisionId
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
            );
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
        const restoreBackup = async backup => {
            const normalized = validateBackup(backup);
            await transaction(BACKUP_TABLES, async () => {
                for (const name of BACKUP_TABLES) {
                    const target = table(name);
                    await target.clear();
                    if (normalized.tables[name].length) {
                        await target.bulkPut(clone(normalized.tables[name]));
                    }
                }
            });
            return { restored: true, tableCount: BACKUP_TABLES.length };
        };

        const repository = Object.freeze({
            transaction, listTable, get, put, update, findBy, findAny,
            loadImageRecords,
            loadLibrary, saveQuestion, updateQuestion, softDeleteQuestion,
            restoreQuestion, listRecentTasks, saveDraft, loadDraft,
            loadDraftBatch, persistReviewDraftBatch, deleteDraftBatch,
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
