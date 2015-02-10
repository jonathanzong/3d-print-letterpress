var JSM = require("./jsmodeler.js");

function ContourPolygonToPrisms (polygon, height)
{
	function CreateBasePolygon (polygon, orientation)
	{
		var basePolygon = [];
		
		var i, coord;
		if (orientation == 'Clockwise') {
			for (i = 0; i < polygon.VertexCount (); i++) {
				coord = polygon.GetVertex (i);
				basePolygon.push (new JSM.Coord (coord.x, 0.0, -coord.y));
			}
		} else {
			for (i = polygon.VertexCount () - 1; i >= 0; i--) {
				coord = polygon.GetVertex (i);
				basePolygon.push (new JSM.Coord (coord.x, 0.0, -coord.y));
			}
		}

		return basePolygon;
	}

	function AddHoleToBasePolygon (basePolygon, polygon, orientation)
	{
		basePolygon.push (null);
	
		var i, coord;
		if (orientation == 'CounterClockwise') {
			for (i = 0; i < polygon.VertexCount (); i++) {
				coord = polygon.GetVertex (i);
				basePolygon.push (new JSM.Coord (coord.x, 0.0, -coord.y));
			}
		} else {
			for (i = polygon.VertexCount () - 1; i >= 0; i--) {
				coord = polygon.GetVertex (i);
				basePolygon.push (new JSM.Coord (coord.x, 0.0, -coord.y));
			}
		}
	}

	var prisms = [];
	var direction = new JSM.Vector (0.0, -1.0, 0.0);
	
	var currentHeight = height;
	if (polygon.originalElem !== undefined) {
		if (polygon.originalElem.hasAttribute ('modelheight')) {
			currentHeight = parseFloat (polygon.originalElem.getAttribute ('modelheight'));
		}
	}
	
	var basePolygon, baseOrientation, prism;
	var contourCount = polygon.ContourCount ();
	if (contourCount == 1) {
		baseOrientation = JSM.PolygonOrientation2D (polygon.GetContour (0));
		basePolygon = CreateBasePolygon (polygon.GetContour (0), baseOrientation);
		prism = JSM.GeneratePrism (basePolygon, direction, currentHeight, true);
		prisms.push (prism);
	} else if (contourCount > 1) {
		baseOrientation = JSM.PolygonOrientation2D (polygon.GetContour (0));
		var holeBasePolygon = CreateBasePolygon (polygon.GetContour (0), baseOrientation);
		var hasHoles = false;
		
		var i, orientation;
		for (i = 1; i < polygon.ContourCount (); i++) {
			orientation = JSM.PolygonOrientation2D (polygon.GetContour (i));
			if (orientation == baseOrientation) {
				basePolygon = CreateBasePolygon (polygon.GetContour (i), baseOrientation);
				prism = JSM.GeneratePrism (basePolygon, direction, currentHeight, true);
				prisms.push (prism);
			} else {
				AddHoleToBasePolygon (holeBasePolygon, polygon.GetContour (i), orientation);
				hasHoles = true;
			}
		}
		
		if (!hasHoles) {
			prism = JSM.GeneratePrism (holeBasePolygon, direction, currentHeight, true);
			prisms.push (prism);
		} else {
			prism = JSM.GeneratePrismWithHole (holeBasePolygon, direction, currentHeight, true);
			prisms.push (prism);
		}
	}
	
	var material = new JSM.Material ({ambient : polygon.color, diffuse : polygon.color});
	return [prisms, material];
}

module.exports = ContourPolygonToPrisms;