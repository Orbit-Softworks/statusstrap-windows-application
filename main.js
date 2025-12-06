const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow;
let tray = null;
let versionsCache = {};

// ===== BOOTSTRAPPER & MOD DATA (Direct copy from your website) =====
const bootstrappers = [
  {
    title: "Fishstrap",
    githubRepo: "fishstrap/fishstrap",
    website: "https://statusstrap.live/download/bootstrappers/fishstrap",
    discord: "https://discord.gg/dZJSbgHx8y",
    platform: "Windows",
    image: "https://i.ibb.co/ymZnSCLj/fishstrap.png",
    tags: ["Fast Boot", "Dev-Grade Tools", "Profile Switching", "Recommended"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Bloxstrap",
    githubRepo: "bloxstraplabs/bloxstrap",
    website: "https://statusstrap.live/download/bootstrappers/bloxstrap",
    discord: "https://discord.gg/nKjV3mGq6R",
    platform: "Windows",
    image: "https://i.ibb.co/HT0SH7H1/bloxstrap.png",
    tags: ["Mods", "Themes", "Multi-Instance", "Stable"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Froststrap",
    githubRepo: "RealMeddsam/Froststrap",
    website: "https://statusstrap.live/download/bootstrappers/froststrap",
    discord: "https://discord.gg/yUv36zs3ax",
    platform: "Windows",
    image: "https://i.ibb.co/fYzdV8vp/froststrap.png",
    tags: ["Ultra-Fast Boot", "Minimal Overhead", "Clean UI"],
    working: false,
    type: "Bootstrapper"
  },
  {
    title: "Chevstrap",
    githubRepo: "FrosSky/Chevstrap",
    website: "https://statusstrap.live/download/bootstrappers/chevstrap",
    discord: "https://discord.gg/rWkJ6Uh46U",
    platform: "Android",
    image: "https://i.ibb.co/4R2hkLzY/chevstrap.png",
    tags: ["Touch-First", "Android Optimized", "Alt Manager"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Appleblox",
    githubRepo: "AppleBlox/appleblox",
    website: "https://statusstrap.live/download/bootstrappers/appleblox",
    discord: "https://discord.gg/MWHgn8VNZT",
    platform: "MacOS",
    image: "https://i.ibb.co/C5RK7Wm7/appleblox.png",
    tags: ["Apple Silicon Native", "macOS Optimized", "Retina Ready"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Roothide",
    githubRepo: "roothide/Bootstrap",
    website: "https://statusstrap.live/download/bootstrappers/roothide",
    discord: "https://discord.gg/ZvY2Yjw8GA",
    platform: "iOS",
    image: "https://i.ibb.co/fzfSzGz3/roothide.jpg",
    tags: ["iOS Native", "Touch Optimized", "No Jailbreak Needed"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Lution",
    githubRepo: "Wookhq/Lution",
    website: "https://statusstrap.live/download/bootstrappers/lution",
    discord: "https://discord.gg/BXT7FYjTBa",
    platform: "Linux",
    image: "https://i.ibb.co/tTWKFgBk/lution.jpg",
    tags: ["Linux Native", "Wine-Free", "Open Source"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Silverr",
    githubRepo: "Wookhq/Silverr",
    website: "https://statusstrap.live/download/bootstrappers/silverr",
    discord: "https://discord.gg/BXT7FYjTBa",
    platform: "Linux",
    image: "https://i.ibb.co/Mx8vgfSt/Silverr.png",
    tags: ["Linux Native", "Wine-Free", "Open Source"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "OrangeBlox",
    githubRepo: "EfazDev/orangeblox",
    website: "https://statusstrap.live/download/bootstrappers/orangeblox",
    discord: "https://discord.gg/QkMZ53jZwk",
    platform: "Windows",
    image: "https://i.ibb.co/hxv3PCP6/AppIcon.png",
    tags: ["Fast Boot", "Mod Installation", "Multi-Instance", "Power User Pick"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Vinegar",
    githubRepo: "vinegarhq/vinegar",
    website: "https://statusstrap.live/download/bootstrappers/vinegar",
    discord: "https://discord.gg/dzdzZ6Pps2",
    platform: "Linux",
    image: "https://i.ibb.co/chmR76FC/vinegar.png",
    tags: ["Fast Boot", "Linux Optimized", "Configurable", "Studio Powerhouse"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "DroidBlox",
    githubRepo: "meowstrapper/DroidBlox",
    website: "https://statusstrap.live/download/bootstrappers/droidblox",
    discord: "https://discord.gg/zFspvBwH92",
    platform: "Android",
    image: "https://i.ibb.co/xKMVg0hD/droidblox.png",
    tags: ["Android-Optimized Launch", "Activity Tracking", "RPC Integration", "Mobile Powerhouse"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "BloxMac",
    githubRepo: "Yop1-BSecretKikx/BloxMac",
    website: "https://statusstrap.live/download/bootstrappers/bloxmac",
    discord: "https://discord.gg/x7gkhSzX8B",
    platform: "MacOS",
    image: "https://i.ibb.co/gMLj02Cj/bloxmac.png",
    tags: ["Mac-Native Launch", "Seamless Setup", "FastFlag Customization", "Power User Pick"],
    working: true,
    type: "Bootstrapper"
  },
  {
    title: "Luczystrap",
    githubRepo: "Luc6i/Luczystrap",
    website: "https://statusstrap.live/download/bootstrappers/luczystrap",
    discord: "https://discord.gg/QRhRA7XjjZ",
    platform: "Windows",
    image: "https://i.ibb.co/gZyH0F5w/luczystrap.png",
    tags: ["Quick Launch", "Flag Mastery", "Mod Vault", "Secure Profiles"],
    working: false,
    type: "Bootstrapper"
  }
];

const mods = [
  // Add your mods here if you have any
  {
    title: "Synapse X",
    githubRepo: "",
    website: "https://x.synapse.to",
    discord: "https://discord.gg/synapsex",
    platform: "Windows",
    image: "https://i.ibb.co/example/synapse.png",
    tags: ["Script Executor", "Premium", "Powerful"],
    working: true,
    type: "Mod"
  },
  {
    title: "Script-Ware",
    githubRepo: "",
    website: "https://script-ware.com",
    discord: "https://discord.gg/scriptware",
    platform: "Windows",
    image: "https://i.ibb.co/example/scriptware.png",
    tags: ["Script Executor", "Multi-Platform", "Modern"],
    working: true,
    type: "Mod"
  }
];

// ===== UTILITY FUNCTIONS =====
function loadStoredVersions() {
  try {
    const versionFilePath = path.join(app.getPath('userData'), 'versions.json');
    if (fs.existsSync(versionFilePath)) {
      const data = fs.readFileSync(versionFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading versions:', error);
  }
  return {};
}

function saveVersions(versions) {
  try {
    const versionFilePath = path.join(app.getPath('userData'), 'versions.json');
    fs.writeFileSync(versionFilePath, JSON.stringify(versions, null, 2));
  } catch (error) {
    console.error('Error saving versions:', error);
  }
}

async function fetchGitHubRelease(repo) {
  return new Promise((resolve, reject) => {
    if (!repo) {
      resolve({
        version: "Manual",
        lastUpdated: "Manual Update",
        description: "",
        success: true,
        isManual: true
      });
      return;
    }

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases`,
      headers: {
        'User-Agent': 'StatusStrap-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const releases = JSON.parse(data);
          if (!releases || releases.length === 0) {
            resolve({
              version: "No Releases",
              lastUpdated: "Not Available",
              description: "",
              success: false
            });
            return;
          }

          const sortedReleases = releases.sort((a, b) => 
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
          );
          
          const latestRelease = sortedReleases[0];
          const version = extractVersion(latestRelease.name || latestRelease.tag_name || "Unknown");
          const isPrerelease = latestRelease.prerelease || false;
          
          resolve({
            version: `v${version}${isPrerelease ? '-beta' : ''}`,
            lastUpdated: new Date(latestRelease.published_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            description: latestRelease.body || "No description available",
            success: true,
            isPrerelease
          });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

function extractVersion(text) {
  if (!text) return "Unknown";
  
  const versionMatch = text.match(/v?(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/i);
  if (versionMatch) {
    return versionMatch[1];
  }
  
  const numbersMatch = text.match(/(\d+(?:\.\d+)*)/);
  if (numbersMatch) {
    return numbersMatch[1];
  }
  
  return text;
}

async function sendDiscordNotification(launcher, oldVersion, newVersion, description, platform, image, isPrerelease = false) {
  try {
    const webhookUrl = "YOUR_DISCORD_WEBHOOK_HERE"; // Add your webhook URL
    
    const platformConfig = {
      "Windows": { emoji: "🪟", color: 15158332 },
      "Android": { emoji: "📱", color: 15158332 },
      "MacOS": { emoji: "🍎", color: 15158332 },
      "iOS": { emoji: "📱", color: 15158332 },
      "Linux": { emoji: "🐧", color: 15158332 }
    };

    const platformInfo = platformConfig[platform] || { emoji: "⚙️", color: 15158332 };

    const embed = {
      title: `${isPrerelease ? '🚧' : '🎉'} ${launcher} ${newVersion} Released!`,
      color: isPrerelease ? 15158332 : platformInfo.color,
      description: `A new version of **${launcher}** has been published!`,
      thumbnail: {
        url: image || "https://i.ibb.co/zTFZDhbR/status-strap-christmas-b.png"
      },
      fields: [
        {
          name: `${platformInfo.emoji} Platform`,
          value: `**${platform}**`,
          inline: true
        },
        {
          name: "📈 Version Change",
          value: `\`${oldVersion}\` → \`${newVersion}\``,
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "StatusStrap App • Live Release Tracker",
        icon_url: "https://i.ibb.co/zTFZDhbR/status-strap-christmas-b.png"
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
        username: "StatusStrap Tracker",
        avatar_url: "https://i.ibb.co/zTFZDhbR/status-strap-christmas-b.png"
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Discord webhook error:', error);
    return false;
  }
}

function showDesktopNotification(title, body, icon = null) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: icon || path.join(__dirname, 'assets', 'icon.png'),
      silent: false
    });
    
    notification.show();
    
    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    return true;
  }
  return false;
}

// ===== CREATE MAIN WINDOW =====
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    icon: iconPath,
    backgroundColor: '#000000',
    title: 'StatusStrap v1.19 - Roblox Launcher Tracker',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    frame: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 13 }
  });

  // Load the HTML file with embedded CSS and JS
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Start auto-update checks
    startAutoUpdateChecks();
    
    // DevTools for development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Create application menu
  createMenu();

  // Create system tray
  createTray();
}

// ===== AUTO-UPDATE CHECKER =====
let updateInterval;

async function checkAllBootstrappers() {
  try {
    const storedVersions = loadStoredVersions();
    const bootstrappersToCheck = [...bootstrappers, ...mods];
    
    for (const bootstrapper of bootstrappersToCheck) {
      if (bootstrapper.githubRepo && bootstrapper.working) {
        try {
          const releaseData = await fetchGitHubRelease(bootstrapper.githubRepo);
          
          if (releaseData.success && !releaseData.isManual) {
            const oldVersion = storedVersions[bootstrapper.title] || "Unknown";
            const newVersion = releaseData.version;
            
            // Check if version changed
            if (oldVersion !== newVersion && 
                newVersion !== "Unknown" && 
                newVersion !== "Error" && 
                newVersion !== "No Releases") {
              
              // Update stored version
              storedVersions[bootstrapper.title] = newVersion;
              saveVersions(storedVersions);
              
              // Send notifications
              showDesktopNotification(
                `${bootstrapper.title} Update Available!`,
                `Updated from ${oldVersion} to ${newVersion}`,
                bootstrapper.image
              );
              
              // Send Discord notification
              await sendDiscordNotification(
                bootstrapper.title,
                oldVersion,
                newVersion,
                releaseData.description,
                bootstrapper.platform,
                bootstrapper.image,
                releaseData.isPrerelease
              );
              
              // Update UI if window is loaded
              if (mainWindow) {
                mainWindow.webContents.send('bootstrapper-updated', {
                  title: bootstrapper.title,
                  version: newVersion,
                  lastUpdated: releaseData.lastUpdated,
                  isPrerelease: releaseData.isPrerelease
                });
              }
              
              console.log(`Update detected: ${bootstrapper.title} ${oldVersion} → ${newVersion}`);
            }
          }
        } catch (error) {
          console.error(`Error checking ${bootstrapper.title}:`, error);
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error in auto-update check:', error);
  }
}

function startAutoUpdateChecks() {
  // Check immediately on start
  checkAllBootstrappers();
  
  // Check every 10 minutes
  updateInterval = setInterval(checkAllBootstrappers, 10 * 60 * 1000);
}

// ===== CREATE APPLICATION MENU =====
function createMenu() {
  const template = [
    {
      label: 'StatusStrap',
      submenu: [
        {
          label: 'About StatusStrap',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                scrollToSection('credits');
              `);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: async () => {
            if (mainWindow) {
              mainWindow.webContents.send('checking-updates');
              await checkAllBootstrappers();
              mainWindow.webContents.send('updates-checked');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'Shift+CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Home',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                window.location.hash = '';
                document.querySelector('.overflow-y-auto').scrollTo({ top: 0, behavior: 'smooth' });
              `);
            }
          }
        },
        {
          label: 'Bootstrappers',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                scrollToSection('bootstrappers');
              `);
            }
          }
        },
        {
          label: 'Mods',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                scrollToSection('mods');
              `);
            }
          }
        },
        {
          label: 'Credits',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                scrollToSection('credits');
              `);
            }
          }
        }
      ]
    },
    {
      label: 'Bootstrappers',
      submenu: bootstrappers.map(b => ({
        label: b.title,
        enabled: b.working,
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
              openBootstrapper('${b.title}');
            `);
          }
        }
      }))
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Clear Cache',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.session.clearCache().then(() => {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Cache Cleared',
                  message: 'Application cache has been cleared successfully.',
                  buttons: ['OK']
                });
              });
            }
          }
        },
        {
          label: 'Clear Version History',
          click: () => {
            const versionFilePath = path.join(app.getPath('userData'), 'versions.json');
            if (fs.existsSync(versionFilePath)) {
              fs.unlinkSync(versionFilePath);
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'History Cleared',
                message: 'Version history has been cleared.',
                buttons: ['OK']
              });
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Website',
          click: () => {
            shell.openExternal('https://statusstrap.live');
          }
        },
        {
          label: 'Discord Server',
          click: () => {
            shell.openExternal('https://discord.gg/statusstrap');
          }
        },
        {
          label: 'GitHub',
          click: () => {
            shell.openExternal('https://github.com/Orbit-Softworks/statusstrap-app');
          }
        },
        { type: 'separator' },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/Orbit-Softworks/statusstrap-app/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ===== CREATE SYSTEM TRAY =====
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  tray = new Tray(iconPath || nativeImage.createEmpty());
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show StatusStrap',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: async () => {
        if (mainWindow) {
          mainWindow.webContents.send('checking-updates');
          await checkAllBootstrappers();
          mainWindow.webContents.send('updates-checked');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Bootstrappers',
      submenu: bootstrappers.slice(0, 5).map(b => ({
        label: b.title,
        enabled: b.working,
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.executeJavaScript(`
              openBootstrapper('${b.title}');
            `);
          }
        }
      }))
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('StatusStrap - Roblox Launcher Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// ===== IPC HANDLERS =====
ipcMain.on('get-bootstrappers', (event) => {
  event.returnValue = { bootstrappers, mods };
});

ipcMain.on('get-stored-versions', (event) => {
  event.returnValue = loadStoredVersions();
});

ipcMain.on('save-versions', (event, versions) => {
  saveVersions(versions);
});

ipcMain.on('fetch-github-release', async (event, repo) => {
  try {
    const data = await fetchGitHubRelease(repo);
    event.reply('github-release-response', { repo, data });
  } catch (error) {
    event.reply('github-release-response', { repo, error: error.message });
  }
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('download-bootstrapper', (event, bootstrapper) => {
  // Open download page in default browser
  if (bootstrapper.website) {
    shell.openExternal(bootstrapper.website);
  }
  
  // Show notification
  showDesktopNotification(
    `Downloading ${bootstrapper.title}`,
    'Opening download page in your browser...',
    bootstrapper.image
  );
});

ipcMain.on('join-discord', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('open-github', (event, repo) => {
  shell.openExternal(`https://github.com/${repo}`);
});

ipcMain.on('check-updates', async (event) => {
  event.reply('update-check-started');
  await checkAllBootstrappers();
  event.reply('update-check-completed');
});

// ===== APP EVENT HANDLERS =====
app.whenReady().then(() => {
  // Set app name
  if (process.platform === 'darwin') {
    app.setName('StatusStrap');
  }
  
  // Create window
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up intervals
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
