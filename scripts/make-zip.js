import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const version = packageJson.version;
const packageName = packageJson.name;

// 0. Cleanup existing zip files
const dir = process.cwd();
fs.readdirSync(dir).forEach((file) => {
    // Clean up typical zip patterns, but EXCLUDE firefox zip
    if (file.startsWith(packageName) && file.endsWith('.zip') && !file.endsWith('-firefox.zip')) {
        console.log(`Removing old zip: ${file}`);
        fs.unlinkSync(path.join(dir, file));
    }
});

// Filename format: {package-name}-v{version}.zip
const fileName = `${packageName}-v{version}.zip`.replace('{version}', version);

console.log(`Creating zip file: ${fileName}`);

// Find bestzip CLI script
const bestzipCli = path.join(dir, 'node_modules', 'bestzip', 'bin', 'cli.js');

console.log(`Executing: node ${bestzipCli} ${fileName} dist/`);

execFile(process.execPath, [bestzipCli, fileName, 'dist/'], (error, stdout, stderr) => {
    if (error) {
        console.error(`Error creating zip: ${error.message}`);
        process.exit(1);
    }
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`Success! Created ${fileName}`);
});
