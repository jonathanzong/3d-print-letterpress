"use strict";

var fs = require('fs');
var opentype = require("opentype.js");
var JSM = require("../lib/jsmodeler.js");
var segmentElem = require("../lib/segmentelem.js");
var ContourPolygonToPrisms = require("../lib/contourpolygontoprisms.js");

var args = process.argv.slice(2);
var fileOrSvgPath = args[0];
var pointsize = args[1] ? args[1] : 72;
var ch = args[2] ? dedupe(args[2]) : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

if (args.length == 0) {
    console.log("Usage: 3d-print-letterpress type-file [point-size [glyphs]]");
    console.log("Usage: 3d-print-letterpress svg-path-string");
}
else {
    if (fileOrSvgPath && /[MLHVCSQTAZ].*Z/i.test(fileOrSvgPath)) {
        var pathString = fileOrSvgPath;
        var point = require("point-at-length");
        var parsed = point(pathString)._path;
        var commands = [];
        while (parsed.length > 0) {
            var cmd = parsed.shift();
            var cmdType = cmd.shift();
            var cmdObj = {
                'type' : cmdType
            }
            switch (cmdType) {
                case 'Z' :
                    break;
                case 'c' : 
                case 'C' : 
                    cmdObj.x1 = cmd.shift();
                    cmdObj.y1 = cmd.shift();
                    cmdObj.x2 = cmd.shift();
                    cmdObj.y2 = cmd.shift();
                    cmdObj.x = cmd.shift();
                    cmdObj.y = cmd.shift();
                    break;
                case 'q' :
                case 'Q' :
                    cmdObj.x1 = cmd.shift();
                    cmdObj.y1 = cmd.shift();
                    cmdObj.x = cmd.shift();
                    cmdObj.y = cmd.shift();
                    break;
                default :
                    cmdObj.x = cmd.shift();
                    cmdObj.y = cmd.shift();
                    break;
            }
            commands.push(cmdObj);
        }
        var model = getModelForCommands(commands);
        var bbox = model.GetBody(0).GetBoundingBox();
        pointsize = bbox.max.z - bbox.min.z;
        writeTypeSTLForModel(model, bbox.max.z, 'svg_path');
    }
    else {
        var file = fileOrSvgPath;
        opentype.load(file, function (err, font) {
            if (err) {
                console.error("File '" + args[0] + "' not found, exiting.");
                return;
            }

            var glyphs = font.stringToGlyphs(ch);

            // TODO the ascender line could be taller than the cap line
            var capTopZ = 
                getModelForCommands(font.charToGlyph('H').getPath(0, 0, pointsize).commands)
                .GetBody(0).GetBoundingBox().max.z;

            for (var a = 0, b = glyphs.length; a < b; a++) {
                var model = getModelForCommands(glyphs[a].getPath(0, 0, pointsize).commands);
                writeTypeSTLForModel(model, capTopZ, file, glyphs[a].name);
            }
        });
    }
}


function writeTypeSTLForModel(model, maxHeightZ, faceName, glyphName) {
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
    
    var bboxWidthX = bboxdims.max.x - bboxdims.min.x;

    var typeHigh = 0.918 * 72;
    var faceHeight = 2;
    var base = JSM.GenerateCuboid(bboxWidthX, typeHigh - faceHeight, pointsize);

    var alignBaseToLetter = JSM.TranslationTransformation (
        new JSM.Coord (
            bboxdims.min.x + bboxWidthX / 2,
            bboxdims.max.y - (typeHigh / 2) - (faceHeight / 2),
            maxHeightZ - pointsize / 2 + 0.5
        ));
    base.Transform (alignBaseToLetter);

    var nick = JSM.GenerateCylinder(faceHeight, bboxWidthX, 50, true, true);
    nick.Transform(JSM.RotationYTransformation(Math.PI/2));
    var alignNickToBase = new JSM.Coord (
            bboxdims.min.x + bboxWidthX / 2,
            bboxdims.max.y - (3 * typeHigh / 4),
            maxHeightZ - pointsize
        );
    nick.Transform(JSM.TranslationTransformation (alignNickToBase));
    base = JSM.BooleanOperation ('Difference', base, nick);

    while (model.bodies.length > 0) {
        base = JSM.BooleanOperation ('Union', base, model.bodies.pop());
    }

    model.AddBody(base);

    var rotateUpright = JSM.RotationXTransformation(Math.PI/2);

    for (var n = 0, bodies = model.BodyCount(); n < bodies; n++) {
        model.GetBody(n).Transform(rotateUpright);
    }

    var stl = JSM.ExportModelToStl(model);

    glyphName = glyphName ? glyphName : '';

    if (faceName.indexOf("/") != -1)
        faceName = faceName.substring(faceName.lastIndexOf("/") + 1);
    if (faceName.indexOf(".") != -1)
        faceName = faceName.substring(0, faceName.indexOf("."));

    var dirname = faceName + "STL/";
    var filename = faceName + glyphName + pointsize + "pt.stl";

    fs.mkdir(dirname, (function () {
        fs.writeFile(arguments[0], arguments[1], (function(err) {
            if(err) {
                console.error(err);
            } else {
                console.log("output written to " + this);
            }
        }).bind(arguments[0]));
    }).bind(undefined, dirname + filename, stl));
}

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

function dedupe(s) {
    var firsts = "";
    for (var i = 0, len = s.length; i<len; i++) {
        if (i == s.indexOf(s[i])) {
            firsts += s[i];
        }
    }
    return firsts;
}
