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
    const manual = fs.readFileSync(path.join(ROOT, 'qisi-manual-entry-model.js'), 'utf8');
    assert.match(app, /ManualEntryModel\.createWorkspace\s*\(/);
    assert.match(app, /state: manualState, library: libraryService, repository: storageRepository/);
    assert.match(app, /submitQuestion = manualWorkspace\.submit/);
    assert.match(manual, /library\.saveQuestion\s*\(/);
    assert.doesNotMatch(manual, /\bdb\.|indexedDB|FormalAdmissionPolicy/);
    assert.doesNotMatch(manual, /repository\.(?:put|deleteMany|update)\s*\(\s*['"]questions['"]/);
    const external = fs.readFileSync(path.join(ROOT, 'qisi-library-external-merge.js'), 'utf8');
    assert.match(app, /LibraryExternalMerge\.createWorkspace\s*\(/);
    assert.match(app, /state: externalState, library: libraryService/);
    assert.match(app, /confirmAddExternalToPersonal = externalWorkspace\.commit/);
    assert.match(app, /undoLatestExternalMerge = externalWorkspace\.undo/);
    assert.match(external, /library\.commitExternalMerge\s*\(/);
    assert.match(external, /library\.undoExternalMerge\s*\(/);
    assert.doesNotMatch(external, /\bdb\.|indexedDB|filledQuestionSnapshots|addedQuestionIds/);
    assert.doesNotMatch(external, /repository\.(?:put|deleteMany|saveQuestion|updateQuestion|softDeleteQuestion|confirmDraftToQuestion)\s*\(/);

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
