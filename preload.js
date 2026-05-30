const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultDirectory: () => ipcRenderer.invoke('get-default-directory'),
  
  startRecordingFile: (data) => ipcRenderer.invoke('start-recording-file', data),
  appendRecordingChunk: (data) => ipcRenderer.invoke('append-recording-chunk', data),
  stopRecordingFile: () => ipcRenderer.invoke('stop-recording-file'),
  
  openFileExplorer: (filePath) => ipcRenderer.invoke('open-file-explorer', filePath),
  playFile: (filePath) => ipcRenderer.invoke('play-file', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  
  getRecordingHistory: () => ipcRenderer.invoke('get-recording-history'),
  saveRecordingHistory: (historyList) => ipcRenderer.invoke('save-recording-history', historyList),
  
  // Floating Recording Control Widget APIs
  showRecordingWidget: () => ipcRenderer.invoke('show-recording-widget'),
  hideRecordingWidget: () => ipcRenderer.invoke('hide-recording-widget'),
  updateWidgetTimer: (timeStr) => ipcRenderer.invoke('update-widget-timer', timeStr),
  updateWidgetState: (state) => ipcRenderer.invoke('update-widget-state', state),
  
  onStopFromWidget: (callback) => ipcRenderer.on('stop-recording-from-widget', (event, data) => callback(data)),
  onPauseFromWidget: (callback) => ipcRenderer.on('pause-recording-from-widget', (event, data) => callback(data))
});
