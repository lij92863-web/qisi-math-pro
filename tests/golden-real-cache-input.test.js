const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const JSZip = require('../vendor/jszip/jszip.min.js');
const { loadInput, outputPath } = require('../scripts/golden/replay-real-cache.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function fixture({ zipItems, extraContentList = false, omitImage = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-real-cache-input-'));
    const source = Buffer.from('%PDF-synthetic-fixture-no-rendering');
    const items = [
        { page_idx:0, type:'text', text:'1. Fixture question A. First B. Second C. Third D. Fourth' },
        { page_idx:0, type:'image', img_path:'images/figure.png' }
    ];
    const image = Buffer.from('synthetic-image-bytes');
    const zip = new JSZip(); zip.file('fixture_content_list.json', JSON.stringify(zipItems || items));
    if (extraContentList) zip.file('other_content_list.json', '[]');
    if (!omitImage) zip.file('images/figure.png', image);
    const zipped = await zip.generateAsync({ type:'nodebuffer', compression:'DEFLATE' });
    const receipt = Buffer.from(JSON.stringify({ version:'mineru-extraction-v2', state:'ready', sourceId:sha(source), zipSha256:sha(zipped) }));
    const pin = (name, bytes) => {
        const file=path.join(directory,name); fs.writeFileSync(file,bytes); return { path:file,sha256:sha(bytes) };
    };
    const config = { schema:'qisi.real-cache-replay-input.v1', source:pin('source.pdf',source),
        receipt:pin('receipt.json',receipt), zip:pin('cache.zip',zipped), contentList:pin('content.json',Buffer.from(JSON.stringify(items))) };
    const configFile=path.join(directory,'config.json');
    const save=()=>fs.writeFileSync(configFile,JSON.stringify(config));
    save(); return { directory, config, configFile, items, image, save };
}

test('offline cache input verifies source, receipt, archive, export and assets before browser launch', async () => {
    const f=await fixture(), result=await loadInput(f.configFile);
    assert.deepEqual(result.items,f.items); assert.deepEqual(result.images['images/figure.png'].bytes,f.image);
    assert.equal(result.identity.sourceSha256,f.config.source.sha256);
    assert.equal(result.identity.assetManifest[0].sha256,sha(f.image));
});

test('changed pinned PDF, receipt, ZIP or exported JSON is rejected', async () => {
    for(const field of ['source','receipt','zip','contentList']) {
        const f=await fixture(); fs.appendFileSync(f.config[field].path,' ');
        await assert.rejects(loadInput(f.configFile),/REAL_CACHE_HASH_MISMATCH/);
    }
});

test('a validly hashed receipt for another source or non-ready task is rejected', async () => {
    for(const change of [r=>r.sourceId='0'.repeat(64),r=>r.zipSha256='0'.repeat(64),r=>r.state='running',r=>r.version='unknown']) {
        const f=await fixture(), receipt=JSON.parse(fs.readFileSync(f.config.receipt.path)); change(receipt);
        const bytes=Buffer.from(JSON.stringify(receipt)); fs.writeFileSync(f.config.receipt.path,bytes);
        f.config.receipt.sha256=sha(bytes); f.save();
        await assert.rejects(loadInput(f.configFile),/REAL_CACHE_RECEIPT_MISMATCH/);
    }
});

test('a validly hashed export from another ZIP cannot be substituted', async () => {
    const f=await fixture({ zipItems:[{page_idx:0,type:'text',text:'Different cache'}] });
    await assert.rejects(loadInput(f.configFile),/REAL_CACHE_CONTENT_MISMATCH/);
});

test('ambiguous content-list entries and missing image bytes are rejected', async () => {
    const duplicate=await fixture({extraContentList:true});
    await assert.rejects(loadInput(duplicate.configFile),/REAL_CACHE_CONTENT_ENTRY_INVALID/);
    const missing=await fixture({omitImage:true});
    await assert.rejects(loadInput(missing.configFile),/REAL_CACHE_ASSET_INVALID/);
});

test('remote paths and output reuse or escape fail before any browser or source write', async () => {
    const f=await fixture(); f.config.source.path='https://example.invalid/source.pdf'; f.save();
    await assert.rejects(loadInput(f.configFile),/REAL_CACHE_INPUT_INVALID/);
    for(const out of ['',f.directory,path.resolve(__dirname,'..'),path.resolve(__dirname,'../local-run-artifacts/golden-baseline')]) {
        assert.throws(()=>outputPath(out),/REAL_CACHE_OUTPUT_/);
    }
});
