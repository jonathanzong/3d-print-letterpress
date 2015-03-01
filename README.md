# 3d-print-letterpress
Converts OpenType and TrueType (.otf and .ttf) files into 3D printable (.stl) models of letterpress type for a specified point size and glyph.

This project brings together two technologies, old and new, that empower people through the democratization of production.

Installation
------------

3d-print-letterpress requires [node.js](http://nodejs.org).

Install via [npm](https://www.npmjs.org)
```
$ npm install git+ssh://git@github.com:jonathanzong/3d-print-letterpress.git -g
```

Usage Example
-------------

```
$ 3d-print-letterpress 
Usage: 3d-print-letterpress type-file [point-size [glyphs]]
Usage: 3d-print-letterpress svg-file
```

**Keep in mind that STL files are unitless, and that you will have to scale your models to type-high (0.918 in or 23.317 mm).**

### Single Glyph

```
$ 3d-print-letterpress Gotham-Book.otf 16 H
output written to Gotham-BookSTL/Gotham-Book16ptUpperH.stl
```
<img src="https://cloud.githubusercontent.com/assets/4650077/6158011/49adf192-b214-11e4-852e-cccc9b920b0d.png" width="250"/>

### Multiple Glyphs

```
$ 3d-print-letterpress Gotham-Book.otf 16 OMG
output written to Gotham-BookSTL/Gotham-Book16ptUpperO.stl
output written to Gotham-BookSTL/Gotham-Book16ptUpperM.stl
output written to Gotham-BookSTL/Gotham-Book16ptUpperG.stl
```

### SVG Path File

```
$ 3d-print-letterpress bird.svg
output written to svg_pathSTL/svg_path97ptbird.stl
```


Dependencies
-----------
3d-print-letterpress uses

- [opentype](https://github.com/nodebox/opentype.js) -- parser for OpenType and TrueType formats
- [JSModeler](https://github.com/kovacsv/JSModeler) -- 3D modeling library modifed here to work in Node.js (removed references to the DOM)
- [point-at-length](https://github.com/substack/point-at-length) -- SVG utility to perform path calculations


License
-----------
MIT
