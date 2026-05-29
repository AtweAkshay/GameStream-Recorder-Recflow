const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
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
