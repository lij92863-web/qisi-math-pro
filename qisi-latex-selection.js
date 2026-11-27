(function (root) {
    'use strict';

    const highlightName = 'qisi-latex-selection';
    const formulaMark = 'data-latex-selection-mark';
    const controllers = new WeakMap();
    let activeController;

    function textIndex(value, offset = 0) {
        let text = '';
        const positions = [];
        for (const character of value) {
            const normalized = character.normalize('NFKC').replace(/[、。]/g, '.').replace(/\s/g, '');
            for (let i = 0; i < normalized.length; i++) positions.push([offset, offset + character.length]);
            text += normalized;
            offset += character.length;
        }
        return { text, positions };
    }

    // KaTeX exposes its input formula in the MathML annotation. Use the
    // expression as the match key, while retaining its whole source span.
    function formulaKey(value) {
        return textIndex(value
            .replace(/\\(?:mathrm|text)\{([^{}]*)\}/g, '$1')
            .replace(/\\(?:left|right)\b/g, '')
            .replace(/\\[dt]frac\b/g, '\\frac')
            .replace(/\\vect\b/g, '\\overrightarrow')
            .replace(/(?<!\\)\b(?:Sangle|angle|theta|alpha|beta|gamma|pi)\b/g, command =>
                '\\' + (command === 'Sangle' ? 'angle' : command))
            .replace(/\\(le|ge|ne|pi|in|cap|cup|to)\b/g, (_, command) => ({
                le:'≤', ge:'≥', ne:'≠', pi:'π', in:'∈', cap:'∩', cup:'∪', to:'→'
            })[command])).text;
    }

    function sourceIndex(value) {
        let text = '';
        const positions = [];
        for (const segment of root.Qisi.Utils.tokenizeLatexSource(value).segments) {
            if (segment.type === 'math') {
                const key = formulaKey(segment.expression);
                const span = [segment.start, segment.end];
                text += key;
                for (let i = 0; i < key.length; i++) positions.push(span);
            } else {
                const plain = textIndex(segment.raw, segment.start);
                text += plain.text;
                for (const span of plain.positions) positions.push(span);
            }
        }
        return { text, positions };
    }

    function* renderedParts(node) {
        if (node.nodeType === 3) {
            yield { node, ...textIndex(node.data) };
            return;
        }
        if (node.nodeType !== 1 || node.style?.display === 'none' ||
            node.matches('[data-latex-ignore], [data-image-id], figure, [hidden], script, style')) return;
        if (node.matches('.katex')) {
            const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) yield { node, text: formulaKey(annotation.textContent), raw: textIndex(annotation.textContent).text, formula: true };
            return;
        }
        for (const child of node.childNodes) yield* renderedParts(child);
    }

    function mapSource(value, previews) {
        const source = sourceIndex(value);
        const mappings = [];
        let cursor = 0;
        // Walking in render order keeps identical sentences or formulas on
        // their own source occurrences, including split preview fragments.
        for (const preview of previews) {
            for (const part of renderedParts(preview)) {
                if (!part.text) continue;
                let key = part.text;
                let start = source.text.indexOf(key, cursor);
                if (part.raw && part.raw !== key) {
                    const offset = source.text.indexOf(part.raw, cursor);
                    if (offset >= 0 && (start < 0 || offset < start)) {
                        start = offset;
                        key = part.raw;
                    }
                }
                if (start < 0) continue;
                cursor = start + key.length;
                mappings.push({ part, start, end: cursor });
            }
        }
        return { mappings, positions: source.positions };
    }

    function selectedParts(mapping, start, end, document) {
        const overlaps = ([from, to]) => start < to && from < end;
        const selected = [];
        for (const { part, start: index, end: limit } of mapping.mappings) {
            const first = mapping.positions[index], last = mapping.positions[limit - 1];
            if (start >= last[1] || end <= first[0]) continue;
            if (part.formula) {
                selected.push({ formula: part.node });
                continue;
            }
            let left = 0, right = limit - index - 1;
            while (left <= right && !overlaps(mapping.positions[index + left])) left++;
            if (left > right) continue;
            while (!overlaps(mapping.positions[index + right])) right--;
            const range = document.createRange();
            range.setStart(part.node, part.positions[left][0]);
            range.setEnd(part.node, part.positions[right][1]);
            selected.push({ range });
        }
        return selected;
    }

    function reveal(selection, scope) {
        const range = selection?.range;
        const node = selection?.formula || range?.startContainer.parentElement;
        const rect = selection?.formula?.getBoundingClientRect() || range?.getClientRects()[0];
        if (!node || !rect?.height) return;
        for (let parent = node.parentElement; parent && parent !== scope; parent = parent.parentElement) {
            if (parent.scrollHeight <= parent.clientHeight || !/^(auto|scroll)$/.test(root.getComputedStyle(parent).overflowY)) continue;
            const viewport = parent.getBoundingClientRect();
            if (rect.top < viewport.top + 8 || rect.top >= viewport.bottom - 8) {
                parent.scrollTop += rect.top - viewport.top - 12;
            }
            return;
        }
    }

    function mount(scope) {
        const document = scope.ownerDocument;
        const events = ['select', 'pointerup', 'keyup', 'input', 'focusin', 'focusout'];
        const registry = root.CSS?.highlights;
        let frame = 0, cache, formulas = [], visibleRange;
        const clear = () => {
            for (const formula of formulas) formula.removeAttribute(formulaMark);
            formulas = [];
            if (activeController === clear) {
                registry?.delete(highlightName);
                activeController = undefined;
            }
        };
        const update = () => {
            frame = 0;
            const input = document.activeElement;
            const key = input?.dataset.latexSource;
            if (!key || !scope.contains(input) || !(input.selectionStart < input.selectionEnd)) {
                clear();
                visibleRange = undefined;
                return;
            }
            if (cache?.input !== input || cache.key !== key || cache.value !== input.value) {
                const previews = [...scope.querySelectorAll('[data-latex-preview]')].filter(node => node.dataset.latexPreview === key);
                cache = { input, key, value: input.value, mapping: mapSource(input.value, previews) };
            }
            const { selectionStart: start, selectionEnd: end } = input;
            const selected = selectedParts(cache.mapping, start, end, document);
            activeController?.();
            activeController = clear;
            const ranges = [];
            for (const item of selected) {
                if (item.range) ranges.push(item.range);
                else {
                    item.formula.setAttribute(formulaMark, '');
                    formulas.push(item.formula);
                }
            }
            if (ranges.length && registry && root.Highlight) {
                const highlight = new root.Highlight();
                for (const range of ranges) highlight.add(range);
                registry.set(highlightName, highlight);
            }
            if (visibleRange?.input !== input || visibleRange.start !== start || visibleRange.end !== end) {
                reveal(input.selectionDirection === 'backward' ? selected[0] : selected.at(-1), scope);
                visibleRange = { input, start, end };
            }
        };
        const schedule = () => { if (!frame) frame = root.requestAnimationFrame(update); };
        const observer = new root.MutationObserver(() => { cache = undefined; schedule(); });
        observer.observe(scope, { childList: true, subtree: true, characterData: true, attributes: true,
            attributeFilter: ['data-latex-source', 'data-latex-preview'] });
        for (const event of events) scope.addEventListener(event, schedule);
        const selectionChanged = () => { if (scope.contains(document.activeElement)) schedule(); };
        document.addEventListener('selectionchange', selectionChanged, true);
        controllers.set(scope, () => {
            observer.disconnect();
            root.cancelAnimationFrame(frame);
            for (const event of events) scope.removeEventListener(event, schedule);
            document.removeEventListener('selectionchange', selectionChanged, true);
            clear();
        });
    }

    root.Qisi = root.Qisi || {};
    root.Qisi.LatexSelection = {
        install(app) {
            app.directive('latex-selection', { mounted: mount, beforeUnmount: scope => controllers.get(scope)?.() });
        }
    };
})(globalThis);
