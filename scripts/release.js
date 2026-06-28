const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(msg) {
    console.log(`[Release Manager] ${msg}`);
}

function error(msg) {
    console.error(`[Release Manager] Error: ${msg}`);
    process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    error('Missing version bump type. Usage: node scripts/release.js <patch | minor | major> [--notes "release notes"] [--git]');
}

const bumpType = args[0].toLowerCase();
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    error(`Invalid bump type "${bumpType}". Must be "patch", "minor", or "major".`);
}

let notes = 'Minor updates and bug fixes.';
let useGit = false;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--notes' && args[i + 1]) {
        notes = args[i + 1];
        i++;
    } else if (args[i] === '--git') {
        useGit = true;
    }
}

// Paths
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

if (!fs.existsSync(packageJsonPath)) {
    error('package.json not found in the project root.');
}
if (!fs.existsSync(changelogPath)) {
    error('CHANGELOG.md not found in the project root.');
}

// Read and parse package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
if (!currentVersion) {
    error('No version field found in package.json.');
}

// Calculate new version
const parts = currentVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
    error(`Current version "${currentVersion}" is not in valid semver format (X.Y.Z).`);
}

let [major, minor, patch] = parts;
if (bumpType === 'patch') {
    patch++;
} else if (bumpType === 'minor') {
    minor++;
    patch = 0;
} else if (bumpType === 'major') {
    major++;
    minor = 0;
    patch = 0;
}

const newVersion = `${major}.${minor}.${patch}`;
log(`Bumping version: ${currentVersion} -> ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
log('Updated package.json');

// Update CHANGELOG.md
let changelogContent = fs.readFileSync(changelogPath, 'utf8');
const insertIndex = changelogContent.indexOf('## ');

// Format new release notes
const notesLines = notes.split('\n').map(line => {
    let trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('-')) {
        trimmed = `- ${trimmed}`;
    }
    return trimmed;
}).filter(Boolean).join('\n');

const newEntry = `## ${newVersion}\n\n${notesLines}\n\n`;

if (insertIndex !== -1) {
    changelogContent = changelogContent.slice(0, insertIndex) + newEntry + changelogContent.slice(insertIndex);
} else {
    changelogContent += `\n${newEntry}`;
}

fs.writeFileSync(changelogPath, changelogContent, 'utf8');
log('Updated CHANGELOG.md');

// Run Build / Packaging
try {
    log('Running TypeScript compilation (npm run compile)...');
    execSync('npm run compile', { stdio: 'inherit' });
    
    log('Running packaging (npm run build)...');
    execSync('npm run build', { stdio: 'inherit' });
    log('Successfully compiled and packaged extension.');
} catch (err) {
    error(`Build/packaging failed: ${err.message}`);
}

// Git integration
if (useGit) {
    try {
        log('Staging changes in Git...');
        execSync('git add package.json CHANGELOG.md', { stdio: 'inherit' });
        
        const commitMsg = `chore(release): bump version to ${newVersion}`;
        log(`Committing changes: "${commitMsg}"...`);
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
        
        const tagName = `v${newVersion}`;
        log(`Creating Git tag: "${tagName}"...`);
        execSync(`git tag ${tagName}`, { stdio: 'inherit' });
        log('Git operations completed successfully.');
    } catch (err) {
        console.warn(`[Release Manager] Warning: Git operations failed: ${err.message}`);
    }
}

log(`Release ${newVersion} package ready!`);
