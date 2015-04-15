"use strict";

var fs = require('fs');
var path = require('path');
var opentype = require("opentype.js");
var JSM = require("../lib/jsmodeler.js");
var segmentElem = require("../lib/segmentelem.js");
var ContourPolygonToPrisms = require("../lib/contourpolygontoprisms.js");

var args = process.argv.slice(2);
var file = args[0];
var pointsize = args[1] ? args[1] : 72;
var ch = args[2] ? dedupe(args[2]) : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

if (args.length == 0) {
    console.log("Usage: 3d-print-letterpress type-file [point-size [glyphs]]");
    console.log("Usage: 3d-print-letterpress svg-file");
}
else {
    var ext = path.extname(file);
    if (ext == '.otf' || ext == '.ttf') {
        // parse type file
        opentype.load(file, function (err, font) {
            if (err) {
                console.error("File '" + args[0] + "' not found, exiting.");
                return;
            }

            var glyphs = font.stringToGlyphs(ch);

            // find highest of ascenders, cap height, etc
            var capTopZ = font.stringToGlyphs('HAkl').map(function(val, idx) {
                return getModelForCommands(val.getPath(0, 0, pointsize).commands)
                    .GetBody(0)
                    .GetBoundingBox()
                    .max.z;
            }).reduce(function(previousValue, currentValue) {
                return Math.max(previousValue, currentValue);
            });

            for (var a = 0, b = glyphs.length; a < b; a++) {
                var model = getModelForCommands(glyphs[a].getPath(0, 0, pointsize).commands);
                var glyphCh = glyphs[a].name;
                var glyphName = glyphCh == glyphCh.toLowerCase() ? "Lower" + glyphCh : "Upper" + glyphCh;
                writeTypeSTLForModel(model, capTopZ, path.basename(file, ext), glyphName);
            }
        });
    }
    else if (ext == '.svg') {
        // handle arbitrary svg path string
        fs.readFile(file, function (err, data) {
            if (err) {
                throw err; 
            }
            else {
                var matches = data.toString().replace(/ /g,'').match(/(([MLHVCSQTA][^a-z]+)+Z)+/ig);
                var raphael = require("node-raphael");
                // generate one model from matches
                raphael.generate(1280, 1280, function (r) {
                    r = r.raphael;
                    var models = matches.map(function (elem) {
                        var p = r.parsePathString(elem);
                        var commands = [];
                        while (p.length > 0) {
                            var cmd = p.shift();
                            var cmdType = cmd.shift();
                            var cmdObj = {
                                'type' : cmdType
                            }
                            switch (cmdType) {
                                case 'z' :
                                case 'Z' :
                                    break;
                                case 'h' :
                                case 'H' :
                                    cmdObj.x = cmd.shift();
                                    break;
                                case 'v' :
                                case 'V' :
                                    cmdObj.y = cmd.shift();
                                    break;
                                default :
                                    var i = 1;
                                    while (cmd.length > 2) {
                                        cmdObj['z'+i] = cmd.shift();
                                        i++;
                                    }
                                    cmdObj.x = cmd.shift();
                                    cmdObj.y = cmd.shift();
                                    break;
                            }
                            commands.push(cmdObj);      
                        }
                        return getModelForCommands(commands);
                    });
                    var model = models.shift();
                    while (models.length > 0) {
                        model.bodies = model.bodies.concat(models.shift().bodies);
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
                    pointsize = Math.ceil(bboxdims.max.z - bboxdims.min.z + 1);
                    writeTypeSTLForModel(model, bboxdims.max.z, 'svg_path', path.basename(file, ext));
                });
            }
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
    var topPadding = 0.5;
    var base = JSM.GenerateCuboid(bboxWidthX, typeHigh - faceHeight, pointsize);

    var alignBaseToLetter = JSM.TranslationTransformation (
        new JSM.Coord (
            bboxdims.min.x + bboxWidthX / 2,
            bboxdims.max.y - (typeHigh / 2) - (faceHeight / 2),
            maxHeightZ - pointsize / 2 + topPadding
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

    var dirname = faceName + "STL/";
    var filename = faceName + pointsize + "pt" + glyphName + ".stl";

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
