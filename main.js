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

// === EXTREME SECURITY MEASURES ===
function applyExtremeSecurity(window) {
  if (!window || window.isDestroyed()) return;
  
  // 1. Remove all menus
  Menu.setApplicationMenu(null);
  window.setMenu(null);
  
  // 2. Disable ALL dev tools (even in dev mode for production builds)
  window.webContents.closeDevTools();
  window.webContents.setDevToolsWebContents(null);
  window.webContents.on('devtools-opened', () => {
    window.webContents.closeDevTools();
    // Force close if somehow opened
    setTimeout(() => {
      if (!window.isDestroyed()) {
        window.webContents.closeDevTools();
      }
    }, 10);
  });
  
  // 3. Block ALL devtools-related shortcuts GLOBALLY
  globalShortcut.registerAll([
    'F12',
    'CommandOrControl+Shift+I',
    'CommandOrControl+Shift+J',
    'CommandOrControl+Shift+C',
    'CommandOrControl+U',
    'CommandOrControl+Shift+R',
    'CommandOrControl+R',
    'CommandOrControl+Shift+U',
    'Alt+CommandOrControl+I',
    'Option+CommandOrControl+I'
  ], () => {
    console.log('DevTools shortcut blocked globally');
    return true; // Block the shortcut
  });
  
  // 4. Block input at window level
  window.webContents.on('before-input-event', (event, input) => {
    // Block ALL function keys that could open dev tools
    if (input.key.startsWith('F') && input.key.length <= 3) {
      const fnNum = parseInt(input.key.substring(1));
      if (fnNum >= 1 && fnNum <= 12) {
        event.preventDefault();
        return;
      }
    }
    
    // Block ALL Ctrl/Cmd+Shift+[Key] combinations
    if ((input.control || input.meta) && input.shift) {
      const blockedKeys = ['I', 'J', 'C', 'K', 'U', 'R', 'S', 'D'];
      if (blockedKeys.includes(input.key.toUpperCase())) {
        event.preventDefault();
        return;
      }
    }
    
    // Block Alt+Menu
    if (input.alt && input.key === 'Menu') {
      event.preventDefault();
      return;
    }
    
    // Block Ctrl/Cmd+U (view source)
    if ((input.control || input.meta) && input.key.toUpperCase() === 'U') {
      event.preventDefault();
      return;
    }
  });
  
  // 5. Disable right-click
  window.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });
  
  // 6. Disable any devtools-related APIs
  if (app.isPackaged) {
    // Override devtools API if it exists
    window.webContents.executeJavaScript(`
      // Override any devtools-related functions
      if (window.devtools && window.devtools._inspectedWindow) {
        window.devtools._inspectedWindow = null;
      }
      
      // Disable console methods in production
      if (window.console) {
        const originalConsole = {...console};
        console.clear = function() {};
        console.debug = function() {};
        console.dir = function() {};
        console.dirxml = function() {};
        console.table = function() {};
        console.trace = function() {};
        console.group = function() {};
        console.groupCollapsed = function() {};
        console.groupEnd = function() {};
        
        // Still allow error/warning for debugging but redirect
        console.log = function(...args) {
          originalConsole.log('[StatusStrap Log]:', ...args);
        };
        console.error = function(...args) {
          originalConsole.error('[StatusStrap Error]:', ...args);
        };
        console.warn = function(...args) {
          originalConsole.warn('[StatusStrap Warning]:', ...args);
        };
      }
      
      // Block opening devtools via JavaScript
      Object.defineProperty(document, 'openDevTools', {
        value: function() {
          console.log('DevTools access blocked');
          return null;
        },
        writable: false,
        configurable: false
      });
      
      // Disable eval
      window.eval = null;
      
      // Remove __devtools properties
      delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      delete window.__REDUX_DEVTOOLS_EXTENSION__;
      delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
    `).catch(() => {});
  }
  
  // 7. Block navigation to devtools
  window.webContents.on('will-navigate', (event, url) => {
    if (url.includes('chrome-devtools://') || 
        url.includes('devtools://') || 
        url.includes('chrome://inspect')) {
      event.preventDefault();
      return;
    }
  });
  
  // 8. Block any new windows that might be devtools
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('chrome-devtools://') || 
        url.includes('devtools://') || 
        url.includes('chrome://inspect')) {
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  
  // 9. Periodic devtools check (every 2 seconds)
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
  
  securityCheckInterval = setInterval(() => {
    if (window && !window.isDestroyed()) {
      // Force close devtools if somehow opened
      window.webContents.closeDevTools();
      
      // Check if devtools are focused (could be separate window)
      window.webContents.executeJavaScript(`
        // Check if devtools are open via any method
        const isDevToolsOpen = 
          navigator.userAgent.includes('Chrome') && 
          (document.documentElement.style.height === '100%' || 
           window.outerHeight - window.innerHeight > 100);
        
        // If devtools detected, trigger security response
        if (isDevToolsOpen) {
          console.warn('Security violation: DevTools detected');
          // Could trigger a logout or security action here
          return true;
        }
        return false;
      `).then((detected) => {
        if (detected && window && !window.isDestroyed()) {
          console.log('Security: DevTools detected, taking action');
          window.webContents.closeDevTools();
          
          // Optional: Show warning or take action
          window.webContents.executeJavaScript(`
            alert('Security Warning: Developer Tools are not allowed in this application.');
            // Clear sensitive data if devtools detected
            if (window.__APP_TOKEN) {
              delete window.__APP_TOKEN;
              delete window.__STATUSSTRAP_APP;
              // Trigger re-auth or logout
              window.location.reload();
            }
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  }, 2000);
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
      devTools: false, // Force disable
      webSecurity: true,
      allowRunningInsecureContent: false,
      webgl: false,
      plugins: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'ScriptStreaming'
    }
  });
  
  // Apply extreme security
  applyExtremeSecurity(splashWindow);
  
  // Block any devtools attempt
  splashWindow.webContents.on('devtools-opened', () => {
    splashWindow.closeDevTools();
    splashWindow.destroy();
  });
  
  splashWindow.loadFile('splash.html');
  splashWindow.webContents.send('status', 'Starting StatusStrap...');
}

async function getReleaseDate(version) {
  // ... (keep your existing getReleaseDate function)
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
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false, // Force disable
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      disableBlinkFeatures: 'ScriptStreaming',
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      safeDialogs: true,
      safeDialogsMessage: 'StatusStrap Security Warning',
      disableHtmlFullscreenWindowResize: false
    }
  });
  
  // Apply extreme security to main window
  applyExtremeSecurity(mainWindow);
  
  // Additional: Block iframe devtools
  mainWindow.webContents.on('devtools-open-url', (event, url) => {
    event.preventDefault();
  });
  
  // Block all devtools-related IPC messages
  ipcMain.on('open-devtools', (event) => {
    event.returnValue = false;
  });
  
  ipcMain.on('toggle-devtools', (event) => {
    event.returnValue = false;
  });
  
  mainWindow.webContents.setUserAgent(`StatusStrap-App/${APP_CONFIG.APP_VERSION} Electron/${process.versions.electron}`);
  
  // Inject security code BEFORE page loads
  mainWindow.webContents.on('did-start-loading', () => {
    mainWindow.webContents.executeJavaScript(`
      // === SECURITY OVERRIDES ===
      // Override console before anything else
      (function() {
        const originalConsole = window.console || {};
        const noop = function() {};
        
        // In production, severely limit console
        if (window.location.protocol !== 'file:') {
          window.console = {
            log: function(...args) {
              originalConsole.log && originalConsole.log('[StatusStrap]:', ...args);
            },
            error: function(...args) {
              originalConsole.error && originalConsole.error('[StatusStrap Error]:', ...args);
            },
            warn: function(...args) {
              originalConsole.warn && originalConsole.warn('[StatusStrap Warning]:', ...args);
            },
            info: noop,
            debug: noop,
            dir: noop,
            dirxml: noop,
            table: noop,
            trace: noop,
            group: noop,
            groupCollapsed: noop,
            groupEnd: noop,
            clear: noop,
            count: noop,
            assert: noop,
            markTimeline: noop,
            profile: noop,
            profileEnd: noop,
            timeline: noop,
            timelineEnd: noop,
            time: noop,
            timeEnd: noop,
            timeStamp: noop,
            memory: noop
          };
        }
        
        // Block eval
        window.eval = null;
        window.eval.toString = function() { return 'function eval() { [native code] }'; };
        
        // Block Function constructor
        window.Function = function() {
          throw new Error('EvalError: Function constructor is disabled');
        };
        
        // Block setTimeout/setInterval with strings
        const originalSetTimeout = window.setTimeout;
        const originalSetInterval = window.setInterval;
        
        window.setTimeout = function(fn, delay) {
          if (typeof fn === 'string') {
            throw new Error('SecurityError: String arguments to setTimeout are not allowed');
          }
          return originalSetTimeout.call(this, fn, delay);
        };
        
        window.setInterval = function(fn, delay) {
          if (typeof fn === 'string') {
            throw new Error('SecurityError: String arguments to setInterval are not allowed');
          }
          return originalSetInterval.call(this, fn, delay);
        };
        
        // Block opening devtools via inspect
        document.addEventListener('inspect', function(e) {
          e.preventDefault();
          return false;
        }, true);
        
        // Block all right-clicks
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }, true);
        
        // Block all keyboard shortcuts for devtools
        document.addEventListener('keydown', function(e) {
          // Block F1-F12
          if (e.key.startsWith('F') && e.key.length <= 3) {
            const fnNum = parseInt(e.key.substring(1));
            if (fnNum >= 1 && fnNum <= 12) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
          
          // Block Ctrl/Cmd+Shift+ combinations
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            const blockedKeys = ['I', 'J', 'C', 'K', 'U', 'R', 'S', 'D', 'H', 'P', 'O', 'L', 'M'];
            if (blockedKeys.includes(e.key.toUpperCase())) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
          
          // Block Ctrl/Cmd+U
          if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === 'U' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
          
          // Block Alt+Menu
          if (e.altKey && e.key === 'Menu') {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }, true);
        
        // Remove devtools hooks
        delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        delete window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
        delete window.__REDUX_DEVTOOLS_EXTENSION__;
        delete window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__;
        delete window.__ANGULAR_DEVTOOLS__;
        
        // Block devtools detection bypass attempts
        Object.defineProperty(document, 'hidden', {
          get: function() { return false; },
          configurable: false
        });
        
        Object.defineProperty(document, 'visibilityState', {
          get: function() { return 'visible'; },
          configurable: false
        });
        
        console.log('[StatusStrap Security]: Maximum security layer activated');
      })();
      
      // Inject auth data
      delete window.__STATUSSTRAP_APP;
      delete window.__APP_TOKEN;
      delete window.__STATUSSTRAP_AUTH_EVENT;
      
      window.__STATUSSTRAP_APP = true;
      window.__APP_TOKEN = '${APP_CONFIG.APP_TOKEN}';
      window.__APP_VERSION = '${APP_CONFIG.APP_VERSION}';
      window.__ELECTRON = true;
      window.__ELECTRON_VERSION = '${process.versions.electron}';
      
      console.log('[StatusStrap Desktop App] Authentication injected with security layer');
    `).catch(err => console.error('Security injection failed:', err));
  });
  
  // Your existing did-finish-load code...
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
      
      window.__ELECTRON_DEBUG = {
        authenticated: true,
        version: '${APP_CONFIG.APP_VERSION}',
        userAgent: navigator.userAgent,
        electronVersion: '${process.versions.electron}'
      };
    `).catch(err => console.error('Failed to reinforce auth:', err));
  });
  
  // Your existing headers code...
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
  
  // Your existing ready-to-show animation code...
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

// Your existing auto-updater functions...
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
  // Unregister all shortcuts when app closes
  globalShortcut.unregisterAll();
  
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
  
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Clean up
  globalShortcut.unregisterAll();
  if (securityCheckInterval) {
    clearInterval(securityCheckInterval);
  }
});

// Your existing IPC handlers and global functions...
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
