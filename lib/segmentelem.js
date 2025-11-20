var JSM = require("./jsmodeler.js");
var svgPathProps = require('svg-path-properties');
var SVGPathProperties = svgPathProps && (svgPathProps.SVGPathProperties || svgPathProps.svgPathProperties);

if (!SVGPathProperties) {
	throw new Error('svg-path-properties does not expose a constructor compatible with this build.');
}

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
		function buildPathString(commands) {
		    var parts = [];
		    for (var i = 0, len = commands.length; i < len; i++) {
			var command = commands[i];
			if (!command || typeof command.type === 'undefined') {
				continue;
			}
			var segment = command.type;
			var orderedParams = [];
			switch (command.type) {
				case 'C':
				case 'c':
					orderedParams = [command.x1, command.y1, command.x2, command.y2, command.x, command.y];
					break;
				case 'S':
				case 's':
					orderedParams = [command.x2, command.y2, command.x, command.y];
					break;
				case 'Q':
				case 'q':
					orderedParams = [command.x1, command.y1, command.x, command.y];
					break;
				case 'T':
				case 't':
					orderedParams = [command.x, command.y];
					break;
				case 'A':
				case 'a':
					var radiusX = typeof command.rX !== 'undefined' ? command.rX : command.rx;
					var radiusY = typeof command.rY !== 'undefined' ? command.rY : command.ry;
					var largeArcFlag = typeof command.largeArcFlag !== 'undefined' ? command.largeArcFlag : command.largeArc;
					var sweepFlag = typeof command.sweepFlag !== 'undefined' ? command.sweepFlag : command.sweep;
					var axisRotation = typeof command.xAxisRotation !== 'undefined' ? command.xAxisRotation : command.rotation;
					orderedParams = [radiusX, radiusY, axisRotation, largeArcFlag, sweepFlag, command.x, command.y];
					break;
				default:
					var fallbackParams = [];
					for (var property in command) {
						if (!command.hasOwnProperty(property) || property === 'type') {
							continue;
						}
						fallbackParams.push(command[property]);
					}
					orderedParams = fallbackParams;
			}
			var filtered = [];
			for (var j = 0; j < orderedParams.length; j++) {
				if (typeof orderedParams[j] !== 'undefined') {
					filtered.push(orderedParams[j]);
				}
			}
			if (filtered.length > 0) {
				segment += ' ' + filtered.join(' ');
			}
			parts.push(segment.trim());
		}
		return parts.join(' ');
		}

		var commandsPath = buildPathString(items);
		if (!commandsPath) {
			return lastCoord;
		}
		var svgpath = 'M' + lastCoord.x + ' ' + lastCoord.y + ' ' + commandsPath;
		var properties = new SVGPathProperties(svgpath);
		var pathLength = properties.getTotalLength();
		var segmentation = 0;
		if (segmentLength > 0) {
			segmentation = parseInt(pathLength / segmentLength, 10);
		}
		if (segmentation < 3) {
			segmentation = 3;
		}
		var step = pathLength / segmentation;
		var i, point;
		for (i = 1; i <= segmentation; i++) {
			point = properties.getPointAtLength(i * step);
			lastCoord = AddTransformedVertex(result, currentContour, point.x, point.y);
		}
		return lastCoord;
	}
	
	function IsCurvedItem (itemType)
	{
		return "CcQqAaSsTt".indexOf(itemType) >= 0;
	}
	
	function IsSmoothItem (itemType)
	{
		return	"SsTt".indexOf(itemType) >= 0;
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