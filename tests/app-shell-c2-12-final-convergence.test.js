const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    verifyAppShellArchitecture
} = require('../scripts/verify-app-shell-architecture.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('AST gate accepts the corrective app-shell responsibility matrix', () => {
    const result = verifyAppShellArchitecture();
    assert.equal(result.decision, 'APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED');
    assert.equal(result.functionCount, 9);
    assert.deepEqual(result.errors, []);
});

test('responsibility matrix owns every Program C UI command as a bounded class A wrapper', () => {
    const matrix = JSON.parse(read(
        'docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json'
    ));
    const expected = [
        'runBatchRecognition',
        'refreshBatchStats',
        'markDraftReviewed',
        'submitDraftQuestion',
        'openBatchSubmitSummary',
        'dedupeActiveBatchDraftsNow',
        'cleanupActiveBatchDisplayPollution',
        'confirmBatchSubmit',
        'deleteBatchImport'
    ];
    assert.deepEqual(matrix.functions.map(item => item.name), expected);
    for (const item of matrix.functions) {
        assert.equal(item.file, 'app.js');
        assert.equal(item.class, 'A');
        assert.equal(item.owner, 'UI Shell');
        assert.ok(item.range[1] - item.range[0] + 1 <= matrix.maxWrapperLines);
        assert.ok(item.allowedCalls.length > 0);
        assert.ok(item.forbiddenCalls.length > 0);
    }
});

test('AST gate rejects renamed semantic ownership bypasses', t => {
    const source = read('app.js').replace(
        'reviewWorkflowService.submitDraft({',
        'batchFormalSubmit.submit({'
    );
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-app-gate-'));
    const appPath = path.join(directory, 'app.js');
    fs.writeFileSync(appPath, source);
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const result = verifyAppShellArchitecture({ appPath });
    assert.equal(result.decision, 'APP_SHELL_CORRECTIVE_CLOSURE_BLOCKED');
    assert.ok(result.errors.some(message =>
        message.includes('direct formal submit') ||
        message.includes('forbidden call batchFormalSubmit.submit')
    ));
});
