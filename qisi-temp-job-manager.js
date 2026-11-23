const path = require('node:path');
const defaultFsPromises = require('node:fs/promises');

function createTempJobManager(options = {}) {
    const fsPromises = options.fsPromises || defaultFsPromises;
    const now = options.now || Date.now;
    const maxAgeMs = Math.max(1, Number(options.maxAgeMs || 24 * 60 * 60 * 1000));
    const maxBytes = options.maxBytes ?? 1024 ** 3;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new RangeError('TEMP_CAPACITY_INVALID');
    const logger = options.logger || ((event, payload) => console.error(event, payload));
    const roots = (options.roots || []).map(item => path.resolve(item));
    const active = new Set();
    const isActive = target => [...active].some(job =>
        [job.uploadPath, job.outputDir].some(file => file && path.resolve(file) === target));
    const track = job => {
        active.add(job);
        return () => active.delete(job);
    };

    const logErrorCode = error => {
        logger('[TEMP_CLEANUP_ERROR]', {
            code: String(error?.code || 'TEMP_CLEANUP_FAILED')
        });
    };

    const isAllowedChild = target => {
        const resolved = path.resolve(target || '');
        return roots.some(root => {
            const relative = path.relative(root, resolved);
            return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
        });
    };

    const cleanupOne = async target => {
        if (!target) return false;
        if (!isAllowedChild(target)) {
            logErrorCode({ code: 'TEMP_CLEANUP_PATH_REJECTED' });
            return false;
        }
        try {
            await fsPromises.rm(path.resolve(target), { recursive: true, force: true });
            return true;
        } catch (error) {
            logErrorCode(error);
            return false;
        }
    };

    const cleanupRequest = async job => {
        const targets = [...new Set([
            job?.uploadPath,
            job?.outputDir
        ].filter(Boolean).map(item => path.resolve(item)))];
        const results = await Promise.all(targets.map(cleanupOne));
        return { removed: results.filter(Boolean).length };
    };

    const withCleanup = async (job, action) => {
        try {
            return await action();
        } finally {
            await cleanupRequest(job);
        }
    };

    const measure = async (target, stat) => {
        if (stat.isSymbolicLink()) return 0;
        if (!stat.isDirectory()) return stat.size;
        let size = 0;
        for (const name of await fsPromises.readdir(target)) {
            const child = path.join(target, name);
            size += await measure(child, await fsPromises.lstat(child));
        }
        return size;
    };

    async function sweep(manual) {
        let removed = 0, freedBytes = 0, remainingBytes = 0, failed = 0;
        const candidates = [];
        for (const root of roots) {
            try {
                // Windows may report an 8.3 alias for the parent directory.
                const boundary = options.rootBoundary ? path.resolve(options.rootBoundary) : path.dirname(root);
                const relative = path.relative(boundary, root);
                if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
                    throw Object.assign(new Error(), { code: 'TEMP_CLEANUP_PATH_REJECTED' });
                }
                const expectedRoot = path.join(await fsPromises.realpath(boundary), relative);
                if (path.relative(expectedRoot, await fsPromises.realpath(root))) {
                    throw Object.assign(new Error(), { code: 'TEMP_CLEANUP_PATH_REJECTED' });
                }
                for (const name of await fsPromises.readdir(root)) {
                    const target = path.join(root, name);
                    try {
                        const stat = await fsPromises.lstat(target);
                        const size = await measure(target, stat);
                        remainingBytes += size;
                        if (!isActive(target)) candidates.push({ target, size, updatedAt: stat.mtimeMs });
                    } catch (error) {
                        if (error.code !== 'ENOENT') { failed++; logErrorCode(error); }
                    }
                }
            } catch (error) {
                failed++;
                logErrorCode(error);
            }
        }
        candidates.sort((left, right) => left.updatedAt - right.updatedAt);
        const expiry = now() - maxAgeMs;
        for (const { target, size, updatedAt } of candidates) {
            if (!manual && updatedAt >= expiry && remainingBytes <= maxBytes) break;
            if (isActive(target)) continue;
            if (!await cleanupOne(target)) { failed++; continue; }
            removed++;
            freedBytes += size;
            remainingBytes -= size;
        }
        return { removed, freedBytes, remainingBytes, maxBytes, failed };
    }

    let sweepTail = Promise.resolve();
    const schedule = manual => {
        const result = sweepTail.then(() => sweep(manual));
        sweepTail = result.catch(() => {});
        return result;
    };

    return {
        cleanupRequest,
        withCleanup,
        cleanupExpired: () => schedule(false),
        cleanupInactive: () => schedule(true), track
    };
}

module.exports = { createTempJobManager };
