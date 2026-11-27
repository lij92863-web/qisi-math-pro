(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.UiEvents = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const bindClick = (el, handler) => {
        if (el && typeof handler === 'function') {
            el.addEventListener('click', handler);
            return true;
        }
        return false;
    };

    const findVerticalScrollTarget = (element, document) => {
        const dialog = element.closest('dialog, [role="dialog"], [aria-modal="true"]');
        const page = document.scrollingElement;
        for (let node = element; node && node !== page; node = node.parentElement) {
            const overflow = document.defaultView.getComputedStyle(node).overflowY;
            if (/^(auto|scroll|overlay)$/.test(overflow)) {
                const scrollHeight = node.scrollHeight;
                const clientHeight = node.clientHeight;
                if (scrollHeight > clientHeight) return node;
            }
            if (node === dialog) return null;
        }
        return page && page.scrollHeight > page.clientHeight ? page : null;
    };

    const createMiddleButtonScroll = document => {
        const window = document.defaultView;
        const deadZone = 9;
        const indicator = document.createElement('span');
        indicator.className = 'qisi-middle-scroll-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = '↕';
        let gesture = null;
        let handledMiddleDown = false;

        const stop = () => {
            if (!gesture) return;
            window.cancelAnimationFrame(gesture.frame);
            gesture.listeners.abort();
            indicator.remove();
            gesture = null;
        };

        const tick = time => {
            const scroll = gesture;
            if (!scroll.target.isConnected) {
                stop();
                return;
            }
            // Cap the time step after a busy frame so the page cannot jump.
            const elapsed = Math.max(0, Math.min(34, time - scroll.lastTime));
            scroll.lastTime = time;
            scroll.velocity += (scroll.desiredVelocity - scroll.velocity) * (1 - Math.exp(-elapsed / 65));
            if (scroll.desiredVelocity === 0 && Math.abs(scroll.velocity) < 3) {
                scroll.frame = 0;
                scroll.velocity = 0;
                scroll.remainder = 0;
                return;
            }
            scroll.remainder += scroll.velocity * elapsed / 1000;
            const delta = Math.trunc(scroll.remainder);
            if (delta) {
                scroll.target.scrollBy({ top: delta, behavior: 'instant' });
                scroll.remainder -= delta;
            }
            scroll.frame = window.requestAnimationFrame(tick);
        };

        const move = event => {
            const offset = event.clientY - gesture.anchorY;
            const distance = Math.max(0, Math.abs(offset) - deadZone);
            gesture.dragged ||= distance > 0;
            gesture.desiredVelocity = Math.sign(offset) * Math.min(2100, 2 * distance ** 1.22);
            if (!gesture.frame && gesture.desiredVelocity) {
                gesture.lastTime = window.performance.now();
                gesture.frame = window.requestAnimationFrame(tick);
            }
        };

        const release = event => {
            // A click latches scrolling; a deliberate held drag ends on release.
            if (event.button === 1 && gesture.dragged) stop();
        };

        const cancelWithEscape = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            stop();
        };

        const press = event => {
            const middle = event.button === 1;
            if (middle) handledMiddleDown = false;
            if (gesture) {
                stop();
                if (middle) {
                    event.preventDefault();
                    handledMiddleDown = true;
                }
                return;
            }
            const element = event.target;
            if (!middle || !element.closest || element.closest('a[href], area[href], select, input[type="range"]')) return;
            const target = findVerticalScrollTarget(element, document);
            if (!target) return;
            event.preventDefault();
            handledMiddleDown = true;
            const listeners = new window.AbortController();
            gesture = {
                target, anchorY: event.clientY, listeners, dragged: false,
                frame: 0, lastTime: 0, velocity: 0, desiredVelocity: 0, remainder: 0
            };
            indicator.style.left = event.clientX + 'px';
            indicator.style.top = event.clientY + 'px';
            document.body.appendChild(indicator);
            const options = { capture: true, signal: listeners.signal };
            document.addEventListener('mousemove', move, { ...options, passive: true });
            document.addEventListener('mouseup', release, options);
            document.addEventListener('keydown', cancelWithEscape, options);
            document.addEventListener('wheel', stop, { ...options, passive: true });
            document.addEventListener('visibilitychange', stop, options);
            document.documentElement.addEventListener('mouseleave', stop, { signal: listeners.signal });
            window.addEventListener('blur', stop, options);
        };

        const suppressAuxClick = event => {
            if (event.button !== 1 || !handledMiddleDown) return;
            event.preventDefault();
            handledMiddleDown = false;
        };

        document.addEventListener('mousedown', press, true);
        document.addEventListener('auxclick', suppressAuxClick, true);
        const dispose = () => {
            stop();
            document.removeEventListener('mousedown', press, true);
            document.removeEventListener('auxclick', suppressAuxClick, true);
        };
        return { stop, dispose };
    };

    const buildQuestionNumberGapWarning = (items = []) => {
        const numbers = [
            ...new Set(
                (items || [])
                    .map(item => Number(String(item.questionNumber || '').match(/\d+/)?.[0]))
                    .filter(Number.isFinite)
            )
        ].sort((a, b) => a - b);

        if (numbers.length < 2) return '';

        const gaps = [];

        for (let index = 1; index < numbers.length; index += 1) {
            const previous = numbers[index - 1];
            const current = numbers[index];

            for (let value = previous + 1; value < current; value += 1) {
                gaps.push(value);
            }
        }

        return gaps.length
            ? `原文件题号不连续，未识别到题号：${gaps.join('、')}。系统未自动补题，请核对原文件。`
            : '';
    };

    const createKnowledgeCounter = (tree, type, getQuestionKnowledge, { byId = false, counts = Object.create(null) } = {}) => {
        const addCount = (name, weight) => {
            const count = (Object.hasOwn(counts, name) ? counts[name] : 0) + weight;
            if (count) counts[name] = count;
            else delete counts[name];
        };
        const parentMap = new Map();
        const pathsById = new Map();
        const visit = (nodes, parents = []) => {
            for (const node of nodes || []) {
                const path = [byId ? node.id : node.name, ...parents];
                if (!parentMap.has(node.name)) parentMap.set(node.name, path);
                if (node.id) pathsById.set(node.id, path);
                visit(node.children, path);
            }
        };
        visit(tree);

        const adjust = (q, count = 1) => {
            const references = q?.personalKnowledgeIds ?? q?.meta?.personalKnowledgeIds;
            if (type === 'personal' && Array.isArray(references)) {
                new Set(references.flatMap(id => pathsById.get(id) || [])).forEach(name => addCount(name, count));
                return;
            }
            const name = getQuestionKnowledge?.(q, type);
            if (name) new Set(parentMap.get(name) || (byId ? [] : [name])).forEach(key => addCount(key, count));
        };
        return { counts, adjust };
    };
    const buildKnowledgeCounts = (tree, type, questions = [], getQuestionKnowledge, options) => {
        if (typeof getQuestionKnowledge !== 'function') return {};
        const counter = createKnowledgeCounter(tree, type, getQuestionKnowledge, options);
        for (const question of questions || []) counter.adjust(question);
        return { ...counter.counts };
    };

    return {
        bindClick,
        createMiddleButtonScroll,
        buildQuestionNumberGapWarning,
        buildKnowledgeCounts, createKnowledgeCounter
    };
});
