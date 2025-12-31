import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const version = packageJson.version;
const packageName = packageJson.name;

// 0. Cleanup existing zip files
const dir = process.cwd();
fs.readdirSync(dir).forEach((file) => {
    // Clean up typical zip patterns
    if (file.startsWith(packageName) && file.endsWith('.zip')) {
        console.log(`Removing old zip: ${file}`);
        fs.unlinkSync(path.join(dir, file));
    }
});

// Filename format: {package-name}-v{version}.zip
const fileName = `${packageName}-v${version}.zip`;

console.log(`Creating zip file: ${fileName}`);

// Use npx to ensure we find bestzip from node_modules
const command = `npx bestzip ${fileName} dist/`;

console.log(`Executing: ${command}`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error creating zip: ${error.message}`);
        process.exit(1);
    }
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`Success! Created ${fileName}`);
});
