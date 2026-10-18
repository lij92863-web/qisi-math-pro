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

    // 批次写入不变量：已提交凭证集合只能被「正式删除」减少，不能被整批覆盖抹掉。
    // 凭证随值走：一条草稿的凭证由它指向的正式题决定，没有正式题就退回行本身。
    const draftProof = draft => draft?.submittedQuestionId
        ? `q:${draft.submittedQuestionId}`
        : `row:${draft?.id}`;

    const assertSubmittedDraftsPreserved = (existingDrafts, incomingDrafts, batchId) => {
        const incoming = new Set((incomingDrafts || []).map(draftProof));
        const lost = (existingDrafts || [])
            .filter(draft => draft?.status === 'submitted')
            .filter(draft => !incoming.has(draftProof(draft)))
            .map(draft => ({
                id: draft.id,
                questionNumber: draft.questionNumber ?? null,
                submittedQuestionId: draft.submittedQuestionId ?? null
            }));
        if (!lost.length) return;
        throw new StorageRepositoryError(
            'draft-submitted-row-loss',
            `Batch ${batchId} would drop ${lost.length} submitted draft row(s).`,
            { batchId, lost }
        );
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
        // 写路径只有一条：atomic()。事务回调必须是**同步函数**，返回 Dexie
        // 自己的 promise 链（.then/bulkPut/first 都行，Promise.all 与 await 不行）。
        // async 回调永远返回原生 Promise，Dexie 拿到就判定事务已经结束并提交，
        // 第二次写抛 PrematureCommitError —— 而第一次写已经落盘。
        // 所以 run() 只做错误归一，不插入 async 边界；Dexie 必须拿到自己的 promise。
        const run = (operation, work) => {
            let result;
            try {
                result = work();
            } catch (error) {
                // 同步失败也以 rejected promise 交回调用方：对外 API 一律是 promise。
                return Promise.reject(normalizeError(error, operation));
            }
            if (!result || typeof result.then !== 'function') return result;
            return result.then(
                value => value,
                error => { throw normalizeError(error, operation); }
            );
        };
        const atomic = (names, build, mode = 'rw') => {
            if (typeof build !== 'function') {
                throw new StorageRepositoryError(
                    'transaction-callback-missing',
                    'A transaction requires a callback.',
                    { names: [...(names || [])] }
                );
            }
            if (build.constructor?.name === 'AsyncFunction') {
                throw new StorageRepositoryError(
                    'transaction-callback-async',
                    'Transaction callbacks must be synchronous and return a Dexie promise chain.',
                    { names: [...(names || [])] }
                );
            }
            const uniqueNames = [...new Set(names || [])];
            let pending;
            try {
                pending = database.transaction(
                    mode,
                    ...uniqueNames.map(table),
                    () => build(repository)
                );
            } catch (error) {
                throw normalizeError(error, 'transaction');
            }
            return pending.then(
                value => value,
                error => { throw normalizeError(error, 'transaction'); }
            );
        };
        // 旧名保留为薄别名，调用点不必改写；实现只有一个。
        const transaction = (names, work, mode = 'rw') =>
            atomic(names, work, mode);
        const listTable = (
            name,
            { orderBy = '', reverse = false, includeDeleted = true } = {}
        ) => run(`list:${name}`, () => {
            let query = table(name);
            if (orderBy) query = query.orderBy(orderBy);
            if (reverse) query = query.reverse();
            return query.toArray().then(rows => clone(includeDeleted
                ? rows
                : rows.filter(row => !row?.deletedAt)));
        });
        const get = (name, id) => run(
            `get:${name}`,
            () => table(name).get(id).then(row => clone(row))
        );
        const put = (name, value) => run(`put:${name}`, () =>
            table(name).put(clone(value)).then(() => clone(value)));
        const deleteMany = (name, ids) => run(
            `delete-many:${name}`,
            () => {
                const normalized = clone(Array.isArray(ids) ? ids : []);
                const target = table(name);
                if (normalized.length && typeof target.bulkDelete === 'function') {
                    return target.bulkDelete(normalized)
                        .then(() => ({ deletedCount: normalized.length }));
                }
                const deleteAt = index => index >= normalized.length
                    ? { deletedCount: normalized.length }
                    : target.delete(normalized[index])
                        .then(() => deleteAt(index + 1));
                return deleteAt(0);
            }
        );
        const update = (name, id, patch) => run(
            `update:${name}`,
            () => table(name).update(id, clone(patch))
                .then(() => get(name, id))
        );
        const findBy = (name, index, value, { sortBy = '' } = {}) => run(
            `find:${name}:${index}`,
            () => {
                const query = table(name).where(index).equals(value);
                return (sortBy ? query.sortBy(sortBy) : query.toArray())
                    .then(rows => clone(rows));
            }
        );
        const findAny = (name, index, values) => run(
            `find-any:${name}:${index}`,
            () => table(name).where(index).anyOf(values).toArray()
                .then(rows => clone(rows))
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
            return transaction(['questions'], tx =>
                tx.get('questions', id).then(existing => {
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
                    return tx.put('questions', next);
                })
            );
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
            () => table('draftImportBatches').get(batchId).then(batch =>
                table('draftQuestions').get(draftId).then(draft =>
                    table('draftImages').where('questionId')
                        .equals(draftId).toArray()
                        .then(images => ({
                            batch: clone(batch),
                            draft: clone(draft),
                            images: clone(images)
                        })))),
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
                () => {
                    const batchTable = table('draftImportBatches');
                    return batchTable.get(batchId).then(batch => {
                        if (!batch) {
                            throw new StorageRepositoryError(
                                'draft-batch-not-found',
                                'DRAFT_BATCH_NOT_FOUND',
                                { batchId }
                            );
                        }
                        return table('draftQuestions')
                            .where('batchId').equals(batchId).toArray()
                            .then(questions => table('draftImages')
                                .where('batchId').equals(batchId).toArray()
                                .then(images => {
                                    assertActive();
                                    const { counts, batchPatch } = buildUpdate({
                                        batch, questions, images
                                    });
                                    assertActive();
                                    return batchTable.update(batchId, clone(batchPatch))
                                        .then(() => {
                                            assertActive();
                                            return batchTable.get(batchId);
                                        })
                                        .then(readback => {
                                            assertActive();
                                            return {
                                                counts: clone(counts),
                                                readback: { batch: clone(readback) }
                                            };
                                        });
                                }));
                    });
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
            return run('create-draft-batch', () => atomic(
                ['draftImportBatches', 'draftImportFiles'],
                () => {
                    const batchTable = table('draftImportBatches');
                    const fileTable = table('draftImportFiles');
                    assertActive();
                    return batchTable.get(batchId).then(existing => {
                        if (existing) {
                            throw new StorageRepositoryError(
                                'duplicate-id',
                                `Draft batch ${batchId} already exists.`,
                                { batchId }
                            );
                        }
                        return batchTable.put(clone(batch));
                    }).then(() => {
                        assertActive();
                        if (!files.length) return undefined;
                        return fileTable.bulkPut(clone(files));
                    }).then(() => {
                        assertActive();
                        return batchTable.get(batchId).then(current =>
                            fileTable.where('batchId').equals(batchId).toArray()
                                .then(records => ({
                                    batch: clone(current),
                                    files: clone(records)
                                })));
                    });
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
            return run('persist-review-draft-batch', () => atomic(
                [
                    'draftQuestions',
                    'draftImages',
                    'draftImportFiles',
                    'draftImportBatches'
                ],
                () => {
                    const batchTable = table('draftImportBatches');
                    const draftTable = table('draftQuestions');
                    const imageTable = table('draftImages');
                    const fileTable = table('draftImportFiles');
                    assertActive();
                    // 先读快照：同一个事务里读到的批次已提交行，是本事务必须保住的凭证。
                    return draftTable.where('batchId').equals(batch.id).toArray()
                        .then(existingDrafts => {
                            if (!Number.isInteger(expectedVersion)) {
                                return existingDrafts;
                            }
                            return batchTable.get(batch.id).then(currentBatch => {
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
                                return existingDrafts;
                            });
                        })
                        .then(existingDrafts => {
                            assertSubmittedDraftsPreserved(
                                existingDrafts, drafts, batch.id
                            );
                            assertActive();
                            return draftTable.where('batchId')
                                .equals(batch.id).delete();
                        })
                        .then(() => {
                            assertActive();
                            if (!drafts.length) return undefined;
                            return draftTable.bulkPut(clone(drafts));
                        })
                        .then(() => {
                            assertActive();
                            if (!Array.isArray(images)) return undefined;
                            return imageTable.where('batchId').equals(batch.id)
                                .delete()
                                .then(() => {
                                    assertActive();
                                    if (!images.length) return undefined;
                                    return imageTable.bulkPut(clone(images));
                                });
                        })
                        .then(() => {
                            assertActive();
                            if (!files.length) return undefined;
                            return fileTable.bulkPut(clone(files));
                        })
                        .then(() => {
                            assertActive();
                            return batchTable.put(clone(batch));
                        })
                        .then(() => {
                            assertActive();
                            return {
                                batch: clone(batch),
                                draftCount: drafts.length,
                                imageCount: Array.isArray(images)
                                    ? images.length
                                    : undefined
                            };
                        });
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
            () => {
                const assertActive = () => {
                    if (signal?.aborted) throw Object.assign(new Error('DRAFT_PERSISTENCE_CANCELLED'), { name: 'AbortError' });
                };
                const batchTable = table('draftImportBatches');
                assertActive();
                return batchTable.get(batchId).then(current => {
                    const actualVersion = current?.draftPersistence?.version || 0;
                    if (
                        Number.isInteger(expectedVersion) &&
                        actualVersion !== expectedVersion
                    ) {
                        throw new StorageRepositoryError(
                            'version-mismatch',
                            'Draft batch persistence version changed.',
                            { batchId, expectedVersion, actualVersion }
                        );
                    }
                    return batchTable.delete(batchId);
                }).then(() => {
                    assertActive();
                    const names = [
                        'draftImportFiles',
                        'draftQuestions',
                        'draftImages'
                    ];
                    const clearAt = index => {
                        if (index >= names.length) return undefined;
                        assertActive();
                        return table(names[index])
                            .where('batchId')
                            .equals(batchId)
                            .delete()
                            .then(() => clearAt(index + 1));
                    };
                    return clearAt(0);
                });
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
                () => {
                    const draftTable = table('draftQuestions');
                    const questionTable = table('questions');
                    const imageTable = table('images');
                    const batchTable = table('draftImportBatches');

                    const loadDuplicateEvidence = fresh => {
                        const indexed = ['duplicateCoreV2', 'duplicateStemV2', 'formalRequestId', 'formalIdempotencyKey']
                            .every(key => questionTable.schema?.idxByName?.[key]) &&
                            typeof duplicatePolicy.canonicalCoreFingerprint === 'function' &&
                            typeof duplicatePolicy.canonicalStemFingerprint === 'function';
                        if (!indexed) {
                            // Older repository ports/schemas retain the same transaction-local scan.
                            return questionTable.toArray().then(existingQuestions => ({
                                existingQuestions,
                                conflictingRequest: existingQuestions.find(question => !question?.deletedAt &&
                                    (question?.admission?.requestId === requestId || question?.admission?.idempotencyKey === idempotencyKey) &&
                                    question?.admission?.draftId !== id)
                            }));
                        }
                        return questionTable.where('formalRequestId').equals(requestId)
                            .filter(question => question.admission?.draftId !== id).first()
                            .then(requestMatches => questionTable.where('formalIdempotencyKey')
                                .equals(idempotencyKey)
                                .filter(question => question.admission?.draftId !== id).first()
                                .then(keyMatches => ({
                                    conflictingRequest: [requestMatches, keyMatches]
                                        .filter(Boolean)
                                        .sort((left, right) => database.constructor.cmp(left.id, right.id))[0]
                                })))
                            .then(evidence => questionTable.where('duplicateCoreV2')
                                .equals(duplicatePolicy.canonicalCoreFingerprint(fresh)).first()
                                .then(exact => {
                                    const stem = duplicatePolicy.canonicalStemFingerprint(fresh);
                                    if (exact || !stem) {
                                        return {
                                            ...evidence,
                                            existingQuestions: exact ? [exact] : []
                                        };
                                    }
                                    return questionTable.where('duplicateStemV2').equals(stem).first()
                                        .then(similar => ({
                                            ...evidence,
                                            existingQuestions: similar ? [similar] : []
                                        }));
                                }));
                    };

                    return draftTable.get(id).then(rawDraft => {
                        const fresh = clone(rawDraft);
                        if (!fresh) {
                            throw new StorageRepositoryError(
                                'draft-missing',
                                `Draft ${id} was not found.`,
                                { draftId: id }
                            );
                        }

                        if (fresh.status === 'submitted') {
                            if (
                                fresh.admissionAudit?.idempotencyKey !==
                                idempotencyKey
                            ) {
                                throw new StorageRepositoryError(
                                    'draft-already-confirmed',
                                    `Draft ${id} was already confirmed.`,
                                    { draftId: id }
                                );
                            }
                            return questionTable.get(fresh.submittedQuestionId)
                                .then(rawCommitted => {
                                    const committed = clone(rawCommitted);
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
                                });
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

                        return loadDuplicateEvidence(fresh)
                            .then(({ existingQuestions, conflictingRequest }) => {
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
                                return questionTable.get(formalId).then(existingFormal => {
                                    if (existingFormal) {
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

                                    const images = imageRecords || [];
                                    images.forEach(image => requireId(image?.id, 'image.id'));
                                    const putImageAt = index => index >= images.length
                                        ? undefined
                                        : imageTable.put(clone(images[index]))
                                            .then(() => putImageAt(index + 1));
                                    const updateBatchStats = () => {
                                        const submittedCount = draftTable.schema
                                            ?.idxByName?.['[batchId+status]']
                                            ? draftTable.where('[batchId+status]')
                                                .equals([fresh.batchId, 'submitted']).count()
                                            : draftTable.where('batchId')
                                                .equals(fresh.batchId).toArray()
                                                .then(items => items.filter(
                                                    item => item.status === 'submitted'
                                                ).length);
                                        return submittedCount.then(count =>
                                            batchTable.get(fresh.batchId).then(batch => {
                                                const batchVersion =
                                                    batch?.draftPersistence?.version || 0;
                                                return batchTable.update(fresh.batchId, {
                                                    submittedCount: count,
                                                    updatedAt: clockValue,
                                                    lastAdmissionDecisionId: evaluated.decisionId,
                                                    draftPersistence: { ...batch?.draftPersistence, version: batchVersion + 1,
                                                        idempotencyKey: 'formal-commit:' + idempotencyKey,
                                                        signature: JSON.stringify([id, formalId, actualVersion + 1]) }
                                                });
                                            }));
                                    };

                                    const writeQuestion = images.length
                                        ? putImageAt(0).then(() => questionTable.put(clone(question)))
                                        : questionTable.put(clone(question));
                                    return writeQuestion
                                        .then(() => draftTable.update(id, {
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
                                        }))
                                        .then(() => (fresh.batchId
                                            ? updateBatchStats()
                                            : undefined))
                                        .then(() => ({
                                            question: clone(question),
                                            draftId: id,
                                            admissionDecisionId: evaluated.decisionId,
                                            idempotent: false,
                                            committedAt,
                                            requestId
                                        }));
                                });
                            });
                    });
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
            await transaction(BACKUP_TABLES, () => {
                const replaceTables = index => {
                    if (index >= providedTables.length) return undefined;
                    const name = providedTables[index];
                    const target = table(name);
                    const rows = normalized.tables[name];
                    return target.clear()
                        .then(() => (rows.length
                            ? target.bulkPut(clone(rows))
                            : undefined))
                        .then(() => replaceTables(index + 1));
                };
                if (expectedSnapshot === undefined) return replaceTables(0);
                if (!isRecord(expectedSnapshot) || Object.keys(expectedSnapshot).length !== BACKUP_TABLES.length ||
                    BACKUP_TABLES.some(name => !Array.isArray(expectedSnapshot[name]))) {
                    throw new StorageRepositoryError('corrupt-data', 'A complete safety snapshot is required.');
                }
                const readAll = (index, current) => index >= BACKUP_TABLES.length
                    ? current
                    : table(BACKUP_TABLES[index]).toArray().then(rows => readAll(
                        index + 1,
                        { ...current, [BACKUP_TABLES[index]]: rows }
                    ));
                return readAll(0, {})
                    .then(current => waitFor(
                        defaultSnapshotPolicy.assertSameSnapshot(expectedSnapshot, current)
                    ).then(
                        () => undefined,
                        cause => {
                            throw new StorageRepositoryError(
                                'restore-conflict',
                                'Current data changed or could not be compared; restoration cancelled.',
                                { causeCode: cause?.code || '' }
                            );
                        }
                    ))
                    .then(() => replaceTables(0));
            });
            return { restored: true, tableCount: providedTables.length };
        };

        // ---- 外部批次写路径：app.js 三处 db.transaction 直写的唯一替代 ----
        // 数据准备（id 映射、指纹、文案）留在调用方；这里只负责单事务落盘。
        const importExternalBatch = ({ batch, images = [], questions = [] } = {}) => {
            requireId(batch?.id, 'batch.id');
            const imageRows = (Array.isArray(images) ? images : []).map(row => {
                requireId(row?.id, 'image.id');
                return clone(row);
            });
            const questionRows = (Array.isArray(questions) ? questions : []).map(row => {
                requireId(row?.id, 'question.id');
                return clone(row);
            });
            return atomic(
                ['importBatches', 'externalQuestions', 'images'],
                () => table('importBatches').put(clone(batch))
                    .then(() => imageRows.length
                        ? table('images').bulkPut(imageRows)
                        : undefined)
                    .then(() => questionRows.length
                        ? table('externalQuestions').bulkPut(questionRows)
                        : undefined)
            ).then(() => ({
                imported: questionRows.length,
                images: imageRows.length
            }));
        };

        const deleteExternalBatch = batchId => {
            requireId(batchId, 'batchId');
            return atomic(
                ['importBatches', 'externalQuestions'],
                () => table('externalQuestions')
                    .where('batchId').equals(batchId).delete()
                    .then(() => table('importBatches').delete(batchId))
            ).then(() => ({ deleted: true }));
        };

        // decide 是纯函数：row => 要更新的字段对象（不含 recalculatedAt，仓储负责盖时间戳）。
        const recalcExternalBatchStatus = (batchId, decide) => {
            requireId(batchId, 'batchId');
            if (typeof decide !== 'function') {
                throw new StorageRepositoryError(
                    'invalid-record',
                    'recalcExternalBatchStatus requires a decide(row) function.'
                );
            }
            return atomic(['externalQuestions'], () =>
                table('externalQuestions')
                    .where('batchId').equals(batchId).toArray()
                    .then(rows => {
                        const stamp = clock();
                        const applyAt = index => index >= rows.length
                            ? undefined
                            : table('externalQuestions').update(rows[index].id, {
                                ...decide(rows[index]),
                                recalculatedAt: stamp
                            }).then(() => applyAt(index + 1));
                        return applyAt(0);
                    })
            ).then(() => ({ recalculated: true }));
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
            importExternalBatch, deleteExternalBatch, recalcExternalBatchStatus,
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
