const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const https = require('https');

let splashWindow;
let mainWindow;

// Configure logging
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';
autoUpdater.logger = log;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    transparent: true,
    center: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  splashWindow.loadFile('splash.html');
  splashWindow.webContents.send('status', 'Starting StatusStrap...');
}

async function getReleaseDate(version) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/Orbit-Softworks/statusstrap-app/releases/tags/v${version}`,
      method: 'GET',
      headers: {
        'User-Agent': 'StatusStrap-App'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (release.published_at) {
            const date = new Date(release.published_at);
            const formatted = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
            resolve(formatted);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Failed to parse release date:', err);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Failed to fetch release date:', err);
      resolve(null);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

async function createMainWindow() {
  const version = app.getVersion();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: `StatusStrap | v${version} | Loading...`,
    roundedCorners: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // CHANGED: Load local index.html instead of website
  mainWindow.loadFile('index.html');
  
  // Fetch release date in the background
  getReleaseDate(version).then(releaseDate => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const title = releaseDate 
        ? `StatusStrap | v${version} | ${releaseDate}`
        : `StatusStrap | v${version}`;
      mainWindow.setTitle(title);
    }
  });
  
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.close();
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

function setupAutoUpdater() {
  // Only check for updates in production
  if (!app.isPackaged) {
    console.log('Dev mode: Skipping auto-update check');
    return false;
  }
  
  console.log('=== AUTO-UPDATER CONFIG ===');
  console.log('Current version:', app.getVersion());
  console.log('Feed provider: github');
  console.log('Owner: Orbit-Softworks');
  console.log('Repo: statusstrap-app');
  
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;
  
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    if (splashWindow) {
      splashWindow.webContents.send('status', 'Checking for updates...');
    }
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('=== UPDATE AVAILABLE ===');
    console.log('Version:', info.version);
    console.log('Release date:', info.releaseDate);
    
    if (splashWindow) {
      splashWindow.webContents.send('status', `Update ${info.version} available!`);
      splashWindow.webContents.send('progress', 0);
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    console.log('No updates available');
    if (splashWindow) {
      splashWindow.webContents.send('status', 'You have the latest version');
      setTimeout(() => {
        splashWindow.webContents.send('status', 'Starting app...');
        setTimeout(() => createMainWindow(), 1000);
      }, 1500);
    } else {
      createMainWindow();
    }
  });
  
  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.floor(progress.percent);
    console.log(`Download progress: ${percent}%`);
    
    if (splashWindow) {
      splashWindow.webContents.send('progress', percent);
      splashWindow.webContents.send('status', `Downloading... ${percent}%`);
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('=== UPDATE DOWNLOADED ===');
    console.log('Version ready to install:', info.version);
    
    if (splashWindow) {
      splashWindow.webContents.send('progress', 100);
      splashWindow.webContents.send('status', 'Update downloaded!');
      
      setTimeout(() => {
        splashWindow.webContents.send('status', 'Restarting to install update...');
        
        setTimeout(() => {
          console.log('Calling quitAndInstall()...');
          autoUpdater.quitAndInstall(true, true);
        }, 2000);
      }, 1000);
    } else {
      autoUpdater.quitAndInstall(true, true);
    }
  });
  
  autoUpdater.on('error', (err) => {
    console.error('=== AUTO-UPDATE ERROR ===');
    console.error('Error message:', err.message);
    
    if (splashWindow) {
      splashWindow.webContents.send('status', 'Update failed, starting app...');
      setTimeout(() => createMainWindow(), 1500);
    } else {
      createMainWindow();
    }
  });
  
  return true;
}

function checkForUpdates() {
  if (!setupAutoUpdater()) {
    setTimeout(() => createMainWindow(), 2000);
    return;
  }
  
  console.log('Starting update check...');
  
  const updateTimeout = setTimeout(() => {
    console.log('Update check timeout, starting app...');
    if (splashWindow) {
      splashWindow.webContents.send('status', 'Starting app...');
      setTimeout(() => createMainWindow(), 1000);
    }
  }, 15000);
  
  autoUpdater.checkForUpdates().then(result => {
    clearTimeout(updateTimeout);
    console.log('Update check result:', result);
    
    if (!result || !result.updateInfo) {
      console.log('No update found or already up to date');
      if (splashWindow) {
        splashWindow.webContents.send('status', 'Starting app...');
        setTimeout(() => createMainWindow(), 1000);
      }
    }
  }).catch(err => {
    clearTimeout(updateTimeout);
    console.error('Update check failed:', err);
    if (splashWindow) {
      splashWindow.webContents.send('status', 'Starting app...');
      setTimeout(() => createMainWindow(), 1000);
    }
  });
}

app.on('ready', () => {
  console.log(`StatusStrap v${app.getVersion()} starting...`);
  createSplash();
  
  setTimeout(() => {
    checkForUpdates();
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('get-version', (event) => {
  event.returnValue = app.getVersion();
});
