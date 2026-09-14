'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const tableModel = require('../qisi-handout-table.js');

test('H9 structured table preserves editable LaTeX cells', () => {
    let table = tableModel.createTable({
        id: 'table-1',
        rows: 2,
        columns: 3
    });
    table = tableModel.updateCell(
        table,
        0,
        1,
        { content: '$\\frac{1}{2}$' }
    );

    assert.equal(table.rows[0][1].content, '$\\frac{1}{2}$');
    assert.deepEqual(table.columnWidths, [
        33.3333,
        33.3333,
        33.3333
    ]);
});

test('H9 table row and column operations stay rectangular', () => {
    let table = tableModel.createTable({
        id: 'table-2',
        rows: 2,
        columns: 2
    });
    table = tableModel.insertRow(table, 0);
    table = tableModel.insertColumn(table, 0);
    assert.deepEqual(tableModel.dimensions(table), {
        rows: 3,
        columns: 3
    });
    table = tableModel.deleteRow(table, 1);
    table = tableModel.deleteColumn(table, 2);
    assert.deepEqual(tableModel.dimensions(table), {
        rows: 2,
        columns: 2
    });
});

test('H9 merged table cells can be restored without deleting content', () => {
    let table = tableModel.createTable({
        id: 'table-3',
        rows: 2,
        columns: 2
    });
    table = tableModel.updateCell(
        table,
        1,
        1,
        { content: '保留内容' }
    );
    table = tableModel.mergeCells(
        table,
        { row: 0, column: 0 },
        { row: 1, column: 1 }
    );
    assert.equal(table.rows[0][0].rowSpan, 2);
    assert.equal(
        table.rows[1][1].coveredBy,
        table.rows[0][0].id
    );
    table = tableModel.splitCell(table, 0, 0);
    assert.equal(table.rows[1][1].coveredBy, '');
    assert.equal(table.rows[1][1].content, '保留内容');
});

test('H9 column resizing keeps a normalized 100 percent total', () => {
    let table = tableModel.createTable({
        id: 'table-4',
        rows: 2,
        columns: 3
    });
    table = tableModel.setColumnWidth(table, 0, 50);
    const total = table.columnWidths.reduce(
        (sum, value) => sum + value,
        0
    );
    assert.ok(Math.abs(total - 100) < 0.001);
    assert.equal(table.columnWidths[0], 50);
});
