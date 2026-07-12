const test = require('node:test');
const assert = require('node:assert/strict');

const Library = require('../qisi-library-service.js');

const makeQuestions = count => Array.from({ length: count }, (_, index) => ({
    id: `q${index}`,
    stem: `question ${index}`,
    type: index % 2 ? '解答题' : '单选题',
    grade: `高${index % 3 + 1}`,
    diff: index % 2 ? '中等' : '简单',
    createdAt: index,
    answer: index % 2 ? '' : 'A',
    images: []
}));

const service = Library.createLibraryService({
    matchesFilters: (item, { keyword, filters }) =>
        (!keyword || item.stem.includes(keyword)) &&
        (!filters.type || item.type === filters.type)
});

for (const count of [100, 1000, 5000]) {
    test(`${count} metadata records filter, sort, and paginate`, () => {
        const source = makeQuestions(count);
        const started = performance.now();
        const result = service.query(source, {
            filters: { type: '单选题' },
            sortBy: 'createdAt',
            direction: 'desc',
            page: 2,
            pageSize: 25
        });
        const duration = performance.now() - started;

        assert.equal(result.total, Math.ceil(count / 2));
        assert.equal(result.items.length, 25);
        assert.equal(result.items[0].createdAt > result.items[1].createdAt, true);
        assert.ok(duration < 1000, `query took ${duration}ms`);
        assert.equal(source.length, count);
    });
}
