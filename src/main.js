"use strict";

var opentype = require("opentype.js");

var args = process.argv.slice(2);
var file = args[0];
var pointsize = args[1] ? args[1] : 72;
var ch = args[2] ? args[2] : 'A';


opentype.load(file, function (err, font) {
    if (err) {
        console.error("File '" + args[0] + "' not found, exiting.");
        return;
    }

    var fs = require('fs');
    var JSM = require("../lib/jsmodeler.js");
    var segmentElem = require("../lib/segmentelem.js");
    var ContourPolygonToPrisms = require("../lib/contourpolygontoprisms.js");

    var glyphs = font.stringToGlyphs(ch);

    for (var a = 0, b = glyphs.length; a < b; a++) {
        var commands = glyphs[a].getPath(0, 0, pointsize).commands;
        var name = glyphs[a].name;
        console.log(name);

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

        console.log(JSON.stringify(model, null, 4));
        var bboxdims = model.GetBody(0).GetBoundingBox();
        var bboxWidthX = bboxdims.max.x - bboxdims.min.x;

        var typeHigh = 0.918 * 72;
        var faceHeight = 5;
        var base = JSM.GenerateCuboid(bboxWidthX, typeHigh - faceHeight, pointsize);

        var alignBaseToLetter = JSM.TranslationTransformation (
            new JSM.Coord (
                bboxdims.min.x + bboxWidthX / 2,
                bboxdims.max.y - (typeHigh / 2) - (faceHeight / 2),
                bboxdims.max.z - pointsize / 2
            ));
        base.Transform (alignBaseToLetter);

        // var bbox = JSM.GenerateCuboid(bboxdims.max.x - bboxdims.min.x, 
        //     bboxdims.max.y - bboxdims.min.y, 
        //     bboxdims.max.z - bboxdims.min.z);

        model.AddBody(base);
        // model.AddBody(bbox);

        console.log(bboxdims.max.y - bboxdims.min.y);

        var stl = JSM.ExportModelToStl(model);

        fs.mkdir("../out/", function () { 
            fs.writeFile("../out/" + name + pointsize + "pt.stl", stl, function(err) {
                if(err) {
                    console.log(err);
                } else {
                    console.log("output written to out/" + name + pointsize + "pt.stl");
                }
            }); 
        });
    }
});