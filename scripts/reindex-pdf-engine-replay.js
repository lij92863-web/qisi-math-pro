const fs = require('node:fs');
const path = require('node:path');

const { rebuildReplayCacheKey } = require('./pdf-engine-replay-store.js');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const positional = args.filter(value => value !== '--apply');

if (positional.length !== 2) {
    throw new Error('Usage: node scripts/reindex-pdf-engine-replay.js <replay-directory> <mapping.json> [--apply]');
}

const directory = path.resolve(positional[0]);
const mappingPath = path.resolve(positional[1]);
const directoryPrefix = `${directory}${path.sep}`;
const assertInsideDirectory = targetPath => {
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(directoryPrefix)) {
        throw new Error(`Replay path escapes target directory: ${resolved}`);
    }
    return resolved;
};

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const sourceByImageSha256 = mapping.sourceByImageSha256 || {};
const sourceNames = new Set(Object.keys(sourceByImageSha256));
if (!sourceNames.size) throw new Error('Mapping has no sourceByImageSha256 entries');

const sourceFiles = fs.readdirSync(directory)
    .filter(name => name.endsWith('.json'))
    .sort();
const sourcePaths = new Set(sourceFiles.map(name => assertInsideDirectory(path.join(directory, name))));
const planned = [];

for (const filename of sourceFiles) {
    const sourcePath = assertInsideDirectory(path.join(directory, filename));
    const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const imageHashes = Array.isArray(payload.metadata?.imageSha256)
        ? payload.metadata.imageSha256
        : [];
    const matches = [...new Set(imageHashes.filter(hash => sourceNames.has(hash)))];
    if (!matches.length) continue;
    if (matches.length !== 1) {
        throw new Error(`Replay entry has ambiguous source image mapping: ${filename}`);
    }

    const correction = sourceByImageSha256[matches[0]];
    const metadata = {
        ...payload.metadata,
        sourceFileSha256: String(correction.sourceFileSha256 || ''),
        page: Math.max(0, Number(correction.page) || 0)
    };
    metadata.cacheKey = rebuildReplayCacheKey(metadata);
    const destinationPath = assertInsideDirectory(path.join(directory, `${metadata.cacheKey}.json`));
    planned.push({ sourcePath, destinationPath, payload: { ...payload, metadata } });
}

const destinationPaths = new Set();
for (const item of planned) {
    if (destinationPaths.has(item.destinationPath)) {
        throw new Error(`Replay correction creates duplicate cache key: ${item.destinationPath}`);
    }
    destinationPaths.add(item.destinationPath);
    if (
        item.sourcePath !== item.destinationPath &&
        fs.existsSync(item.destinationPath) &&
        !sourcePaths.has(item.destinationPath)
    ) {
        throw new Error(`Replay correction would overwrite unrelated file: ${item.destinationPath}`);
    }
}

const changed = planned.filter(item =>
    item.sourcePath !== item.destinationPath ||
    JSON.stringify(JSON.parse(fs.readFileSync(item.sourcePath, 'utf8'))) !== JSON.stringify(item.payload)
);

if (apply && changed.length) {
    const temporary = changed.map((item, index) => {
        const temporaryPath = assertInsideDirectory(path.join(directory, `.reindex-${process.pid}-${index}.json`));
        fs.writeFileSync(temporaryPath, `${JSON.stringify(item.payload, null, 2)}\n`, 'utf8');
        return { ...item, temporaryPath };
    });
    for (const item of temporary) fs.rmSync(item.sourcePath);
    for (const item of temporary) fs.renameSync(item.temporaryPath, item.destinationPath);
}

console.log(JSON.stringify({
    status: apply ? 'applied' : 'dry-run',
    directory,
    mappedEntries: planned.length,
    changedEntries: changed.length,
    changes: changed.map(item => ({
        from: path.basename(item.sourcePath),
        to: path.basename(item.destinationPath),
        sourceFileSha256: item.payload.metadata.sourceFileSha256,
        page: item.payload.metadata.page
    }))
}, null, 2));
