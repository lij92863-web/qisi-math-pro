/* Resizable three-pane review layout.
   Widths are stored per browser; the grid itself stays a CSS grid so the
   existing responsive rules still apply below 1100px. */
(function initReviewPaneLayout() {
    'use strict';

    var STORAGE_KEY = 'qisi_review_panes_v1';
    var MIN_NAV = 170;
    var MIN_PREVIEW = 280;
    var MIN_CENTER = 420;

    function readState() {
        try {
            var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return {
                nav: Number(raw.nav) || 0,
                preview: Number(raw.preview) || 0
            };
        } catch (error) {
            return { nav: 0, preview: 0 };
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            /* private mode: layout still works for this page */
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function attach() {
        var grid = document.querySelector('.batch-review-grid');
        if (!grid || grid.dataset.paneLayout === '1') return;
        if (!grid.querySelector('.batch-question-nav') || !grid.querySelector('.batch-editor')) return;

        grid.dataset.paneLayout = '1';
        grid.classList.add('qisi-pane-layout');

        var leftHandle = document.createElement('div');
        leftHandle.className = 'qisi-pane-handle';
        leftHandle.title = '拖动调整题目列表宽度';
        var rightHandle = document.createElement('div');
        rightHandle.className = 'qisi-pane-handle';
        rightHandle.title = '拖动调整预览宽度';
        grid.appendChild(leftHandle);
        grid.appendChild(rightHandle);

        var state = readState();

        function geometry() {
            var nav = grid.querySelector('.batch-question-nav');
            var preview = grid.querySelector('.batch-preview-panel');
            var navWidth = nav ? nav.getBoundingClientRect().width : 208;
            var previewWidth = preview ? preview.getBoundingClientRect().width : 380;
            return { navWidth: navWidth, previewWidth: previewWidth, total: grid.getBoundingClientRect().width };
        }

        function render(navWidth, previewWidth) {
            if (window.innerWidth <= 1100) {
                grid.style.gridTemplateColumns = '';
                leftHandle.style.display = 'none';
                rightHandle.style.display = 'none';
                return;
            }
            leftHandle.style.display = '';
            rightHandle.style.display = '';
            grid.style.gridTemplateColumns =
                navWidth + 'px minmax(0, 1fr) ' + previewWidth + 'px';
            leftHandle.style.left = (navWidth - 4) + 'px';
            rightHandle.style.right = (previewWidth - 4) + 'px';
        }

        function current() {
            var g = geometry();
            var navWidth = state.nav || g.navWidth;
            var previewWidth = state.preview || g.previewWidth;
            var maxNav = Math.max(MIN_NAV, g.total - previewWidth - MIN_CENTER);
            navWidth = clamp(navWidth, MIN_NAV, maxNav);
            previewWidth = clamp(previewWidth, MIN_PREVIEW, Math.max(MIN_PREVIEW, g.total - navWidth - MIN_CENTER));
            return { navWidth: navWidth, previewWidth: previewWidth };
        }

        function apply() {
            var values = current();
            render(values.navWidth, values.previewWidth);
        }

        var drag = null;
        function onDown(side) {
            return function (event) {
                event.preventDefault();
                var g = geometry();
                drag = {
                    side: side,
                    startX: event.clientX,
                    navWidth: g.navWidth,
                    previewWidth: g.previewWidth,
                    total: g.total
                };
                document.body.classList.add('qisi-pane-dragging');
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp, { once: true });
            };
        }

        function onMove(event) {
            if (!drag) return;
            var dx = event.clientX - drag.startX;
            var navWidth = drag.navWidth;
            var previewWidth = drag.previewWidth;
            if (drag.side === 'left') {
                var maxNav = Math.max(MIN_NAV, drag.total - previewWidth - MIN_CENTER);
                navWidth = clamp(drag.navWidth + dx, MIN_NAV, maxNav);
            } else {
                var maxPreview = Math.max(MIN_PREVIEW, drag.total - navWidth - MIN_CENTER);
                previewWidth = clamp(drag.previewWidth - dx, MIN_PREVIEW, maxPreview);
            }
            render(navWidth, previewWidth);
            state.nav = navWidth;
            state.preview = previewWidth;
        }

        function onUp() {
            drag = null;
            document.body.classList.remove('qisi-pane-dragging');
            window.removeEventListener('mousemove', onMove);
            saveState(state);
        }

        leftHandle.addEventListener('mousedown', onDown('left'));
        rightHandle.addEventListener('mousedown', onDown('right'));
        window.addEventListener('resize', apply);
        apply();
    }

    window.addEventListener('load', function () {
        window.setTimeout(attach, 250);
    });
    new MutationObserver(function () {
        attach();
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
