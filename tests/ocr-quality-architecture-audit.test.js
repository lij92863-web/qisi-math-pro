const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = relativePath => JSON.parse(read(relativePath));

// Program A seal (docs/audit/OCR_QUALITY_ARCHITECTURE_AUDIT_R1.md).
const PROGRAM_A_SEAL = '1361d7e7f81d2f23819a995a0f9d1808adf19982';
const SEALED_FILES = [
    'qisi-pdf-support-controlled-write.js',
    'qisi-formal-admission-policy.js',
    'qisi-answer-only-ai-pass.js',
    'app.js'
];

// A file-level allow-list is not enough: it would keep waving through every later edit. The
// register pins the exact reviewed content, so any change to a sealed file is red until the owner
// reviews it and updates architecture/post-seal-approved-blobs.json.
const APPROVAL_REGISTER_PATH = 'architecture/post-seal-approved-blobs.json';
const gitBlobOf = (revision, file) => {
    try {
        return execFileSync('git', ['rev-parse', `${revision}:${file}`], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (_) {
        // The file does not exist in that revision (qisi-answer-only-ai-pass.js never was tracked).
        return '';
    }
};
// Line endings are normalised so the hash means "this content", not "this checkout's autocrlf".
const contentSha256 = file => {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) return '';
    const normalised = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
    return crypto.createHash('sha256').update(normalised).digest('hex');
};

test('architecture audit reports every required invariant and honest limitation', () => {
    const report = read('docs/audit/OCR_QUALITY_ARCHITECTURE_AUDIT_R1.md');
    for (const topic of [
        'adapter pluggability', 'engine-specific domain isolation', 'shadow no-write',
        'unique promotion owner', 'controlled-write unchanged',
        'FormalAdmission unchanged', 'Route B frozen',
        'app local-model isolation', 'config traceability'
    ]) {
        assert.match(report, new RegExp(topic, 'i'), topic);
    }
    assert.match(report, /OCR_QUALITY_ARCHITECTURE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS/);
    assert.match(report, /production-promoted engines[^\n]*0/i);
});

test('OCR architecture owners are unique, acyclic, and never depend on UI/storage/formal write', () => {
    const layers = json('architecture/layers.json').modules;
    const owners = json('architecture/owners.json');
    const ocr = layers.filter(item => /ocr/.test(item.id));
    assert.ok(ocr.length >= 9);
    assert.equal(new Set(ocr.map(item => item.domainOwner)).size, ocr.length);
    for (const item of ocr) {
        assert.equal(owners[item.domainOwner], item.file);
        if (!['app-shell'].includes(item.id)) {
            assert.equal(item.allowedDependencies.includes('app-shell'), false, item.id);
            assert.equal(item.allowedDependencies.includes('storage-repository'), false, item.id);
            assert.equal(item.allowedDependencies.includes('formal-admission'), false, item.id);
        }
    }
});

test('adapter registry enforces the five-method pluggable contract', () => {
    const registry = read('qisi-ocr-engine-registry.js');
    for (const method of [
        'healthCheck', 'getCapabilities', 'recognizePage', 'recognizeDocument', 'cancel'
    ]) {
        assert.match(registry, new RegExp(`['"]${method}['"]`), method);
    }
    for (const adapter of ['qisi-ocr-qwen-adapter.js', 'qisi-ocr-local-adapter.js']) {
        const source = read(adapter);
        assert.doesNotMatch(source, /answerOwnership|saveQuestion|FormalAdmission|db\.questions/);
    }
});

test('Program A controlled-write, FormalAdmission, Route B, and app stay unchanged from seal', () => {
    const register = json(APPROVAL_REGISTER_PATH);
    assert.equal(register.programASeal, PROGRAM_A_SEAL, 'the register must name the Program A seal');
    const approved = register.approvedFiles || {};

    for (const file of Object.keys(approved)) {
        assert.ok(SEALED_FILES.includes(file), `${file} is approved but is not a sealed file`);
    }

    for (const file of SEALED_FILES) {
        const entry = approved[file];
        if (!entry) {
            assert.equal(
                gitBlobOf('HEAD', file),
                gitBlobOf(PROGRAM_A_SEAL, file),
                `${file} changed without an entry in ${APPROVAL_REGISTER_PATH}`
            );
            continue;
        }

        assert.ok(
            /^[0-9a-f]{40}$/.test(entry.gitBlob || ''),
            `${file} needs a 40 character git blob hash`
        );
        assert.ok(
            /^[0-9a-f]{64}$/.test(entry.contentSha256 || ''),
            `${file} needs a sha256 content hash`
        );
        assert.ok(entry.reason && entry.authorisedAt, `${file} needs a reason and an authorisation date`);
        assert.ok(entry.ledger && fs.existsSync(path.join(root, entry.ledger)), `${file} needs a ledger document`);
        assert.match(read(entry.ledger), new RegExp(file.replace(/[.]/g, '\\.')), entry.ledger);

        assert.equal(
            gitBlobOf('HEAD', file),
            entry.gitBlob,
            `${file} differs from the approved blob; review the change and update ${APPROVAL_REGISTER_PATH}`
        );
        assert.equal(
            contentSha256(file),
            entry.contentSha256,
            `${file} differs from the approved content; review the change and update ${APPROVAL_REGISTER_PATH}`
        );
    }
});

test('production and benchmark OCR configuration are traceable without false promotion', () => {
    const trace = json('architecture/ocr-engine-config-r1.json');
    assert.equal(trace.productionCurrent.productionPromotedByProgramB, false);
    assert.equal(trace.productionCurrent.versionStatus, 'legacy-unpinned');
    assert.equal(trace.benchmark.runner, 'scripts/benchmark/run-ocr-benchmark.js');
    assert.deepEqual(trace.promotionRegistry, []);
    assert.equal(trace.canary.enabled, false);
    assert.equal(trace.realOcrCalls, 0);
    assert.equal(trace.modelDownloads, 0);
});

test('app has no specific local model implementation and shadow/selection have no write authority', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /PaddleOCR|PaddleOCR-VL|olmOCR|Unlimited-OCR|local-ocr\/server/i);
    for (const file of ['qisi-ocr-shadow-mode.js', 'qisi-ocr-candidate-selection-policy.js']) {
        const source = read(file);
        assert.doesNotMatch(source, /eligibleForControlledWrite:\s*true/);
        assert.doesNotMatch(source, /eligibleForFormalAdmission:\s*true/);
        assert.doesNotMatch(source, /saveQuestion|confirmDraftToQuestion|db\.questions/);
    }
});
