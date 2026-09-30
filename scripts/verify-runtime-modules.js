const fs = require('fs');
const path = require('path');
function validateInventory({ inventory, actualFiles, browserFiles } = {}) {
    const errors = [];
    if (inventory?.schemaVersion !== 'qisi.runtime-file-inventory.v1' || !Array.isArray(inventory.modules)) {
        return { valid: false, errors: ['invalid-inventory-schema'] };
    }
    const byFile = new Map();
    for (const item of inventory.modules) {
        if (!/^qisi-[a-z0-9-]+\.js$|^app\.js$/.test(item?.file || '') ||
            !['browser', 'node', 'dormant'].includes(item.runtime)) errors.push('invalid-module-record');
        if (byFile.has(item.file)) errors.push(`duplicate-module:${item.file}`);
        byFile.set(item.file, item);
    }
    const actual = new Set(actualFiles);
    for (const file of actual) if (!byFile.has(file)) errors.push(`unregistered-module:${file}`);
    for (const file of byFile.keys()) if (!actual.has(file)) errors.push(`missing-module:${file}`);
    for (const file of browserFiles) {
        if (byFile.get(file)?.runtime !== 'browser') errors.push(`browser-role-mismatch:${file}`);
    }
    return { valid: errors.length === 0, errors };
}
function verify(root = path.resolve(__dirname, '..')) {
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'architecture/runtime-modules.json'), 'utf8'));
    const actualFiles = fs.readdirSync(root).filter(file => /^qisi-.*\.js$/.test(file) || file === 'app.js');
    const html = fs.readFileSync(path.join(root, 'main.html'), 'utf8');
    const browserFiles = [...html.matchAll(/<script\b[^>]*src=["']\.\/((?:qisi-[a-z0-9-]+|app)\.js)(?:[?"'])/g)]
        .map(match => match[1]);
    const result = validateInventory({ inventory, actualFiles, browserFiles });
    for (const file of ['architecture/layers.json', 'docs/architecture/layers.json']) {
        const catalogPath = path.join(root, file);
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        if (!catalog.runtimeInventory || path.resolve(path.dirname(catalogPath), catalog.runtimeInventory) !==
            path.join(root, 'architecture/runtime-modules.json')) result.errors.push(`inventory-reference-mismatch:${file}`);
    }
    result.valid = result.errors.length === 0;
    return result;
}
if (require.main === module) {
    const result = verify();
    console.log(JSON.stringify(result)); if (!result.valid) process.exitCode = 1;
}
module.exports = { validateInventory, verify };
