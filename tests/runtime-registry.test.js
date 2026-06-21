const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    Runtime
} = require('../qisi-runtime.js');

test(
    'BM05: setRuntimeDependency and getRuntimeDependency work',
    () => {
        Runtime.setRuntimeDependency('testDb', { name: 'TestDB' });
        const db = Runtime.getRuntimeDependency('testDb');
        assert.ok(db);
        assert.equal(db.name, 'TestDB');
    }
);

test(
    'BM05: getRuntimeDependency returns null for missing',
    () => {
        const missing = Runtime.getRuntimeDependency('nonexistent_xyz');
        assert.equal(missing, null);
    }
);

test(
    'BM05: setRuntimeDependency throws for duplicate',
    () => {
        Runtime.setRuntimeDependency('dupKey', 1);
        assert.throws(() => Runtime.setRuntimeDependency('dupKey', 2));
    }
);

test(
    'BM05: assertQisiModules checks module presence',
    () => {
        assert.doesNotThrow(() =>
            Runtime.assertQisiModules(['Runtime'])
        );
    }
);
