"use strict";

var fs = require('fs');
var path = require('path');
var opentype = require("opentype.js");
var DOMParser = require('@xmldom/xmldom').DOMParser;
var parseSVG = require('svg-path-parser').parseSVG;
var JSM = require("../lib/jsmodeler.js");
var segmentElem = require("../lib/segmentelem.js");
var ContourPolygonToPrisms = require("../lib/contourpolygontoprisms.js");

function run(argv) {
    var args = Array.isArray(argv) ? argv.slice() : process.argv.slice(2);
    var file = args[0];
    var pointsize = args[1] ? parseFloat(args[1]) : 72;
    if (isNaN(pointsize) || pointsize <= 0) {
        pointsize = 72;
    }
    var ch = args[2] ? dedupe(args[2]) : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    if (args.length === 0) {
        console.log("Usage: 3d-print-letterpress type-file [point-size [glyphs]]");
        console.log("Usage: 3d-print-letterpress svg-file");
        return;
    }

    var ext = file ? path.extname(file).toLowerCase() : '';
    if (ext == '.otf' || ext == '.ttf') {
        // parse type file
        opentype.load(file, function (err, font) {
            if (err) {
                console.error("Failed to load font '" + file + "': " + err.message);
                return;
            }

            var glyphs = font.stringToGlyphs(ch);
            if (!glyphs || glyphs.length === 0) {
                console.error("No glyphs found for character set '" + ch + "'.");
                return;
            }

            var capTopZ = estimateCapHeight(font, pointsize);

            for (var a = 0, b = glyphs.length; a < b; a++) {
                var glyphPath = glyphs[a].getPath(0, 0, pointsize);
                if (!glyphPath || !glyphPath.commands || glyphPath.commands.length === 0) {
                    console.warn("Skipping glyph '" + (glyphs[a].name || glyphs[a].index) + "' with no outlines.");
                    continue;
                }
                var model = getModelForCommands(glyphPath.commands);
                if (!model || model.BodyCount() === 0) {
                    console.warn("Skipping glyph '" + (glyphs[a].name || glyphs[a].index) + "' due to empty geometry.");
                    continue;
                }
                var glyphName = formatGlyphName(glyphs[a]);
                writeTypeSTLForModel(model, capTopZ, path.basename(file, ext), glyphName, pointsize);
            }
        });
    }
    else if (ext == '.svg') {
        // handle arbitrary svg path string
        fs.readFile(file, 'utf8', function (err, data) {
            if (err) {
                console.error("Failed to read SVG file '" + file + "': " + err.message);
                return;
            }

            var doc;
            try {
                doc = new DOMParser().parseFromString(data, 'image/svg+xml');
            } catch (parseErr) {
                console.error("Unable to parse SVG document: " + parseErr.message);
                return;
            }

            var pathNodes = doc.getElementsByTagName('path');
            if (!pathNodes || pathNodes.length === 0) {
                console.error("No <path> elements found in SVG file '" + file + "'.");
                return;
            }

            var models = [];
            for (var i = 0; i < pathNodes.length; i++) {
                var pathData = pathNodes[i].getAttribute('d');
                if (!pathData) {
                    continue;
                }
                var commands = convertSvgPathToCommands(pathData);
                if (!commands.length) {
                    continue;
                }
                models.push(getModelForCommands(commands));
            }

            if (!models.length) {
                console.error("No valid path data found in SVG file '" + file + "'.");
                return;
            }

            var model = mergeModels(models);
            var bboxdims = getModelBoundingBox(model);
            if (!bboxdims) {
                console.error("Failed to compute geometry for SVG file '" + file + "'.");
                return;
            }
            pointsize = Math.ceil(bboxdims.max.z - bboxdims.min.z + 1);
            writeTypeSTLForModel(model, bboxdims.max.z, 'svg_path', path.basename(file, ext), pointsize);
        });
    }
    else {
        console.error("unrecognized extension: " + ext);
        console.error("expected: ( .otf | .ttf | .svg )");
    }
}

/*
Writes STL file describing 3d model of a piece of type to an output folder.
params:
model - model object of the glyph
maxHeightZ - the maximum z coordinate of the typeface's bounding box (i.e. highest ascender)
faceName - the name of the typeface (ex. Gotham-Book)
glyphName - the name of the glyph (ex. A)
*/
function writeTypeSTLForModel(model, maxHeightZ, faceName, glyphName, outputPointSize) {
    var bboxdims = getModelBoundingBox(model);
    if (!bboxdims) {
        console.warn("Skipping glyph '" + glyphName + "' due to missing bounding box.");
        return;
    }
    
    var bboxWidthX = bboxdims.max.x - bboxdims.min.x;

    var typeHigh = 0.918 * 72;
    var faceHeight = 2;
    var topPadding = 0.5;
    var base = JSM.GenerateCuboid(bboxWidthX, typeHigh - faceHeight, outputPointSize);

    var alignBaseToLetter = JSM.TranslationTransformation (
        new JSM.Coord (
            bboxdims.min.x + bboxWidthX / 2,
            bboxdims.max.y - (typeHigh / 2) - (faceHeight / 2),
            maxHeightZ - outputPointSize / 2 + topPadding
        ));
    base.Transform (alignBaseToLetter);

    var nick = JSM.GenerateCylinder(faceHeight, bboxWidthX, 50, true, true);
    nick.Transform(JSM.RotationYTransformation(Math.PI/2));
    var alignNickToBase = new JSM.Coord (
            bboxdims.min.x + bboxWidthX / 2,
            bboxdims.max.y - (3 * typeHigh / 4),
            maxHeightZ - outputPointSize
        );
    nick.Transform(JSM.TranslationTransformation (alignNickToBase));
    base = JSM.BooleanOperation ('Difference', base, nick);

    // TODO figure out why these lines kill the base for certain svgs
    // while (model.bodies.length > 0) {
    //     base = JSM.BooleanOperation ('Union', base, model.bodies.pop());
    // }

    model.AddBody(base);

    var rotateUpright = JSM.RotationXTransformation(Math.PI/2);

    for (var n = 0, bodies = model.BodyCount(); n < bodies; n++) {
        model.GetBody(n).Transform(rotateUpright);
    }

    var stl = JSM.ExportModelToStl(model);

    var dirname = faceName + "STL";
    var filename = faceName + outputPointSize + "pt" + glyphName + ".stl";

    fs.mkdir(dirname, { recursive: true }, function (mkdirErr) {
        if (mkdirErr) {
            console.error("Failed to create output directory '" + dirname + "': " + mkdirErr.message);
            return;
        }
        var outputPath = path.join(dirname, filename);
        fs.writeFile(outputPath, stl, function(err) {
            if(err) {
                console.error(err);
            } else {
                console.log("output written to " + outputPath);
            }
        });
    });
}

/*
Returns a model object described by the svg commands, 10 units deep in the y axis.
*/
function getModelForCommands(commands) {
    var model = new JSM.Model ();
    var polygons = segmentElem(commands, 1);
    var currentHeight = 10;
    
    var i, j, prismsAndMaterial, currentPrisms, currentPrism, currentMaterial;
    for (i = 0, len = polygons.length; i < len; i++) {
        prismsAndMaterial = ContourPolygonToPrisms (polygons[i], currentHeight);
        currentPrisms = prismsAndMaterial[0];
        for (j = 0; j < currentPrisms.length; j++) {
            currentPrism = currentPrisms[j];
            model.AddBody (currentPrism);
        }
    }

    return model;
} 

function estimateCapHeight(font, size) {
    var probes = font.stringToGlyphs('HAkl') || [];
    var heights = [];
    for (var i = 0; i < probes.length; i++) {
        try {
            var glyphPath = probes[i].getPath(0, 0, size);
            if (!glyphPath || !glyphPath.commands || glyphPath.commands.length === 0) {
                continue;
            }
            var model = getModelForCommands(glyphPath.commands);
            var bbox = getModelBoundingBox(model);
            if (bbox) {
                heights.push(bbox.max.z);
            }
        } catch (err) {
            // ignore glyphs we cannot process
        }
    }
    if (!heights.length) {
        return size;
    }
    return heights.reduce(function(previousValue, currentValue) {
        return Math.max(previousValue, currentValue);
    }, heights[0]);
}

function formatGlyphName(glyph) {
    if (!glyph) {
        return 'glyph';
    }
    var rawName = glyph.name || '';
    if (!rawName && typeof glyph.unicode !== 'undefined') {
        rawName = String.fromCharCode(glyph.unicode);
    }
    if (!rawName) {
        rawName = 'glyph' + (typeof glyph.index !== 'undefined' ? glyph.index : '');
    }
    if (rawName.length === 1 && /[A-Za-z]/.test(rawName)) {
        return (rawName === rawName.toLowerCase() ? 'Lower' : 'Upper') + rawName;
    }
    return rawName;
}

function getModelBoundingBox(model) {
    if (!model || model.BodyCount() === 0) {
        return null;
    }
    var bboxdims = model.GetBody(0).GetBoundingBox();
    for (var n = 1, bodies = model.BodyCount(); n < bodies; n++) {
        var bbox = model.GetBody(n).GetBoundingBox();
        bboxdims.max.x = Math.max(bboxdims.max.x, bbox.max.x);
        bboxdims.max.y = Math.max(bboxdims.max.y, bbox.max.y);
        bboxdims.max.z = Math.max(bboxdims.max.z, bbox.max.z);

        bboxdims.min.x = Math.min(bboxdims.min.x, bbox.min.x);
        bboxdims.min.y = Math.min(bboxdims.min.y, bbox.min.y);
        bboxdims.min.z = Math.min(bboxdims.min.z, bbox.min.z);
    }
    return bboxdims;
}

function mergeModels(models) {
    if (!models || !models.length) {
        return null;
    }
    var combined = models[0];
    for (var i = 1; i < models.length; i++) {
        combined.bodies = combined.bodies.concat(models[i].bodies);
    }
    return combined;
}

function convertSvgPathToCommands(pathData) {
    try {
        var parsed = parseSVG(pathData);
        var commands = [];
        for (var i = 0; i < parsed.length; i++) {
            var mapped = mapSvgCommand(parsed[i]);
            if (mapped) {
                commands.push(mapped);
            }
        }
        return commands;
    } catch (err) {
        console.error("Failed to parse SVG path segment: " + err.message);
        return [];
    }
}

function mapSvgCommand(command) {
    if (!command || !command.code) {
        return null;
    }
    var mapped = { type: command.code };
    switch (command.code) {
        case 'M':
        case 'm':
        case 'L':
        case 'l':
        case 'T':
        case 't':
            mapped.x = command.x;
            mapped.y = command.y;
            break;
        case 'H':
        case 'h':
            mapped.x = command.x;
            break;
        case 'V':
        case 'v':
            mapped.y = command.y;
            break;
        case 'C':
        case 'c':
            mapped.x1 = command.x1;
            mapped.y1 = command.y1;
            mapped.x2 = command.x2;
            mapped.y2 = command.y2;
            mapped.x = command.x;
            mapped.y = command.y;
            break;
        case 'S':
        case 's':
            mapped.x2 = command.x2;
            mapped.y2 = command.y2;
            mapped.x = command.x;
            mapped.y = command.y;
            break;
        case 'Q':
        case 'q':
            mapped.x1 = command.x1;
            mapped.y1 = command.y1;
            mapped.x = command.x;
            mapped.y = command.y;
            break;
        case 'A':
        case 'a':
            mapped.rX = typeof command.rx !== 'undefined' ? command.rx : command.rX;
            mapped.rY = typeof command.ry !== 'undefined' ? command.ry : command.rY;
            mapped.xAxisRotation = command.xAxisRotation;
            mapped.largeArcFlag = typeof command.largeArcFlag !== 'undefined' ? command.largeArcFlag : command.largeArc;
            mapped.sweepFlag = typeof command.sweepFlag !== 'undefined' ? command.sweepFlag : command.sweep;
            mapped.x = command.x;
            mapped.y = command.y;
            break;
        case 'Z':
        case 'z':
            break;
        default:
            return null;
    }
    return mapped;
}

/*
Returns string s without any duplicate characters
*/
function dedupe(s) {
    var firsts = "";
    for (var i = 0, len = s.length; i<len; i++) {
        if (i == s.indexOf(s[i])) {
            firsts += s[i];
        }
    }
    return firsts;
}

if (require.main === module) {
    run();
}

module.exports = {
    run: run,
    _internals: {
        dedupe: dedupe,
        mapSvgCommand: mapSvgCommand,
        convertSvgPathToCommands: convertSvgPathToCommands,
        mergeModels: mergeModels,
        getModelBoundingBox: getModelBoundingBox
    }
};
