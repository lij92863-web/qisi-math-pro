const test = require('node:test'), assert = require('node:assert/strict');
globalThis.JSZip = require('../vendor/jszip/jszip.min');
require('../qisi-archive-security');
const Backup = require('../qisi-backup');

async function fixture({ writeFault, databaseFault, downloadFault, invalidRows } = {}, work) {
    const original = Object.fromEntries(['document', 'localStorage', 'setTimeout'].map(key => [key, { owned: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
    const warn = console.warn, warnings = [], writes = [], anchors = [];
    const failure = Object.freeze(Object.assign(new Error('synthetic original failure'), { name: 'QuotaExceededError' }));
    const database = {
        tables: Backup.TABLE_NAMES.map(name => ({ name })),
        transaction: async (_mode, _tables, operation) => operation(),
        table: name => ({ toArray: async () => {
            if (databaseFault && name === 'questions') throw failure;
            return name === 'questions' ? (invalidRows ? [{ id: 'q1' }, { id: 'q1' }] : [{ id: 'q1', stem: 'synthetic question' }]) : [];
        } })
    };
    globalThis.document = { body: { appendChild() {} }, createElement() {
        const anchor = { click() { if (downloadFault) throw failure; }, remove() {} };
        anchors.push(anchor); return anchor;
    } };
    globalThis.localStorage = { getItem: () => null, setItem(key, value) {
        writes.push({ key, value }); if (key === writeFault) throw failure;
    } };
    globalThis.setTimeout = operation => { operation(); return 0; };
    console.warn = (...args) => warnings.push(args);
    try { await work({ database, failure, warnings, writes, anchors }); }
    finally {
        console.warn = warn;
        for (const [key, value] of Object.entries(original)) {
            if (value.owned) globalThis[key] = value.value; else delete globalThis[key];
        }
    }
}

for (const key of ['qisi_last_verified_full_backup_at', 'qisi_last_full_backup_report']) {
    test(key + ': browser download does not write verified save status', async () => {
        await fixture({ writeFault: key }, async ({ database, writes, warnings, anchors }) => {
            const manifest = await Backup.exportFullDatabaseBackup(database);
            assert.equal(manifest.verification.ok, true);
            assert.equal(anchors.length, 1);
            assert.equal(anchors[0].download, manifest.filename);
            assert.deepEqual(writes, []);
            assert.deepEqual(warnings, []);
        });
    });
}

for (const condition of ['databaseFault', 'downloadFault']) {
    test(condition + ': the original failure still rejects and cannot write successful backup status', async () => {
        await fixture({ [condition]: true }, async ({ database, failure, warnings, writes }) => {
            await assert.rejects(Backup.exportFullDatabaseBackup(database), error => error === failure);
            assert.deepEqual(writes, []);
            assert.deepEqual(warnings, []);
        });
    });
}

test('an archive validation failure still stops before the download or bookkeeping', async () => {
    await fixture({ invalidRows: true }, async ({ database, anchors, writes, warnings }) => {
        await assert.rejects(Backup.exportFullDatabaseBackup(database), /Full backup verification failed/);
        assert.deepEqual(anchors, []);
        assert.deepEqual(writes, []);
        assert.deepEqual(warnings, []);
    });
});
