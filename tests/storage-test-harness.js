const clone = value => structuredClone(value);

class FakeQuery {
    constructor(table, predicate = () => true, orderBy = '') {
        this.table = table;
        this.predicate = predicate;
        this.orderKey = orderBy;
        this.reversed = false;
    }

    equals(value) {
        return new FakeQuery(
            this.table,
            row => row?.[this.orderKey] === value
        );
    }

    anyOf(values) {
        const allowed = new Set(values);
        return new FakeQuery(
            this.table,
            row => allowed.has(row?.[this.orderKey])
        );
    }

    reverse() {
        this.reversed = !this.reversed;
        return this;
    }

    async toArray() {
        let rows = [...this.table.rows.values()]
            .filter(this.predicate)
            .map(clone);
        if (this.orderKey) {
            rows.sort((left, right) => {
                const a = left?.[this.orderKey];
                const b = right?.[this.orderKey];
                return a < b ? -1 : a > b ? 1 : 0;
            });
        }
        if (this.reversed) rows.reverse();
        return rows;
    }

    async sortBy(key) {
        const rows = await this.toArray();
        return rows.sort((left, right) =>
            left?.[key] < right?.[key]
                ? -1
                : left?.[key] > right?.[key]
                    ? 1
                    : 0
        );
    }

    async delete() {
        for (const [id, row] of this.table.rows.entries()) {
            if (this.predicate(row)) this.table.rows.delete(id);
        }
    }
}

class FakeTable {
    constructor(name, rows = []) {
        this.name = name;
        this.rows = new Map(rows.map(row => [row.id, clone(row)]));
    }

    orderBy(key) {
        return new FakeQuery(this, () => true, key);
    }

    where(key) {
        return new FakeQuery(this, () => true, key);
    }

    async toArray() {
        return [...this.rows.values()].map(clone);
    }

    async get(id) {
        const value = this.rows.get(id);
        return value === undefined ? undefined : clone(value);
    }

    async put(value) {
        this.rows.set(value.id, clone(value));
        return value.id;
    }

    async bulkPut(values) {
        for (const value of values) await this.put(value);
    }

    async update(id, patch) {
        const current = this.rows.get(id);
        if (!current) return 0;
        this.rows.set(id, { ...current, ...clone(patch) });
        return 1;
    }

    async delete(id) {
        this.rows.delete(id);
    }

    async clear() {
        this.rows.clear();
    }
}

class FakeDatabase {
    constructor(seed = {}) {
        this.tablesByName = new Map();
        for (const [name, rows] of Object.entries(seed)) {
            this.tablesByName.set(name, new FakeTable(name, rows));
        }
        this.failAfterWork = false;
    }

    table(name) {
        if (!this.tablesByName.has(name)) {
            this.tablesByName.set(name, new FakeTable(name));
        }
        return this.tablesByName.get(name);
    }

    async transaction(_mode, ...args) {
        const work = args.at(-1);
        const snapshots = new Map(
            [...this.tablesByName.entries()].map(([name, table]) => [
                name,
                [...table.rows.values()].map(clone)
            ])
        );
        try {
            const result = await work();
            if (this.failAfterWork) {
                const error = new Error('transaction interrupted');
                error.name = 'AbortError';
                throw error;
            }
            return result;
        } catch (error) {
            this.tablesByName = new Map(
                [...snapshots.entries()].map(([name, rows]) => [
                    name,
                    new FakeTable(name, rows)
                ])
            );
            throw error;
        }
    }
}

module.exports = { FakeDatabase };
