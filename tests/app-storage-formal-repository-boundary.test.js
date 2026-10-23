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
    const external = fs.readFileSync(path.join(ROOT, 'qisi-library-external-merge.js'), 'utf8');
    assert.match(app, /LibraryExternalMerge\.createWorkspace\s*\(/);
    assert.match(app, /state: externalState, library: libraryService/);
    assert.match(app, /confirmAddExternalToPersonal = externalWorkspace\.commit/);
    assert.match(app, /undoLatestExternalMerge = externalWorkspace\.undo/);
    assert.match(external, /library\.commitExternalMerge\s*\(/);
    assert.match(external, /library\.undoExternalMerge\s*\(/);
    assert.doesNotMatch(external, /\bdb\.|indexedDB|filledQuestionSnapshots|addedQuestionIds/);
    assert.doesNotMatch(external, /repository\.(?:put|deleteMany|saveQuestion|updateQuestion|softDeleteQuestion|confirmDraftToQuestion)\s*\(/);

    const manual = fs.readFileSync(path.join(ROOT, 'qisi-manual-entry-model.js'), 'utf8');
    assert.match(app, /ManualEntryModel\.createWorkspace\s*\(/);
    assert.match(app, /state: manualState, library: libraryService, repository: storageRepository/);
    assert.match(app, /submitQuestion = manualWorkspace\.submit/);
    assert.match(manual, /library\.saveQuestion\s*\(/);
    assert.doesNotMatch(manual, /\bdb\.|indexedDB|FormalAdmissionPolicy/);
    assert.doesNotMatch(manual, /repository\.(?:put|deleteMany|update)\s*\(\s*['"]questions['"]/);
    assert.match(app, /libraryService\.replaceQuestion\s*\(/);
    assert.match(app, /libraryService\.softDelete\s*\(/);
    const library = read('qisi-library-service.js');
    assert.match(app, /LibraryService\.createQuestionMaintenance\s*\(/);
    assert.match(app, /repository: storageRepository, service: libraryService/);
    assert.match(app, /migrateSafeQuestionLatexData = questionMaintenance\.migrate/);
    assert.match(app, /window\.migrateSafeQuestionLatexData = migrateSafeQuestionLatexData/);
    assert.match(library, /service\.migrateSafeQuestionLatexData\s*\(/);
    assert.doesNotMatch(app, /questionMaintenance\.migrate\s*\(/);
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
