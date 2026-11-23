'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Only transport receipts and immutable extraction ZIPs live here. Draft and
// formal assets continue to belong to the existing application repositories.
function createMineruTaskStore(directory) {
    const root = path.resolve(directory);
    const file = (key, suffix) => {
        if (!/^[a-f0-9]{64}$/.test(key)) throw Object.assign(new Error('MINERU_TASK_ID_INVALID'), { code: 'MINERU_TASK_ID_INVALID' });
        return path.join(root, key + suffix);
    };
    async function read(key) {
        try { return JSON.parse(await fs.readFile(file(key, '.json'), 'utf8')); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }
    async function write(key, receipt) {
        await fs.mkdir(root, { recursive: true });
        const pending = file(key, `.json.${process.pid}.next`);
        await fs.writeFile(pending, JSON.stringify(receipt));
        await fs.rename(pending, file(key, '.json'));
    }
    async function prepare(key, receipt) {
        await fs.mkdir(root, { recursive: true });
        try { await fs.writeFile(file(key, '.json'), JSON.stringify(receipt), { flag: 'wx' }); return receipt; }
        catch (error) { if (error.code === 'EEXIST') return read(key); throw error; }
    }
    async function writeZip(key, bytes) {
        const pending = file(key, `.zip.${process.pid}.next`);
        await fs.writeFile(pending, bytes);
        await fs.rename(pending, file(key, '.zip'));
        return crypto.createHash('sha256').update(bytes).digest('hex');
    }
    async function readZip(key, digest) {
        const bytes = await fs.readFile(file(key, '.zip'));
        if (crypto.createHash('sha256').update(bytes).digest('hex') !== digest) {
            throw Object.assign(new Error('MINERU_CACHE_INTEGRITY_FAILED'), { code: 'MINERU_CACHE_INTEGRITY_FAILED' });
        }
        return bytes;
    }
    return Object.freeze({ read, write, prepare, writeZip, readZip });
}

module.exports = { createMineruTaskStore };
