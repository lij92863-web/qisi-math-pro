const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    createAppFacade
} = require('../qisi-app-facade.js');

test(
    'BM04: createAppFacade creates facade with dependency access',
    () => {
        const facade =
            createAppFacade({ db: {}, parser: {} });

        assert.ok(facade.hasDependency('db'));
        assert.ok(facade.hasDependency('parser'));
        assert.ok(!facade.hasDependency('missing'));

        const db = facade.getDependency('db');
        assert.ok(db);
        assert.equal(facade.getDependency('nonexistent'), null);
    }
);

test(
    'BM04: assertDependency throws for missing',
    () => {
        const facade =
            createAppFacade({ db: {} });

        assert.doesNotThrow(() => facade.assertDependency('db'));
        assert.throws(() => facade.assertDependency('missing'));
    }
);

test(
    'BM04: getAppEnvironment reports Node environment',
    () => {
        const facade =
            createAppFacade({});

        const env = facade.getAppEnvironment();

        assert.equal(env.isNode, true);
        assert.equal(env.isBrowser, false);
    }
);

test(
    'BM04: assertAppDependencies reports missing',
    () => {
        const facade =
            createAppFacade({ a: 1, b: 2 });

        assert.equal(facade.assertAppDependencies(['a', 'b']), true);
        assert.throws(
            () => facade.assertAppDependencies(['a', 'b', 'c']),
            /c/
        );
    }
);

test(
    'BM04: facade is usable in Node test without browser',
    () => {
        const facade =
            createAppFacade({ mockDb: {} });

        assert.ok(facade);
        assert.ok(typeof facade.hasDependency === 'function');
    }
);
