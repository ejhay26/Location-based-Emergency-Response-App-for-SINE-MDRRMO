const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceApp = path.join(__dirname, '../src-tauri/target/release/bundle/macos/MDRRMO EMERGENCY RESPONSE APP.app');
const releaseDir = path.join(__dirname, '../release');
const targetApp = path.join(releaseDir, 'MDRRMO EMERGENCY RESPONSE APP.app');

if (!fs.existsSync(sourceApp)) {
  console.error(`[post-build-mac] Error: Built .app not found at: ${sourceApp}`);
  process.exit(1);
}

// 1. Ensure release/ directory exists
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// 2. Copy .app to release/
console.log(`[post-build-mac] Copying application to ${targetApp}...`);
execSync(`rm -rf "${targetApp}" && cp -R "${sourceApp}" "${releaseDir}/"`);

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
