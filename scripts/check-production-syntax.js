'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { productionSyntaxCheckFiles } = require('./production-entry-manifest.js');

const root = path.resolve(__dirname, '..');

for (const file of productionSyntaxCheckFiles) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true
    });

    if (result.status !== 0) {
        process.stderr.write(result.stderr || result.stdout || `${file} failed syntax check.\n`);
        process.exit(result.status || 1);
    }
}

process.stdout.write(`[check-production-syntax] ${productionSyntaxCheckFiles.length} files passed.\n`);
