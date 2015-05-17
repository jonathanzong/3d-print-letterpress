# 3d-print-letterpress
Converts OpenType and TrueType (.otf and .ttf) files into 3D printable (.stl) models of letterpress type for a specified point size and glyph.

This project brings together two technologies, old and new, that empower people through the democratization of production.

<img src="https://cloud.githubusercontent.com/assets/4650077/7669372/5f308a92-fc3e-11e4-9a37-b9cc01d28f8c.jpg" width="250"/>

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

Keep in mind that STL files are unitless, and that you will have to scale your models to type-high (0.918 in or 23.317 mm).

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
<img src="https://cloud.githubusercontent.com/assets/4650077/6433055/f4648cf0-c032-11e4-858a-e6f5357baf8a.png" width="250"/>

### SVG Path File

```
$ 3d-print-letterpress bird.svg
output written to svg_pathSTL/svg_path97ptbird.stl
```
<img src="https://cloud.githubusercontent.com/assets/4650077/6433035/cb66b486-c032-11e4-9026-507926ae7cdc.png" width="250"/>

Final Product
-------------
<img src="https://cloud.githubusercontent.com/assets/4650077/7669323/b7132b6e-fc3b-11e4-8c8b-4c8a5be98c7a.jpg" width="250"/>

Dependencies
-----------
3d-print-letterpress uses

- [opentype](https://github.com/nodebox/opentype.js) -- parser for OpenType and TrueType formats
- [JSModeler](https://github.com/kovacsv/JSModeler) -- 3D modeling library modifed here to work in Node.js (removed references to the DOM)
- [node-raphael](https://github.com/dodo/node-raphael) -- SVG utility to perform path calculations


License
-----------
MIT
