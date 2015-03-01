var JSM = require("./jsmodeler.js");

function SegmentElem (commands, segmentLength)
{
	function AddTransformedVertex (result, contour, x, y)
	{
		var resultCoord = new JSM.Coord2D (x, y);
		
		var contourVertexCount = result.VertexCount (contour);
		if (contourVertexCount > 0) {
			if (JSM.CoordIsEqual2DWithEps (result.GetVertex (contour, contourVertexCount - 1), resultCoord, 0.1)) {
				return resultCoord;
			}
		}

		result.AddVertex (contour, x, y);
		return resultCoord;
	}

	function SegmentCurve (segmentLength, lastCoord, items, result, currentContour)
	{

		function pathString(commands) {    
	        var pathstring = "";
	        for (var i = 0, len = commands.length; i < len; i++) {
				for (var property in commands[i]) {
					if (commands[i].hasOwnProperty(property)) {
						pathstring += commands[i][property] + " ";
					}
				}
	        }
	        return pathstring;
	    }

		var point = require("point-at-length");

	    var svgpath = pathString(items);
	    svgpath = "M"+ lastCoord.x + " " + lastCoord.y + " " + svgpath;
		var path = point(svgpath);
		var pathLength = path.length();

		console.log(svgpath);
		
		var segmentation = 0;
		if (segmentLength > 0) {
			segmentation = parseInt (pathLength / segmentLength, 10);
		}
		if (segmentation < 3) {
			segmentation = 3;
		}
		
		var step = pathLength / segmentation;

		var i, point;
		for (i = 1; i <= segmentation; i++) {
			point = path.at(i * step);
			lastCoord = AddTransformedVertex (result, currentContour, point[0], point[1]);
		}
		
		return lastCoord;
	}
	
	function IsCurvedItem (itemType)
	{
		return "CcQqAaSs".indexOf(itemType) >= 0;
	}
	
	function IsSmoothItem (itemType)
	{
		return	"Ss".indexOf(itemType) >= 0;
	}

	function RemoveEqualEndVertices (polygon, contour)
	{
		var vertexCount = polygon.VertexCount (contour);
		if (vertexCount === 0) {
			return;
		}
		
		var firstCoord = polygon.GetVertex (contour, 0);
		var lastCoord = polygon.GetVertex (contour, vertexCount - 1);
		if (JSM.CoordIsEqual2DWithEps (firstCoord, lastCoord, 0.1)) {
			polygon.GetContour (contour).vertices.pop ();
		}
	}

	function StartNewContour (result, contour)
	{
		if (result.VertexCount (contour) > 0) {
			RemoveEqualEndVertices (result, contour);
			result.AddContour ();
			return contour + 1;
		}
		return contour;
	}

	var result = new JSM.ContourPolygon2D ();

	var i, j;
	//
	var lastCoord = new JSM.Coord2D (0.0, 0.0);
	var lastMoveCoord = new JSM.Coord2D (0.0, 0.0);

	var currentSegmentLength = segmentLength;
	
	var item, items, currentItem;
	var currentContour = 0;
	for (i = 0, len = commands.length; i < len; i++) {
		item = commands[i];
		console.log(item);
		if (item.type == 'Z') {
			// do nothing
		} else if (item.type == 'M') {
			currentContour = StartNewContour (result, currentContour);
			lastCoord = AddTransformedVertex (result, currentContour, item.x, item.y);
			lastMoveCoord = lastCoord.Clone ();
		} else if (item.type == 'm') {
			currentContour = StartNewContour (result, currentContour);
			lastCoord = AddTransformedVertex (result, currentContour, lastMoveCoord.x + item.x, lastMoveCoord.y + item.y);
			lastMoveCoord = lastCoord.Clone ();
		} else if (item.type == 'L') {
			lastCoord = AddTransformedVertex (result, currentContour, item.x, item.y);
		} else if (item.type == 'l') {
			lastCoord = AddTransformedVertex (result, currentContour, lastCoord.x + item.x, lastCoord.y + item.y);
		} else if (item.type == 'H') {
			lastCoord = AddTransformedVertex (result, currentContour, item.x, lastCoord.y);
		} else if (item.type == 'V') {
			lastCoord = AddTransformedVertex (result, currentContour, lastCoord.x, item.y);
		} else if (item.type == 'h') {
			lastCoord = AddTransformedVertex (result, currentContour, lastCoord.x + item.x, lastCoord.y);
		} else if (item.type == 'v') {
			lastCoord = AddTransformedVertex (result, currentContour, lastCoord.x, lastCoord.y + item.y);
		} else if (IsCurvedItem (item.type)) {
			items = [];
			if (IsSmoothItem (item.type)) {
				for (j = i; j < len; j++) {
					currentItem = commands[j];
					if (!IsSmoothItem (currentItem.type)) {
						break;
					}
					items.push (currentItem);
				}
				i = j - 1;
			} else {
				items.push (item);
			}
			lastCoord = SegmentCurve (currentSegmentLength, lastCoord, items, result, currentContour);
		} else {
			// unknown segment type
		}
	}
	
	RemoveEqualEndVertices (result, currentContour);
	
	return [result];
}

module.exports = SegmentElem;