'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const JSZip = require('../vendor/jszip/3.10.1/jszip.min.js');
const backup = require('../qisi-backup.js');

const ROOT = path.resolve(__dirname, '..');

const reserveLoopbackPort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = address && typeof address === 'object'
            ? address.port
            : 0;
        server.close(error => error ? reject(error) : resolve(port));
    });
});

const waitForServer = async (origin, child) => {
    const deadline = Date.now() + 20_000;

    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`local server exited before startup (${child.exitCode})`);
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1000)
            });
            if (response.ok) return;
        } catch (_) {
            // Readiness probes are bounded and intentionally quiet.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('local server did not become ready');
};

const stopProcess = child => {
    if (!child || child.exitCode !== null || child.killed) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
        }, 3000);
        timer.unref();
        child.once('exit', () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill();
    });
};

const createBackupDatabase = rowsByTable => ({
    name: 'QisiMathVueDB',
    tables: Object.keys(rowsByTable).map(name => ({ name })),
    table(name) {
        return {
            async toArray() {
                return rowsByTable[name];
            }
        };
    }
});

test('H2 Dexie v8 to v9 migration adds handout stores without changing old rows or indexes', {
    timeout: 60_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({
            headless: true
        });
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(`${origin}/tests/fixtures/handout-h2-db.html`);
        await page.addScriptTag({
            url: `${origin}/vendor/dexie/3.2.4/dexie.min.js`
        });
        await page.evaluate(async () => {
            const legacy = new Dexie('QisiMathVueDB');
            legacy.version(8).stores({
                questions: 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt',
                images: 'id, createdAt',
                customTemplates: 'id, name, createdAt',
                personalKnowledge: 'id, updatedAt',
                externalQuestions: 'id, batchId, sourceTeacher, importedAt, importOrder, processStatus, detectedStatus',
                importBatches: 'id, sourceTeacher, importedAt, importStatus',
                mergeBatches: 'id, createdAt, revertedAt',
                draftImportBatches: 'id, status, createdAt, updatedAt',
                draftImportFiles: 'id, batchId, role, fileType, parseStatus, createdAt',
                draftQuestions: 'id, batchId, order, questionNumber, status, duplicateStatus, selected, createdAt',
                draftImages: 'id, batchId, questionId, status, createdAt'
            });
            await legacy.open();
            await legacy.questions.put({
                id: 'legacy-question',
                grade: '高一',
                type: '单选题',
                diff: '中等',
                stem: '旧数据必须原样保留',
                createdAt: '2026-07-01T00:00:00.000Z'
            });
            await legacy.images.put({
                id: 'legacy-image',
                blob: new Blob(['legacy'], {
                    type: 'image/png'
                }),
                createdAt: '2026-07-01T00:00:00.000Z'
            });
            legacy.close();
        });
        await page.addScriptTag({
            url: `${origin}/qisi-db.js`
        });
        for (const modulePath of [
            'qisi-handout-model.js',
            'qisi-handout-question-instance.js',
            'qisi-handout-asset-repository.js',
            'qisi-handout-repository.js'
        ]) {
            await page.addScriptTag({
                url: `${origin}/${modulePath}`
            });
        }

        const evidence = await page.evaluate(async () => {
            const access = globalThis.Qisi?.Database;
            const db = access.getDatabase();
            await db.open();
            const oldTableIndexes = Object.fromEntries(
                [
                    'questions',
                    'images',
                    'customTemplates',
                    'personalKnowledge',
                    'externalQuestions',
                    'importBatches',
                    'mergeBatches',
                    'draftImportBatches',
                    'draftImportFiles',
                    'draftQuestions',
                    'draftImages'
                ].map(name => [
                    name,
                    db.table(name).schema.indexes.map(index => index.name)
                ])
            );
            let idSequence = 0;
            let timeSequence = 0;
            const repository = Qisi.HandoutRepository.createHandoutRepository({
                db,
                idFactory: prefix => `${prefix}-browser-${++idSequence}`,
                clock: () => new Date(
                    Date.UTC(2026, 6, 28, 12, 0, timeSequence++)
                ).toISOString()
            });
            const created = await repository.create({
                title: '真实 Dexie 讲义'
            });
            const inserted = await repository.insertQuestionSnapshot(
                created.id,
                {
                    question: {
                        id: 'browser-source-question',
                        updatedAt: '2026-07-28T02:00:00.000Z',
                        type: '解答题',
                        stem: '浏览器事务题干',
                        options: [],
                        answer: '答案',
                        solution: '解析',
                        images: [{
                            id: 'browser-source-image'
                        }]
                    },
                    sourceImages: [{
                        id: 'browser-source-image',
                        blob: new Blob(['browser-image'], {
                            type: 'image/png'
                        })
                    }],
                    expectedUpdatedAt: created.updatedAt
                }
            );
            const autosaved = await repository.autosave({
                ...inserted.handout,
                title: '真实 Dexie 自动保存'
            }, {
                expectedUpdatedAt: inserted.handout.updatedAt
            });
            const storedAssets = await db.handoutAssets
                .where('handoutId')
                .equals(created.id)
                .toArray();
            const storedRevisions = await repository.listRevisions(created.id);
            const repositoryEvidence = {
                title: autosaved.title,
                revision: autosaved.revision,
                blockCount: autosaved.blocks.length,
                assetCount: storedAssets.length,
                assetText: await storedAssets[0].blob.text(),
                revisionCount: storedRevisions.length
            };
            await repository.remove(created.id);
            repositoryEvidence.afterDelete = {
                handout: await repository.get(created.id),
                assets: await db.handoutAssets
                    .where('handoutId')
                    .equals(created.id)
                    .count(),
                revisions: await db.handoutRevisions
                    .where('handoutId')
                    .equals(created.id)
                    .count()
            };

            const result = {
                accessName: access.name,
                accessVersion: access.schemaVersion,
                version: db.verno,
                tableNames: db.tables.map(table => table.name).sort(),
                oldTableIndexes,
                question: await db.questions.get('legacy-question'),
                imageText: await (
                    await db.images.get('legacy-image')
                ).blob.text(),
                repositoryEvidence
            };
            await db.delete();
            return result;
        });

        assert.equal(evidence.accessName, 'QisiMathVueDB');
        assert.equal(evidence.accessVersion, 9);
        assert.equal(evidence.version, 9);
        assert.ok(evidence.tableNames.includes('handouts'));
        assert.ok(evidence.tableNames.includes('handoutAssets'));
        assert.ok(evidence.tableNames.includes('handoutRevisions'));
        assert.deepEqual(evidence.oldTableIndexes.questions, [
            'grade',
            'type',
            'diff',
            'knowledge',
            'knowledgeType',
            'systemKnowledge',
            'personalKnowledge',
            'createdAt'
        ]);
        assert.deepEqual(evidence.oldTableIndexes.draftImages, [
            'batchId',
            'questionId',
            'status',
            'createdAt'
        ]);
        assert.equal(evidence.question.stem, '旧数据必须原样保留');
        assert.equal(evidence.imageText, 'legacy');
        assert.deepEqual(evidence.repositoryEvidence, {
            title: '真实 Dexie 自动保存',
            revision: 2,
            blockCount: 1,
            assetCount: 1,
            assetText: 'browser-image',
            revisionCount: 2,
            afterDelete: {
                handout: null,
                assets: 0,
                revisions: 0
            }
        });
        assert.deepEqual(pageErrors, []);
    } catch (error) {
        error.message += `\nlocal server output:\n${serverOutput.join('')}`;
        throw error;
    } finally {
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});

test('H2 full backup includes handout records, copied Blobs, revisions, and reference checks', async () => {
    globalThis.JSZip = JSZip;

    const handout = {
        schemaVersion: 1,
        id: 'handout-backup',
        title: '备份讲义',
        status: 'draft',
        blocks: [{
            id: 'question-block',
            type: 'question',
            sourceQuestionId: 'question-1',
            snapshot: {
                snapshotVersion: 1,
                sourceQuestionId: 'question-1',
                sourceUpdatedAt: '',
                capturedAt: '2026-07-28T00:00:00.000Z',
                images: [{
                    sourceImageId: 'image-1',
                    assetId: 'handout-asset-1'
                }]
            },
            contentOverrides: {}
        }],
        settings: {},
        createdAt: '2026-07-28T00:00:00.000Z',
        updatedAt: '2026-07-28T00:00:00.000Z',
        revision: 0
    };
    const database = createBackupDatabase({
        questions: [{
            id: 'question-1',
            stem: '正式题目'
        }],
        images: [{
            id: 'image-1',
            blob: new Blob(['question-image'], {
                type: 'image/png'
            })
        }],
        handouts: [handout],
        handoutAssets: [{
            id: 'handout-asset-1',
            handoutId: handout.id,
            blob: new Blob(['handout-image'], {
                type: 'image/png'
            })
        }],
        handoutRevisions: [{
            id: 'revision-1',
            handoutId: handout.id,
            revision: 0,
            snapshot: handout,
            createdAt: '2026-07-28T00:00:00.000Z'
        }]
    });
    const created = await backup.createFullDatabaseBackupBlob(database);
    const verification = await backup.verifyFullDatabaseBackupBlob(
        created.blob
    );
    const zip = await JSZip.loadAsync(
        await created.blob.arrayBuffer()
    );

    assert.equal(verification.ok, true);
    assert.equal(verification.handoutCount, 1);
    assert.equal(verification.handoutAssetCount, 1);
    assert.equal(verification.handoutAssetBlobCount, 1);
    assert.ok(zip.file('tables/handouts.json'));
    assert.ok(zip.file('tables/handoutAssets.json'));
    assert.ok(zip.file('tables/handoutRevisions.json'));
    assert.ok(zip.file('handout-asset-blobs/handout-asset-1.png'));
    assert.deepEqual(verification.handoutReferenceReport.missing, []);

    const revisions = JSON.parse(
        await zip.file('tables/handoutRevisions.json').async('string')
    );
    revisions[0].snapshot.id = 'handout-other';
    zip.file(
        'tables/handoutRevisions.json',
        JSON.stringify(revisions)
    );
    const mismatchedRevision = await backup.verifyFullDatabaseBackupBlob(
        await zip.generateAsync({
            type: 'blob'
        })
    );
    assert.equal(mismatchedRevision.ok, false);
    assert.equal(
        mismatchedRevision.handoutReferenceReport
            .revisionOwnershipMismatches.length,
        1
    );
});

test('H2 backup fails closed for a missing handout Blob but still accepts legacy v1 archives', async () => {
    globalThis.JSZip = JSZip;

    const broken = new JSZip();
    broken.file('manifest.json', JSON.stringify({
        format: 'qisi-full-backup',
        version: 1,
        tables: {
            questions: { count: 0 },
            images: { count: 0, blobCount: 0 },
            handouts: { count: 1 },
            handoutAssets: { count: 1, blobCount: 1 },
            handoutRevisions: { count: 0 }
        }
    }));
    broken.file('tables/questions.json', '[]');
    broken.file('tables/images.json', '[]');
    broken.file('tables/handouts.json', JSON.stringify([{
        id: 'handout-broken',
        blocks: [{
            assetId: 'asset-broken'
        }]
    }]));
    broken.file('tables/handoutAssets.json', JSON.stringify([{
        id: 'asset-broken',
        handoutId: 'handout-broken',
        blobFile: 'handout-asset-blobs/asset-broken.png'
    }]));
    broken.file('tables/handoutRevisions.json', '[]');

    const brokenReport = await backup.verifyFullDatabaseBackupBlob(
        await broken.generateAsync({
            type: 'blob'
        })
    );
    assert.equal(brokenReport.ok, false);
    assert.match(brokenReport.errors.join(' '), /Blob/i);

    broken.file(
        'handout-asset-blobs/asset-broken.png',
        new Uint8Array()
    );
    const emptyBlobReport = await backup.verifyFullDatabaseBackupBlob(
        await broken.generateAsync({
            type: 'blob'
        })
    );
    assert.equal(emptyBlobReport.ok, false);
    assert.equal(emptyBlobReport.invalidBlobFiles.length, 1);

    const legacy = new JSZip();
    legacy.file('manifest.json', JSON.stringify({
        format: 'qisi-full-backup',
        version: 1,
        tables: {
            questions: { count: 1 },
            images: { count: 0, blobCount: 0 }
        }
    }));
    legacy.file('tables/questions.json', JSON.stringify([{
        id: 'legacy-question'
    }]));
    legacy.file('tables/images.json', '[]');

    const legacyReport = await backup.verifyFullDatabaseBackupBlob(
        await legacy.generateAsync({
            type: 'blob'
        })
    );
    assert.equal(legacyReport.ok, true);
    assert.equal(legacyReport.questionCount, 1);
    assert.equal(legacyReport.handoutCount, 0);
});
