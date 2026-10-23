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
    // Undo is destructive: only structurally provable stored values may be restored.
    // Unknown object types deliberately fail closed rather than being JSON-erased.
    const sameStoredValue = (left, right) => {
        if (Object.is(left, right)) return true;
        if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
        if (left instanceof Date || right instanceof Date) {
            return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
        }
        if (Array.isArray(left) !== Array.isArray(right)) return false;
        if (!Array.isArray(left) && (Object.getPrototypeOf(left) !== Object.prototype ||
            Object.getPrototypeOf(right) !== Object.prototype)) return false;
        if (Array.isArray(left) && left.length !== right.length) return false;
        const keys = Object.keys(left);
        return keys.length === Object.keys(right).length && keys.every(key =>
            Object.prototype.hasOwnProperty.call(right, key) && sameStoredValue(left[key], right[key]));
    };
    const externalStatus = row => ({ id: row.id, processStatus: row.processStatus || 'unprocessed',
        linkedQuestionId: row.linkedQuestionId || '', processedAt: row.processedAt || 0 });

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

    const createExternalQuestionModel = ({ coreFingerprint, stemFingerprint, getIndexes,
        getKnowledge, hasText, sameText, clock = Date.now, random = Math.random }) => {
        const getExternalMatchInfo = (extQ) => {
            const core = coreFingerprint(extQ);
            const stem = stemFingerprint(extQ);
        
            const exact = getIndexes().core.get(core);
            if (exact) {
                const extAnswer = extQ.answer || '';
                const localAnswer = exact.answer || '';
                const answerConflict = hasText(extAnswer) && hasText(localAnswer) && !sameText(extAnswer, localAnswer);
        
                if (answerConflict) {
                    return { status: 'answerConflict', matchedQuestion: exact, reason: '题干和选项基本一致，但答案不一致' };
                }
        
                const canFillAnswer = !hasText(exact.answer) && hasText(extQ.answer);
                const canFillSolution = !hasText(exact.solution) && hasText(extQ.solution);
                const canFillPersonalKnowledge = !hasText(getKnowledge(exact, 'personal')) && hasText(getKnowledge(extQ, 'personal'));
                const canFillSystemKnowledge = !hasText(getKnowledge(exact, 'system')) && hasText(getKnowledge(extQ, 'system'));
        
                if (canFillAnswer || canFillSolution || canFillPersonalKnowledge || canFillSystemKnowledge) {
                    return { status: 'fillable', matchedQuestion: exact, reason: '个人题库已有此题，但可补全答案、解析或知识点' };
                }
        
                return { status: 'existing', matchedQuestion: exact, reason: '个人题库已有完整相同题目' };
            }
        
            const similar = stem ? getIndexes().stem.get(stem) : null;
        
            if (similar && coreFingerprint(similar) !== core) {
                return { status: 'similar', matchedQuestion: similar, reason: '题干相同或高度相似，但选项或结构不同，需要人工确认' };
            }
        
            return { status: 'new', matchedQuestion: null, reason: '个人题库中未发现相同题目' };
        };
        
        const copyExternalToPersonalQuestion = (extQ, item) => {
            const now = clock();
            const personalKnowledge = item.personalKnowledge || getKnowledge(extQ, 'personal') || '';
            const systemKnowledge = item.systemKnowledge || getKnowledge(extQ, 'system') || '';
            const primaryKnowledge = personalKnowledge || systemKnowledge ||
                extQ.personalKnowledge || extQ.systemKnowledge ||
                extQ.meta?.personalKnowledge || extQ.meta?.systemKnowledge ||
                extQ.knowledge || extQ.meta?.knowledge || '';
            const primaryKnowledgeType = personalKnowledge
                ? 'personal'
                : (systemKnowledge ? 'system' : (extQ.knowledgeType || extQ.meta?.knowledgeType || 'system'));
            const sourceTags = Array.isArray(extQ.meta?.tags) ? extQ.meta.tags : (Array.isArray(extQ.tags) ? extQ.tags : []);
            const tags = [
                ...sourceTags,
                '外部导入',
                `来源_${extQ.sourceTeacher || '外部教师'}`
            ].filter(Boolean);
        
            return {
                id: `q_${now}_${random().toString(36).slice(2, 8)}`,
                grade: extQ.grade || extQ.meta?.grade || '高一',
                diff: extQ.diff || extQ.meta?.diff || '中等',
                type: extQ.type || '解答题',
                stem: extQ.stem || '',
                options: Array.isArray(extQ.options) ? [...extQ.options] : ['', '', '', ''],
                answer: extQ.answer || '',
                solution: extQ.solution || '',
                images: (extQ.images || []).map(img => ({ id: img.id, align: img.align || 'center' })),
                knowledge: primaryKnowledge,
                knowledgeType: primaryKnowledgeType,
                systemKnowledge,
                personalKnowledge,
                meta: {
                    ...(extQ.meta || {}),
                    grade: extQ.grade || extQ.meta?.grade || '高一',
                    diff: extQ.diff || extQ.meta?.diff || '中等',
                    knowledge: primaryKnowledge,
                    knowledgeType: primaryKnowledgeType,
                    systemKnowledge,
                    personalKnowledge,
                    tags,
                    sources: [
                        ...(extQ.meta?.sources || []),
                        { type: 'external', sourceTeacher: extQ.sourceTeacher || '外部教师', batchId: extQ.batchId, externalId: extQ.id, addedAt: now }
                    ]
                },
                createdAt: now,
                updatedAt: now
            };
        };
        
        const buildFilledQuestionFromExternal = (localQ, extQ, item) => {
            const now = clock();
            const next = JSON.parse(JSON.stringify(localQ));
            if (!hasText(next.answer) && hasText(extQ.answer)) next.answer = extQ.answer;
            if (!hasText(next.solution) && hasText(extQ.solution)) next.solution = extQ.solution;
            if (!next.meta) next.meta = {};
        
            const personalToFill = item.personalKnowledge || getKnowledge(extQ, 'personal');
            const systemToFill = item.systemKnowledge || getKnowledge(extQ, 'system');
        
            if (!hasText(next.personalKnowledge) && personalToFill) {
                next.personalKnowledge = personalToFill;
                next.meta.personalKnowledge = personalToFill;
            }
            if (!hasText(next.systemKnowledge) && systemToFill) {
                next.systemKnowledge = systemToFill;
                next.meta.systemKnowledge = systemToFill;
            }
        
            const primaryKnowledge = next.personalKnowledge || next.systemKnowledge || next.knowledge || '';
            const primaryKnowledgeType = next.personalKnowledge ? 'personal' : (next.systemKnowledge ? 'system' : next.knowledgeType || 'system');
            next.knowledge = primaryKnowledge;
            next.knowledgeType = primaryKnowledgeType;
            next.meta.knowledge = primaryKnowledge;
            next.meta.knowledgeType = primaryKnowledgeType;
        
            const oldTags = Array.isArray(next.meta.tags) ? next.meta.tags : (Array.isArray(next.tags) ? next.tags : []);
            next.meta.tags = [...new Set([...oldTags, '外部补全', `来源_${extQ.sourceTeacher || '外部教师'}`])];
            next.meta.sources = [
                ...(next.meta.sources || []),
                { type: 'external-fill', sourceTeacher: extQ.sourceTeacher || '外部教师', batchId: extQ.batchId, externalId: extQ.id, filledAt: now }
            ];
            next.updatedAt = now;
            return next;
        };
        return Object.freeze({ getMatchInfo: getExternalMatchInfo, copyQuestion: copyExternalToPersonalQuestion, fillQuestion: buildFilledQuestionFromExternal });
    };

    const createQuestionMaintenance = ({ repository, service, tokenize, renderMath, refreshLibrary,
        report = () => {} }) => {
        const audit = async () => {
            const storedQuestions = await repository.listTable('questions');
            const imageRecords = await repository.listTable('images');
            const storedImageIds = new Set(
                imageRecords.map(record => String(record?.id || '')).filter(Boolean)
            );
            const issues = [];
        
            const inspectField = (question, fieldName, value) => {
                const source = String(value || '');
                if (!source) return;
        
                const parsed = tokenize(source);
        
                for (const issue of parsed.issues) {
                    issues.push({
                        questionId: question.id,
                        field: fieldName,
                        type: issue.type,
                        detail: issue.preview
                    });
                }
        
                for (const segment of parsed.segments) {
                    if (segment.type !== 'math') continue;
                    const expression = String(segment.expression || '').replace(/\s*\n\s*/g, ' ').trim();
                    try {
                        renderMath(expression, {
                            throwOnError: true,
                            strict: 'ignore'
                        });
                    } catch (error) {
                        issues.push({
                            questionId: question.id,
                            field: fieldName,
                            type: 'katex-error',
                            detail: error?.message || String(error),
                            source: segment.raw
                        });
                    }
                }
        
                const imageRefs = [
                    ...source.matchAll(/\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/g),
                    ...source.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)
                ];
                const questionImageIds = new Set(
                    (question.images || []).map(image => String(image?.id || '')).filter(Boolean)
                );
        
                for (const match of imageRefs) {
                    const imageId = String(match[1] || '').trim();
                    if (!questionImageIds.has(imageId)) {
                        issues.push({
                            questionId: question.id,
                            field: fieldName,
                            type: 'image-not-in-question',
                            detail: imageId
                        });
                    }
                    if (!storedImageIds.has(imageId)) {
                        issues.push({
                            questionId: question.id,
                            field: fieldName,
                            type: 'image-blob-missing',
                            detail: imageId
                        });
                    }
                }
        
                if (/MATHPROTECT|@@QISI_MATH_/.test(source)) {
                    issues.push({
                        questionId: question.id,
                        field: fieldName,
                        type: 'internal-token-leaked',
                        detail: source.slice(0, 160)
                    });
                }
            };
        
            for (const question of storedQuestions) {
                inspectField(question, 'stem', question.stem);
                inspectField(question, 'answer', question.answer);
                inspectField(question, 'solution', question.solution);
                (question.options || []).forEach((option, index) => {
                    inspectField(question, `option${index}`, option);
                });
            }
        
            report({ kind: 'audit', issues });
            return issues;
        };
        let pending = null;
        const migrate = () => {
            if (pending) return pending;
            pending = (async () => {
                let changedCount;
                try { changedCount = await service.migrateSafeQuestionLatexData(); }
                catch (error) {
                    const progress = error.migrationProgress || { changedCount: 0 };
                    let refreshError;
                    if (progress.changedCount > 0) {
                        try { await refreshLibrary(); } catch (failure) { refreshError = failure; }
                    }
                    report({ kind: 'migration-failed', ...progress, error, refreshError });
                    throw error;
                }
                try { await refreshLibrary(); }
                catch (cause) {
                    const error = new Error(`迁移已写入 ${changedCount} 道题，但页面刷新失败：${cause?.message || cause}`);
                    error.code = 'LIBRARY_MIGRATION_REFRESH_FAILED'; error.cause = cause;
                    error.migrationProgress = { changedCount, committed: true };
                    report({ kind: 'migration-refresh-failed', changedCount, error });
                    throw error;
                }
                report({ kind: 'migration-complete', changedCount });
                return changedCount;
            })().finally(() => { pending = null; });
            return pending;
        };
        return Object.freeze({ audit, migrate });
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
                try {
                    const next = await transform(clone(row));
                    if (!next) continue;
                    await requireRepositoryMethod('updateQuestion')(
                        row.id, next, { expectedUpdatedAt: row.updatedAt }
                    );
                    changedCount += 1;
                } catch (error) {
                    error.migrationProgress = { changedCount, failedQuestionId: row.id };
                    throw error;
                }
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

        const runExternalTransaction = work => {
            let domainError;
            return requireRepositoryMethod('transaction')(
                ['questions', 'externalQuestions', 'mergeBatches'],
                tx => work(tx).catch(error => {
                    if (error?.name === 'LibraryServiceError') domainError = error;
                    throw error; // repository must observe failure and roll back before it is exposed
                })
            ).catch(error => { throw domainError || error; });
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
            if (new Set(normalized.map(row => row.externalId)).size !== normalized.length ||
                new Set(normalized.filter(row => row.action !== 'skip').map(row => row.question.id)).size !==
                    normalized.filter(row => row.action !== 'skip').length) {
                fail('EXTERNAL_MERGE_OPERATION_DUPLICATE', '同一合并请求含重复来源或重复目标，请重新选择。');
            }
            return runExternalTransaction(
                tx => {
                    const mergeBatch = {
                        id,
                        createdAt,
                        source: 'externalConfirm',
                        undoSnapshotVersion: 1,
                        writtenQuestionSnapshots: [],
                        writtenExternalStatuses: [],
                        addedQuestionIds: [],
                        filledQuestionSnapshots: [],
                        externalStatusSnapshots: [],
                        summary: { added: 0, filled: 0, skipped: 0 },
                        revertedAt: 0
                    };
                    // 本模块沿用可等待的 Dexie promise 链；原子性取决于所有数据库操作
                    // 都在事务内完成且失败向上传播，并非由是否使用 async 关键字决定。
                    const applyOperation = operation =>
                        tx.get('externalQuestions', operation.externalId)
                            .then(external => {
                                if (!external) {
                                    fail(
                                        'EXTERNAL_MERGE_SOURCE_MISSING',
                                        'External merge source was not found.'
                                    );
                                }
                                if (external.linkedQuestionId || ['added', 'filled'].includes(external.processStatus)) {
                                    if (operation.action !== 'skip') {
                                        fail('EXTERNAL_MERGE_SOURCE_PROCESSED', '这道外部题已处理，请刷新后重新选择。');
                                    }
                                    // A repeated skip must not erase an existing successful association.
                                    mergeBatch.summary.skipped += 1;
                                    return;
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
                        .then(() => {
                            let readback = tx.get('externalQuestions', normalized[0].externalId);
                            for (const questionId of [...mergeBatch.addedQuestionIds,
                                ...mergeBatch.filledQuestionSnapshots.map(row => row.id)]) {
                                readback = readback.then(() => tx.get('questions', questionId)).then(row => {
                                    if (!row) fail('EXTERNAL_MERGE_READBACK_FAILED', '合并题目读回失败。');
                                    mergeBatch.writtenQuestionSnapshots.push(clone(row));
                                });
                            }
                            for (const before of mergeBatch.externalStatusSnapshots) {
                                readback = readback.then(() => tx.get('externalQuestions', before.id)).then(row => {
                                    if (!row) fail('EXTERNAL_MERGE_READBACK_FAILED', '合并来源读回失败。');
                                    mergeBatch.writtenExternalStatuses.push(externalStatus(row));
                                });
                            }
                            return readback;
                        })
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
            return runExternalTransaction(
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
                        if (batch.undoSnapshotVersion !== 1 || !Array.isArray(batch.writtenQuestionSnapshots) ||
                            !Array.isArray(batch.writtenExternalStatuses)) {
                            fail('EXTERNAL_MERGE_UNDO_SNAPSHOT_REQUIRED',
                                '这条历史记录缺少写后快照，无法安全撤销；题库内容已保留。');
                        }
                        const questionIds = [...(batch.addedQuestionIds || []),
                            ...(batch.filledQuestionSnapshots || []).map(row => row.id)];
                        const sourceIds = (batch.externalStatusSnapshots || []).map(row => row.id);
                        if (questionIds.length !== batch.writtenQuestionSnapshots.length ||
                            sourceIds.length !== batch.writtenExternalStatuses.length ||
                            questionIds.some(id => !batch.writtenQuestionSnapshots.some(row => row.id === id)) ||
                            sourceIds.some(id => !batch.writtenExternalStatuses.some(row => row.id === id))) {
                            fail('EXTERNAL_MERGE_UNDO_SNAPSHOT_REQUIRED', '撤销证据不完整，题库内容已保留。');
                        }
                        // Every read and subsequent restore stays inside the same repository transaction.
                        let chain = tx.get('mergeBatches', mergeBatchId);
                        for (const snapshot of batch.writtenQuestionSnapshots) {
                            chain = chain.then(() => tx.get('questions', snapshot.id)).then(current => {
                                if (!sameStoredValue(current, snapshot)) {
                                    fail('EXTERNAL_MERGE_UNDO_TARGET_CHANGED',
                                        '合并后的题目已有修改或已删除，无法安全撤销；当前题目已保留。');
                                }
                            });
                        }
                        for (const snapshot of batch.writtenExternalStatuses) {
                            chain = chain.then(() => tx.get('externalQuestions', snapshot.id)).then(current => {
                                if (!current || !sameStoredValue(externalStatus(current), snapshot)) {
                                    fail('EXTERNAL_MERGE_UNDO_SOURCE_CHANGED',
                                        '外部题目的处理状态已改变，无法撤销较早记录；当前状态已保留。');
                                }
                            });
                        }
                        chain = chain.then(() => tx.deleteMany('questions', batch.addedQuestionIds || []));
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
        createQuestionMaintenance,
        createExternalQuestionModel,
        stableSort,
        collectKnowledgeNames,
        paginate,
        selectBatch,
        detectDuplicate,
        metadataQuery,
        createLibraryService
    });
});
