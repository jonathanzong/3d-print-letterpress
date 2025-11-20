const test = require('node:test');
const assert = require('node:assert');

const mainModule = require('../src/main');
const internals = mainModule._internals;

test('dedupe removes repeated characters while preserving order', () => {
    assert.strictEqual(internals.dedupe('AABBCCAA'), 'ABC');
    assert.strictEqual(internals.dedupe('xyz'), 'xyz');
});

test('getModelBoundingBox merges bounding boxes across bodies', () => {
    const boxes = [
        { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
        { min: { x: -2, y: -3, z: -4 }, max: { x: 5, y: 4, z: 2 } }
    ];
    const model = {
        BodyCount: () => boxes.length,
        GetBody: (index) => ({
            GetBoundingBox: () => JSON.parse(JSON.stringify(boxes[index]))
        })
    };

    const bbox = internals.getModelBoundingBox(model);
    assert.deepStrictEqual(bbox.min, { x: -2, y: -3, z: -4 });
    assert.deepStrictEqual(bbox.max, { x: 5, y: 4, z: 2 });
});

test('mergeModels concatenates body arrays when multiple models provided', () => {
    const first = { bodies: [1, 2] };
    const second = { bodies: [3] };
    const combined = internals.mergeModels([first, second]);
    assert.strictEqual(combined.bodies.length, 3);
    assert.deepStrictEqual(combined.bodies, [1, 2, 3]);
});

test('convertSvgPathToCommands parses valid path data', () => {
    const commands = internals.convertSvgPathToCommands('M0 0 L10 10 H20 V0 Z');
    assert.ok(Array.isArray(commands));
    assert.ok(commands.length >= 4);
});

test('convertSvgPathToCommands gracefully handles invalid path data', () => {
    const commands = internals.convertSvgPathToCommands('M0 0 L');
    assert.deepStrictEqual(commands, []);
});

test('mapSvgCommand supports multiple draw commands and fallbacks', () => {
    assert.ok(internals.mapSvgCommand({ code: 'M', x: 1, y: 2 }));
    assert.ok(internals.mapSvgCommand({ code: 'H', x: 5 }));
    assert.ok(internals.mapSvgCommand({ code: 'V', y: 9 }));
    assert.ok(internals.mapSvgCommand({ code: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 }));
    assert.ok(internals.mapSvgCommand({ code: 'S', x2: 7, y2: 8, x: 9, y: 10 }));
    assert.ok(internals.mapSvgCommand({ code: 'Q', x1: 3, y1: 4, x: 5, y: 6 }));
    assert.ok(internals.mapSvgCommand({ code: 'A', rx: 3, ry: 4, xAxisRotation: 0, largeArcFlag: 0, sweepFlag: 1, x: 5, y: 6 }));
    assert.strictEqual(internals.mapSvgCommand({}), null);
    assert.strictEqual(internals.mapSvgCommand({ code: 'X' }), null);
});
