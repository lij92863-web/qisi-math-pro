'use strict';

// This manifest is the single source of truth for local production scripts.
// Keep browserScriptOrder aligned with the normalized local `src` values in
// main.html. Root qisi-*.js files must belong to exactly one category.
const browserScriptOrder = Object.freeze([
    'qisi-startup-guard.js',
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
    'qisi-exam-composable.js',
    'qisi-library-view-state.js',
    'qisi-library-composable.js',
    'qisi-entry-view-state.js',
    'qisi-entry-composable.js',
    'qisi-knowledge-tree-state.js',
    'qisi-settings-composable.js',
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
    'qisi-review-composable.js',
    'qisi-batch-final-gate.js',
    'app.js'
]);

const browserStyleOrder = Object.freeze([
    'vendor/tailwindcss/3.4.17/qisi-tailwind.min.css',
    'vendor/katex/0.16.8/katex.min.css',
    'vendor/vue-virtual-scroller/2.0.0-beta.8/vue-virtual-scroller.css',
    'app.css'
]);

const handoutBrowserScriptOrder = Object.freeze([
    'vendor/katex/0.16.8/katex.min.js',
    'vendor/vue/3.5.40/vue.global.prod.js',
    'vendor/dexie/3.2.4/dexie.min.js',
    'qisi-db.js',
    'qisi-handout-model.js',
    'qisi-handout-question-instance.js',
    'qisi-handout-source-update.js',
    'qisi-handout-asset-repository.js',
    'qisi-handout-repository.js',
    'qisi-handout-question-library.js',
    'qisi-handout-editor-state.js',
    'qisi-handout-batch-settings.js',
    'qisi-handout-preview.js',
    'qisi-handout-edition-policy.js',
    'qisi-handout-typst-template.js',
    'qisi-handout-document.js',
    'qisi-handout-compiler-client.js',
    'qisi-handout-pdf-session.js',
    'qisi-handout-app.js'
]);

const handoutBrowserStyleOrder = Object.freeze([
    'vendor/katex/0.16.8/katex.min.css',
    'handout.css'
]);

const handoutWorkerModuleFiles = Object.freeze([
    'workers/qisi-handout-compiler-contract.mjs',
    'workers/qisi-handout-compiler-diagnostics.mjs',
    'workers/qisi-handout-typst-worker.mjs'
]);

const categoryFiles = Object.freeze({
    'browser-live': Object.freeze(
        browserScriptOrder.filter(file => /^qisi-[a-z0-9-]+\.js$/.test(file))
    ),
    'browser-library': Object.freeze([
        'qisi-handout-asset-repository.js',
        'qisi-handout-batch-settings.js',
        'qisi-handout-model.js',
        'qisi-handout-question-instance.js',
        'qisi-handout-repository.js',
        'qisi-handout-source-update.js'
    ]),
    'browser-handout-entry': Object.freeze([
        'qisi-handout-app.js',
        'qisi-handout-compiler-client.js',
        'qisi-handout-document.js',
        'qisi-handout-edition-policy.js',
        'qisi-handout-editor-state.js',
        'qisi-handout-pdf-session.js',
        'qisi-handout-preview.js',
        'qisi-handout-question-library.js',
        'qisi-handout-typst-template.js'
    ]),
    'node-entry': Object.freeze([
        'qisi-local-server.js'
    ]),
    'node-dependency': Object.freeze([
        'qisi-serial-task-queue.js'
    ]),
    'node-safety': Object.freeze([
        'qisi-mathtype-native-guard.js',
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
    'browser-library': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'browser-handout-entry': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-entry': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-dependency': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'node-safety': Object.freeze({ mustExist: true, production: true, syntaxCheck: true }),
    'frozen-research': Object.freeze({ mustExist: true, production: false, syntaxCheck: false }),
    'dead-scaffold': Object.freeze({ mustExist: false, production: false, syntaxCheck: false }),
    'expected-absent': Object.freeze({ mustExist: false, production: false, syntaxCheck: false })
});

const classificationEvidence = Object.freeze({
    'qisi-handout-asset-repository.js': 'H2 handout asset domain library, loaded by the isolated H3 entry',
    'qisi-handout-app.js': 'H3 isolated handout browser entry, never loaded by main.html',
    'qisi-handout-compiler-client.js': 'H5 lazy Worker lifecycle and cancellation client; it loads no compiler assets until compile',
    'qisi-handout-batch-settings.js': 'H7 bounded, undoable multi-question presentation settings policy',
    'qisi-handout-document.js': 'H4 pure edition-to-Typst document pipeline loaded only by the isolated handout entry',
    'qisi-handout-edition-policy.js': 'H4 deterministic edition inheritance and student leakage boundary',
    'qisi-handout-editor-state.js': 'H3 structured handout editor state and undo/redo policy',
    'qisi-handout-model.js': 'H2 handout schema and validation domain library',
    'qisi-handout-pdf-session.js': 'H5 formal PDF artifact, local PDF.js preview, download and Blob lifecycle boundary',
    'qisi-handout-preview.js': 'H3 HTML preview projection with student-content safety',
    'qisi-handout-question-instance.js': 'H2 immutable question snapshot domain library',
    'qisi-handout-source-update.js': 'H7 explicit field-level source refresh and conflict acceptance policy',
    'qisi-handout-question-library.js': 'H3 read-only adapter for formal question-bank insertion',
    'qisi-handout-repository.js': 'H2 handout persistence domain library, loaded by the isolated H3 entry',
    'qisi-handout-typst-template.js': 'H4 centrally managed trusted A4 Typst template without compiler runtime loading',
    'workers/qisi-handout-compiler-contract.mjs': 'H5 versioned local runtime manifest, VFS and request limits',
    'workers/qisi-handout-compiler-diagnostics.mjs': 'H5 compiler line-to-block/formula diagnostic projection',
    'workers/qisi-handout-typst-worker.mjs': 'H5 sole production Typst/MiTeX/WASM compiler execution boundary',
    'qisi-local-server.js': 'package.json main/start entry',
    'qisi-serial-task-queue.js': 'required by qisi-local-server.js',
    'qisi-mathtype-native-guard.js': 'fail-closed native MathType fault isolation required by qisi-local-server.js',
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
    ...handoutWorkerModuleFiles,
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
    browserStyleOrder,
    handoutBrowserScriptOrder,
    handoutBrowserStyleOrder,
    handoutWorkerModuleFiles,
    categoryFiles,
    categoryPolicy,
    classificationEvidence,
    productionSyntaxCheckFiles,
    categoryFor
});
