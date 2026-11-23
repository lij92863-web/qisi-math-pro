(function (root) {
    'use strict';

    const policy = root.Qisi.QuestionImagePolicy;
    const figureSelector = '[data-image-id], [data-figure]';
    const corners = [['nw', '左上'], ['ne', '右上'], ['sw', '左下'], ['se', '右下']];
    const alignments = [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']];
    const clamp = (value, min, max) => Math.min(Math.max(min, max), Math.max(min, value));
    const figureId = node => node?.dataset.imageId || node?.dataset.figure || '';
    const imageNodes = surface => [...surface.querySelectorAll('img')].filter(img => figureId(img.closest(figureSelector)));

    function flowHost(figure, surface) {
        const question = figure.closest('[data-qisi-question-flow], .hc-kind-question > .hc-block-body');
        const support = figure.closest('.hc-support, .qisi-question-support');
        const option = figure.closest('.hc-option, .gaokao-option');
        const body = figure.closest('.hc-block-body');
        return support || question || figure.closest('.qisi-image-flow-host, .hc-stem, .math-content') || option?.lastElementChild ||
            body?.querySelector('.hc-stem') || body || surface;
    }

    function flowBounds(host) {
        const rect = host.getBoundingClientRect();
        const style = getComputedStyle(host);
        const left = parseFloat(style.paddingLeft);
        const scale = Number(host.closest('[data-paper-scale]')?.dataset.paperScale) || 1;
        return {
            scale, left: rect.left + (host.clientLeft + left) * scale,
            top: rect.top + (host.clientTop + parseFloat(style.paddingTop)) * scale,
            width: host.clientWidth - left - parseFloat(style.paddingRight),
            height: host.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        };
    }

    // Only complete, top-level blocks can own a following picture. A split
    // fragment that lacks the recorded block uses its original flow position.
    function flowBlocks(host) {
        return [...host.children].flatMap(child => {
            if (!child.matches('.hc-figure-row')) return [child];
            // Side-figure rows cease to be columns once their last fixed image
            // has moved away (or is hidden while dragging).
            const visible = [...child.children].filter(node => !node.matches('.qisi-figure-drag-source'));
            return visible.length === 1 && visible[0].matches('.hc-figure-main') ? [...visible[0].children] : [child];
        });
    }

    function figureAnchors(host) {
        const blocks = flowBlocks(host);
        return [
            ['options', blocks.find(node => node.matches('.hc-options, .gaokao-options, .hc-figure-row:has(.hc-options)'))],
            ['stem', blocks.findLast(node => node.matches('.hc-stem, [data-question-stem], .hc-figure-row:has(.hc-stem):not(:has(.hc-options))'))]
        ].filter(([, node]) => node);
    }

    function attachAfter(figure, anchor, gap) {
        anchor.after(figure);
        figure.classList.add('qisi-flow-anchored');
        figure.style.setProperty('--qisi-image-y', gap + 'px');
        const options = figure.nextElementSibling;
        if (options?.matches('.hc-options, .gaokao-options') && !figure.classList.contains('qisi-flow-stacked')) {
            figure.classList.add('qisi-flow-beside-options');
            options.style.setProperty('--qisi-options-image-gap', gap + 'px');
        }
    }

    function estimateAutoColumns(node, scale = 1, live = false) {
        const groups = [...node.querySelectorAll(live ? '[data-auto-options]' : '[data-options="auto"]')];
        const rooms = groups.map(options => live ? options.parentElement.clientWidth : options.clientWidth);
        const figureWidths = groups.map(options => {
            const preceding = options.previousElementSibling;
            if (preceding?.matches('.qisi-flow-beside-options')) return preceding.offsetWidth;
            const figure = options.parentElement.querySelector(':scope > .qisi-flow-image:not(.qisi-flow-anchored, .qisi-flow-stacked, .qisi-figure-drag-source)');
            if (!figure || !preceding) return 0;
            const top = preceding.getBoundingClientRect().bottom + parseFloat(getComputedStyle(options).marginTop) * scale;
            const pictureTop = figure.firstElementChild.getBoundingClientRect().top;
            return top >= pictureTop && top < figure.getBoundingClientRect().bottom ? figure.offsetWidth : 0;
        });
        const measureClass = live ? 'qisi-options-measure' : 'hc-options-measure';
        groups.forEach(options => options.classList.add(measureClass));
        const measurements = groups.map(options => [...options.children].map(option => option.getBoundingClientRect().width / scale));
        groups.forEach((options, index) => {
            const widths = measurements[index];
            const widest = Math.max(...widths);
            const beside = rooms[index] - figureWidths[index];
            const room = widest <= beside ? beside : rooms[index];
            options.classList.remove(measureClass);
            const fits = count => widths.length <= count ? widest * count + (count - 1) * 14 <= room :
                widths.every((_, i) => i % count !== 0 || Math.max(...widths.slice(i, i + count)) * count + (count - 1) * 14 <= room);
            const columns = fits(4) ? '4' : fits(2) ? '2' : '1';
            if (options.dataset.options !== columns) options.dataset.options = columns;
            if (live) options.style.setProperty('--qisi-option-width', room + 'px');
        });
    }

    function dropAnchor(host, picture, scale, paperOnly = false) {
        const rect = picture.getBoundingClientRect();
        let preceding, bottom = -Infinity;
        for (const child of flowBlocks(host)) {
            if (child.contains(picture) || child.matches('.qisi-figure-drag-source') ||
                (paperOnly && child.hasAttribute('data-preview-only'))) continue;
            const box = (child.querySelector(':scope > .qisi-flow-picture') || child).getBoundingClientRect();
            if (!box.height) continue;
            // Overlapping vertical intervals mean the content may wrap beside the picture.
            if (box.bottom > rect.top && box.top < rect.bottom) return { anchor: 'origin' };
            if (box.bottom <= rect.top && box.bottom > bottom) {
                preceding = child;
                bottom = box.bottom;
            }
        }
        const match = figureAnchors(host).find(([, node]) => node === preceding);
        return match ? { anchor: match[0], gap: (rect.top - bottom) / scale } : { anchor: 'origin' };
    }

    function compactLegacyFigures(root, scale = 1) {
        for (const figure of root.querySelectorAll('figure[data-legacy-position]')) {
            const host = figure.parentElement;
            const options = figureAnchors(host).find(([key]) => key === 'options')?.[1];
            if (!options || host.querySelectorAll(':scope > .qisi-flow-image').length !== 1) continue;
            const placement = dropAnchor(host, figure.firstElementChild, scale, true);
            const line = parseFloat(getComputedStyle(options).lineHeight);
            if (placement.anchor !== 'options' || !(placement.gap > line)) continue;
            attachAfter(figure, options, Math.min(12, line / 2));
            delete figure.dataset.legacyPosition;
        }
    }

    function buildFigure(source, id) {
        const figure = document.createElement('figure');
        figure.dataset.imageId = id;
        const image = source.cloneNode();
        image.removeAttribute('style');
        image.removeAttribute('width');
        image.removeAttribute('height');
        image.draggable = false;
        const picture = document.createElement('div');
        picture.className = 'qisi-flow-picture';
        picture.append(image, document.createElement('figcaption'));
        figure.append(picture);
        return figure;
    }

    function placeFigure(figure, layout, host) {
        const picture = figure.firstElementChild;
        const image = picture.firstElementChild;
        const caption = picture.lastElementChild;
        const side = layout.x < .5 ? 'qisi-flow-left' : 'qisi-flow-right';
        // Reserve a full row only near the center. An off-center figure leaves
        // the larger side available to both stem lines and choices.
        const centered = host.hasAttribute?.('data-qisi-question-flow')
            ? Math.abs(layout.x - .5) <= .035 : layout.x > .22 && layout.x < .78;
        const className = 'qisi-flow-image ' + side + (centered ? ' qisi-flow-stacked' : '');
        if (figure.className !== className) figure.className = className;
        figure.style.setProperty('--qisi-image-width', layout.width + 'px');
        figure.style.setProperty('--qisi-image-x', layout.x);
        figure.style.setProperty('--qisi-image-y', layout.y + 'px');
        image.style.aspectRatio = layout.height ? layout.width + ' / ' + layout.height : 'auto';
        const alt = layout.caption || '配图';
        if (image.alt !== alt) image.alt = alt;
        if (caption.textContent !== layout.caption) caption.textContent = layout.caption;
        caption.hidden = !layout.caption;
    }

    function layoutHtml(html, references) {
        const layoutById = new Map();
        for (const ref of references || []) {
            const layout = policy.normalizeLayout(ref?.layout);
            if (!layout) continue;
            for (const name of [ref.id, ref.filename, ref.name]) {
                if (name && !layoutById.has(String(name))) layoutById.set(String(name), layout);
            }
        }
        if (!layoutById.size || !html.includes('<img')) return html;
        const tree = document.createElement('template');
        tree.innerHTML = html;
        let rootHost;
        for (const image of imageNodes(tree.content).reverse()) {
            const original = image.closest(figureSelector);
            const id = figureId(original);
            const layout = layoutById.get(id);
            if (!layout) continue;
            let host = flowHost(original, tree.content);
            if (host === tree.content) {
                if (!rootHost) {
                    rootHost = document.createElement('div');
                    rootHost.append(...tree.content.childNodes);
                    tree.content.append(rootHost);
                }
                host = rootHost;
            }
            const next = buildFigure(image, id);
            placeFigure(next, layout, host);
            const sideRow = original.parentElement?.closest('.hc-figure-row');
            original.remove();
            if (sideRow?.childElementCount === 1 && sideRow.firstElementChild.matches('.hc-figure-main')) {
                sideRow.replaceWith(...sideRow.firstElementChild.childNodes);
            }
            host.classList?.add('qisi-image-flow-host');
            const anchor = figureAnchors(host).find(([key]) => key === layout.anchor);
            if (anchor) attachAfter(next, anchor[1], layout.gap);
            else {
                host.prepend(next);
                if (!layout.anchor) next.dataset.legacyPosition = '';
            }
        }
        return tree.innerHTML;
    }

    function resizeBox(box, corner, dx, dy, preserveRatio, width, height) {
        const west = corner.endsWith('w');
        const north = corner.startsWith('n');
        const maxWidth = west ? box.x + box.width : width - box.x;
        const maxHeight = north ? box.y + box.height : height - box.y;
        let nextWidth = box.width + dx * (west ? -1 : 1);
        let nextHeight = box.height + dy * (north ? -1 : 1);
        if (preserveRatio) {
            const kx = nextWidth / box.width;
            const ky = nextHeight / box.height;
            const scale = clamp(Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky,
                Math.max(24 / box.width, 24 / box.height), Math.min(maxWidth / box.width, maxHeight / box.height));
            nextWidth = box.width * scale;
            nextHeight = box.height * scale;
        } else {
            nextWidth = clamp(nextWidth, 24, maxWidth);
            nextHeight = clamp(nextHeight, 24, maxHeight);
        }
        return {
            x: box.x + (west ? box.width - nextWidth : 0), y: box.y + (north ? box.height - nextHeight : 0),
            width: nextWidth, height: nextHeight
        };
    }

    const component = {
        props: { images: { type: Array, default: () => [] }, disabled: Boolean, removable: Boolean },
        emits: ['layout', 'remove'],
        data: () => ({ visibleIds: [], selection: '', corners, alignments }),
        computed: {
            activeId() { return this.visibleIds.includes(this.selection) ? this.selection : this.visibleIds[0]; },
            activeLayout() {
                return policy.normalizeLayout(this.reference(this.activeId)?.layout);
            },
            activeAlignment() {
                const x = this.activeLayout?.x;
                return x == null || x === .5 ? 'center' : x === 0 ? 'left' : x === 1 ? 'right' : 'free';
            }
        },
        mounted() {
            this._contentObserver = new MutationObserver(() => this.scheduleSync());
            this._contentObserver.observe(this.$refs.surface, { childList: true, subtree: true });
            this._sizeObserver = new ResizeObserver(() => this.scheduleSync());
            this._sizeObserver.observe(this.$refs.surface);
            this.scheduleSync();
        },
        activated() { this.scheduleSync(); },
        deactivated() { this._endGesture?.(); },
        beforeUnmount() {
            this._endGesture?.();
            cancelAnimationFrame(this._syncFrame || 0);
            this._contentObserver?.disconnect();
            this._sizeObserver?.disconnect();
        },
        watch: {
            disabled() { this.scheduleSync(); }
        },
        methods: {
            reference(id) {
                return this.images.find(row => [row.id, row.filename, row.name].some(value => value && String(value) === id));
            },
            image(id) {
                return imageNodes(this.$refs.surface).find(img => figureId(img.closest(figureSelector)) === id);
            },
            scheduleSync() {
                if (this._syncFrame || this._endGesture || !this.$refs.surface) return;
                this._syncFrame = requestAnimationFrame(() => {
                    this._syncFrame = 0;
                    if (this._endGesture || !this.$refs.surface) return;
                    const surface = this.$refs.surface;
                    estimateAutoColumns(surface, Number(surface.closest('[data-paper-scale]')?.dataset.paperScale) || 1, true);
                    const nodes = imageNodes(this.$refs.surface).filter(img => img.getClientRects().length);
                    for (const img of nodes) {
                        img.draggable = false;
                        if (!this.disabled) img.tabIndex = 0;
                        else img.removeAttribute('tabindex');
                    }
                    const ids = this.disabled ? [] : [...new Set(nodes.map(img => figureId(img.closest(figureSelector))))];
                    if (ids.join('\0') !== this.visibleIds.join('\0')) this.visibleIds = ids;
                    if (!ids.includes(this.selection)) this.selection = '';
                    this.outline(this.selection ? this.image(this.selection) : null);
                });
            },
            outline(image) {
                const element = this.$refs.outline;
                element.hidden = !image;
                if (!image) return;
                const surface = this.$refs.surface;
                const imageRect = image.getBoundingClientRect();
                const origin = surface.getBoundingClientRect();
                const x = imageRect.left - origin.left + surface.scrollLeft - surface.clientLeft;
                const y = imageRect.top - origin.top + surface.scrollTop - surface.clientTop;
                element.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
                element.style.width = imageRect.width + 'px';
                element.style.height = imageRect.height + 'px';
            },
            select(id) {
                this.selection = id;
                this.scheduleSync();
            },
            keyboardSelect(event) {
                const image = event.target.closest('img');
                const id = figureId(image?.closest(figureSelector)) || (event.target === this.$refs.surface ? this.selection : '');
                if (this.removable && !this.disabled && id && ['Backspace', 'Delete'].includes(event.key) &&
                    !event.ctrlKey && !event.metaKey && !event.altKey) {
                    event.preventDefault();
                    this.$emit('remove', this.reference(id)?.id || id);
                    return;
                }
                if (this.disabled || !id || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                this.select(id);
            },
            emitLayout(id, layout, image) {
                this.$emit('layout', this.reference(id)?.id || id, policy.normalizeLayout(layout),
                    image?.closest('[data-image-region]')?.dataset.imageRegion || 'stem');
            },
            configure(field, value) {
                const id = this.activeId;
                const image = this.image(id);
                if (!image) return;
                const rect = image.getBoundingClientRect();
                const host = flowHost(image.closest(figureSelector), this.$refs.surface);
                const bounds = flowBounds(host);
                const width = rect.width / bounds.scale;
                const x = clamp((rect.left - bounds.left) / bounds.scale / Math.max(1, bounds.width - width), 0, 1);
                const layout = { width, x, y: Math.max(0, (rect.top - bounds.top) / bounds.scale), ...this.activeLayout };
                if (!layout.anchor) Object.assign(layout, dropAnchor(host, image, bounds.scale));
                if (field === 'align') layout.x = { left: 0, center: .5, right: 1 }[value];
                else layout.caption = value;
                this.emitLayout(id, layout, image);
            },
            start(event) {
                if (event.button !== 0 || this.disabled || this._endGesture) return;
                const corner = event.target.closest('[data-corner]')?.dataset.corner;
                const image = corner ? this.image(this.selection) : event.target.closest('img');
                const original = image?.closest(figureSelector);
                const id = figureId(original);
                if (!id) {
                    this.select('');
                    return;
                }
                const surface = this.$refs.surface;
                const host = flowHost(original, surface);
                const bounds = flowBounds(host);
                const rect = image.getBoundingClientRect();
                if (!rect.width || !rect.height || !bounds.width) return;
                event.preventDefault();
                this.selection = id;
                image.focus({ preventScroll: true });
                this.outline(image);
                surface.setPointerCapture(event.pointerId);

                const width = bounds.width;
                const ground = surface.getBoundingClientRect();
                const scale = bounds.scale;
                const box = { x: (rect.left - bounds.left) / scale, y: Math.max(0, (rect.top - bounds.top) / scale),
                    width: rect.width / scale, height: rect.height / scale };
                const height = Math.max(box.y + box.height + (corner ? 300 : 120), bounds.height, (ground.bottom - bounds.top) / scale);
                const startScroll = surface.scrollTop;
                const caption = this.activeLayout?.caption ?? original.querySelector('figcaption, .hc-inline-caption')?.textContent ?? '';
                const hadFlowHost = host.classList.contains('qisi-image-flow-host');
                let last = event, frame = 0, working, layout;
                const paint = () => {
                    frame = 0;
                    const dx = (last.clientX - event.clientX) / scale;
                    const dy = (last.clientY - event.clientY + surface.scrollTop - startScroll) / scale;
                    if (!working && Math.hypot(dx, dy) * scale < 4) return;
                    if (!working) {
                        // Reuse the rendered text and formulas throughout the gesture.
                        working = buildFigure(image, id);
                        original.classList.add('qisi-figure-drag-source');
                        host.classList.add('qisi-image-flow-host');
                        host.prepend(working);
                    }
                    const next = corner ? resizeBox(box, corner, dx, dy, last.shiftKey, width, height) : {
                        ...box, x: clamp(box.x + dx, 0, width - box.width), y: clamp(box.y + dy, 0, height - box.height)
                    };
                    layout = {
                        width: next.width, height: corner ? next.height : this.activeLayout?.height,
                        x: clamp(next.x / Math.max(1, width - next.width), 0, 1), y: next.y, caption
                    };
                    placeFigure(working, layout, host);
                    estimateAutoColumns(host, scale, true);
                    this.outline(working.firstElementChild.firstElementChild);
                };
                const onMove = pointer => {
                    if (pointer.pointerId !== event.pointerId) return;
                    last = pointer;
                    if (!frame) frame = requestAnimationFrame(paint);
                };
                const onScroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
                const finish = pointer => {
                    if (pointer && pointer.pointerId !== event.pointerId) return;
                    this._endGesture = null;
                    cancelAnimationFrame(frame);
                    if (pointer?.type === 'pointerup') {
                        last = pointer;
                        paint();
                    }
                    surface.removeEventListener('pointermove', onMove);
                    surface.removeEventListener('pointerup', finish);
                    surface.removeEventListener('pointercancel', finish);
                    surface.removeEventListener('lostpointercapture', finish);
                    surface.removeEventListener('scroll', onScroll);
                    if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
                    if (working) {
                        if (pointer?.type === 'pointerup') Object.assign(layout, dropAnchor(host, working.firstElementChild, scale));
                        original.classList.remove('qisi-figure-drag-source');
                        working.remove();
                        if (!hadFlowHost) host.classList.remove('qisi-image-flow-host');
                        if (pointer?.type === 'pointerup') {
                            this.emitLayout(id, layout, image);
                            surface.focus({ preventScroll: true });
                        }
                    }
                    this.scheduleSync();
                };
                this._endGesture = finish;
                surface.addEventListener('pointermove', onMove);
                surface.addEventListener('pointerup', finish);
                surface.addEventListener('pointercancel', finish);
                surface.addEventListener('lostpointercapture', finish);
                surface.addEventListener('scroll', onScroll, { passive: true });
            }
        },
        template: `<div class="qisi-figure-editor" :class="{'qisi-figure-readonly':disabled}">
            <div class="qisi-figure-surface" ref="surface" tabindex="-1" @pointerdown="start" @dragstart.prevent @keydown="keyboardSelect" @load.capture="scheduleSync">
                <slot></slot>
                <div ref="outline" class="qisi-figure-outline" hidden>
                    <button v-for="[corner,name] in corners" :key="corner" type="button" :data-corner="corner" :aria-label="name+'缩放角'" tabindex="-1"></button>
                </div>
            </div>
            <div v-if="activeId" class="qisi-figure-dock" aria-label="配图设置">
                <label v-if="visibleIds.length>1"><span>配图</span><select :value="activeId" @change="select($event.target.value)"><option v-for="(id,index) in visibleIds" :key="id" :value="id">配图 {{index+1}}</option></select></label>
                <label><span>图片对齐</span><select :value="activeAlignment" @change="configure('align',$event.target.value)">
                    <option v-if="activeAlignment==='free'" value="free" disabled>自由位置</option>
                    <option v-for="[value,name] in alignments" :key="value" :value="value">{{name}}</option>
                </select></label>
                <label><span>图标题</span><input :value="activeLayout?.caption||''" @input="configure('caption',$event.target.value)" maxlength="120" placeholder="输入图标题"></label>
            </div>
        </div>`
    };

    root.Qisi.FigureEditor = Object.freeze({
        layoutHtml, compactLegacyFigures, estimateAutoColumns,
        install(app) { app.component('FigurePreview', component); }
    });
})(globalThis);
