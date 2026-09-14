(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutImageInteraction = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const HANDLE_DIRECTIONS = Object.freeze({
            'north-west': Object.freeze({ x: -1, y: -1 }),
            'north-east': Object.freeze({ x: 1, y: -1 }),
            'south-east': Object.freeze({ x: 1, y: 1 }),
            'south-west': Object.freeze({ x: -1, y: 1 })
        });
        const DROP_TARGETS = Object.freeze({
            'below-left': Object.freeze({
                placement: 'below-stem',
                alignment: 'left'
            }),
            'below-center': Object.freeze({
                placement: 'below-stem',
                alignment: 'center'
            }),
            'below-right': Object.freeze({
                placement: 'below-stem',
                alignment: 'right'
            }),
            'stem-right': Object.freeze({
                placement: 'right-of-stem',
                alignment: 'center'
            }),
            'options-right': Object.freeze({
                placement: 'right-of-options',
                alignment: 'center'
            }),
            'block-left': Object.freeze({
                placement: 'block',
                alignment: 'left'
            }),
            'block-center': Object.freeze({
                placement: 'block',
                alignment: 'center'
            }),
            'block-right': Object.freeze({
                placement: 'block',
                alignment: 'right'
            }),
            inline: Object.freeze({
                placement: 'inline',
                alignment: 'inline'
            })
        });

        const finite = (value, label) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) {
                throw new TypeError(`${label} must be finite`);
            }
            return numeric;
        };

        const clamp = (value, minimum, maximum) =>
            Math.min(maximum, Math.max(minimum, value));

        const createResizeSession = ({
            handle,
            pointerX,
            pointerY,
            renderedWidthPx,
            renderedHeightPx,
            availableWidthPx,
            availableWidthMm,
            widthValue,
            widthUnit = 'percent',
            minimumPercent = 8,
            maximumPercent = 100
        }) => {
            const direction = HANDLE_DIRECTIONS[handle];
            if (!direction) {
                throw new RangeError(`unsupported resize handle: ${handle}`);
            }
            const widthPx = finite(
                renderedWidthPx,
                'rendered image width'
            );
            const heightPx = finite(
                renderedHeightPx,
                'rendered image height'
            );
            const containerWidthPx = finite(
                availableWidthPx,
                'available width'
            );
            const containerWidthMm = finite(
                availableWidthMm,
                'available width in millimetres'
            );
            if (
                widthPx <= 0
                || heightPx <= 0
                || containerWidthPx <= 0
                || containerWidthMm <= 0
            ) {
                throw new RangeError(
                    'resize geometry must use positive dimensions'
                );
            }
            if (!['mm', 'percent'].includes(widthUnit)) {
                throw new RangeError(`unsupported width unit: ${widthUnit}`);
            }

            const minPercent = clamp(
                finite(minimumPercent, 'minimum percent'),
                1,
                100
            );
            const maxPercent = clamp(
                finite(maximumPercent, 'maximum percent'),
                minPercent,
                100
            );
            const persistedWidthValue = Number(widthValue);
            const millimetresPerPixel =
                widthUnit === 'mm'
                && Number.isFinite(persistedWidthValue)
                && persistedWidthValue > 0
                    ? persistedWidthValue / widthPx
                    : containerWidthMm / containerWidthPx;
            const minimumWidthPx = widthUnit === 'mm'
                ? (
                    containerWidthMm
                    * minPercent / 100
                    / millimetresPerPixel
                )
                : containerWidthPx * minPercent / 100;
            const maximumWidthPx = widthUnit === 'mm'
                ? Math.min(
                    containerWidthPx,
                    containerWidthMm
                    * maxPercent / 100
                    / millimetresPerPixel
                )
                : containerWidthPx * maxPercent / 100;

            return Object.freeze({
                handle,
                direction,
                startX: finite(pointerX, 'pointer x'),
                startY: finite(pointerY, 'pointer y'),
                startWidthPx: widthPx,
                aspectRatio: widthPx / heightPx,
                availableWidthPx: containerWidthPx,
                availableWidthMm: containerWidthMm,
                millimetresPerPixel,
                widthUnit,
                minimumWidthPx,
                maximumWidthPx
            });
        };

        const projectResize = (
            session,
            {
                pointerX,
                pointerY
            }
        ) => {
            if (!session?.direction) {
                throw new TypeError('resize session is required');
            }
            const dx = finite(pointerX, 'pointer x') - session.startX;
            const dy = finite(pointerY, 'pointer y') - session.startY;
            const vectorX = session.direction.x;
            const vectorY =
                session.direction.y / session.aspectRatio;
            const projectedWidthDelta =
                (
                    dx * vectorX
                    + dy * vectorY
                )
                / (
                    vectorX * vectorX
                    + vectorY * vectorY
                );
            const widthPx = clamp(
                session.startWidthPx + projectedWidthDelta,
                session.minimumWidthPx,
                session.maximumWidthPx
            );
            const widthPercent =
                widthPx / session.availableWidthPx * 100;
            const widthMm =
                widthPx * session.millimetresPerPixel;

            return Object.freeze({
                widthPx,
                heightPx: widthPx / session.aspectRatio,
                widthPercent,
                widthMm,
                persistedWidth: Object.freeze({
                    unit: session.widthUnit,
                    value: Number(
                        (
                            session.widthUnit === 'mm'
                                ? widthMm
                                : widthPercent
                        ).toFixed(2)
                    )
                })
            });
        };

        const resolveDropTarget = value => {
            const key = String(value || '').trim();
            const target = DROP_TARGETS[key];
            if (!target) return null;
            return {
                key,
                placement: target.placement,
                alignment: target.alignment
            };
        };

        const createFrameThrottler = ({
            requestFrame,
            cancelFrame,
            render
        }) => {
            if (
                typeof requestFrame !== 'function'
                || typeof cancelFrame !== 'function'
                || typeof render !== 'function'
            ) {
                throw new TypeError(
                    'frame throttler requires frame and render functions'
                );
            }
            let frameId = 0;
            let pendingValue;

            const flush = () => {
                frameId = 0;
                const value = pendingValue;
                pendingValue = undefined;
                render(value);
            };

            return Object.freeze({
                push(value) {
                    pendingValue = value;
                    if (!frameId) {
                        frameId = requestFrame(flush);
                    }
                },
                cancel() {
                    if (frameId) cancelFrame(frameId);
                    frameId = 0;
                    pendingValue = undefined;
                },
                flush
            });
        };

        return Object.freeze({
            HANDLE_DIRECTIONS,
            DROP_TARGETS,
            createResizeSession,
            projectResize,
            resolveDropTarget,
            createFrameThrottler
        });
    }
);
