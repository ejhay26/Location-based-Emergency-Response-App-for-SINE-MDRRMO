const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const archArg = process.argv[2] ? process.argv[2].toLowerCase() : null;

// Map user-friendly architecture names to Tauri target triple folder names
const targetMap = {
  'universal': 'universal-apple-darwin',
  'aarch64': 'aarch64-apple-darwin',
  'arm': 'aarch64-apple-darwin',
  'arm64': 'aarch64-apple-darwin',
  'x86_64': 'x86_64-apple-darwin',
  'x64': 'x86_64-apple-darwin',
  'intel': 'x86_64-apple-darwin'
};

const candidateDirs = [];
if (archArg && targetMap[archArg]) {
  candidateDirs.push(path.join(__dirname, `../src-tauri/target/${targetMap[archArg]}/release/bundle`));
}
// Generic fallback candidates in priority order
candidateDirs.push(
  path.join(__dirname, '../src-tauri/target/universal-apple-darwin/release/bundle'),
  path.join(__dirname, '../src-tauri/target/aarch64-apple-darwin/release/bundle'),
  path.join(__dirname, '../src-tauri/target/x86_64-apple-darwin/release/bundle'),
  path.join(__dirname, '../src-tauri/target/release/bundle')
);

// Find the first candidate directory that contains the macOS .app bundle
let bundleDir = null;
let sourceApp = null;
const appName = 'MDRRMO EMERGENCY RESPONSE APP.app';

for (const dir of candidateDirs) {
  const candidateApp = path.join(dir, 'macos', appName);
  if (fs.existsSync(candidateApp)) {
    bundleDir = dir;
    sourceApp = candidateApp;
    break;
  }
}

const releaseDir = path.join(__dirname, '../release');
const targetApp = path.join(releaseDir, appName);

if (!sourceApp || !fs.existsSync(sourceApp)) {
  console.error(`[post-build-mac] Error: Built .app not found in any expected target bundle directories.`);
  console.error(`[post-build-mac] Checked paths:`);
  candidateDirs.forEach(d => console.error(`  - ${path.join(d, 'macos', appName)}`));
  process.exit(1);
}

console.log(`[post-build-mac] Located built bundle at: ${bundleDir}`);

// 1. Ensure release/ directory exists
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// 2. Copy .app to release/
console.log(`[post-build-mac] Copying application to ${targetApp}...`);
execSync(`rm -rf "${targetApp}" && cp -R "${sourceApp}" "${releaseDir}/"`);

// 2b. If .dmg exists, copy to release/
const sourceDmgDir = path.join(bundleDir, 'dmg');
if (fs.existsSync(sourceDmgDir)) {
  const dmgFiles = fs.readdirSync(sourceDmgDir).filter(f => f.endsWith('.dmg'));
  for (const dmg of dmgFiles) {
    const srcDmg = path.join(sourceDmgDir, dmg);
    const destDmg = path.join(releaseDir, dmg);
    console.log(`[post-build-mac] Copying installer disk image to ${destDmg}...`);
    fs.copyFileSync(srcDmg, destDmg);
  }
}

// 3. Unhide extension in Finder so ".app" is explicitly visible
try {
  execSync(`SetFile -a e "${targetApp}" 2>/dev/null || true`);
  execSync(`SetFile -a e "${sourceApp}" 2>/dev/null || true`);
  console.log('[post-build-mac] Explicitly enabled visible .app extension in Finder.');
} catch (e) {
  // Non-fatal if SetFile is unavailable
}

// 4. Force Finder / LaunchServices to refresh icon cache
try {
  execSync(`touch "${targetApp}"`);
  const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
  if (fs.existsSync(lsregister)) {
    execSync(`"${lsregister}" -f "${targetApp}" 2>/dev/null || true`);
  }
  console.log('[post-build-mac] Refreshed macOS LaunchServices icon registration.');
} catch (e) {
  // Non-fatal
}

console.log(`\n======================================================`);
console.log(`✓ macOS Application ready at:`);
console.log(`  ${targetApp}`);
console.log(`======================================================\n`);
