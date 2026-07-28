(function (root, factory) {
    const questionInstance = root.Qisi?.HandoutQuestionInstance
        || (
            typeof require === 'function'
                ? require('./qisi-handout-question-instance.js')
                : null
        );
    const api = factory(questionInstance);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutQuestionLibrary = api;

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
    function (questionInstance) {
        'use strict';

        if (!questionInstance) {
            throw new Error('Qisi.HandoutQuestionInstance is required');
        }

        const MAX_RESULT_LIMIT = 200;
        const MAX_SCAN_ROWS = 5000;

        const requireTable = (db, name) => {
            const table = db?.[name] || db?.table?.(name);

            if (!table) {
                throw new Error(`database table is unavailable: ${name}`);
            }

            return table;
        };

        const sourceImageIdOf = image => String(
            typeof image === 'string'
                ? image
                : image?.sourceImageId || image?.imageId || image?.id || ''
        ).trim();

        const questionSearchText = question => [
            question?.questionNumber,
            question?.title,
            question?.stem,
            ...(Array.isArray(question?.options) ? question.options : []),
            question?.knowledge,
            question?.systemKnowledge,
            question?.personalKnowledge,
            question?.source,
            question?.year
        ].map(value => String(value || '').toLocaleLowerCase('zh-CN'))
            .join('\n');

        const matchesFilters = (question, filters) => {
            const query = String(filters.query || '')
                .trim()
                .toLocaleLowerCase('zh-CN');

            return (
                (!filters.grade || question?.grade === filters.grade)
                && (!filters.type || question?.type === filters.type)
                && (!filters.diff || question?.diff === filters.diff)
                && (!query || questionSearchText(question).includes(query))
            );
        };

        const summarizeQuestion = question => ({
            id: String(question?.id || ''),
            questionNumber: String(question?.questionNumber || ''),
            type: String(question?.type || ''),
            grade: String(question?.grade || ''),
            diff: String(question?.diff || ''),
            knowledge: String(
                question?.systemKnowledge
                || question?.personalKnowledge
                || question?.knowledge
                || ''
            ),
            stem: String(question?.stem || ''),
            optionCount: Array.isArray(question?.options)
                ? question.options.filter(Boolean).length
                : 0,
            imageCount: Array.isArray(question?.images)
                ? question.images.length
                : 0,
            updatedAt: String(
                question?.updatedAt
                || question?.createdAt
                || ''
            )
        });

        const createHandoutQuestionLibrary = ({ db }) => {
            const questions = requireTable(db, 'questions');
            const images = requireTable(db, 'images');

            const readSearchRows = async filters => {
                const indexedGrade = String(filters.grade || '').trim();

                if (
                    indexedGrade
                    && typeof questions.where === 'function'
                ) {
                    return questions
                        .where('grade')
                        .equals(indexedGrade)
                        .limit(MAX_SCAN_ROWS)
                        .toArray();
                }

                if (typeof questions.orderBy === 'function') {
                    return questions
                        .orderBy('createdAt')
                        .reverse()
                        .limit(MAX_SCAN_ROWS)
                        .toArray();
                }

                return (await questions.toArray())
                    .slice(-MAX_SCAN_ROWS)
                    .reverse();
            };

            const search = async (value = {}) => {
                const limit = Math.max(
                    1,
                    Math.min(
                        MAX_RESULT_LIMIT,
                        Number(value.limit || 40)
                    )
                );
                const filters = {
                    query: String(value.query || ''),
                    grade: String(value.grade || ''),
                    type: String(value.type || ''),
                    diff: String(value.diff || '')
                };
                const rows = await readSearchRows(filters);

                return rows
                    .filter(question =>
                        matchesFilters(question, filters)
                    )
                    .slice(0, limit)
                    .map(summarizeQuestion);
            };

            const getQuestion = id =>
                questions.get(String(id || ''));

            const getQuestionBundle = async id => {
                const question = await getQuestion(id);

                if (!question) {
                    const error = new Error(
                        `question ${id} does not exist`
                    );
                    error.code = 'HANDOUT_SOURCE_NOT_FOUND';
                    throw error;
                }

                const imageIds = [...new Set(
                    (Array.isArray(question.images)
                        ? question.images
                        : [])
                        .map(sourceImageIdOf)
                        .filter(Boolean)
                )];
                const sourceImages = await Promise.all(
                    imageIds.map(imageId => images.get(imageId))
                );

                return {
                    question,
                    sourceImages: sourceImages.filter(Boolean),
                    missingImageIds: imageIds.filter(
                        (imageId, index) => !sourceImages[index]
                    )
                };
            };

            const compareBlockSource = async block => {
                const source = await getQuestion(
                    block?.sourceQuestionId
                );

                return questionInstance.compareQuestionSource(
                    block?.snapshot,
                    source,
                    block?.contentOverrides || {}
                );
            };

            return Object.freeze({
                search,
                getQuestion,
                getQuestionBundle,
                compareBlockSource
            });
        };

        return {
            MAX_RESULT_LIMIT,
            MAX_SCAN_ROWS,
            sourceImageIdOf,
            questionSearchText,
            matchesFilters,
            summarizeQuestion,
            createHandoutQuestionLibrary
        };
    }
);
