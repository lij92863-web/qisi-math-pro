'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const imageInteraction = require(
    '../qisi-handout-image-interaction.js'
);

test('H9 corner resize preserves aspect ratio and persists percentage', () => {
    const session = imageInteraction.createResizeSession({
        handle: 'south-east',
        pointerX: 100,
        pointerY: 100,
        renderedWidthPx: 200,
        renderedHeightPx: 100,
        availableWidthPx: 800,
        availableWidthMm: 160,
        widthUnit: 'percent'
    });
    const result = imageInteraction.projectResize(session, {
        pointerX: 180,
        pointerY: 140
    });

    assert.equal(result.widthPx, 280);
    assert.equal(result.heightPx, 140);
    assert.equal(result.persistedWidth.unit, 'percent');
    assert.equal(result.persistedWidth.value, 35);
});

test('H9 every corner grows along its outward diagonal', () => {
    const cases = [
        ['north-west', 50, 50],
        ['north-east', 150, 50],
        ['south-east', 150, 150],
        ['south-west', 50, 150]
    ];

    for (const [handle, pointerX, pointerY] of cases) {
        const session = imageInteraction.createResizeSession({
            handle,
            pointerX: 100,
            pointerY: 100,
            renderedWidthPx: 100,
            renderedHeightPx: 100,
            availableWidthPx: 500,
            availableWidthMm: 150,
            widthUnit: 'mm'
        });
        const result = imageInteraction.projectResize(session, {
            pointerX,
            pointerY
        });
        assert.equal(result.widthPx, 150);
        assert.equal(result.heightPx, 150);
        assert.equal(result.persistedWidth.value, 45);
    }
});

test('H9 millimetre resize keeps the current rendered scale stable', () => {
    const session = imageInteraction.createResizeSession({
        handle: 'south-east',
        pointerX: 100,
        pointerY: 100,
        renderedWidthPx: 105,
        renderedHeightPx: 70,
        availableWidthPx: 1200,
        availableWidthMm: 170,
        widthValue: 28,
        widthUnit: 'mm'
    });
    const result = imageInteraction.projectResize(session, {
        pointerX: 145,
        pointerY: 130
    });

    assert.ok(result.persistedWidth.value > 28);
    assert.equal(result.persistedWidth.unit, 'mm');
});

test('H9 resize clamps to structured usable-width limits', () => {
    const session = imageInteraction.createResizeSession({
        handle: 'south-east',
        pointerX: 0,
        pointerY: 0,
        renderedWidthPx: 200,
        renderedHeightPx: 100,
        availableWidthPx: 800,
        availableWidthMm: 160,
        widthUnit: 'percent',
        minimumPercent: 10,
        maximumPercent: 90
    });
    const tooSmall = imageInteraction.projectResize(session, {
        pointerX: -1000,
        pointerY: -1000
    });
    const tooLarge = imageInteraction.projectResize(session, {
        pointerX: 2000,
        pointerY: 2000
    });

    assert.equal(tooSmall.persistedWidth.value, 10);
    assert.equal(tooLarge.persistedWidth.value, 90);
});

test('H9 drop targets resolve only to allowlisted structured layouts', () => {
    assert.deepEqual(
        imageInteraction.resolveDropTarget('stem-right'),
        {
            key: 'stem-right',
            placement: 'right-of-stem',
            alignment: 'center'
        }
    );
    assert.deepEqual(
        imageInteraction.resolveDropTarget('below-left'),
        {
            key: 'below-left',
            placement: 'below-stem',
            alignment: 'left'
        }
    );
    assert.equal(
        imageInteraction.resolveDropTarget('x=193;y=441'),
        null
    );
});

test('H9 animation throttler coalesces pointer events into one frame', () => {
    const callbacks = [];
    const rendered = [];
    const throttler = imageInteraction.createFrameThrottler({
        requestFrame(callback) {
            callbacks.push(callback);
            return callbacks.length;
        },
        cancelFrame() {},
        render(value) {
            rendered.push(value);
        }
    });

    throttler.push({ x: 1 });
    throttler.push({ x: 2 });
    throttler.push({ x: 3 });
    assert.equal(callbacks.length, 1);
    callbacks[0]();
    assert.deepEqual(rendered, [{ x: 3 }]);
});
