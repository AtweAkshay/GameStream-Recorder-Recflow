const { ipcRenderer } = require('electron');

const timerDisplay = document.getElementById('widget-timer');
const btnPause = document.getElementById('btn-widget-pause');
const btnStop = document.getElementById('btn-widget-stop');
const pauseIcon = document.getElementById('pause-icon');

// SVG paths for play/pause
const pausePath = "M6 19h4V5H6v14zm8-14v14h4V5h-4z"; // Pause symbol (two bars)
const playPath = "M8 5v14l11-7z"; // Play symbol (triangle)

// 1. Stop button click -> forward to main
btnStop.addEventListener('click', () => {
  ipcRenderer.send('stop-recording-clicked');
});

// 2. Pause/Resume button click -> forward to main
btnPause.addEventListener('click', () => {
  ipcRenderer.send('pause-recording-clicked');
});

// 3. Listen for timer ticks from main process
ipcRenderer.on('update-timer', (event, timeStr) => {
  timerDisplay.textContent = timeStr;
});

// 4. Listen for state updates from main process to toggle Play/Pause icons
ipcRenderer.on('update-state', (event, state) => {
  if (state === 'paused') {
    pauseIcon.innerHTML = `<path d="${playPath}"/>`;
    btnPause.title = "Resume Recording";
  } else {
    pauseIcon.innerHTML = `<path d="${pausePath}"/>`;
    btnPause.title = "Pause Recording";
  }
});
