(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryService = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

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
    const fail = (code, message) => {
        const error = new Error(message);
        error.name = 'LibraryServiceError';
        error.code = code;
        throw error;
    };

    const migrateSafeQuestionLatexRecord = question => {
        const validImageIds = new Set(
            (question.images || [])
                .map(image => String(image?.id || ''))
                .filter(Boolean)
        );
        const migrateField = value => String(value || '')
            .replace(/_*MATHPROTECT[_-]?\d+_*/gi, '')
            .replace(/@@QISI_MATH_(?:SEGMENT_)?\d+@@/g, '')
            .replace(
                /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g,
                (fullMatch, rawId) => {
                    const id = String(rawId || '').trim();
                    return validImageIds.has(id)
                        ? `[[IMAGE:${id}]]`
                        : fullMatch;
                }
            );
        const next = {
            ...question,
            stem: migrateField(question.stem),
            answer: migrateField(question.answer),
            solution: migrateField(question.solution),
            options: (question.options || []).map(migrateField)
        };
        const changed =
            next.stem !== question.stem ||
            next.answer !== question.answer ||
            next.solution !== question.solution ||
            JSON.stringify(next.options) !==
                JSON.stringify(question.options || []);
        return changed ? next : null;
    };

    const stableSort = (items, sortBy = 'createdAt', direction = 'desc') =>
        (items || []).map((item, index) => ({ item, index }))
            .sort((left, right) => {
                const a = left.item?.[sortBy];
                const b = right.item?.[sortBy];
                const compared = a < b ? -1 : a > b ? 1 : 0;
                return (direction === 'asc' ? compared : -compared) ||
                    left.index - right.index;
            })
            .map(entry => entry.item);

    const collectKnowledgeNames = node => {
        if (!node) return [];
        return [
            node.name,
            ...(node.children || []).flatMap(collectKnowledgeNames)
        ];
    };

    const paginate = (items, page = 1, pageSize = 10) => {
        const size = Math.max(1, Math.floor(pageSize) || 10);
        const total = (items || []).length;
        const totalPages = Math.max(1, Math.ceil(total / size));
        const currentPage = Math.min(
            totalPages,
            Math.max(1, Math.floor(page) || 1)
        );
        const start = (currentPage - 1) * size;
        return {
            items: (items || []).slice(start, start + size),
            total,
            page: currentPage,
            pageSize: size,
            totalPages
        };
    };

    const selectBatch = (availableIds, selectedIds, mode = 'all') => {
        const available = new Set((availableIds || []).map(String));
        const selected = new Set(
            (selectedIds || []).map(String).filter(id => available.has(id))
        );
        if (mode === 'none') return [];
        if (mode === 'all') return [...available];
        if (typeof mode === 'object' && mode?.toggle != null) {
            const id = String(mode.toggle);
            if (!available.has(id)) return [...selected];
            if (selected.has(id)) selected.delete(id);
            else selected.add(id);
        }
        return [...selected];
    };

    const defaultFingerprint = question => {
        const normalize = value => String(value || '')
            .replace(/\s+/g, '')
            .toLowerCase();
        const stem = normalize(question?.stem);
        const options = (question?.options || []).map(normalize);
        return !stem && !options.length ? ''
            : 'qisi-library-core-v2:' + JSON.stringify([stem, options]);
    };

    const detectDuplicate = (
        candidate,
        items,
        fingerprint = defaultFingerprint
    ) => {
        const candidateKey = fingerprint(candidate);
        if (!candidateKey || candidateKey === '__' || candidateKey === 'qisi-core-v2:["",[]]') return null;
        return (items || []).find(item =>
            item?.id !== candidate?.id && fingerprint(item) === candidateKey
        ) || null;
    };

    const metadataQuery = items => {
        const rows = items || [];
        const types = new Map();
        const grades = new Map();
        const difficulties = new Map();
        let withAnswer = 0;
        let withImages = 0;
        for (const item of rows) {
            const type = String(item?.type || item?.meta?.type || '');
            const grade = String(item?.grade || item?.meta?.grade || '');
            const difficulty = String(item?.diff || item?.meta?.diff || '');
            if (type) types.set(type, (types.get(type) || 0) + 1);
            if (grade) grades.set(grade, (grades.get(grade) || 0) + 1);
            if (difficulty) {
                difficulties.set(
                    difficulty,
                    (difficulties.get(difficulty) || 0) + 1
                );
            }
            if (String(item?.answer || '').trim()) withAnswer += 1;
            if (Array.isArray(item?.images) && item.images.length) withImages += 1;
        }
        return {
            total: rows.length,
            types: Object.fromEntries(types),
            grades: Object.fromEntries(grades),
            difficulties: Object.fromEntries(difficulties),
            withAnswer,
            withImages
        };
    };

    const createLibraryService = ({
        repository,
        matchesFilters,
        getKnowledge,
        findKnowledgeNode,
        fingerprint = defaultFingerprint
    } = {}) => {
        if (typeof matchesFilters !== 'function') {
            throw new TypeError('matchesFilters dependency is required.');
        }

        const filterAndSort = (
            items,
            {
                keyword = '',
                filters = {},
                knowledge = '',
                knowledgeType = 'system',
                knowledgeTree = [],
                sortBy = 'createdAt',
                direction = 'desc'
            } = {}
        ) => {
            let result = (items || []).filter(Boolean);
            if (knowledge) {
                const node = typeof findKnowledgeNode === 'function'
                    ? findKnowledgeNode(knowledgeTree, knowledge)
                    : null;
                const allowed = new Set(
                    node ? collectKnowledgeNames(node) : [knowledge]
                );
                result = result.filter(item => allowed.has(
                    typeof getKnowledge === 'function'
                        ? getKnowledge(item, knowledgeType)
                        : item?.knowledge
                ));
            }
            result = result.filter(item => matchesFilters(item, {
                keyword,
                filters
            }));
            return stableSort(result, sortBy, direction);
        };

        const query = (items, criteria = {}) => {
            const filtered = filterAndSort(items, criteria);
            return paginate(filtered, criteria.page, criteria.pageSize);
        };

        const softDelete = id => {
            if (!repository?.softDeleteQuestion) {
                throw new TypeError('repository soft delete is unavailable.');
            }
            return repository.softDeleteQuestion(id);
        };
        const restore = id => {
            if (!repository?.restoreQuestion) {
                throw new TypeError('repository restore is unavailable.');
            }
            return repository.restoreQuestion(id);
        };

        const requireRepositoryMethod = name => {
            if (typeof repository?.[name] !== 'function') {
                fail(
                    'LIBRARY_REPOSITORY_PORT_REQUIRED',
                    `Library repository method ${name} is unavailable.`
                );
            }
            return repository[name].bind(repository);
        };

        const saveQuestion = (question, options = {}) =>
            requireRepositoryMethod('saveQuestion')(
                clone(question),
                clone(options)
            );

        const replaceQuestion = (question, options = {}) => {
            if (!question?.id) {
                fail(
                    'LIBRARY_QUESTION_ID_REQUIRED',
                    'Question replacement requires an ID.'
                );
            }
            return requireRepositoryMethod('saveQuestion')(
                clone(question),
                { ...clone(options), allowUpdate: true }
            );
        };

        const migrateQuestions = async transform => {
            if (typeof transform !== 'function') {
                fail(
                    'LIBRARY_MIGRATION_TRANSFORM_REQUIRED',
                    'Question migration transform is required.'
                );
            }
            const rows = await requireRepositoryMethod('listTable')(
                'questions'
            );
            let changedCount = 0;
            for (const row of rows) {
                const next = await transform(clone(row));
                if (!next) continue;
                await requireRepositoryMethod('updateQuestion')(
                    row.id,
                    next,
                    { expectedUpdatedAt: row.updatedAt }
                );
                changedCount += 1;
            }
            return changedCount;
        };

        const migrateSafeQuestionLatexData = () =>
            migrateQuestions(migrateSafeQuestionLatexRecord);

        const normalizeExternalOperation = operation => {
            if (!isRecord(operation)) {
                fail(
                    'EXTERNAL_MERGE_OPERATION_INVALID',
                    'External merge operation must be an object.'
                );
            }
            const action = String(operation.action || '');
            if (!['add', 'fill', 'skip'].includes(action)) {
                fail(
                    'EXTERNAL_MERGE_OPERATION_INVALID',
                    'External merge action is invalid.'
                );
            }
            const externalId = String(operation.externalId || '').trim();
            if (!externalId) {
                fail(
                    'EXTERNAL_MERGE_SOURCE_REQUIRED',
                    'External merge source ID is required.'
                );
            }
            if (action !== 'skip' && !operation.question?.id) {
                fail(
                    'EXTERNAL_MERGE_QUESTION_REQUIRED',
                    'External merge question is required.'
                );
            }
            return {
                action,
                externalId,
                question: clone(operation.question),
                expectedUpdatedAt: operation.expectedUpdatedAt
            };
        };

        const commitExternalMerge = async ({
            id,
            createdAt,
            operations = []
        } = {}) => {
            if (!String(id || '').trim() || !Number.isFinite(createdAt)) {
                fail(
                    'EXTERNAL_MERGE_COMMAND_INVALID',
                    'External merge ID and timestamp are required.'
                );
            }
            if (!Array.isArray(operations) || !operations.length) {
                fail(
                    'EXTERNAL_MERGE_COMMAND_INVALID',
                    'External merge operations are required.'
                );
            }
            const normalized = operations.map(normalizeExternalOperation);
            return requireRepositoryMethod('transaction')(
                ['questions', 'externalQuestions', 'mergeBatches'],
                tx => {
                    const mergeBatch = {
                        id,
                        createdAt,
                        source: 'externalConfirm',
                        addedQuestionIds: [],
                        filledQuestionSnapshots: [],
                        externalStatusSnapshots: [],
                        summary: { added: 0, filled: 0, skipped: 0 },
                        revertedAt: 0
                    };
                    // 事务回调必须是同步函数 + Dexie promise 链：async 回调会返回原生
                    // Promise，Dexie 判定事务提前提交，"撤销"就可能撤一半。
                    const applyOperation = operation =>
                        tx.get('externalQuestions', operation.externalId)
                            .then(external => {
                                if (!external) {
                                    fail(
                                        'EXTERNAL_MERGE_SOURCE_MISSING',
                                        'External merge source was not found.'
                                    );
                                }
                                mergeBatch.externalStatusSnapshots.push({
                                    id: external.id,
                                    processStatus:
                                        external.processStatus || 'unprocessed',
                                    linkedQuestionId:
                                        external.linkedQuestionId || '',
                                    processedAt: external.processedAt || 0
                                });
                                if (operation.action === 'skip') {
                                    return tx.update(
                                        'externalQuestions',
                                        external.id,
                                        {
                                            processStatus: 'skipped',
                                            processedAt: createdAt
                                        }
                                    ).then(() => {
                                        mergeBatch.summary.skipped += 1;
                                    });
                                }
                                if (operation.action === 'fill') {
                                    return tx.get(
                                        'questions',
                                        operation.question.id
                                    ).then(current => {
                                        if (!current) {
                                            fail(
                                                'EXTERNAL_MERGE_TARGET_MISSING',
                                                'External merge target was not found.'
                                            );
                                        }
                                        if (
                                            operation.expectedUpdatedAt !== undefined &&
                                            current.updatedAt !==
                                                operation.expectedUpdatedAt
                                        ) {
                                            fail(
                                                'EXTERNAL_MERGE_TARGET_STALE',
                                                'External merge target changed.'
                                            );
                                        }
                                        mergeBatch.filledQuestionSnapshots
                                            .push(current);
                                        return tx.put('questions', operation.question)
                                            .then(() => tx.update(
                                                'externalQuestions',
                                                external.id,
                                                {
                                                    processStatus: 'filled',
                                                    linkedQuestionId: operation.question.id,
                                                    processedAt: createdAt
                                                }
                                            ))
                                            .then(() => {
                                                mergeBatch.summary.filled += 1;
                                            });
                                    });
                                }
                                return tx.get(
                                    'questions',
                                    operation.question.id
                                ).then(existingQuestion => {
                                    if (existingQuestion) {
                                        fail(
                                            'EXTERNAL_MERGE_QUESTION_DUPLICATE',
                                            'External merge question already exists.'
                                        );
                                    }
                                    return tx.put('questions', operation.question)
                                        .then(() => {
                                            mergeBatch.addedQuestionIds.push(
                                                operation.question.id
                                            );
                                        })
                                        .then(() => tx.update(
                                            'externalQuestions',
                                            external.id,
                                            {
                                                processStatus: 'added',
                                                linkedQuestionId: operation.question.id,
                                                processedAt: createdAt
                                            }
                                        ))
                                        .then(() => {
                                            mergeBatch.summary.added += 1;
                                        });
                                });
                            });
                    let chain = tx.get('mergeBatches', id).then(existing => {
                        if (existing) {
                            fail(
                                'EXTERNAL_MERGE_DUPLICATE',
                                'External merge command already exists.'
                            );
                        }
                    });
                    for (const operation of normalized) {
                        chain = chain.then(() => applyOperation(operation));
                    }
                    return chain
                        .then(() => tx.put('mergeBatches', mergeBatch))
                        .then(() => tx.get('mergeBatches', id))
                        .then(readback => {
                            if (!readback) {
                                fail(
                                    'EXTERNAL_MERGE_READBACK_FAILED',
                                    'External merge readback failed.'
                                );
                            }
                            return {
                                mergeBatch: readback,
                                summary: clone(readback.summary)
                            };
                        });
                }
            );
        };

        const getLatestReversibleExternalMerge = async () => {
            const batches = await requireRepositoryMethod('listTable')(
                'mergeBatches',
                { orderBy: 'createdAt', reverse: true }
            );
            return batches.find(batch => !batch?.revertedAt) || null;
        };

        const undoExternalMerge = async ({
            mergeBatchId,
            revertedAt
        } = {}) => {
            if (
                !String(mergeBatchId || '').trim() ||
                !Number.isFinite(revertedAt)
            ) {
                fail(
                    'EXTERNAL_MERGE_UNDO_INVALID',
                    'External merge undo command is invalid.'
                );
            }
            return requireRepositoryMethod('transaction')(
                ['questions', 'externalQuestions', 'mergeBatches'],
                tx => tx.get('mergeBatches', mergeBatchId)
                    .then(batch => {
                        if (!batch) {
                            fail(
                                'EXTERNAL_MERGE_MISSING',
                                'External merge batch was not found.'
                            );
                        }
                        if (batch.revertedAt) {
                            fail(
                                'EXTERNAL_MERGE_ALREADY_REVERTED',
                                'External merge batch was already reverted.'
                            );
                        }
                        let chain = tx.deleteMany(
                            'questions',
                            batch.addedQuestionIds || []
                        );
                        for (const snapshot of
                            batch.filledQuestionSnapshots || []) {
                            if (snapshot?.id) {
                                chain = chain.then(() =>
                                    tx.put('questions', snapshot));
                            }
                        }
                        for (const snapshot of
                            batch.externalStatusSnapshots || []) {
                            if (!snapshot?.id) continue;
                            chain = chain.then(() => tx.update(
                                'externalQuestions',
                                snapshot.id,
                                {
                                    processStatus:
                                        snapshot.processStatus || 'unprocessed',
                                    linkedQuestionId:
                                        snapshot.linkedQuestionId || '',
                                    processedAt: snapshot.processedAt || 0
                                }
                            ));
                        }
                        return chain
                            .then(() => tx.update('mergeBatches', mergeBatchId, {
                                revertedAt
                            }))
                            .then(() => tx.get('mergeBatches', mergeBatchId))
                            .then(readback => {
                                if (readback?.revertedAt !== revertedAt) {
                                    fail(
                                        'EXTERNAL_MERGE_UNDO_READBACK_FAILED',
                                        'External merge undo readback failed.'
                                    );
                                }
                                return { mergeBatch: readback, reverted: true };
                            });
                    })
            );
        };

        return Object.freeze({
            filterAndSort,
            query,
            paginate,
            selectBatch,
            detectDuplicate: (candidate, items) =>
                detectDuplicate(candidate, items, fingerprint),
            metadataQuery,
            softDelete,
            restore,
            saveQuestion,
            replaceQuestion,
            migrateQuestions,
            migrateSafeQuestionLatexData,
            commitExternalMerge,
            getLatestReversibleExternalMerge,
            undoExternalMerge
        });
    };

    return Object.freeze({
        stableSort,
        collectKnowledgeNames,
        paginate,
        selectBatch,
        detectDuplicate,
        metadataQuery,
        createLibraryService
    });
});
