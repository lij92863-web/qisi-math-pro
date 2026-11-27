const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { modules } = require('../architecture/runtime-modules.json');
const { verify } = require('./verify-runtime-modules');

const root = path.resolve(__dirname, '..');
const inventory = verify(root);
if (!inventory.valid) {
    console.error(inventory.errors.join('\n'));
    process.exit(1);
}
const files = [
    ...modules.filter(module => module.runtime !== 'dormant').map(module => module.file),
    'scripts/check-runtime-syntax.js',
    'scripts/verify-runtime-modules.js',
    'scripts/verify-app-shell-architecture.js',
    'scripts/benchmark/measure-program-c-closure.js',
    'scripts/verify-personal-stable.js'
];
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = 1;
}
if (!process.exitCode) console.log(`Syntax checked: ${files.length} files.`);
