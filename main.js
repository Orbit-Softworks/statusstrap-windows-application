const { app, BrowserWindow, ipcMain, Menu, globalShortcut, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const https = require('https');

let splashWindow;
let mainWindow;
let securityCheckInterval;

const APP_CONFIG = {
  APP_TOKEN: process.env.APP_TOKEN || 'STATUSSTRAP_APP_SECRET_2024_V1',
  APP_VERSION: app.getVersion() || '1.0.2'
};

function applyExtremeSecurity(window) {
  if (!window || window.isDestroyed()) return;
  
  console.log('Applying security measures to window');
  
  try {
    Menu.setApplicationMenu(null);
    window.setMenu(null);
  } catch (e) {
    console.log('Menu removal error:', e.message);
  }
  
  try {
    window.webContents.closeDevTools();
    
    window.webContents.on('devtools-opened', () => {
      console.log('DevTools opened event - closing');
      window.webContents.closeDevTools();
    });
    
    window.webContents.on('devtools-focused', () => {
      console.log('DevTools focused event - closing');
      window.webContents.closeDevTools();
    });
  } catch (e) {
    console.log('DevTools disabling error:', e.message);
  }
  
  try {
    const shortcuts = [
      'F12',
      'CommandOrControl+Shift+I',
      'CommandOrControl+Shift+J',
      'CommandOrControl+Shift+C',
      'CommandOrControl+U',
      'CommandOrControl+Shift+R',
      'CommandOrControl+R',
      'CommandOrControl+Shift+U',
      'Alt+CommandOrControl+I'
    ];
    
    shortcuts.forEach(shortcut => {
      try {
        const ret = globalShortcut.register(shortcut, () => {
          console.log(`Blocked shortcut: ${shortcut}`);
          return true;
        });
        
        if (!ret) {
          console.log(`Failed to register shortcut: ${shortcut}`);
        }
      } catch (e) {
        console.log(`Error registering shortcut ${shortcut}:`, e.message);
      }
    });
  } catch (e) {
    console.log('Global shortcut error:', e.message);
  }
  
  window.webContents.on('before-input-event', (event, input) => {
    try {
      if (input.key && input.key.startsWith('F')) {
        const fnNum = parseInt(input.key.substring(1));
        if (!isNaN(fnNum) && fnNum >= 1 && fnNum <= 12) {
          event.preventDefault();
          return;
        }
      }
      
      if ((input.control || input.meta) && input.shift && input.key) {
        const blockedKeys = ['I', 'J', 'C', 'K', 'U', 'R', 'S', 'D'];
        if (blockedKeys.includes(input.key.toUpperCase())) {
          event.preventDefault();
          return;
        }
      }
      
      if ((input.control || input.meta) && input.key && input.key.toUpperCase() === 'U' && !input.shift) {
        event.preventDefault();
        return;
      }
      
      if (input.alt && input.key === 'Menu') {
        event.preventDefault();
        return;
      }
    } catch (e) {
    }
  });
  
  window.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  
  window.webContents.on('will-navigate', (event, url) => {
    if (url.includes('chrome-devtools://') || 
        url.includes('devtools://') || 
        url.includes('chrome://inspect')) {
      event.preventDefault();
      return;
    }
  });
  
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('chrome-devtools://') || 
        url.includes('devtools://') || 
        url.includes('chrome://inspect')) {
      return { action: 'deny' };
    }
    
    if (url.includes('eiuyrqweptwoeihfdsjkcbnaadjxblfskjdhvndsbflav.vercel.app') || url.includes('github.com')) {
      return { action: 'allow' };
    }
    
    return { action: 'deny' };
  });
  
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
  
  securityCheckInterval = setInterval(() => {
    try {
      if (window && !window.isDestroyed()) {
        window.webContents.closeDevTools();
      }
    } catch (e) {
    }
  }, 5000);
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    transparent: true,
    center: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  
  applyExtremeSecurity(splashWindow);
  
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
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  
  applyExtremeSecurity(mainWindow);
  
  mainWindow.webContents.setUserAgent(`StatusStrap-App/${APP_CONFIG.APP_VERSION} Electron/${process.versions.electron}`);
  
  mainWindow.webContents.on('did-start-loading', () => {
    mainWindow.webContents.executeJavaScript(`
      // Block right-click
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      });
      
      // Block keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12') {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+Shift+I
        if (e.key === 'I' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+Shift+J
        if (e.key === 'J' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+Shift+C
        if (e.key === 'C' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+U
        if (e.key === 'U' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          return false;
        }
        
        // Ctrl+Shift+R
        if (e.key === 'R' && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          return false;
        }
      }, true);
      
      // Inject auth data
      delete window.__STATUSSTRAP_APP;
      delete window.__APP_TOKEN;
      delete window.__STATUSSTRAP_AUTH_EVENT;
      
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      window.__APP_VERSION = '${APP_CONFIG.APP_VERSION}';
      window.__ELECTRON = true;
      window.__ELECTRON_VERSION = '${process.versions.electron}';
      
      console.log('[StatusStrap Desktop App] Authentication injected IMMEDIATELY');
      console.log('[StatusStrap Desktop App] Version: ${APP_CONFIG.APP_VERSION}');
      console.log('[StatusStrap Desktop App] Token injected: ${APP_CONFIG.APP_TOKEN.substring(0, 8)}...');
    `).catch(err => console.error('Failed to inject immediate auth:', err));
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      window.__STATUSSTRAP_AUTH_EVENT = true;
      
      window.dispatchEvent(new CustomEvent('statusstrap-app-authenticated', {
        detail: {
          token: '${APP_CONFIG.APP_TOKEN}',
          version: '${APP_CONFIG.APP_VERSION}',
          timestamp: new Date().toISOString()
        }
      }));
      
      console.log('[StatusStrap Desktop App] Authentication reinforced with event');
      console.log('[StatusStrap Desktop App] Event dispatched to React');
      
      window.__ELECTRON_DEBUG = {
        authenticated: true,
        version: '${APP_CONFIG.APP_VERSION}',
        userAgent: navigator.userAgent,
        electronVersion: '${process.versions.electron}'
      };
    `).catch(err => console.error('Failed to reinforce auth:', err));
  });
  
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['X-StatusStrap-App'] = APP_CONFIG.APP_VERSION;
      details.requestHeaders['X-StatusStrap-Token'] = APP_CONFIG.APP_TOKEN;
      details.requestHeaders['X-Client-Source'] = 'electron-desktop-app';
      details.requestHeaders['User-Agent'] = `StatusStrap-App/${APP_CONFIG.APP_VERSION} Electron/${process.versions.electron}`;
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('Navigation attempt to:', url);
    if (!url.includes('eiuyrqweptwoeihfdsjkcbnaadjxblfskjdhvndsbflav.vercel.app')) {
      event.preventDefault();
      console.log('Blocked navigation to external URL');
    }
  });
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('eiuyrqweptwoeihfdsjkcbnaadjxblfskjdhvndsbflav.vercel.app') || url.includes('github.com')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
  
  mainWindow.loadURL('https://eiuyrqweptwoeihfdsjkcbnaadjxblfskjdhvndsbflav.vercel.app');
  
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
      setTimeout(() => {
        if (splashWindow.isDestroyed()) {
          mainWindow.show();
          return;
        }
        
        const splashBounds = splashWindow.getBounds();
        const targetBounds = { x: splashBounds.x - 350, y: splashBounds.y - 250, width: 1200, height: 800 };
        
        let steps = 40;
        let currentStep = 0;
        
        const resizeInterval = setInterval(() => {
          if (currentStep >= steps || splashWindow.isDestroyed()) {
            clearInterval(resizeInterval);
            
            if (!splashWindow.isDestroyed()) {
              mainWindow.setBounds(targetBounds);
              mainWindow.setOpacity(0);
              mainWindow.show();
              
              setTimeout(() => {
                if (!splashWindow.isDestroyed()) {
                  splashWindow.close();
                }
                
                let opacity = 0;
                const fadeInterval = setInterval(() => {
                  opacity += 0.02;
                  if (opacity >= 1) {
                    mainWindow.setOpacity(1);
                    clearInterval(fadeInterval);
                  } else {
                    mainWindow.setOpacity(opacity);
                  }
                }, 20);
              }, 300);
            }
            return;
          }
          
          currentStep++;
          const progress = currentStep / steps;
          const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          const newBounds = {
            x: Math.round(splashBounds.x + (targetBounds.x - splashBounds.x) * easeProgress),
            y: Math.round(splashBounds.y + (targetBounds.y - splashBounds.y) * easeProgress),
            width: Math.round(splashBounds.width + (targetBounds.width - splashBounds.width) * easeProgress),
            height: Math.round(splashBounds.height + (targetBounds.height - splashBounds.height) * easeProgress)
          };
          
          if (!splashWindow.isDestroyed()) {
            splashWindow.setBounds(newBounds);
          }
        }, 20);
      }, 2000);
    } else {
      mainWindow.show();
    }
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log('Dev mode: Skipping auto-update check');
    return false;
  }
  
  console.log('=== AUTO-UPDATER CONFIG ===');
  console.log('Current version:', app.getVersion());
  console.log('Feed provider: github');
  console.log('Owner: Orbit-Softworks');
  console.log('Repo: statusstrap-windows-application');
  console.log('Platform:', process.platform);
  
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
    console.log('Release notes:', info.releaseNotes);
    
    if (splashWindow) {
      splashWindow.webContents.send('status', `Update ${info.version} available!`);
      splashWindow.webContents.send('progress', 0);
    }
    
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
  console.log(`App Token: ${APP_CONFIG.APP_TOKEN}`);
  createSplash();
  
  setTimeout(() => {
    checkForUpdates();
  }, 1000);
});

app.on('window-all-closed', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {
    console.log('Error unregistering shortcuts:', e.message);
  }
  
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
  
  // Keep macOS behavior (don't quit when all windows are closed)
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch (e) {
    console.log('Error unregistering shortcuts on quit:', e.message);
  }
  
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
});

ipcMain.on('get-version', (event) => {
  event.returnValue = app.getVersion();
});

global.debugUpdate = () => {
  console.log('=== MANUAL UPDATE DEBUG ===');
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    console.log('Not in production mode');
  }
};

global.forceUpdateCheck = () => {
  console.log('=== FORCE UPDATE CHECK ===');
  checkForUpdates();
};

global.injectAuth = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Manually injecting auth...');
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      window.__STATUSSTRAP_AUTH_EVENT = true;
      
      window.dispatchEvent(new CustomEvent('statusstrap-app-authenticated', {
        detail: {
          token: '${APP_CONFIG.APP_TOKEN}',
          version: '${APP_CONFIG.APP_VERSION}'
        }
      }));
      
      console.log('[DEBUG] Auth injected and event dispatched');
    `);
  } else {
    console.log('Main window not available');
  }
};

global.checkAuthStatus = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Auth Status:');
      console.log('  __STATUSSTRAP_APP:', window.__STATUSSTRAP_APP);
      console.log('  __APP_TOKEN:', window.__APP_TOKEN ? '***' + window.__APP_TOKEN.slice(-4) : 'Not set');
      console.log('  __STATUSSTRAP_AUTH_EVENT:', window.__STATUSSTRAP_AUTH_EVENT);
      console.log('  User Agent:', navigator.userAgent);
      
      return {
        hasApp: !!window.__STATUSSTRAP_APP,
        hasToken: !!window.__APP_TOKEN,
        hasAuthEvent: !!window.__STATUSSTRAP_AUTH_EVENT,
        userAgent: navigator.userAgent,
        tokenMatchesExpected: window.__APP_TOKEN === '${APP_CONFIG.APP_TOKEN}'
      };
    `).then(result => {
      console.log('Auth check result:', result);
    });
  }
};

global.simulateWebsite = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Simulating website (no auth)...');
      delete window.__STATUSSTRAP_APP;
      delete window.__APP_TOKEN;
      delete window.__STATUSSTRAP_AUTH_EVENT;
      delete window.__ELECTRON;
      delete window.__ELECTRON_VERSION;
      
      console.log('[DEBUG] All auth flags removed (simulating website)');
      console.log('[DEBUG] Reloading page to trigger auth check...');
      window.location.reload();
    `);
  }
};

global.reauthenticate = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(`
      console.log('[DEBUG] Forcing re-authentication...');
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      window.__STATUSSTRAP_AUTH_EVENT = true;
      
      window.dispatchEvent(new CustomEvent('statusstrap-app-authenticated', {
        detail: {
          token: '${APP_CONFIG.APP_TOKEN}',
          version: '${APP_CONFIG.APP_VERSION}',
          forced: true
        }
      }));
      
      console.log('[DEBUG] Re-authentication complete');
    `);
  }
};
