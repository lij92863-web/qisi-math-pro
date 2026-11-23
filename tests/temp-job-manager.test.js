const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createTempJobManager } = require('../qisi-temp-job-manager.js');

const fixture = async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'qisi-temp-jobs-'));
    const uploads = path.join(root, 'uploads');
    const converted = path.join(root, 'converted');
    await Promise.all([
        fsp.mkdir(uploads, { recursive: true }),
        fsp.mkdir(converted, { recursive: true })
    ]);
    return { root, uploads, converted };
};

test('successful job deletes upload and converted output directory', async t => {
    const dirs = await fixture();
    t.after(() => fsp.rm(dirs.root, { recursive: true, force: true }));
    const uploadPath = path.join(dirs.uploads, 'success.docx');
    const outputDir = path.join(dirs.converted, 'job-success');
    await fsp.writeFile(uploadPath, 'private upload');
    await fsp.mkdir(outputDir);
    await fsp.writeFile(path.join(outputDir, 'result.pdf'), 'private result');

    const manager = createTempJobManager({ roots: [dirs.uploads, dirs.converted] });
    const value = await manager.withCleanup({ uploadPath, outputDir }, async () => 'ok');

    assert.equal(value, 'ok');
    assert.equal(fs.existsSync(uploadPath), false);
    assert.equal(fs.existsSync(outputDir), false);
});

test('failed job still deletes upload and converted output directory', async t => {
    const dirs = await fixture();
    t.after(() => fsp.rm(dirs.root, { recursive: true, force: true }));
    const uploadPath = path.join(dirs.uploads, 'failure.docx');
    const outputDir = path.join(dirs.converted, 'job-failure');
    await fsp.writeFile(uploadPath, 'private upload');
    await fsp.mkdir(outputDir);

    const manager = createTempJobManager({ roots: [dirs.uploads, dirs.converted] });
    await assert.rejects(
        manager.withCleanup({ uploadPath, outputDir }, async () => {
            throw new Error('conversion failed');
        }),
        /conversion failed/
    );

    assert.equal(fs.existsSync(uploadPath), false);
    assert.equal(fs.existsSync(outputDir), false);
});

test('startup cleanup removes expired jobs but preserves fresh jobs', async t => {
    const dirs = await fixture();
    t.after(() => fsp.rm(dirs.root, { recursive: true, force: true }));
    const expired = path.join(dirs.converted, 'expired-job');
    const fresh = path.join(dirs.converted, 'fresh-job');
    await Promise.all([fsp.mkdir(expired), fsp.mkdir(fresh)]);
    const now = Date.now();
    await fsp.utimes(expired, new Date(now - 7200000), new Date(now - 7200000));

    const manager = createTempJobManager({
        roots: [dirs.uploads, dirs.converted],
        maxAgeMs: 3600000,
        now: () => now
    });
    const result = await manager.cleanupExpired();

    assert.equal(result.removed, 1);
    assert.equal(fs.existsSync(expired), false);
    assert.equal(fs.existsSync(fresh), true);
});

test('capacity cleanup evicts the oldest idle job and manual cleanup keeps active paths across both roots', async t => {
    const dirs = await fixture();
    t.after(() => fsp.rm(dirs.root, { recursive: true, force: true }));
    const oldest = path.join(dirs.uploads, 'oldest.pdf');
    const newest = path.join(dirs.converted, 'newest');
    const active = path.join(dirs.uploads, 'active.pdf');
    await fsp.mkdir(newest);
    await Promise.all([fsp.writeFile(oldest, Buffer.alloc(9)), fsp.writeFile(active, Buffer.alloc(8)),
        fsp.writeFile(path.join(newest, 'result.pdf'), Buffer.alloc(9))]);
    const now = Date.now();
    await fsp.utimes(oldest, new Date(now - 120000), new Date(now - 120000));
    await fsp.utimes(active, new Date(now - 7200000), new Date(now - 7200000));
    const manager = createTempJobManager({ roots: [dirs.uploads, dirs.converted], maxBytes: 20, maxAgeMs: 3600000, now: () => now });
    const untrack = manager.track({ uploadPath: active });
    assert.deepEqual(await manager.cleanupExpired(), { removed: 1, freedBytes: 9, remainingBytes: 17, maxBytes: 20, failed: 0 });
    assert.equal(fs.existsSync(oldest), false);
    assert.equal(fs.existsSync(newest), true);
    assert.deepEqual(await manager.cleanupInactive(), { removed: 1, freedBytes: 9, remainingBytes: 8, maxBytes: 20, failed: 0 });
    assert.equal(fs.existsSync(active), true);
    untrack();
    assert.equal((await manager.cleanupInactive()).removed, 1);
});

test('cleanup failure logs only a stable error code', async () => {
    const secret = 'C:\\private\\teacher-answer.docx';
    const logs = [];
    const manager = createTempJobManager({
        roots: ['C:\\private'],
        fsPromises: {
            rm: async () => {
                const error = new Error(`cannot delete ${secret}`);
                error.code = 'EACCES';
                throw error;
            }
        },
        logger: (event, payload) => logs.push({ event, payload })
    });

    await manager.cleanupRequest({ uploadPath: secret });
    assert.deepEqual(logs, [{
        event: '[TEMP_CLEANUP_ERROR]',
        payload: { code: 'EACCES' }
    }]);
    assert.equal(JSON.stringify(logs).includes(secret), false);
});

test('production server registers job output before conversion and cleans before listening', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'qisi-local-server.js'),
        'utf8'
    );
    assert.match(source, /job\.outputDir\s*=\s*outDir/);
    assert.match(source, /finally\s*\{\s*await tempJobManager\.cleanupRequest\(cleanupJob\)/s);
    assert.ok(
        source.indexOf('await tempJobManager.cleanupExpired()') < source.indexOf('app.listen(PORT'),
        'expired jobs are cleaned before the server listens'
    );
    assert.doesNotMatch(source, /unlink\(uploaded\.path\)\.catch\(\(\) => \{\}\)/);
});
