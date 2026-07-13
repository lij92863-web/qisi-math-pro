const path = require('node:path');
const defaultFsPromises = require('node:fs/promises');

function createTempJobManager(options = {}) {
    const fsPromises = options.fsPromises || defaultFsPromises;
    const now = options.now || Date.now;
    const maxAgeMs = Math.max(1, Number(options.maxAgeMs || 24 * 60 * 60 * 1000));
    const logger = options.logger || ((event, payload) => console.error(event, payload));
    const roots = (options.roots || []).map(item => path.resolve(item));

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

    const cleanupExpired = async () => {
        let removed = 0;
        for (const root of roots) {
            let entries;
            try {
                entries = await fsPromises.readdir(root, { withFileTypes: true });
            } catch (error) {
                logErrorCode(error);
                continue;
            }
            for (const entry of entries) {
                const target = path.join(root, entry.name);
                try {
                    const stat = await fsPromises.stat(target);
                    if (now() - stat.mtimeMs <= maxAgeMs) continue;
                    if (await cleanupOne(target)) removed += 1;
                } catch (error) {
                    logErrorCode(error);
                }
            }
        }
        return { removed };
    };

    return {
        cleanupRequest,
        withCleanup,
        cleanupExpired
    };
}

module.exports = { createTempJobManager };
