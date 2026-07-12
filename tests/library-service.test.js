const test = require('node:test');
const assert = require('node:assert/strict');

const Library = require('../qisi-library-service.js');

const matchesFilters = (item, { keyword, filters }) => {
    const haystack = `${item.stem} ${item.answer} ${item.solution}`.toLowerCase();
    return (!keyword || haystack.includes(keyword.toLowerCase())) &&
        (!filters.type || item.type === filters.type) &&
        (!filters.grade || item.grade === filters.grade);
};

const questions = [
    { id: 'q1', stem: 'Alpha', type: '单选题', grade: '高一', createdAt: 1, answer: 'A', images: [], knowledge: '集合' },
    { id: 'q2', stem: 'Beta', type: '解答题', grade: '高二', createdAt: 3, answer: '', images: [{ id: 'i1' }], knowledge: '子知识' },
    { id: 'q3', stem: 'Gamma alpha', type: '单选题', grade: '高一', createdAt: 2, answer: 'B', images: [], knowledge: '函数' }
];

test('search, filter, knowledge descendants, sort, and pagination compose', () => {
    const service = Library.createLibraryService({
        matchesFilters,
        getKnowledge: item => item.knowledge,
        findKnowledgeNode: (_tree, name) => name === '集合'
            ? { name: '集合', children: [{ name: '子知识' }] }
            : null
    });
    const result = service.query(questions, {
        filters: { grade: '高一' },
        sortBy: 'createdAt',
        direction: 'desc',
        page: 1,
        pageSize: 1
    });
    assert.equal(result.total, 2);
    assert.equal(result.totalPages, 2);
    assert.equal(result.items[0].id, 'q3');

    const knowledge = service.filterAndSort(questions, {
        knowledge: '集合',
        knowledgeTree: []
    });
    assert.deepEqual(knowledge.map(item => item.id), ['q2', 'q1']);
});

test('batch selection remains deterministic', () => {
    assert.deepEqual(
        Library.selectBatch(['q1', 'q2'], [], 'all'),
        ['q1', 'q2']
    );
    assert.deepEqual(
        Library.selectBatch(['q1', 'q2'], ['q1'], { toggle: 'q2' }),
        ['q1', 'q2']
    );
    assert.deepEqual(Library.selectBatch(['q1'], ['q1'], 'none'), []);
});

test('duplicate detection and metadata query are pure', () => {
    const input = structuredClone(questions);
    const duplicate = Library.detectDuplicate(
        { id: 'new', stem: ' Alpha ', options: [] },
        questions
    );
    assert.equal(duplicate.id, 'q1');
    assert.deepEqual(Library.metadataQuery(questions), {
        total: 3,
        types: { 单选题: 2, 解答题: 1 },
        grades: { 高一: 2, 高二: 1 },
        difficulties: {},
        withAnswer: 2,
        withImages: 1
    });
    assert.deepEqual(questions, input);
});

test('soft delete and restore delegate to repository only', async () => {
    const calls = [];
    const service = Library.createLibraryService({
        matchesFilters,
        repository: {
            softDeleteQuestion: async id => calls.push(['delete', id]),
            restoreQuestion: async id => calls.push(['restore', id])
        }
    });
    await service.softDelete('q1');
    await service.restore('q1');
    assert.deepEqual(calls, [['delete', 'q1'], ['restore', 'q1']]);
});
