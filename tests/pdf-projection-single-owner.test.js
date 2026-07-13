const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('PDF candidate projection has one production owner and one browser-loaded API', () => {
    const owner = read('qisi-pdf-candidate-projection.js');
    const main = read('main.html');
    const owners = JSON.parse(read('architecture/owners.json'));
    const manifest = JSON.parse(read('architecture/layers.json'));
    const entry = manifest.modules.find(item => item.id === 'pdf-candidate-projection');

    assert.equal(owners.pdfCandidateProjectionOwner, 'qisi-pdf-candidate-projection.js');
    assert.equal(entry.file, 'qisi-pdf-candidate-projection.js');
    assert.equal(entry.status, 'production-wired');
    assert.deepEqual(entry.publicApi, [
        'FIELDS',
        'PdfCandidateProjectionError',
        'mergeControlledWriteDecisions',
        'createPdfEngineProjectionContext',
        'projectPdfCandidate',
        'projectPdfCandidates',
        'compareCanonicalPdfCandidates'
    ]);
    assert.match(owner, /function projectPdfCandidate\s*\(/);
    assert.match(owner, /function compareCanonicalPdfCandidates\s*\(/);
    assert.match(owner, /function mergeControlledWriteDecisions\s*\(/);
    assert.match(owner, /row\.provenance\s*=\s*provenanceEntry\s*\(\{/);
    assert.match(owner, /acceptedItemMaps\s*=\s*\{/);
    assert.match(owner, /createError\('controlled-write-conflict'\)/);
    assert.ok(main.indexOf('qisi-pdf-candidate-projection.js') >
        main.indexOf('qisi-pdf-support-controlled-write.js'));
    assert.ok(main.indexOf('qisi-pdf-candidate-projection.js') < main.indexOf('app.js'));
});

test('legacy and Bridge production paths delegate projection without local builders', () => {
    const app = read('app.js');
    const bridge = read('qisi-production-import-bridge.js');
    const pdfPort = read('qisi-production-pdf-sources-port.js');
    const engine = read('qisi-batch-engine-v2.js');

    assert.match(app, /Qisi\.PdfCandidateProjection\s*\.projectPdfCandidates\s*\(/);
    assert.match(bridge, /ports\.projectPdfCandidates\s*\(/);
    assert.match(bridge, /'projectPdfCandidates'/);
    assert.doesNotMatch(app, /pdfSupportFieldWarningsByQuestion/);
    assert.doesNotMatch(app, /fieldProvenance\s*:\s*\{/);
    assert.doesNotMatch(app, /const\s+supportLevel|supportLevel\s*:\s*['"`]/);
    assert.doesNotMatch(
        app,
        /const\s+manualReviewRequired|manualReviewRequired\s*:\s*(?:true|false)/
    );
    assert.doesNotMatch(bridge, /fieldProvenance\s*[:=]/);
    assert.doesNotMatch(bridge, /supportLevel\s*[:=]/);
    assert.doesNotMatch(bridge, /manualReviewRequired\s*[:=]/);
    assert.doesNotMatch(bridge, /buildPdfSupportFieldLevelControlledWrite/);
    assert.doesNotMatch(
        bridge,
        /controlledWrite(?:Decision)?\s*(?:\|\||\?\?)/
    );
    assert.match(pdfPort, /deferPdfCandidateProjection:\s*true/);
    assert.match(
        engine,
        /helpers\.deferPdfCandidateProjection\s*!==\s*true/
    );
});

test('no second PDF projection implementation appears in production files', () => {
    const productionFiles = fs.readdirSync(ROOT)
        .filter(file => /^(?:app|qisi-.*)\.js$/.test(file))
        .filter(file => file !== 'qisi-pdf-candidate-projection.js');
    const prohibited = [
        /function\s+(?:build|create)PdfFieldProvenance/i,
        /function\s+(?:derive|build)PdfSupportLevel/i,
        /function\s+(?:derive|build)PdfManualReviewRequired/i,
        /(?:const|let|var)\s+pdf\w*Provenance\s*=/i,
        /(?:const|let|var)\s+pdf\w*SupportLevel\s*=/i,
        /(?:const|let|var)\s+pdf\w*ManualReviewRequired\s*=/i,
        /compareCanonicalPdfCandidates\s*=|function\s+compareCanonicalPdfCandidates/,
        /function\s+mergeControlledWriteDecisions\s*\(/,
        /(?:const|let|var)\s+acceptedItemMaps\s*=/,
        /controlled-write-conflict/
    ];

    for (const file of productionFiles) {
        const source = read(file);
        for (const pattern of prohibited) {
            assert.doesNotMatch(source, pattern, `${file}: ${pattern}`);
        }
    }
});
