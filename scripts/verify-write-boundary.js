const fs = require('fs');
const path = require('path');

// 写入边界门禁。三条规则各自锁一个不变量，不靠"记得别这么写"：
//   1. 写事务只能出现在 qisi-storage-repository.js。
//   2. 本仓储约定显式返回数据库 promise 链；此语法门禁不证明事务原子性，
//      也不表示 Dexie 不支持 async。失败回滚仍须通过实际存储测试验证。
//   3. runtime 'dormant' 的模块不得被 runtime 'browser' 的模块 require。
// 只读事务（Dexie mode 'r'）不写库，按 Dexie 语义不可能成为第二条写门，因此不计入 1、2。

const REPOSITORY_FILE = 'qisi-storage-repository.js';
const RUNTIME_FILE_PATTERN = /^qisi-[a-z0-9-]+\.js$|^app\.js$/;

function listRuntimeFiles(root) {
    return fs.readdirSync(root, { withFileTypes: true })
        .filter(entry => entry.isFile() && RUNTIME_FILE_PATTERN.test(entry.name))
        .map(entry => entry.name)
        .sort();
}

function isRegexStart(source, index) {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const char = source[cursor];
        if (/\s/.test(char)) continue;
        return '([{,;:=!&|?+-*%~^<>'.includes(char);
    }
    return true;
}

// 等长替换：注释（以及可选的字符串内容）变空格，换行保留，因此偏移量与行号可直接对应原文。
function maskSource(source, { maskStrings = true } = {}) {
    const chars = source.split('');
    const blank = index => {
        if (chars[index] !== '\n' && chars[index] !== '\r') chars[index] = ' ';
    };
    let index = 0;
    while (index < source.length) {
        const char = source[index];
        const next = source[index + 1];
        if (char === '/' && next === '/') {
            while (index < source.length && source[index] !== '\n') {
                blank(index);
                index += 1;
            }
            continue;
        }
        if (char === '/' && next === '*') {
            const end = source.indexOf('*/', index + 2);
            const stop = end < 0 ? source.length : end + 2;
            while (index < stop) {
                blank(index);
                index += 1;
            }
            continue;
        }
        if (char === '/' && isRegexStart(source, index)) {
            let cursor = index + 1;
            let inClass = false;
            while (cursor < source.length) {
                const current = source[cursor];
                if (current === '\\') {
                    cursor += 2;
                    continue;
                }
                if (current === '[') inClass = true;
                else if (current === ']') inClass = false;
                else if (current === '/' && !inClass) break;
                else if (current === '\n') break;
                cursor += 1;
            }
            if (maskStrings) for (let position = index; position <= cursor; position += 1) blank(position);
            index = cursor + 1;
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            const quote = char;
            let cursor = index + 1;
            while (cursor < source.length) {
                const current = source[cursor];
                if (current === '\\') {
                    cursor += 2;
                    continue;
                }
                if (current === quote) break;
                cursor += 1;
            }
            if (maskStrings) {
                for (let position = index + 1; position < cursor; position += 1) blank(position);
            }
            index = cursor + 1;
            continue;
        }
        index += 1;
    }
    return chars.join('');
}

function lineLocator(source) {
    const starts = [0];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') starts.push(index + 1);
    }
    return offset => {
        let low = 0;
        let high = starts.length - 1;
        while (low < high) {
            const middle = (low + high + 1) >> 1;
            if (starts[middle] <= offset) low = middle;
            else high = middle - 1;
        }
        return low + 1;
    };
}

function argumentRanges(masked, openIndex) {
    const ranges = [];
    let depth = 0;
    let start = openIndex + 1;
    for (let index = openIndex; index < masked.length; index += 1) {
        const char = masked[index];
        if (char === '(' || char === '[' || char === '{') depth += 1;
        else if (char === ')' || char === ']' || char === '}') {
            depth -= 1;
            if (depth === 0) {
                if (masked.slice(start, index).trim()) ranges.push({ start, end: index });
                return ranges;
            }
        } else if (char === ',' && depth === 1) {
            ranges.push({ start, end: index });
            start = index + 1;
        }
    }
    return ranges;
}

function transactionCalls(source) {
    const masked = maskSource(source);
    const calls = [];
    const pattern = /\.transaction\s*\(/g;
    let match;
    while ((match = pattern.exec(masked))) {
        const openIndex = masked.indexOf('(', match.index);
        const ranges = argumentRanges(masked, openIndex);
        if (ranges.length < 2) continue;
        const mode = source.slice(ranges[0].start, ranges[0].end).trim();
        const callback = masked.slice(ranges[ranges.length - 1].start, ranges[ranges.length - 1].end).trim();
        calls.push({
            offset: match.index,
            readOnly: /^(['"])r\1$/.test(mode),
            asyncCallback: /^async\b/.test(callback)
        });
    }
    return calls;
}

function browserRequiresDormant(source, dormantFiles) {
    const masked = maskSource(source, { maskStrings: false });
    const hits = [];
    for (const match of masked.matchAll(/require\s*\(\s*['"]\.\/([\w.-]+?)(?:\.c?js)?['"]\s*\)/g)) {
        const target = match[1].endsWith('.js') || match[1].endsWith('.cjs')
            ? match[1]
            : `${match[1]}.js`;
        if (dormantFiles.has(target)) hits.push({ offset: match.index, target });
    }
    return hits;
}

function verify(root = path.resolve(__dirname, '..')) {
    const errors = [];
    const inventory = JSON.parse(
        fs.readFileSync(path.join(root, 'architecture/runtime-modules.json'), 'utf8')
    );
    const modules = Array.isArray(inventory.modules) ? inventory.modules : [];
    const dormantFiles = new Set(
        modules.filter(item => item.runtime === 'dormant').map(item => item.file)
    );
    const browserFiles = modules
        .filter(item => item.runtime === 'browser')
        .map(item => item.file);
    const runtimeFiles = new Set(listRuntimeFiles(root));

    for (const file of runtimeFiles) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const lineOf = lineLocator(source);
        for (const call of transactionCalls(source)) {
            if (call.readOnly) continue;
            const line = lineOf(call.offset);
            if (file !== REPOSITORY_FILE) {
                errors.push(`transaction-outside-repository:${file}:${line}`);
            }
            if (call.asyncCallback) {
                errors.push(`async-transaction-callback:${file}:${line}`);
            }
        }
    }

    for (const file of browserFiles) {
        if (!runtimeFiles.has(file)) continue;
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        const lineOf = lineLocator(source);
        for (const hit of browserRequiresDormant(source, dormantFiles)) {
            errors.push(`browser-requires-dormant:${file}:${lineOf(hit.offset)}:${hit.target}`);
        }
    }

    return { ok: errors.length === 0, errors };
}

if (require.main === module) {
    const result = verify();
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
}

module.exports = { verify, maskSource, transactionCalls };
