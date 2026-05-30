const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let floatingWidget = null;
let activeRecordStream = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0c', // Deep dark theme background
    title: 'Local Screen Recorder',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    },
    // We keep standard frame for ease of window dragging and snapping, but we can style the client area exquisitely
    frame: true
  });

  mainWindow.maximize();
  mainWindow.loadFile('index.html');
  
  // Open devtools in development if needed
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// 1. Fetch screens and windows capture sources
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 220, height: 124 }, // 16:9 ratio thumbnails
      fetchWindowIcons: true
    });
    
    if (!sources || sources.length === 0) {
      // Fallback mock screen for headless test environments
      return [{
        id: 'screen:mock',
        name: 'Mock Screen',
        thumbnail: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        appIcon: null
      }];
    }
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  } catch (error) {
    console.error('Error fetching sources:', error);
    return [];
  }
});

// 2. Choose directory for recordings
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder to Save Recordings'
  });
  
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

// 3. Get default recordings directory
ipcMain.handle('get-default-directory', () => {
  return app.getPath('videos');
});

// 4. Robust Real-time File Recorder (Chunk appending)
let currentRecordingFilePath = '';

ipcMain.handle('start-recording-file', async (event, { folderPath, filename }) => {
  try {
    // If no folder path provided, default to Videos/ScreenRecordings
    let targetFolder = folderPath || app.getPath('videos');
    
    // Ensure target folder exists
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    currentRecordingFilePath = path.join(targetFolder, filename);
    
    // Open/Create file empty
    fs.writeFileSync(currentRecordingFilePath, Buffer.alloc(0));
    console.log(`Started recording file at: ${currentRecordingFilePath}`);
    return { success: true, filePath: currentRecordingFilePath };
  } catch (error) {
    console.error('Error starting recording file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('append-recording-chunk', async (event, { chunkArrayBuffer }) => {
  try {
    if (!currentRecordingFilePath) {
      throw new Error('No active recording file stream');
    }
    
    const buffer = Buffer.from(chunkArrayBuffer);
    fs.appendFileSync(currentRecordingFilePath, buffer);
    return { success: true };
  } catch (error) {
    console.error('Error appending chunk:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-recording-file', async () => {
  try {
    const savedPath = currentRecordingFilePath;
    currentRecordingFilePath = '';
    console.log(`Finished writing file: ${savedPath}`);
    
    if (fs.existsSync(savedPath)) {
      const stats = fs.statSync(savedPath);
      return { 
        success: true, 
        filePath: savedPath, 
        sizeBytes: stats.size,
        filename: path.basename(savedPath)
      };
    } else {
      throw new Error('Recording file not found');
    }
  } catch (error) {
    console.error('Error stopping recording file:', error);
    return { success: false, error: error.message };
  }
});

// 5. Open a file in explorer
ipcMain.handle('open-file-explorer', async (event, filePath) => {
  const { shell } = require('electron');
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// 6. Play file (open with default system player)
ipcMain.handle('play-file', async (event, filePath) => {
  const { shell } = require('electron');
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

// 7. Delete file
ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
});

// 8. Manage recordings database (saved in userData directory)
const dbPath = path.join(app.getPath('userData'), 'recording_history.json');

ipcMain.handle('get-recording-history', () => {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error reading recording history:', error);
    return [];
  }
});

ipcMain.handle('save-recording-history', (event, historyList) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(historyList, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving recording history:', error);
    return false;
  }
});

// --- FLOATING RECORDING WIDGET IPC HANDLERS ---

ipcMain.handle('show-recording-widget', () => {
  if (floatingWidget) return { success: true };
  
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  
  floatingWidget = new BrowserWindow({
    width: 200,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false, // Prevents taking focus away from games or browser windows
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  floatingWidget.loadFile('widget.html');
  
  // Position in bottom-left above the taskbar
  floatingWidget.setPosition(20, height - 70);
  
  // CRITICAL: Exclude this widget from ALL screen recordings!
  floatingWidget.setContentProtection(true);
  
  floatingWidget.on('closed', () => {
    floatingWidget = null;
  });
  
  return { success: true };
});

ipcMain.handle('hide-recording-widget', () => {
  if (floatingWidget) {
    floatingWidget.close();
    floatingWidget = null;
  }
  return { success: true };
});

ipcMain.handle('update-widget-timer', (event, timeStr) => {
  if (floatingWidget && !floatingWidget.isDestroyed()) {
    floatingWidget.webContents.send('update-timer', timeStr);
  }
  return { success: true };
});

ipcMain.handle('update-widget-state', (event, state) => {
  if (floatingWidget && !floatingWidget.isDestroyed()) {
    floatingWidget.webContents.send('update-state', state);
  }
  return { success: true };
});

// Relay events clicked inside the widget directly back to the main app renderer
ipcMain.on('stop-recording-clicked', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stop-recording-from-widget');
  }
});

ipcMain.on('pause-recording-clicked', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pause-recording-from-widget');
  }
});
