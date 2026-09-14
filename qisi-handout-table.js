(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutTable = api;

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
    function () {
        'use strict';

        const MAX_ROWS = 40;
        const MAX_COLUMNS = 16;

        const clone = value => (
            typeof structuredClone === 'function'
                ? structuredClone(value)
                : JSON.parse(JSON.stringify(value))
        );

        const boundedInteger = (
            value,
            label,
            minimum,
            maximum
        ) => {
            const numeric = Number(value);
            if (
                !Number.isInteger(numeric)
                || numeric < minimum
                || numeric > maximum
            ) {
                throw new RangeError(
                    `${label} must be between ${minimum} and ${maximum}`
                );
            }
            return numeric;
        };

        const equalWidths = count => Array.from(
            { length: count },
            () => Number((100 / count).toFixed(4))
        );

        const createCell = (id, rowIndex, columnIndex) => ({
            id: `${id}-r${rowIndex + 1}c${columnIndex + 1}`,
            content: '',
            align: 'center',
            rowSpan: 1,
            colSpan: 1,
            coveredBy: ''
        });

        const createTable = ({
            id,
            rows = 2,
            columns = 3,
            placement = 'after-stem'
        }) => {
            const tableId = String(id || '').trim();
            if (!tableId) throw new TypeError('table id is required');
            const rowCount = boundedInteger(
                rows,
                'table rows',
                1,
                MAX_ROWS
            );
            const columnCount = boundedInteger(
                columns,
                'table columns',
                1,
                MAX_COLUMNS
            );
            return {
                id: tableId,
                placement,
                caption: '',
                columnWidths: equalWidths(columnCount),
                rows: Array.from(
                    { length: rowCount },
                    (_, rowIndex) => Array.from(
                        { length: columnCount },
                        (_, columnIndex) =>
                            createCell(
                                tableId,
                                rowIndex,
                                columnIndex
                            )
                    )
                )
            };
        };

        const dimensions = table => ({
            rows: table.rows.length,
            columns: table.rows[0]?.length || 0
        });

        const cellAt = (table, rowIndex, columnIndex) => {
            const size = dimensions(table);
            const row = boundedInteger(
                rowIndex,
                'row index',
                0,
                size.rows - 1
            );
            const column = boundedInteger(
                columnIndex,
                'column index',
                0,
                size.columns - 1
            );
            return {
                row,
                column,
                cell: table.rows[row][column]
            };
        };

        const updateCell = (
            tableValue,
            rowIndex,
            columnIndex,
            patch
        ) => {
            const table = clone(tableValue);
            const { row, column, cell } =
                cellAt(table, rowIndex, columnIndex);
            table.rows[row][column] = {
                ...cell,
                ...patch,
                id: cell.id
            };
            return table;
        };

        const insertRow = (tableValue, afterIndex) => {
            const table = clone(tableValue);
            const size = dimensions(table);
            if (size.rows >= MAX_ROWS) {
                throw new RangeError(
                    `table cannot exceed ${MAX_ROWS} rows`
                );
            }
            const index = clampIndex(
                Number(afterIndex) + 1,
                0,
                size.rows
            );
            const row = Array.from(
                { length: size.columns },
                (_, columnIndex) =>
                    createCell(
                        `${table.id}-${Date.now()}`,
                        index,
                        columnIndex
                    )
            );
            table.rows.splice(index, 0, row);
            return clearMerges(table);
        };

        const deleteRow = (tableValue, rowIndex) => {
            const table = clone(tableValue);
            if (table.rows.length <= 1) {
                throw new RangeError(
                    'table must keep at least one row'
                );
            }
            const { row } = cellAt(table, rowIndex, 0);
            table.rows.splice(row, 1);
            return clearMerges(table);
        };

        const insertColumn = (tableValue, afterIndex) => {
            const table = clone(tableValue);
            const size = dimensions(table);
            if (size.columns >= MAX_COLUMNS) {
                throw new RangeError(
                    `table cannot exceed ${MAX_COLUMNS} columns`
                );
            }
            const index = clampIndex(
                Number(afterIndex) + 1,
                0,
                size.columns
            );
            table.rows.forEach((row, rowIndex) => {
                row.splice(
                    index,
                    0,
                    createCell(
                        `${table.id}-${Date.now()}`,
                        rowIndex,
                        index
                    )
                );
            });
            table.columnWidths = equalWidths(size.columns + 1);
            return clearMerges(table);
        };

        const deleteColumn = (tableValue, columnIndex) => {
            const table = clone(tableValue);
            const size = dimensions(table);
            if (size.columns <= 1) {
                throw new RangeError(
                    'table must keep at least one column'
                );
            }
            const { column } = cellAt(table, 0, columnIndex);
            table.rows.forEach(row => row.splice(column, 1));
            table.columnWidths = equalWidths(size.columns - 1);
            return clearMerges(table);
        };

        const clampIndex = (value, minimum, maximum) =>
            Math.min(maximum, Math.max(minimum, value));

        const clearMerges = tableValue => {
            const table = clone(tableValue);
            table.rows.forEach(row => row.forEach(cell => {
                cell.rowSpan = 1;
                cell.colSpan = 1;
                cell.coveredBy = '';
            }));
            return table;
        };

        const mergeCells = (
            tableValue,
            startValue,
            endValue
        ) => {
            const table = clearMerges(tableValue);
            const start = cellAt(
                table,
                startValue.row,
                startValue.column
            );
            const end = cellAt(
                table,
                endValue.row,
                endValue.column
            );
            const top = Math.min(start.row, end.row);
            const bottom = Math.max(start.row, end.row);
            const left = Math.min(start.column, end.column);
            const right = Math.max(start.column, end.column);
            const anchor = table.rows[top][left];

            anchor.rowSpan = bottom - top + 1;
            anchor.colSpan = right - left + 1;
            for (let row = top; row <= bottom; row += 1) {
                for (
                    let column = left;
                    column <= right;
                    column += 1
                ) {
                    if (row === top && column === left) continue;
                    table.rows[row][column].coveredBy = anchor.id;
                }
            }
            return table;
        };

        const splitCell = (
            tableValue,
            rowIndex,
            columnIndex
        ) => {
            const table = clone(tableValue);
            const { cell } = cellAt(
                table,
                rowIndex,
                columnIndex
            );
            const anchorId = cell.coveredBy || cell.id;
            table.rows.forEach(row => row.forEach(item => {
                if (
                    item.id === anchorId
                    || item.coveredBy === anchorId
                ) {
                    item.rowSpan = 1;
                    item.colSpan = 1;
                    item.coveredBy = '';
                }
            }));
            return table;
        };

        const setColumnWidth = (
            tableValue,
            columnIndex,
            widthPercent
        ) => {
            const table = clone(tableValue);
            const size = dimensions(table);
            const index = boundedInteger(
                columnIndex,
                'column index',
                0,
                size.columns - 1
            );
            const width = Number(widthPercent);
            if (!Number.isFinite(width) || width < 5 || width > 90) {
                throw new RangeError(
                    'column width must be between 5 and 90 percent'
                );
            }
            const remaining = 100 - width;
            const otherTotal = table.columnWidths.reduce(
                (total, value, currentIndex) =>
                    currentIndex === index
                        ? total
                        : total + Number(value || 0),
                0
            );
            table.columnWidths = table.columnWidths.map(
                (value, currentIndex) => {
                    if (currentIndex === index) return width;
                    if (otherTotal <= 0) {
                        return remaining / (size.columns - 1);
                    }
                    return Number(value || 0)
                        / otherTotal
                        * remaining;
                }
            ).map(value => Number(value.toFixed(4)));
            return table;
        };

        return Object.freeze({
            MAX_ROWS,
            MAX_COLUMNS,
            createTable,
            dimensions,
            updateCell,
            insertRow,
            deleteRow,
            insertColumn,
            deleteColumn,
            mergeCells,
            splitCell,
            setColumnWidth,
            clearMerges
        });
    }
);
