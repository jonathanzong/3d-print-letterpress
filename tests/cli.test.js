const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const fixturesRoot = path.join(__dirname, 'fixtures');

async function runCli(args) {
    return new Promise((resolve, reject) => {
        execFile(
            process.execPath,
            [path.join(projectRoot, 'index.js'), ...args],
            { cwd: projectRoot },
            (error, stdout, stderr) => {
                if (error) {
                    error.stdout = stdout;
                    error.stderr = stderr;
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            }
        );
    });
}

async function removeIfExists(targetPath) {
    await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
}

test('generates STL from Montserrat Medium font', async () => {
    const fontPath = path.join(fixturesRoot, 'fonts', 'Montserrat-Medium.ttf');
    const outputDir = path.join(projectRoot, 'Montserrat-MediumSTL');
    const expectedFile = path.join(outputDir, 'Montserrat-Medium48ptUpperA.stl');

    await removeIfExists(outputDir);

    await runCli([fontPath, '48', 'A']);

    const stats = await fs.stat(expectedFile);
    assert.ok(stats.isFile(), 'expected STL output file to be created');
    assert.ok(stats.size > 0, 'expected STL file to contain data');

    await removeIfExists(outputDir);
});

test('generates STL from Montserrat Medium Italic OTF font', async () => {
    const fontPath = path.join(fixturesRoot, 'fonts', 'Montserrat-MediumItalic.otf');
    const outputDir = path.join(projectRoot, 'Montserrat-MediumItalicSTL');
    const expectedFile = path.join(outputDir, 'Montserrat-MediumItalic60ptUpperA.stl');

    await removeIfExists(outputDir);

    await runCli([fontPath, '60', 'A']);

    const stats = await fs.stat(expectedFile);
    assert.ok(stats.isFile(), 'expected STL output file to be created for italic font');
    assert.ok(stats.size > 0, 'expected italic STL file to contain data');

    await removeIfExists(outputDir);
});

test('generates STL from SVG path input', async () => {
    const svgPath = path.join(fixturesRoot, 'svg', 'square.svg');
    const outputDir = path.join(projectRoot, 'svg_pathSTL');

    await removeIfExists(outputDir);

    await runCli([svgPath]);

    const files = await fs.readdir(outputDir);
    assert.ok(files.length > 0, 'expected STL outputs from SVG');
    assert.ok(files.some((file) => file.endsWith('square.stl')), 'expected STL file named after SVG');

    await removeIfExists(outputDir);
});

test('prints usage information when invoked without arguments', async () => {
    const result = await runCli([]);
    assert.match(result.stdout, /Usage: 3d-print-letterpress/);
});

test('warns about unrecognized file extensions', async () => {
    const bogusPath = path.join(fixturesRoot, 'svg', 'notes.txt');
    const result = await runCli([bogusPath]);
    assert.match(result.stderr, /unrecognized extension/);
});
