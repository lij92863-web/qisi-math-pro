const test = require('node:test');
const assert = require('node:assert/strict');
const { pageGeometry, paginate, pageLabel, orderQuestions, PX_PER_MM } = require('../qisi-handout-layout');

test('double-column layout fills the left column first and paginates complete blocks', () => {
    const geometry = pageGeometry({ mode: 'double', paper: 'a3', columnGap: 12 });
    assert.equal(geometry.width, 420 * PX_PER_MM);
    assert.equal(geometry.gap, 12 * PX_PER_MM);
    const height = geometry.contentHeight * 0.45;
    const rows = Array.from({ length: 5 }, (_, id) => ({ id, kind: 'question', height }));
    const pages = paginate(rows, geometry, { mode: 'double', perPage: 1, gap: 10 });
    assert.deepEqual(pages.map(sheet => sheet.columns.map(column => column.map(row => row.id))), [[[0, 1], [2, 3]], [[4], []]]);
});

test('single-column question caps count questions, keep introductory titles with their item, and recognize overflows', () => {
    const geometry = { columns: 1, contentHeight: 100 };
    const rows = [
        { id: 'title', kind: 'title', height: 16, keepNext: true },
        { id: 1, kind: 'question', height: 38 },
        { id: 'text', kind: 'text', height: 18 },
        { id: 2, kind: 'question', height: 101 },
        { id: '2b', kind: 'question', continued: true, height: 34 },
        { id: 3, kind: 'question', height: 46, breakBefore: 'page' }
    ];
    const pages = paginate(rows, geometry, { mode: 'single', perPage: 1, gap: 6 });
    assert.deepEqual(pages.map(page => page.columns[0].map(item => item.id)), [['title', 1, 'text'], [2], ['2b'], [3]]);
    assert.equal(pages[1].columns[0][0].overflow, 1);
    assert.equal(pages[2].count, 0);
});

test('a continued question uses the next column without incrementing the question count', () => {
    const geometry = { columns: 2, contentHeight: 100 };
    const question = { id: 'long', kind: 'question', height: 111 };
    const pages = paginate([
        { id: 'preceding', kind: 'question', height: 56 },
        { ...question, splitAt: room => {
            assert.equal(room, 38);
            return [{ ...question, height: 34 }, { ...question, height: 77, continued: true }];
        } },
        { id: 'explicit', kind: 'question', height: 10, breakBefore: 'page' }
    ], geometry, { mode: 'double', gap: 6 });
    assert.deepEqual(pages.map(page => page.columns.map(column => column.map(row => row.id))),
        [[['preceding', 'long'], ['long']], [['explicit'], []]]);
    assert.deepEqual(pages.map(page => page.count), [2, 1]);
});

test('page variables support offset and override, original question order leaves unnumbered items last', () => {
    const settings = { mode: 'single', startPage: 2, startNumber: 9, overrideTotal: true, totalPages: 11 };
    assert.deepEqual(pageLabel(settings, 0, 4), { current: '', total: 11 });
    assert.deepEqual(pageLabel(settings, 2, 4), { current: 10, total: 11 });
    assert.deepEqual(pageLabel({ mode: 'double' }, 3, 6), { current: 4, total: 6 });
    const questions = [{ id: 'un' }, { id: 'b', meta: { questionNumber: 12 } }, { id: 'a', questionNumber: 2 }];
    assert.deepEqual(orderQuestions(questions, 'ascending').map(q => q.id), ['a', 'b', 'un']);
    assert.deepEqual(orderQuestions(questions, 'descending').map(q => q.id), ['b', 'a', 'un']);
});
