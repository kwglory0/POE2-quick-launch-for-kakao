
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
fs.readdirSync(dir).forEach(file => {
    // Clean up firefox zip
    if (file.startsWith(packageName) && file.endsWith('-firefox.zip')) {
        console.log(`Removing old zip: ${file}`);
        fs.unlinkSync(path.join(dir, file));
    }
});

// Filename format: {package-name}-v{version}-firefox.zip
const fileName = `${packageName}-v${version}-firefox.zip`;

console.log(`Creating Firefox zip file: ${fileName}`);

// 1. Patch manifest.json for Firefox
console.log('Patching dist/manifest.json for Firefox...');
const manifestPath = path.join(dir, 'dist', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Inject browser_specific_settings for Gecko (Firefox)
manifest.browser_specific_settings = {
    gecko: {
        id: "poe2-quick-launch@nerdhead.lab", // Fixed ID for updates
        strict_min_version: "109.0"
    }
};

// Convert background.service_worker to background.scripts for Firefox compatibility
if (manifest.background && manifest.background.service_worker) {
    console.log('Converting background.service_worker to background.scripts for Firefox...');
    manifest.background.scripts = [manifest.background.service_worker];
    delete manifest.background.service_worker;
    delete manifest.background.type; // 'type': 'module' is implied or different in scripts
}

// Remove 'use_dynamic_url' from web_accessible_resources (Firefox doesn't support it)
if (manifest.web_accessible_resources) {
    console.log('Cleaning web_accessible_resources for Firefox...');
    manifest.web_accessible_resources = manifest.web_accessible_resources.map(resource => {
        // Create a shallow copy and delete the forbidden property
        const newResource = { ...resource };
        if ('use_dynamic_url' in newResource) {
            delete newResource.use_dynamic_url;
        }
        return newResource;
    });
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest patched successfully.');

// 2. Zip it
// To ensure manifest.json is at the root of the zip, we must zip the *contents* of dist, not the dist folder itself.
// We also avoid using "*" glob to ensure Windows compatibility by listing files programmatically.
const distDir = path.join(dir, 'dist');
const filesToZip = fs.readdirSync(distDir).map(f => `"${f}"`).join(' '); // Add quotes for safety

const command = `npx bestzip ../${fileName} ${filesToZip}`;

console.log(`Executing in dist/: ${command}`);

exec(command, { cwd: distDir }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error creating zip: ${error.message}`);
        process.exit(1);
    }
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log(`Success! Created ${fileName}`);
});
