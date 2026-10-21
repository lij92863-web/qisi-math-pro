'use strict';

const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const C = require('../../qisi-mineru-client').internals;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };

// Explicit cached material only. Never reads a provider URL or sends an OCR job.
async function loadInput(configFile) {
    const configBytes = fs.readFileSync(configFile), config = JSON.parse(configBytes);
    if (config.schema !== 'qisi.real-cache-replay-input.v1') fail('REAL_CACHE_CONFIG_INVALID');
    const readPinned = (entry, extension) => {
        if (!entry || typeof entry.path !== 'string' || !path.isAbsolute(entry.path) ||
            !entry.path.toLowerCase().endsWith(extension) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) fail('REAL_CACHE_INPUT_INVALID');
        const bytes = fs.readFileSync(entry.path);
        if (sha(bytes) !== entry.sha256) fail('REAL_CACHE_HASH_MISMATCH');
        return bytes;
    };
    const source = readPinned(config.source, '.pdf'), receiptBytes = readPinned(config.receipt, '.json');
    const zip = readPinned(config.zip, '.zip'), contentBytes = readPinned(config.contentList, '.json');
    if (!source.subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('REAL_CACHE_PDF_INVALID');
    const receipt = JSON.parse(receiptBytes);
    if (receipt.version !== 'mineru-extraction-v2' || receipt.state !== 'ready' ||
        receipt.sourceId !== config.source.sha256 || receipt.zipSha256 !== config.zip.sha256) fail('REAL_CACHE_RECEIPT_MISMATCH');
    const entries = C.readZipDirectory(zip), lists = [...entries].filter(([name]) => /_content_list\.json$/.test(name));
    if (lists.length !== 1) fail('REAL_CACHE_CONTENT_ENTRY_INVALID');
    const items = JSON.parse(Buffer.from(await C.readZipEntry(zip, lists[0][1])).toString('utf8'));
    if (!Array.isArray(items) || !require('node:util').isDeepStrictEqual(items, JSON.parse(contentBytes))) fail('REAL_CACHE_CONTENT_MISMATCH');
    const parsed = C.parseContentList(items, { sourceId: config.source.sha256 }), images = {}, assetManifest = [];
    for (const block of parsed.pages.flatMap(page => page.blocks)) {
        if (!block.image || images[block.image]) continue;
        const candidates = [...entries].filter(([name]) => name === block.image || name.endsWith('/' + block.image));
        if (candidates.length !== 1 || !/\.(?:png|jpg|jpeg|webp)$/i.test(block.image)) fail('REAL_CACHE_ASSET_INVALID');
        const bytes = Buffer.from(await C.readZipEntry(zip, candidates[0][1]));
        if (!bytes.length) fail('REAL_CACHE_ASSET_INVALID');
        const type = /\.png$/i.test(block.image) ? 'image/png' : /\.webp$/i.test(block.image) ? 'image/webp' : 'image/jpeg';
        images[block.image] = { type, bytes };
        assetManifest.push({ name: block.image, bytes: bytes.length, sha256: sha(bytes) });
    }
    return { sourceFile: config.source.path, items, images, identity: {
        configSha256: sha(configBytes), sourceSha256: config.source.sha256,
        receiptSha256: config.receipt.sha256, zipSha256: config.zip.sha256,
        contentListSha256: config.contentList.sha256, contentEntry: lists[0][0], assetManifest
    } };
}

function outputPath(out) {
    if (typeof out !== 'string' || !out.trim()) fail('REAL_CACHE_OUTPUT_REQUIRED');
    const target = path.resolve(out), allowed = path.join(ROOT, 'local-run-artifacts/golden-baseline') + path.sep;
    if (!target.startsWith(allowed) || fs.existsSync(target)) fail('REAL_CACHE_OUTPUT_INVALID');
    return target;
}

const projection = draft => ({
    questionNumber: draft.questionNumber, type: draft.type, stem: draft.stem, options: draft.options,
    answer: draft.answer, solution: draft.solution, images: draft.images, status: draft.status,
    manualConfirmed: draft.manualConfirmed, fieldProvenance: draft.fieldProvenance,
    warnings: draft.warnings, sourceTrace: draft.sourceTrace, pdfReview: draft.pdfReview
});
const ordered = rows => [...rows].sort((a,b) => Number(a.questionNumber) - Number(b.questionNumber));
const imageBytes = url => {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(url || '');
    if (!match) fail('REAL_CACHE_RENDERED_IMAGE_INVALID');
    return { bytes: Buffer.from(match[2], 'base64'), extension: match[1] === 'jpeg' ? 'jpg' : match[1] };
};

async function run({ configFile, out, port = 32731 }) {
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) fail('REAL_CACHE_PORT_INVALID');
    const target = outputPath(out), input = await loadInput(configFile);
    // The shared harness may fetch this one worker if uncached. Require its
    // pinned local bytes before launching any browser or server.
    const workerUrl = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const worker = path.join(ROOT, 'local-run-artifacts/r2-e2e-cdn-cache', sha(workerUrl) + '.bin');
    if (!fs.existsSync(worker) || sha(fs.readFileSync(worker)) !== 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b') fail('REAL_CACHE_OFFLINE_WORKER_REQUIRED');
    fs.mkdirSync(target);
    const report = { schema: 'qisi.real-cache-ui-report.v1', mode: 'offline',
        source: input.identity, humanReviewRecorded: false, wrongAttachmentCount: null,
        productionDataWritten: false, limits: 'Actual local PDF and rendering, with cached extraction HTTP replay. This checks software behavior and persisted evidence, not OCR or mathematical accuracy.',
        runtime: fs.readdirSync(ROOT).filter(name => /^(?:app|qisi-[\w-]+)\.js$/.test(name) || name === 'main.html')
            .sort().map(file => ({ file, sha256: sha(fs.readFileSync(path.join(ROOT,file))) })),
        runnerSha256: sha(fs.readFileSync(__filename)), ok: false };
    let h;
    try {
        const H = require('../../tests/e2e/browser-harness'), started = performance.now();
        h = await H.startBrowserApp(port);
        const { installMineruReplay } = require('../../tests/harness/mineru-replay');
        const replay = await installMineruReplay(h.page, [{ file: input.sourceFile, items: input.items, images: input.images }]);
        const imported = await H.createImportThroughUi(h.page, {
            files: [{ file: input.sourceFile, roles: ['full'] }], awaitCompletion: false
        });
        const snapshot = await H.waitForDbSnapshot(h.page, value => value.batches.some(batch =>
            batch.id === imported.batchId && ['review','failed'].includes(batch.status)), { timeout: 180000, interval: 500 });
        const batch = snapshot.batches.find(row => row.id === imported.batchId);
        assert.equal(batch.status, 'review', 'Actual PDF import must reach review.');
        assert.equal(snapshot.questions.length, 0);
        const drafts = ordered(snapshot.drafts.filter(row => row.batchId === imported.batchId));
        assert.ok(drafts.length > 0);
        for (const draft of drafts) {
            assert.equal(draft.producer.routeId, 'pdf-mineru-v1');
            assert.equal(draft.manualConfirmed, false);
            assert.ok(!['reviewed','submitted'].includes(draft.status));
            for (const field of ['stem','answer','solution']) if (draft[field]) assert.equal(draft.fieldProvenance[field].status, 'rejected');
        }
        await h.page.reload();
        const restored = await H.getDbSnapshot(h.page), readback = ordered(restored.drafts.filter(row => row.batchId === imported.batchId));
        assert.deepEqual(readback.map(projection), drafts.map(projection));
        assert.deepEqual(restored.images, snapshot.images);
        assert.equal(restored.questions.length, 0);
        const file = restored.files.find(file => file.batchId === imported.batchId);
        assert.deepEqual(file.pdfMineruEvidence, snapshot.files.find(row=>row.id === file.id).pdfMineruEvidence);
        const evidence = file.pdfMineruEvidence.tasks[0];
        assert.equal(evidence.sha256, input.identity.sourceSha256);
        assert.deepEqual(evidence.rawEvidence.items, input.items);
        const uniquePages = new Map(), uniqueFigures = new Map();
        for (const draft of readback) {
            for (const page of draft.pdfReview.sourcePageImages) {
                const key = page.sourceFileId + ':' + page.sourcePage;
                if (uniquePages.has(key)) assert.equal(uniquePages.get(key).url, page.url);
                else uniquePages.set(key, page);
            }
            for (const image of draft.images) {
                assert.equal(image.sourceSha256, input.identity.sourceSha256);
                assert.ok(input.images[image.assetPath], 'Figure must resolve to this verified ZIP.');
                assert.equal(sha(imageBytes(image.url).bytes), sha(input.images[image.assetPath].bytes));
                const field = image.position.startsWith('option:') ? draft.options.join('\n') : draft[image.position];
                assert.ok(String(field).includes('[[IMAGE:' + image.id + ']]'), 'Figure token must remain in its declared field.');
                uniqueFigures.set(image.id, image);
            }
        }
        const decoded = await h.page.evaluate(async urls => {
            const rows = [];
            for (const url of urls) {
                const image = new Image(); image.src = url; await image.decode();
                rows.push({ width: image.naturalWidth, height: image.naturalHeight });
            }
            return rows;
        }, [...uniquePages.values(), ...uniqueFigures.values()].map(row => row.url));
        assert.ok(decoded.every(row => row.width > 1 && row.height > 1), 'Real rendering must not be a surrogate pixel.');
        assert.ok(decoded.slice(0, uniquePages.size).every(row=>row.width>=600 && row.height>=600));
        fs.mkdirSync(path.join(target, 'rendered-pages'));
        fs.mkdirSync(path.join(target, 'figures'));
        report.renderedPages = [...uniquePages.values()].map((page,index) => {
            const { bytes, extension } = imageBytes(page.url);
            const filename = 'rendered-pages/page-' + String(page.sourcePage).padStart(2,'0') + '.' + extension;
            fs.writeFileSync(path.join(target, filename), bytes, { flag: 'wx' });
            return { page: page.sourcePage, file: filename, bytes: bytes.length, sha256: sha(bytes), ...decoded[index] };
        });
        report.drafts = readback.map(draft => ({
            number: draft.questionNumber, type: draft.type, stem: draft.stem, options: draft.options,
            answer: draft.answer, solution: draft.solution, status: draft.status, manualConfirmed: draft.manualConfirmed,
            warnings: draft.warnings, taskProblems: draft.pdfReview.taskProblems,
            fieldProvenance: draft.fieldProvenance, sourcePages: draft.pdfReview.sourcePageImages.map(page=>page.sourcePage),
            images: draft.images.map(image => ({ ...image, url: undefined, sha256: sha(imageBytes(image.url).bytes) }))
        }));
        report.selectedPhysicalPages = evidence.selectedPages;
        report.figures = [...uniqueFigures.values()].map((image,index)=>{
            const { bytes, extension }=imageBytes(image.url), filename='figures/figure-'+String(index+1).padStart(2,'0')+'.'+extension;
            fs.writeFileSync(path.join(target,filename),bytes,{flag:'wx'});
            return { file:filename, number:readback.find(draft=>draft.id===image.questionId).questionNumber,
                field:image.position, assetPath:image.assetPath, sourcePage:image.sourcePage,
                sha256:sha(bytes), ...decoded[uniquePages.size+index] };
        });
        report.counts = { questions: readback.length, candidateAnswers: readback.filter(row=>row.answer).length,
            retainedSolutions: readback.filter(row=>row.solution).length, persistedSourcePages: uniquePages.size,
            figures: uniqueFigures.size, formalQuestions: restored.questions.length };
        await H.callProxy(h.page, 'openBatchReview', imported.batchId);
        for (const no of ['5','9','16','19'].filter(no => readback.some(draft=>draft.questionNumber === no))) {
            const draft = readback.find(draft=>draft.questionNumber === no);
            await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
            await h.page.locator('[data-testid="pdf-model-review"]').waitFor({ state: 'visible' });
            const panel = await h.page.locator('[data-testid="pdf-model-review"]').innerText();
            assert.match(panel, /待人工核对/);
            if (draft.pdfReview.taskProblems.some(problem=>problem.includes('表格内容未读取'))) {
                assert.match(await h.page.locator('body').innerText(), /表格内容未读取/);
            }
            await h.page.locator('[data-testid="pdf-model-review"] h2').scrollIntoViewIfNeeded();
            await h.page.screenshot({ path: path.join(target, 'review-' + no + '.png'), fullPage: false });
        }
        H.assertNoRuntimeErrors(h);
        assert.equal(replay.calls.filter(call=>call.endsWith('/parse')).length, 1);
        report.replayCalls = replay.calls; report.unexpectedTransportRequests = h.forbiddenRequests;
        report.reload = 'all-measured-fields-and-images-identical';
        report.allAwaitHumanReview = true; report.durationMs = performance.now() - started;
        report.ok = true;
    } catch (error) {
        report.failure = { message: String(error.message || error) };
        if (h) { report.pageErrors = h.pageErrors; report.consoleErrors = h.consoleErrors;
            report.unexpectedTransportRequests = h.forbiddenRequests;
            await h.page.screenshot({ path: path.join(target,'failure.png'), fullPage: false }).catch(()=>{}); }
    } finally {
        if (h) await h.close();
        fs.writeFileSync(path.join(target,'report.json'), JSON.stringify(report,null,2)+'\n', { flag:'wx' });
    }
    process.stdout.write(JSON.stringify({ ok:report.ok, counts:report.counts, failure:report.failure, report:path.join(target,'report.json') })+'\n');
    return report;
}

if (require.main === module) {
    const options = {}, args = process.argv.slice(2);
    for (let i=0; i<args.length; i+=2) {
        const key = { '--config':'configFile', '--out':'out', '--port':'port' }[args[i]];
        if (!key || !args[i+1] || options[key] !== undefined) throw new Error('Only --config, --out and --port are supported.');
        options[key] = key === 'port' ? Number(args[i+1]) : path.resolve(args[i+1]);
    }
    run(options).then(report=>{process.exitCode=report.ok?0:1;}).catch(error=>{
        process.stderr.write(String(error.message)+'\n');process.exitCode=1;
    });
}
module.exports = { loadInput, outputPath, run };
