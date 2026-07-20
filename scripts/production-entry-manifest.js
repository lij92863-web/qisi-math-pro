'use strict';

// This manifest is the single source of truth for local production scripts.
// Keep browserScriptOrder aligned with the normalized local `src` values in
// main.html. Root qisi-*.js files must belong to exactly one category.
const browserScriptOrder = Object.freeze([
    'vendor/tailwindcss/3.4.17/tailwind.browser.min.js',
    'vendor/katex/0.16.8/katex.min.js',
    'vendor/katex/0.16.8/contrib/auto-render.min.js',
    'vendor/vue/3.5.40/vue.global.prod.js',
    'vendor/vue-virtual-scroller/2.0.0-beta.8/vue-virtual-scroller.min.js',
    'vendor/dexie/3.2.4/dexie.min.js',
    'vendor/jszip/3.10.1/jszip.min.js',
    'vendor/pdfjs-dist/3.11.174/pdf.min.js',
    'vendor/lucide/0.378.0/lucide.min.js',
    'qisi-a4-exam-template.js',
    'qisi-config.js',
    'qisi-exam-grouping.js',
    'qisi-library-view-state.js',
    'qisi-entry-view-state.js',
    'qisi-knowledge-tree-state.js',
    'qisi-exam-print-renderer.js',
    'qisi-runtime.js',
    'qisi-utils.js',
    'qisi-db.js',
    'qisi-backup.js',
    'qisi-docx-layout.js',
    'qisi-components.js',
    'qisi-file-dispatcher.js',
    'qisi-docx-ole-reader.js',
    'qisi-docx-mtef-reader.js',
    'qisi-docx-latex-content.js',
    'qisi-docx-table-latex.js',
    'qisi-docx-question-structure.js',
    'qisi-docx-rich-content.js',
    'qisi-docx-support-content.js',
    'qisi-batch-importer.js',
    'qisi-support-parser.js',
    'qisi-support-repair.js',
    'qisi-pdf-content-integrity.js',
    'qisi-pdf-support-aligner.js',
    'qisi-pdf-support-block-parser.js',
    'qisi-pdf-support-controlled-write.js',
    'qisi-pdf-safe-partial-pipeline.js',
    'qisi-docx-pipeline.js',
    'qisi-ui-events.js',
    'qisi-review-draft-state.js',
    'qisi-batch-final-gate.js',
    'app.js'
]);

const categoryFiles = Object.freeze({
    'browser-live': Object.freeze(
        browserScriptOrder.filter(file => /^qisi-[a-z0-9-]+\.js$/.test(file))
    ),
    'node-entry': Object.freeze([
        'qisi-local-server.js'
    ]),
    'node-dependency': Object.freeze([
        'qisi-serial-task-queue.js'
    ]),
    'node-safety': Object.freeze([
        'qisi-pdf-answer-extraction-quality.js'
    ]),
    'frozen-research': Object.freeze([
        'qisi-batch-engine-v2.js',
        'qisi-pdf-answer-only-extraction.js'
    ]),
    'dead-scaffold': Object.freeze([]),
    'expected-absent': Object.freeze([
        'qisi-app-facade.js',
        'qisi-batch-orchestrator.js',
        'qisi-review-view-model.js',
        'qisi-storage-facade.js',
        'qisi-ui-renderer.js'
    ])
});

const categoryPolicy = Object.freeze({
    'browser-live': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-entry': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-dependency': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-safety': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'frozen-research': Object.freeze({ mustExist: true, production: false, syntaxCheck: false }),
    'dead-scaffold': Object.freeze({ mustExist: false, production: false, syntaxCheck: false }),
    'expected-absent': Object.freeze({ mustExist: false, production: false, syntaxCheck: false })
});

const classificationEvidence = Object.freeze({
    'qisi-local-server.js': 'package.json main/start entry',
    'qisi-serial-task-queue.js': 'required by qisi-local-server.js',
    'qisi-pdf-answer-extraction-quality.js': 'Node safety dependency of qisi-pdf-support-controlled-write.js',
    'qisi-batch-engine-v2.js': 'feature-flag research path referenced by app.js but not loaded by main.html',
    'qisi-pdf-answer-only-extraction.js': 'fail-closed research shadow used by the PDF master runner, not main.html',
    'qisi-app-facade.js': 'migration scaffold referenced only by tests/tools',
    'qisi-batch-orchestrator.js': 'migration scaffold referenced only by tests/tools',
    'qisi-review-view-model.js': 'migration scaffold referenced only by tests/tools',
    'qisi-storage-facade.js': 'migration scaffold referenced only by tests/tools',
    'qisi-ui-renderer.js': 'migration scaffold referenced only by tests/tools'
});

const productionSyntaxCheckFiles = Object.freeze([
    ...browserScriptOrder,
    ...Object.entries(categoryFiles)
        .filter(([category]) => categoryPolicy[category].syntaxCheck)
        .flatMap(([, files]) => files)
].filter((file, index, files) => files.indexOf(file) === index));

const categoryFor = file => {
    const matches = Object.entries(categoryFiles)
        .filter(([, files]) => files.includes(file))
        .map(([category]) => category);
    return matches.length === 1 ? matches[0] : null;
};

module.exports = Object.freeze({
    browserScriptOrder,
    categoryFiles,
    categoryPolicy,
    classificationEvidence,
    productionSyntaxCheckFiles,
    categoryFor
});
