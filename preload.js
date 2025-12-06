const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Data methods
    getBootstrappers: () => ipcRenderer.sendSync('get-bootstrappers'),
    getStoredVersions: () => ipcRenderer.sendSync('get-stored-versions'),
    saveVersions: (versions) => ipcRenderer.send('save-versions', versions),
    
    // GitHub methods
    fetchGitHubRelease: (repo) => new Promise((resolve) => {
        ipcRenderer.once('github-release-response', (event, data) => {
            resolve(data);
        });
        ipcRenderer.send('fetch-github-release', repo);
    }),
    
    // Action methods
    downloadBootstrapper: (bootstrapper) => ipcRenderer.send('download-bootstrapper', bootstrapper),
    joinDiscord: (url) => ipcRenderer.send('join-discord', url),
    openGitHub: (repo) => ipcRenderer.send('open-github', repo),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    
    // Update methods
    sendDiscordNotification: (title, oldVersion, newVersion, description, platform, image, isPrerelease) => 
        new Promise((resolve) => {
            ipcRenderer.once('discord-notification-sent', (event, success) => {
                resolve(success);
            });
            ipcRenderer.send('send-discord-notification', title, oldVersion, newVersion, description, platform, image, isPrerelease);
        }),
    checkUpdates: () => new Promise((resolve) => {
        ipcRenderer.once('update-check-completed', () => resolve());
        ipcRenderer.send('check-updates');
    }),
    
    // Event listeners for bootstrapper updates
    onBootstrapperUpdated: (callback) => {
        ipcRenderer.on('bootstrapper-updated', (event, data) => callback(data));
    },
    
    // App info
    getAppVersion: () => require('electron').ipcRenderer.sendSync('get-version')
});
