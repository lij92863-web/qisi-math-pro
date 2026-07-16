(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxLatexContent = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

        const decodeXmlEntities = (value = '') => String(value || '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

        const stripOnlyOuterMathDelimiters = (value = '') => {
            let source = String(value || '').trim();
            let changed = true;

            while (changed) {
                changed = false;
                const pairs = [
                    ['$$', '$$'],
                    ['$', '$'],
                    ['\\[', '\\]'],
                    ['\\(', '\\)']
                ];

                for (const [start, end] of pairs) {
                    if (source.startsWith(start) && source.endsWith(end) && source.length >= start.length + end.length) {
                        source = source.slice(start.length, -end.length).trim();
                        changed = true;
                        break;
                    }
                }
            }

            return source;
        };

        const canonicalizeMathCommands = (value = '') => {
            let source = String(value || '')
                .replace(/\r\n?/g, '\n')
                .replace(/[＝]/g, '=')
                .replace(/[−﹣]/g, '-')
                .replace(/π/g, '\\pi ')
                .replace(/∈/g, '\\in ')
                .replace(/∩/g, '\\cap ')
                .replace(/∪/g, '\\cup ')
                .replace(/⊆/g, '\\subseteq ')
                .replace(/≠/g, '\\ne ')
                .replace(/≤/g, '\\le ')
                .replace(/≥/g, '\\ge ')
                .replace(/×/g, '\\times ')
                .replace(/÷/g, '\\div ')
                .replace(/°/g, '^{\\circ}');

            source = source
                .replace(
                    /\\begin\{array\}\s*\{\s*\*\s*\{\s*\d+\s*\}\s*\{\s*([lcr])\s*\}\s*\}/g,
                    '\\begin{array}{$1}'
                )
                .replace(/\\mathop\s*\\(sum|prod|int|oint)(?![A-Za-z])/g, '\\$1')
                .replace(/\\(?:rm|mathrm|text)\s*\{\s*\\pi\s*\}/g, '\\pi')
                .replace(/\\(?:bf|mathbf)\s*\{\s*Z\s*\}/g, '\\mathbb{Z}')
                .replace(/\\vec\s*\{\s*([A-Za-z]{2,})\s*\}/g, '\\overrightarrow{$1}')
                .replace(/\\sqrt\s*([0-9A-Za-z])/g, '\\sqrt{$1}')
                .replace(/([A-Za-z0-9}])\|([A-Za-z])/g, (match, left, right, offset, fullSource) => {
                    const prefix = String(fullSource || '').slice(Math.max(0, offset - 8), offset + 1);
                    return /\\left$/.test(prefix) ? match : `${left}\\mid ${right}`;
                });

            for (let pass = 0; pass < 4; pass += 1) {
                const next = source
                    .replace(/\{\s*\{([^{}]*)\}\s*\}/g, '{$1}')
                    .replace(/\\(?:rm|mathrm)\s*\{([^{}]*)\}/g, '$1');
                if (next === source) break;
                source = next;
            }

            const compact = source
                .replace(/\s+/g, ' ')
                .replace(/\s*([=+,:])\s*/g, '$1')
                .replace(/(^|[={(,:+\[])\s*-\s+(?=\\)/g, '$1-')
                .replace(/\s*([{}])\s*/g, '$1')
                .replace(/\\pi(?=[A-Za-z0-9])/g, '\\pi ')
                .trim();
            return unwrapStandaloneConstants(collapseRedundantFracGroups(compact));
        };

        const isEscapedAt = (source = '', index = 0) => {
            let slashCount = 0;
            for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
                slashCount += 1;
            }
            return slashCount % 2 === 1;
        };

        const readBalancedGroup = (source, start) => {
            if (source[start] !== '{') return -1;
            let depth = 0;
            for (let index = start; index < source.length; index += 1) {
                if (source[index] === '{' && !isEscapedAt(source, index)) depth += 1;
                if (source[index] === '}' && !isEscapedAt(source, index)) depth -= 1;
                if (depth === 0) return index + 1;
                if (depth < 0) return -1;
            }
            return -1;
        };

        const collapseRedundantFracGroups = (value = '') => {
            const source = String(value || '');
            let output = '';
            let cursor = 0;
            const regex = /\\frac\s*/g;
            let match;
            while ((match = regex.exec(source)) !== null) {
                const firstStart = regex.lastIndex;
                const firstEnd = readBalancedGroup(source, firstStart);
                const secondEnd = firstEnd > 0 ? readBalancedGroup(source, firstEnd) : -1;
                if (firstEnd < 0 || secondEnd < 0) continue;
                const unwrap = body => body.startsWith('{') && readBalancedGroup(body, 0) === body.length
                    ? body.slice(1, -1)
                    : body;
                output += source.slice(cursor, match.index);
                output += `\\frac{${unwrap(source.slice(firstStart + 1, firstEnd - 1))}}`;
                output += `{${unwrap(source.slice(firstEnd + 1, secondEnd - 1))}}`;
                cursor = secondEnd;
                regex.lastIndex = secondEnd;
            }
            return output + source.slice(cursor);
        };

        const unwrapStandaloneConstants = (value = '') => String(value || '').replace(/\{(\\pi|\\mathbb\{Z\})\}/g, (match, body, offset, source) => {
            const prefix = source.slice(0, offset);
            return /\\(?:frac|sqrt)\s*$/.test(prefix) ? match : body;
        });

        const maskFlexibleLeftRightDelimiters = (value = '') => {
            const source = String(value || '');
            let depth = 0;
            let failure = '';
            const masked = source.replace(
                /\\(left|right)\s*(?:\\(?:langle|rangle|lvert|rvert|lVert|rVert|vert|Vert|lfloor|rfloor|lceil|rceil|lbrace|rbrace|backslash|uparrow|downarrow|updownarrow|Uparrow|Downarrow|Updownarrow)|\\[{}|.]|[()[\]{}|.])/g,
                (match, kind, offset) => {
                    if (kind === 'left') {
                        depth += 1;
                    } else if (depth > 0) {
                        depth -= 1;
                    } else if (!failure) {
                        failure = `unexpected-right@${offset}`;
                    }
                    return ' '.repeat(match.length);
                }
            );

            if (!failure && /\\(?:left|right)\b/.test(masked)) {
                failure = 'left-right-delimiter-missing';
            }
            if (!failure && depth) failure = `unclosed-left-${depth}`;

            return failure
                ? { ok: false, diagnostics: [failure], value: masked }
                : { ok: true, diagnostics: [], value: masked };
        };

        const validateLatexBalance = (value = '') => {
            const source = String(value || '');
            const flexible = maskFlexibleLeftRightDelimiters(source);
            if (!flexible.ok) {
                return {
                    ok: false,
                    code: 'UNBALANCED_LATEX',
                    diagnostics: flexible.diagnostics
                };
            }
            const stack = [];
            const pairs = { '}': '{', ']': '[', ')': '(' };

            for (let index = 0; index < flexible.value.length; index += 1) {
                const char = flexible.value[index];
                if (isEscapedAt(flexible.value, index)) continue;
                if ('{[('.includes(char)) stack.push({ char, index });
                if ('}])'.includes(char)) {
                    const openedEntry = stack.pop();
                    const opened = openedEntry?.char;
                    const isMixedBoundary = (opened === '[' && char === ')') || (opened === '(' && char === ']');
                    const isIntervalBoundary = isMixedBoundary
                        && /,/.test(flexible.value.slice((openedEntry?.index ?? index) + 1, index));
                    if (opened !== pairs[char] && !isIntervalBoundary) {
                        return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`unexpected-${char}@${index}`] };
                    }
                }
            }

            if (stack.length) {
                return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`unclosed-${stack.map(entry => entry.char).join('')}`] };
            }

            const environments = new Map();
            source.replace(/\\(begin|end)\s*\{([^}]+)\}/g, (_, kind, name) => {
                environments.set(name, (environments.get(name) || 0) + (kind === 'begin' ? 1 : -1));
                return '';
            });
            const mismatch = [...environments.entries()].find(([, count]) => count !== 0);
            if (mismatch) return { ok: false, code: 'UNBALANCED_LATEX', diagnostics: [`environment-${mismatch[0]}`] };

            return { ok: true, code: 'LATEX_BALANCED', diagnostics: [] };
        };

        const validateCommandArguments = (value = '') => {
            const source = String(value || '');
            const failures = [];

            for (const command of ['frac', 'sqrt']) {
                const regex = new RegExp(`\\\\${command}\\b`, 'g');
                let match;
                while ((match = regex.exec(source)) !== null) {
                    let cursor = regex.lastIndex;
                    while (/\s/.test(source[cursor] || '')) cursor += 1;
                    if (command === 'sqrt' && source[cursor] === '[') {
                        const optionalEnd = source.indexOf(']', cursor + 1);
                        cursor = optionalEnd >= 0 ? optionalEnd + 1 : cursor;
                        while (/\s/.test(source[cursor] || '')) cursor += 1;
                    }
                    const firstEnd = readBalancedGroup(source, cursor);
                    if (firstEnd < 0) {
                        failures.push(`missing-${command}-arg@${match.index}`);
                        continue;
                    }
                    if (command === 'frac') {
                        cursor = firstEnd;
                        while (/\s/.test(source[cursor] || '')) cursor += 1;
                        if (readBalancedGroup(source, cursor) < 0) failures.push(`missing-frac-den@${match.index}`);
                    }
                }
            }

            return failures.length
                ? { ok: false, code: 'MISSING_COMMAND_ARGUMENT', diagnostics: failures }
                : { ok: true, code: 'COMMAND_ARGUMENTS_OK', diagnostics: [] };
        };

        const normalizeLatexFragment = (input) => {
            const source = String(input ?? '').trim();
            if (!source) return { ok: false, code: 'EMPTY_MATH_FRAGMENT', latex: '', diagnostics: [] };

            const stripped = stripOnlyOuterMathDelimiters(source);
            if (/\$|\\\(|\\\)|\\\[|\\\]/.test(stripped)) {
                return {
                    ok: false,
                    code: 'NESTED_MATH_DELIMITER',
                    latex: '',
                    diagnostics: ['math delimiter remained inside fragment']
                };
            }

            const latex = canonicalizeMathCommands(stripped);
            const balance = validateLatexBalance(latex);
            if (!balance.ok) return { ...balance, latex: '' };
            const args = validateCommandArguments(latex);
            if (!args.ok) return { ...args, latex: '' };
            if (/\\(?:overrightarrow|overleftarrow|widehat|widetilde|vec)\s*\{\s*\}/.test(latex)) {
                return { ok: false, code: 'EMPTY_MATH_TEMPLATE', latex: '', diagnostics: ['empty directional template'] };
            }
            if (/\[object Object\]|undefined|null|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*)?\s*\/?>|[{}]\s*:\s*["']/.test(latex)) {
                return { ok: false, code: 'INVALID_LATEX_PAYLOAD', latex: '', diagnostics: ['non-math payload'] };
            }

            return { ok: true, code: 'LATEX_OK', latex, diagnostics: [] };
        };

        const normalizePlainText = (value = '') => String(value || '')
            .replace(/\r\n?/g, '\n')
            .replace(/\u00a0/g, ' ')
            .replace(/\u00ad/g, '');

        const normalizeGeometryTextMath = (value = '') => String(value || '')
            .split(/(\$[^$]*\$)/g)
            .map((segment, index) => {
                if (index % 2 === 1) return segment;
                return segment
                    .replace(
                        /(^|[\u3400-\u9fff△∠，。；：、,;:（(\s])([A-Z]{2,5})(?=[\u3400-\u9fff△∠，。；：、,;:）)\s=＝⊥∥]|$)/g,
                        (_, prefix, identifier) => `${prefix}$${identifier}$`
                    )
                    .replace(
                        /(^|[\u3400-\u9fff，。；：、,;:（(\s])([A-Za-z])\s*([=＝])/g,
                        (_, prefix, identifier) => `${prefix}$${identifier}=$`
                    );
            })
            .reduce((result, segment) => (
                result.endsWith('$') && segment.startsWith('$')
                    ? `${result}\u200B${segment}`
                    : result + segment
            ), '');

        const serializeMixedMathText = (value = '') => {
            const source = String(value || '');
            if (!/[\u3400-\u9fff]/.test(source)) return `$${source}$`;

            const protectedTextCommands = [];
            const protectedSource = source.replace(
                /\\(?:text|textrm|textnormal|mbox)\s*\{[^{}]*[\u3400-\u9fff][^{}]*\}/g,
                command => {
                    const token = `@@QISI_LATEX_TEXT_${protectedTextCommands.length}@@`;
                    protectedTextCommands.push(command);
                    return token;
                }
            );
            const restoreTextCommands = segment => String(segment || '').replace(
                /@@QISI_LATEX_TEXT_(\d+)@@/g,
                (_, index) => protectedTextCommands[Number(index)] || ''
            );
            const hasMathPayload = segment => (
                /\\[A-Za-z]+|[A-Za-z0-9_^=+\-*/<>()[\]{}]|[∵∴π≤≥≠∈∩∪√△]/.test(segment)
            );

            const segments = protectedSource
                .split(/([\u3400-\u9fff，。；：、！？（）【】“”‘’]+)/g)
                .filter(Boolean)
                .map(segment => restoreTextCommands(segment));
            const mathSegments = segments.filter(hasMathPayload);
            const canSplitSafely = mathSegments.every(segment => normalizeLatexFragment(segment).ok);
            if (!canSplitSafely) {
                const embeddedText = source.replace(
                    /([\u3400-\u9fff，。；：、！？（）【】“”‘’]+)/g,
                    (_, text) => `\\text{${text}}`
                );
                return `$${embeddedText}$`;
            }
            return segments
                .map(segment => hasMathPayload(segment) ? `$${segment}$` : segment)
                .join('');
        };

        const mathAssemblyRunValue = run => {
            if (run?.kind === 'math') return String(run.latex || '');
            if (run?.kind === 'text') return normalizePlainText(run.text);
            if (run?.kind === 'tab') return ' ';
            if (run?.kind === 'break') return '\\\\';
            return null;
        };

        const assembleSplitMathRuns = (runs, startIndex) => {
            let candidate = String(runs[startIndex]?.latex || '');
            let mathRunCount = 1;
            for (let index = startIndex + 1; index < runs.length; index += 1) {
                const value = mathAssemblyRunValue(runs[index]);
                if (value === null) break;
                candidate += value;
                if (runs[index]?.kind === 'math') mathRunCount += 1;
                const normalized = normalizeLatexFragment(candidate);
                if (mathRunCount > 1 && normalized.ok) {
                    return { endIndex: index, latex: normalized.latex };
                }
            }
            return null;
        };

        const serializeRichRuns = (runs = [], diagnostics = []) => {
            const sourceRuns = runs || [];
            const segments = [];
            for (let index = 0; index < sourceRuns.length; index += 1) {
                const run = sourceRuns[index];
                if (run?.kind === 'text') {
                    segments.push(normalizeGeometryTextMath(normalizePlainText(run.text)));
                    continue;
                }
                if (run?.kind === 'tab') {
                    segments.push('\t');
                    continue;
                }
                if (run?.kind === 'break') {
                    segments.push('\n');
                    continue;
                }
                if (run?.kind === 'image') {
                    segments.push(run.token || (run.assetId ? `[[IMAGE:${run.assetId}]]` : ''));
                    continue;
                }
                if (run?.kind !== 'math') continue;

                const normalized = normalizeLatexFragment(run.latex);
                if (normalized.ok) {
                    segments.push(serializeMixedMathText(normalized.latex));
                    continue;
                }

                const assembled = ['UNBALANCED_LATEX', 'MISSING_COMMAND_ARGUMENT'].includes(normalized.code)
                    ? assembleSplitMathRuns(sourceRuns, index)
                    : null;
                if (assembled) {
                    segments.push(`$${assembled.latex}$`);
                    index = assembled.endIndex;
                    continue;
                }

                diagnostics.push({
                    kind: 'formula-error',
                    source: String(run.rawSource || run.latex || ''),
                    code: normalized.code,
                    runIndex: index,
                    paragraphIndex: run.paragraphIndex ?? null
                });
                segments.push('公式需要人工复核');
            }
            const joined = segments.reduce((result, segment) => (
                result.endsWith('$') && segment.startsWith('$')
                    ? `${result}\u200B${segment}`
                    : result + segment
            ), '');
            return normalizeGeometryTextMath(joined).replace(
                /([A-Z])\u200B?\$([A-Z]{2,5})\$(?=[\u3400-\u9fff，。；：、,;:]|$)/g,
                (_, prefix, suffix) => `$${prefix}${suffix}$`
            );
        };

        return {
            canonicalizeMathCommands,
            decodeXmlEntities,
            normalizeGeometryTextMath,
            normalizeLatexFragment,
            serializeRichRuns,
            stripOnlyOuterMathDelimiters,
            validateLatexBalance
        };
    }
);
