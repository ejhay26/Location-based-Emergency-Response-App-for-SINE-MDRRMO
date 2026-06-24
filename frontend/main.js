const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs   = require('fs');

function patchBaseHref() {
  const indexPath = path.join(__dirname, 'www', 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf-8');
    if (html.includes('<base href="/">')) {
      html = html.replace('<base href="/">', '<base href="./">');
      fs.writeFileSync(indexPath, html, 'utf-8');
      console.log('[Electron] Patched <base href> → "./"');
    }
  } catch (err) {
    console.warn('[Electron] Could not patch index.html:', err.message);
  }
}

/**
 * OSM TILE FIX
 * Must be registered BEFORE the window is created and OUTSIDE app.whenReady()
 * to avoid the double-call race condition.
 * We intercept tile requests and:
 *   1. Remove the Referer header (file:// origin is blocked by OSM CDN)
 *   2. Set a real browser User-Agent
 *   3. Set proper Accept header
 */
function registerOsmFix() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.tile.openstreetmap.org/*'] },
    (details, callback) => {
      const headers = Object.assign({}, details.requestHeaders);
      delete headers['Referer'];
      delete headers['referer'];
      headers['User-Agent'] =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      headers['Accept'] = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';
      callback({ requestHeaders: headers });
    }
  );
  console.log('[Electron] OSM tile header intercept registered.');
}

function createWindow() {
  patchBaseHref();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    icon: path.join(__dirname, 'www', 'assets', 'icon', 'logo.jpg'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.removeMenu();

  // Uncomment to debug:
  // win.webContents.openDevTools();
}

// Register OSM fix immediately — session is available before app is ready
// This is the correct order: register intercept first, then create window inside whenReady
app.whenReady().then(() => {
  registerOsmFix();   // <-- must be inside whenReady so defaultSession exists
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});