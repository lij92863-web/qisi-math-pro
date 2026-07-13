const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('app shell has zero formal repository mutation and rollback ownership', () => {
    const app = read('app.js');
    assert.doesNotMatch(
        app,
        /storageRepository\.(?:put|deleteMany)\s*\(\s*['"]questions['"]/
    );
    assert.doesNotMatch(
        app,
        /storageRepository\.(?:saveQuestion|updateQuestion|softDeleteQuestion|restoreQuestion|confirmDraftToQuestion)\s*\(/
    );
    assert.doesNotMatch(
        app,
        /db\.transaction\s*\([^\n]{0,240}db\.questions/
    );
    assert.doesNotMatch(app, /filledQuestionSnapshots|addedQuestionIds/);
    assert.match(app, /libraryService\.commitExternalMerge\s*\(/);
    assert.match(app, /libraryService\.undoExternalMerge\s*\(/);
    assert.match(app, /libraryService\.saveQuestion\s*\(/);
    assert.match(app, /libraryService\.replaceQuestion\s*\(/);
    assert.match(app, /libraryService\.softDelete\s*\(/);
    assert.match(app, /libraryService\s*\n\s*\.migrateSafeQuestionLatexData\s*\(/);
    assert.doesNotMatch(app, /libraryService\s*\n\s*\.migrateQuestions\s*\(/);
});

test('formal submit remains Admission then Repository while LibraryService owns G commands', () => {
    const app = read('app.js');
    const formalSubmit = read('qisi-batch-formal-submit.js');
    const library = read('qisi-library-service.js');
    assert.match(app, /createBatchFormalSubmit\s*\(/);
    assert.match(formalSubmit, /policy\.evaluateDraftAdmission\s*\(/);
    assert.match(formalSubmit, /repository\.confirmDraftToQuestion\s*\(/);
    assert.match(library, /commitExternalMerge/);
    assert.match(library, /undoExternalMerge/);
    assert.doesNotMatch(library, /\bdb\.|indexedDB|FormalAdmissionPolicy/);
});
