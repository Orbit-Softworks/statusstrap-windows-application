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
      path: `/repos/Orbit-Softworks/statusstrap-windows-application/releases/tags/v${version}`,
      method: 'GET',
      headers: {
        'User-Agent': 'StatusStrap-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        console.log(`GitHub API returned ${res.statusCode}`);
        req.destroy();
        resolve(null);
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
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
      console.error('Failed to fetch release date:', err.message);
      resolve(null);
    });

    req.setTimeout(3000, () => {
      console.log('Release date fetch timeout');
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
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
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
  console.log('Repo: statusstrap-windows-application');
  
  // Configure GitHub repository for updates
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Orbit-Softworks',
    repo: 'statusstrap-windows-application'
  });
  
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;
  
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status', 'Checking for updates...');
    }
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('=== UPDATE AVAILABLE ===');
    console.log('Version:', info.version);
    console.log('Release date:', info.releaseDate);
    
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status', `Update ${info.version} available!`);
      splashWindow.webContents.send('progress', 0);
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    console.log('No updates available');
    if (splashWindow && !splashWindow.isDestroyed()) {
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
    
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('progress', percent);
      splashWindow.webContents.send('status', `Downloading... ${percent}%`);
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('=== UPDATE DOWNLOADED ===');
    console.log('Version ready to install:', info.version);
    
    if (splashWindow && !splashWindow.isDestroyed()) {
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
    console.error('Error stack:', err.stack);
    
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status', 'Update failed, starting app...');
      setTimeout(() => createMainWindow(), 1500);
    } else {
      createMainWindow();
    }
  });
  
  return true;
}

async function checkForUpdates() {
  // DEBUG: Uncomment the next 2 lines to skip update checks temporarily
  // console.log('DEBUG: Skipping update check');
  // setTimeout(() => createMainWindow(), 1000);
  // return;

  if (!setupAutoUpdater()) {
    console.log('Dev mode: Starting app without update check');
    setTimeout(() => createMainWindow(), 1000);
    return;
  }
  
  console.log('Starting update check...');
  
  // Set a timeout for the entire update check process
  const updateTimeout = setTimeout(() => {
    console.log('Update check timeout, starting app...');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status', 'Starting app...');
      setTimeout(() => createMainWindow(), 500);
    }
  }, 8000); // Reduced from 15s to 8s
  
  try {
    const result = await autoUpdater.checkForUpdates();
    clearTimeout(updateTimeout);
    console.log('Update check completed:', result);
    
    // If no update or error in result, proceed
    if (!result || !result.updateInfo) {
      console.log('No updates available');
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('status', 'Starting app...');
        setTimeout(() => createMainWindow(), 500);
      }
    }
  } catch (err) {
    clearTimeout(updateTimeout);
    console.error('Update check failed:', err);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status', 'Starting app...');
      setTimeout(() => createMainWindow(), 500);
    }
  }
}

app.on('ready', () => {
  console.log(`StatusStrap v${app.getVersion()} starting...`);
  createSplash();
  
  // Give splash screen time to render before starting update check
  setTimeout(() => {
    checkForUpdates();
  }, 500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('get-version', (event) => {
  event.returnValue = app.getVersion();
});

// Add this for better error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Try to start the main window even if there's an error
  if (!mainWindow && splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status', 'Error occurred, starting app...');
    setTimeout(() => createMainWindow(), 1000);
  }
});
