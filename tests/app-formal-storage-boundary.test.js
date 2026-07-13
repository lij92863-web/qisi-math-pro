const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const ROOT = path.resolve(__dirname, '..');

test('app shell delegates every formal question table mutation to the repository owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    assert.doesNotMatch(
        app,
        /\bdb\.questions\.(?:put|add|bulkPut|update|delete|bulkDelete|clear)\s*\(/
    );
    assert.doesNotMatch(
        app,
        /storageRepository\.(?:put|deleteMany)\(\s*['"]questions['"]/
    );
    assert.doesNotMatch(
        app,
        /storageRepository\.(?:saveQuestion|updateQuestion|softDeleteQuestion|restoreQuestion|confirmDraftToQuestion)\s*\(/
    );
    assert.match(app, /libraryService\.saveQuestion\s*\(/);
    assert.match(app, /libraryService\.commitExternalMerge\s*\(/);
    assert.match(app, /libraryService\.undoExternalMerge\s*\(/);
});

test('repository bulk deletion is clone-safe and owns the questions table mutation', async () => {
    const database = new FakeDatabase({
        questions: [
            { id: 'q1', stem: 'one' },
            { id: 'q2', stem: 'two' }
        ]
    });
    const repository = Storage.createRepository(database);
    const ids = ['q1'];

    await repository.deleteMany('questions', ids);
    ids.push('q2');

    assert.equal(await repository.get('questions', 'q1'), undefined);
    assert.equal((await repository.get('questions', 'q2')).stem, 'two');
});
