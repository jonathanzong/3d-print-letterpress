const test = require('node:test');
const assert = require('node:assert');

const mainModule = require('../src/main');
const internals = mainModule._internals;
const EPSILON = 1e-9;

function assertApproxEqual(actual, expected, epsilon = EPSILON) {
    assert.ok(Math.abs(actual - expected) < epsilon, `expected ${expected} but received ${actual}`);
}

function assertVerticalMetricsClose(metrics, expectedTop, expectedBottom, expectedHeight) {
    assertApproxEqual(metrics.top, expectedTop);
    assertApproxEqual(metrics.bottom, expectedBottom);
    assertApproxEqual(metrics.height, expectedHeight);
}

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

test('computeSlugBounds expands slug to include sidebearings when metrics are present', () => {
    const letterBounds = { min: { x: 120, y: 0, z: 0 }, max: { x: 320, y: 10, z: 5 } };
    const metrics = { leftSideBearing: 120, rightSideBearing: 60, xMin: 120 };
    const result = internals.computeSlugBounds(letterBounds, metrics, 380, 1000, 1000);
    assert.deepStrictEqual(result, { minX: 0, width: 380 });
});

test('computeSlugBounds preserves overhangs when bearings are negative', () => {
    const letterBounds = { min: { x: -30, y: 0, z: 0 }, max: { x: 420, y: 10, z: 5 } };
    const metrics = { leftSideBearing: -30, rightSideBearing: 40, xMin: -30 };
    const result = internals.computeSlugBounds(letterBounds, metrics, 460, 1000, 1000);
    assert.deepStrictEqual(result, { minX: -30, width: 490 });
});

test('computeSlugBounds returns null when required inputs are missing', () => {
    const letterBounds = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 10, z: 5 } };
    assert.strictEqual(internals.computeSlugBounds(letterBounds, null, 400, 1000, 1000), null);
    assert.strictEqual(internals.computeSlugBounds(null, {}, 400, 1000, 1000), null);
});

test('computeFontVerticalMetrics honors USE_TYPO_METRICS bit from OS/2', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            os2: {
                fsSelection: 0x80,
                sTypoAscender: 900,
                sTypoDescender: -200,
                usWinAscent: 1100,
                usWinDescent: 450
            }
        }
    };
    const pointSize = 60;
    const ascender = 900;
    const descender = -200;
    const span = ascender - descender;
    const scale = pointSize / span;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertVerticalMetricsClose(
        metrics,
        ascender * scale,
        descender * scale,
        pointSize
    );
});

test('computeFontVerticalMetrics splits OS/2 sTypo line gap evenly', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            os2: {
                fsSelection: 0x80,
                sTypoAscender: 800,
                sTypoDescender: -200,
                sTypoLineGap: 200
            }
        }
    };
    const pointSize = 96;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertApproxEqual(metrics.height, 96);
    assertApproxEqual(metrics.top, 72);
    assertApproxEqual(metrics.bottom, -24);
});

test('computeFontVerticalMetrics uses usWin metrics when USE_TYPO_METRICS is unset', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            os2: {
                fsSelection: 0,
                sTypoAscender: 900,
                sTypoDescender: -200,
                usWinAscent: 1100,
                usWinDescent: 450
            }
        }
    };
    const pointSize = 50;
    const ascender = 1100;
    const descender = -450;
    const span = ascender - descender;
    const scale = pointSize / span;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertVerticalMetricsClose(
        metrics,
        ascender * scale,
        descender * scale,
        pointSize
    );
});

test('computeFontVerticalMetrics falls back to hhea ascender/descender when OS/2 missing', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            hhea: { ascender: 800, descender: -300 }
        }
    };
    const pointSize = 40;
    const ascender = 800;
    const descender = -300;
    const span = ascender - descender;
    const scale = pointSize / span;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertVerticalMetricsClose(
        metrics,
        ascender * scale,
        descender * scale,
        pointSize
    );
});

test('computeFontVerticalMetrics uses hhea line gap when present', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            hhea: { ascender: 700, descender: -300, lineGap: 100 }
        }
    };
    const pointSize = 55;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertApproxEqual(metrics.height, pointSize);
    assertApproxEqual(metrics.top, 37.5);
    assertApproxEqual(metrics.bottom, -17.5);
});

test('computeFontVerticalMetrics falls back to head yMax/yMin when hhea missing', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            head: { yMax: 700, yMin: -200 }
        }
    };
    const pointSize = 10;
    const ascender = 700;
    const descender = -200;
    const span = ascender - descender;
    const scale = pointSize / span;
    const metrics = internals.computeFontVerticalMetrics(font, pointSize, null);
    assertVerticalMetricsClose(
        metrics,
        ascender * scale,
        descender * scale,
        pointSize
    );
});

test('computeFontVerticalMetrics falls back to glyph bounds when metrics missing', () => {
    const font = { unitsPerEm: 1000 };
    const bounds = { minZ: -5, maxZ: 32 };
    const metrics = internals.computeFontVerticalMetrics(font, 72, bounds);
    assert.deepStrictEqual(metrics, { top: 32, bottom: -5, height: 37 });
});

test('computeFontVerticalMetrics extends to glyph bounds when outlines exceed metrics', () => {
    const font = {
        unitsPerEm: 1000,
        tables: {
            os2: {
                fsSelection: 0x80,
                sTypoAscender: 800,
                sTypoDescender: -200
            }
        }
    };
    const bounds = { minZ: -15, maxZ: 55 };
    const metrics = internals.computeFontVerticalMetrics(font, 48, bounds);
    assert.deepStrictEqual(metrics, { top: 55, bottom: -15, height: 70 });
});

test('getScalingRangeForFont includes line gap when provided', () => {
    const range = internals.getScalingRangeForFont({ ascender: 700, descender: -300, lineGap: 200 }, 1000);
    assert.strictEqual(range, 1200);
});

test('applyUniformScale transforms all bodies with a uniform matrix', () => {
    const transformedMatrices = [];
    const body = {
        Transform: (transform) => {
            transformedMatrices.push(transform.GetMatrix().slice());
        }
    };
    const model = {
        BodyCount: () => 2,
        GetBody: () => body
    };

    internals.applyUniformScale(model, internals.POINT_TO_MM);

    assert.strictEqual(transformedMatrices.length, 2);
    transformedMatrices.forEach((matrix) => {
        assertApproxEqual(matrix[0], internals.POINT_TO_MM);
        assertApproxEqual(matrix[5], internals.POINT_TO_MM);
        assertApproxEqual(matrix[10], internals.POINT_TO_MM);
        assert.strictEqual(matrix[15], 1);
    });
});
