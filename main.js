const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const https = require('https');

let splashWindow;
let mainWindow;

// ===== AUTHENTICATION CONFIG =====
const APP_CONFIG = {
  // Set this token in your build process or environment
  APP_TOKEN: process.env.APP_TOKEN || 'STATUSSTRAP_APP_SECRET_2024_V1',
  APP_VERSION: app.getVersion() || '1.0.2'
};
// =================================

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

    // Timeout after 5 seconds
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
      contextIsolation: true,
      // Optional: Add a preload script if needed for additional security
    }
  });
  
  // ===== AUTHENTICATION SETUP =====
  // 1. Set custom User Agent for your app
  mainWindow.webContents.setUserAgent(`StatusStrap-App/${APP_CONFIG.APP_VERSION} Electron/${process.versions.electron}`);
  
  // 2. Inject authentication token after website loads
  mainWindow.webContents.on('did-finish-load', () => {
    // Wait a bit to ensure website JavaScript is loaded
    setTimeout(() => {
      mainWindow.webContents.executeJavaScript(`
        // Set app authentication flags
        window.__STATUSSTRAP_APP = true;
        window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
        window.__APP_VERSION = '${APP_CONFIG.APP_VERSION}';
        window.__ELECTRON = true;
        window.__ELECTRON_VERSION = '${process.versions.electron}';
        
        console.log('[StatusStrap Desktop App] Authentication injected');
        console.log('[StatusStrap Desktop App] Version: ${APP_CONFIG.APP_VERSION}');
        
        // Dispatch an event that your website can listen for
        window.dispatchEvent(new CustomEvent('statusstrap-app-authenticated', {
          detail: {
            token: '${APP_CONFIG.APP_TOKEN}',
            version: '${APP_CONFIG.APP_VERSION}'
          }
        }));
      `).catch(err => console.error('Failed to inject auth:', err));
    }, 1000);
  });
  
  // 3. Add custom headers to all requests (optional but recommended)
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['X-StatusStrap-App'] = APP_CONFIG.APP_VERSION;
      details.requestHeaders['X-StatusStrap-Token'] = APP_CONFIG.APP_TOKEN;
      details.requestHeaders['X-Client-Source'] = 'electron-desktop-app';
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  
  // 4. Listen for when the main window is about to navigate
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('Navigation attempt to:', url);
    // You could add additional security checks here
  });
  // =================================
  
  mainWindow.loadURL('https://statusstrap.live');
  
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
      // Wait longer before starting transition (let user see "Starting app..." message)
      setTimeout(() => {
        if (splashWindow.isDestroyed()) {
          mainWindow.show();
          return;
        }
        
        // Smooth transition from splash to main
        const splashBounds = splashWindow.getBounds();
        const targetBounds = { x: splashBounds.x - 350, y: splashBounds.y - 250, width: 1200, height: 800 };
        
        // Animate splash window resize (slower - 40 steps instead of 20)
        let steps = 40;
        let currentStep = 0;
        
        const resizeInterval = setInterval(() => {
          if (currentStep >= steps || splashWindow.isDestroyed()) {
            clearInterval(resizeInterval);
            
            if (!splashWindow.isDestroyed()) {
              // Position main window at final location
              mainWindow.setBounds(targetBounds);
              mainWindow.setOpacity(0);
              mainWindow.show();
              
              // Wait a moment with black screen
              setTimeout(() => {
                // Close splash
                if (!splashWindow.isDestroyed()) {
                  splashWindow.close();
                }
                
                // Fade in main window slowly
                let opacity = 0;
                const fadeInterval = setInterval(() => {
                  opacity += 0.02; // Slower fade (was 0.05)
                  if (opacity >= 1) {
                    mainWindow.setOpacity(1);
                    clearInterval(fadeInterval);
                  } else {
                    mainWindow.setOpacity(opacity);
                  }
                }, 20); // Slightly slower interval
              }, 300); // Show black screen for 300ms
            }
            return;
          }
          
          currentStep++;
          const progress = currentStep / steps;
          const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2; // easeInOutQuad
          
          const newBounds = {
            x: Math.round(splashBounds.x + (targetBounds.x - splashBounds.x) * easeProgress),
            y: Math.round(splashBounds.y + (targetBounds.y - splashBounds.y) * easeProgress),
            width: Math.round(splashBounds.width + (targetBounds.width - splashBounds.width) * easeProgress),
            height: Math.round(splashBounds.height + (targetBounds.height - splashBounds.height) * easeProgress)
          };
          
          if (!splashWindow.isDestroyed()) {
            splashWindow.setBounds(newBounds);
          }
        }, 20); // Slightly slower (was 16ms)
      }, 2000); // Wait 2 seconds after main window is ready before starting transition
    } else {
      mainWindow.show();
    }
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
  
  // CRITICAL: Configure auto-updater
  autoUpdater.autoDownload = true; // Must be true!
  autoUpdater.autoInstallOnAppQuit = true; // Install on quit
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;
  
  // Event handlers
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
    console.log('Release notes:', info.releaseNotes);
    
    if (splashWindow) {
      splashWindow.webContents.send('status', `Update ${info.version} available!`);
      splashWindow.webContents.send('progress', 0);
    }
    
    // Auto-download should start automatically with autoDownload = true
    console.log('Auto-download starting...');
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
    console.log('Bytes per second:', progress.bytesPerSecond);
    console.log('Transferred:', progress.transferred, 'Total:', progress.total);
    
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
      
      // Ask user to restart (or auto-restart after delay)
      setTimeout(() => {
        splashWindow.webContents.send('status', 'Restarting to install update...');
        
        // Give user 2 seconds to see the message, then restart
        setTimeout(() => {
          console.log('Calling quitAndInstall()...');
          autoUpdater.quitAndInstall(true, true); // isSilent = true, isForceRunAfter = true
        }, 2000);
      }, 1000);
    } else {
      // If no splash window, just install
      autoUpdater.quitAndInstall(true, true);
    }
  });
  
  autoUpdater.on('error', (err) => {
    console.error('=== AUTO-UPDATE ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    
    // Check for specific errors
    if (err.message.includes('404') || err.message.includes('Not Found')) {
      console.error('ERROR: latest.yml or installer not found on GitHub');
      console.error('Check that the release contains: latest.yml and .exe file');
    } else if (err.message.includes('sha512') || err.message.includes('checksum')) {
      console.error('ERROR: File hash mismatch');
    } else if (err.message.includes('net::ERR')) {
      console.error('ERROR: Network error');
    } else if (err.message.includes('GitHub')) {
      console.error('ERROR: GitHub API error');
    }
    
    // Continue to app even if update fails
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
    // Not in production, just start the app
    setTimeout(() => createMainWindow(), 2000);
    return;
  }
  
  console.log('Starting update check...');
  
  // Set a timeout in case update check hangs
  const updateTimeout = setTimeout(() => {
    console.log('Update check timeout, starting app...');
    if (splashWindow) {
      splashWindow.webContents.send('status', 'Starting app...');
      setTimeout(() => createMainWindow(), 1000);
    }
  }, 15000); // 15 second timeout
  
  // Start the update check
  autoUpdater.checkForUpdates().then(result => {
    clearTimeout(updateTimeout);
    console.log('Update check result:', result);
    
    // If no update available, result will be null
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
  console.log(`App Token: ${APP_CONFIG.APP_TOKEN}`);
  createSplash();
  
  // Wait for splash to render, then check for updates
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

// Debug helper
global.debugUpdate = () => {
  console.log('=== MANUAL UPDATE DEBUG ===');
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    console.log('Not in production mode');
  }
};

// Force update check (for testing)
global.forceUpdateCheck = () => {
  console.log('=== FORCE UPDATE CHECK ===');
  checkForUpdates();
};

// ===== AUTHENTICATION DEBUGGING =====
// Add a way to manually trigger auth injection (for testing)
global.injectAuth = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Manually injecting auth...');
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      console.log('[DEBUG] Auth injected:', window.__STATUSSTRAP_APP);
    `);
  } else {
    console.log('Main window not available');
  }
};

// Check authentication status
global.checkAuthStatus = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Auth Status:');
      console.log('  __STATUSSTRAP_APP:', window.__STATUSSTRAP_APP);
      console.log('  __APP_TOKEN:', window.__APP_TOKEN ? '***' + window.__APP_TOKEN.slice(-4) : 'Not set');
      console.log('  User Agent:', navigator.userAgent);
      
      return {
        hasApp: !!window.__STATUSSTRAP_APP,
        hasToken: !!window.__APP_TOKEN,
        userAgent: navigator.userAgent
      };
    `).then(result => {
      console.log('Auth check result:', result);
    });
  }
};
