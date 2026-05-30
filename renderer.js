// Local Screen Recorder - Front-end logical engine

// DOM Elements
const pathDisplay = document.getElementById('path-display');
const btnSelectFolder = document.getElementById('btn-select-folder');

const toggleScreen = document.getElementById('toggle-screen');
const btnSelectSource = document.getElementById('btn-select-source');
const selectedSourcePreview = document.getElementById('selected-source-preview');
const sourceOverlayLabel = document.getElementById('source-overlay-label');

const toggleCamera = document.getElementById('toggle-camera');
const selectCamera = document.getElementById('select-camera');
const webcamConfigDrawer = document.getElementById('webcam-config-drawer');
const shapeCircleBtn = document.getElementById('shape-circle');
const shapeRectBtn = document.getElementById('shape-rect');
const posTlBtn = document.getElementById('pos-tl');
const posTrBtn = document.getElementById('pos-tr');
const posBlBtn = document.getElementById('pos-bl');
const posBrBtn = document.getElementById('pos-br');
const webcamSizeSlider = document.getElementById('webcam-size');
const webcamSizeVal = document.getElementById('webcam-size-val');

const toggleMic = document.getElementById('toggle-mic');
const selectMic = document.getElementById('select-mic');
const volumeMicSlider = document.getElementById('volume-mic');
const volumeMicVal = document.getElementById('volume-mic-val');
const vuMicFill = document.getElementById('vu-mic');

const toggleSystemAudio = document.getElementById('toggle-system-audio');
const volumeSystemSlider = document.getElementById('volume-system');
const volumeSystemVal = document.getElementById('volume-system-val');
const vuSystemFill = document.getElementById('vu-system');

const btnRecord = document.getElementById('btn-record');
const btnRecordText = document.getElementById('btn-record-text');
const btnPause = document.getElementById('btn-pause');
const recordingStatsContainer = document.getElementById('recording-stats-container');
const recordingTimer = document.getElementById('recording-timer');
const statusDot = document.getElementById('status-dot');

const libraryList = document.getElementById('library-list');
const libraryCount = document.getElementById('library-count');
const libraryEmpty = document.getElementById('library-empty');

// Modals
const modalSelectSource = document.getElementById('modal-select-source');
const modalBtnClose = document.getElementById('modal-btn-close');
const tabScreens = document.getElementById('tab-screens');
const tabWindows = document.getElementById('tab-windows');
const sourcesGrid = document.getElementById('sources-grid');

const modalPlayer = document.getElementById('modal-player');
const playerBtnClose = document.getElementById('player-btn-close');
const previewVideo = document.getElementById('preview-video');
const playerTitle = document.getElementById('player-title');

const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');

// Video elements for canvas mixing
const screenVideoEl = document.getElementById('screen-video-element');
const cameraVideoEl = document.getElementById('camera-video-element');
const mixerCanvas = document.getElementById('mixer-canvas');
const mixerCtx = mixerCanvas.getContext('2d');

// UI Preview Webcam elements
const webcamUiPreviewContainer = document.getElementById('webcam-ui-preview-container');
const webcamUiPreviewEl = document.getElementById('webcam-ui-preview');

// Mic Level Monitoring variables (for testing before recording)
let monitorStream = null;
let monitorContext = null;
let monitorSource = null;
let monitorAnalyser = null;
let monitorGainNode = null;
let monitorInterval = null;

// State Variables
let saveDirectory = '';
let activeScreenSourceId = '';
let activeScreenSourceName = '';
let activeScreenSourceThumb = '';
let activeCameraId = '';
let activeMicId = '';

let screenStream = null;
let cameraStream = null;
let micStream = null;

// Audio mixing nodes
let audioContext = null;
let audioDestination = null;
let micGainNode = null;
let systemGainNode = null;
let micAnalyser = null;
let systemAnalyser = null;
let vuMeterInterval = null;

// Webcam styling state
let webcamShape = 'circle'; // circle or rect
let webcamPosition = 'br';  // tl, tr, bl, br
let webcamSizePct = 18;    // percentage of video width

// Recording management
let mediaRecorder = null;
let recordStartTime = 0;
let recordTimerInterval = null;
let recordingElapsedMs = 0;
let isRecording = false;
let isPaused = false;
let activeChunkWrites = 0;
let canvasAnimFrame = null;
let sourceSources = []; // Store fetched desktop sources
let currentTab = 'screens'; // 'screens' or 'windows'
let recordingHistory = [];

// --- INITIALIZATION ---

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Get default save folder
    saveDirectory = await window.api.getDefaultDirectory();
    updateSaveDirectoryDisplay();
    
    // 2. Load recording history
    await loadHistory();
    
    // 3. Enumerate video and audio devices
    await refreshDevices();
    
    // 4. Register event listeners
    registerEventListeners();
    
    // 5. Start pre-recording mic monitoring VU testing
    await startMicMonitoring();
    
    // 6. Select default screen (primary screen) automatically if available
    await selectPrimaryScreenDefault();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});

// Update the output folder display in header
function updateSaveDirectoryDisplay() {
  pathDisplay.textContent = saveDirectory;
  pathDisplay.title = saveDirectory;
}

// Automatically pick the first full screen as the default capture source
async function selectPrimaryScreenDefault() {
  const sources = await window.api.getSources();
  const primaryScreen = sources.find(s => s.id.startsWith('screen:'));
  if (primaryScreen) {
    selectSource(primaryScreen.id, primaryScreen.name, primaryScreen.thumbnail);
  }
}

// Enumerates all mics and webcams
async function refreshDevices() {
  // Request temporary permissions to get device labels
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch (e) {
    console.warn('Initial permission request rejected/ignored. Labels might be empty.');
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  
  // Clear lists
  selectMic.innerHTML = '<option value="">Select Microphone...</option>';
  selectCamera.innerHTML = '<option value="">Select Camera...</option>';
  
  let micCount = 0;
  let camCount = 0;
  
  devices.forEach(device => {
    if (device.kind === 'audioinput') {
      micCount++;
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${micCount}`;
      selectMic.appendChild(option);
    } else if (device.kind === 'videoinput') {
      camCount++;
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${camCount}`;
      selectCamera.appendChild(option);
    }
  });
  
  // Auto-select first device if available
  if (selectMic.options.length > 1) {
    selectMic.selectedIndex = 1;
    activeMicId = selectMic.options[1].value;
  }
  if (selectCamera.options.length > 1) {
    selectCamera.selectedIndex = 1;
    activeCameraId = selectCamera.options[1].value;
  }
}

// History loaders
async function loadHistory() {
  recordingHistory = await window.api.getRecordingHistory();
  renderHistory();
}

async function saveHistory() {
  await window.api.saveRecordingHistory(recordingHistory);
  renderHistory();
}

function renderHistory() {
  libraryCount.textContent = recordingHistory.length;
  
  if (recordingHistory.length === 0) {
    libraryEmpty.style.display = 'flex';
    // Remove existing cards
    const cards = libraryList.querySelectorAll('.library-card');
    cards.forEach(c => c.remove());
    return;
  }
  
  libraryEmpty.style.display = 'none';
  
  // Clear only library card items (preserve empty state tag structure)
  const cards = libraryList.querySelectorAll('.library-card');
  cards.forEach(c => c.remove());
  
  // Render cards sorted by date desc
  const sortedHistory = [...recordingHistory].sort((a, b) => b.timestamp - a.timestamp);
  
  sortedHistory.forEach(item => {
    const card = document.createElement('div');
    card.className = 'library-card';
    card.dataset.filePath = item.filePath;
    
    const formattedDate = new Date(item.timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const sizeMB = (item.sizeBytes / (1024 * 1024)).toFixed(1);
    
    card.innerHTML = `
      <div class="card-info" style="cursor: pointer;">
        <div class="recording-title" title="${item.filename}">${item.filename}</div>
        <div class="recording-meta">
          <span>${formattedDate}</span>
          <span>•</span>
          <span>${item.duration}</span>
          <span>•</span>
          <span>${sizeMB} MB</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-card-action btn-play" title="Preview inside application">
          <svg viewBox="0 0 24 24" class="svg-icon"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="btn-card-action btn-folder" title="Show in File Explorer">
          <svg viewBox="0 0 24 24" class="svg-icon"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 12H4V8h14v10z"/></svg>
        </button>
        <button class="btn-card-action btn-delete" title="Delete recording permanently">
          <svg viewBox="0 0 24 24" class="svg-icon"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;
    
    // Event listeners on buttons
    card.querySelector('.card-info').addEventListener('click', () => playVideoInApp(item));
    card.querySelector('.btn-play').addEventListener('click', () => playVideoInApp(item));
    
    card.querySelector('.btn-folder').addEventListener('click', () => {
      window.api.openFileExplorer(item.filePath);
    });
    
    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete "${item.filename}" permanently? This cannot be undone.`)) {
        const deleted = await window.api.deleteFile(item.filePath);
        if (deleted) {
          recordingHistory = recordingHistory.filter(h => h.filePath !== item.filePath);
          await saveHistory();
        } else {
          alert('Could not delete file (it may have already been deleted or is open in another app).');
        }
      }
    });
    
    libraryList.appendChild(card);
  });
}

function playVideoInApp(item) {
  if (item.filename.toLowerCase().endsWith('.mkv')) {
    // Matroska (.mkv) container is not natively supported for playing in Chromium <video> tag, so we open in default system player
    window.api.playFile(item.filePath);
  } else {
    playerTitle.textContent = item.filename;
    previewVideo.src = `file:///${item.filePath.replace(/\\/g, '/')}`;
    modalPlayer.style.display = 'flex';
  }
}

// --- EVENT LISTENERS REGISTRATION ---

function registerEventListeners() {
  // Folder selector
  btnSelectFolder.addEventListener('click', async () => {
    const selected = await window.api.selectDirectory();
    if (selected) {
      saveDirectory = selected;
      updateSaveDirectoryDisplay();
    }
  });
  
  // Screen selection switches
  toggleScreen.addEventListener('change', (e) => {
    const card = document.getElementById('card-screen');
    if (e.target.checked) {
      card.classList.add('active');
      btnSelectSource.disabled = false;
    } else {
      card.classList.remove('active');
      btnSelectSource.disabled = true;
    }
  });

  btnSelectSource.addEventListener('click', () => {
    openSourceModal();
  });
  
  modalBtnClose.addEventListener('click', () => {
    modalSelectSource.style.display = 'none';
  });
  
  tabScreens.addEventListener('click', () => {
    currentTab = 'screens';
    tabScreens.classList.add('active');
    tabWindows.classList.remove('active');
    renderSourcesGrid();
  });
  
  tabWindows.addEventListener('click', () => {
    currentTab = 'windows';
    tabWindows.classList.add('active');
    tabScreens.classList.remove('active');
    renderSourcesGrid();
  });

  // Camera selection switches
  toggleCamera.addEventListener('change', async (e) => {
    const card = document.getElementById('card-camera');
    if (e.target.checked) {
      card.classList.add('active');
      selectCamera.disabled = false;
      webcamConfigDrawer.style.display = 'flex';
      activeCameraId = selectCamera.value;
      await startWebcamPreview();
    } else {
      card.classList.remove('active');
      selectCamera.disabled = true;
      webcamConfigDrawer.style.display = 'none';
      stopWebcamPreview();
    }
  });
  
  selectCamera.addEventListener('change', async (e) => {
    activeCameraId = e.target.value;
    if (toggleCamera.checked) {
      await startWebcamPreview();
    }
  });
  
  // Microphone selection
  toggleMic.addEventListener('change', (e) => {
    const card = document.getElementById('card-mic');
    if (e.target.checked) {
      card.classList.add('active');
      selectMic.disabled = false;
      activeMicId = selectMic.value;
      startMicMonitoring();
    } else {
      card.classList.remove('active');
      selectMic.disabled = true;
      stopMicMonitoring();
    }
  });
  
  selectMic.addEventListener('change', (e) => {
    activeMicId = e.target.value;
    if (toggleMic.checked) {
      startMicMonitoring();
    }
  });

  // System audio selection
  toggleSystemAudio.addEventListener('change', (e) => {
    const card = document.getElementById('card-system-audio');
    if (e.target.checked) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
      vuSystemFill.style.width = '0%';
    }
  });

  // Webcam Overlay Styles Controls
  shapeCircleBtn.addEventListener('click', () => {
    webcamShape = 'circle';
    shapeCircleBtn.classList.add('active');
    shapeRectBtn.classList.remove('active');
  });
  
  shapeRectBtn.addEventListener('click', () => {
    webcamShape = 'rect';
    shapeRectBtn.classList.add('active');
    shapeCircleBtn.classList.remove('active');
  });
  
  const posBtns = [posTlBtn, posTrBtn, posBlBtn, posBrBtn];
  const posMapping = { 'pos-tl': 'tl', 'pos-tr': 'tr', 'pos-bl': 'bl', 'pos-br': 'br' };
  
  posBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      posBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      webcamPosition = posMapping[btn.id];
    });
  });
  
  webcamSizeSlider.addEventListener('input', (e) => {
    webcamSizePct = parseInt(e.target.value);
    webcamSizeVal.textContent = `${webcamSizePct}%`;
  });

  // Volume Sliders Value display binding
  volumeMicSlider.addEventListener('input', (e) => {
    volumeMicVal.textContent = `${e.target.value}%`;
    if (micGainNode && audioContext) {
      micGainNode.gain.setValueAtTime(e.target.value / 100, audioContext.currentTime);
    }
    // Update pre-recording monitor gain instantly
    if (monitorGainNode && monitorContext) {
      monitorGainNode.gain.setValueAtTime(e.target.value / 100, monitorContext.currentTime);
    }
  });

  volumeSystemSlider.addEventListener('input', (e) => {
    volumeSystemVal.textContent = `${e.target.value}%`;
    if (systemGainNode) {
      systemGainNode.gain.setValueAtTime(e.target.value / 100, audioContext.currentTime);
    }
  });

  // Main Record Buttons
  btnRecord.addEventListener('click', () => {
    if (!isRecording) {
      triggerCountdown();
    } else {
      stopRecording();
    }
  });
  
  btnPause.addEventListener('click', () => {
    if (isRecording) {
      if (!isPaused) {
        pauseRecording();
      } else {
        resumeRecording();
      }
    }
  });

  // Player Close
  playerBtnClose.addEventListener('click', () => {
    modalPlayer.style.display = 'none';
    previewVideo.src = ''; // stop playing
  });
}

// --- WEBCAM PREVIEW UTILS ---

async function startWebcamPreview() {
  if (cameraStream) {
    stopWebcamPreview();
  }
  
  if (!activeCameraId) return;
  
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: activeCameraId },
        width: 640,
        height: 480
      },
      audio: false
    });
    
    cameraVideoEl.srcObject = cameraStream;
    cameraVideoEl.play();
    
    // Bind to visible UI preview
    if (webcamUiPreviewContainer && webcamUiPreviewEl) {
      webcamUiPreviewContainer.style.display = 'block';
      webcamUiPreviewEl.srcObject = cameraStream;
      webcamUiPreviewEl.play().catch(e => console.warn('UI Webcam preview autoplay block:', e));
    }
  } catch (error) {
    console.error('Error starting webcam preview:', error);
  }
}

function stopWebcamPreview() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraVideoEl.srcObject = null;
  
  if (webcamUiPreviewContainer && webcamUiPreviewEl) {
    webcamUiPreviewContainer.style.display = 'none';
    webcamUiPreviewEl.srcObject = null;
  }
}

// --- SOURCE SELECTOR MODAL ---

async function openSourceModal() {
  modalSelectSource.style.display = 'flex';
  
  // Show spinner / loading in grid
  sourcesGrid.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--color-text-secondary); padding: 40px;">Fetching screens and windows...</div>';
  
  sourceSources = await window.api.getSources();
  renderSourcesGrid();
}

function renderSourcesGrid() {
  sourcesGrid.innerHTML = '';
  
  // Filter by tab
  const filtered = sourceSources.filter(source => {
    if (currentTab === 'screens') {
      return source.id.startsWith('screen:');
    } else {
      return !source.id.startsWith('screen:');
    }
  });
  
  if (filtered.length === 0) {
    sourcesGrid.innerHTML = `<div style="grid-column: span 3; text-align: center; color: var(--color-text-dark); padding: 40px;">No available ${currentTab} found.</div>`;
    return;
  }
  
  filtered.forEach(source => {
    const item = document.createElement('div');
    item.className = 'source-item';
    
    item.innerHTML = `
      <div class="source-item-thumb">
        <img src="${source.thumbnail}" alt="${source.name}">
      </div>
      <div class="source-item-title">
        ${source.appIcon ? `<img class="app-icon" src="${source.appIcon}">` : ''}
        <span>${source.name}</span>
      </div>
    `;
    
    item.addEventListener('click', () => {
      selectSource(source.id, source.name, source.thumbnail);
      modalSelectSource.style.display = 'none';
    });
    
    sourcesGrid.appendChild(item);
  });
}

function selectSource(id, name, thumbnail) {
  activeScreenSourceId = id;
  activeScreenSourceName = name;
  activeScreenSourceThumb = thumbnail;
  
  if (sourceOverlayLabel) {
    sourceOverlayLabel.textContent = name;
    sourceOverlayLabel.style.display = 'block';
  }
  
  if (thumbnail && mixerCtx) {
    const img = new Image();
    img.onload = () => {
      // Clear the canvas and draw the selected source's thumbnail
      mixerCtx.fillStyle = '#08080c';
      mixerCtx.fillRect(0, 0, mixerCanvas.width, mixerCanvas.height);
      
      const canvasWidth = mixerCanvas.width;
      const canvasHeight = mixerCanvas.height;
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;
      
      let drawWidth = canvasWidth;
      let drawHeight = canvasHeight;
      let x = 0;
      let y = 0;
      
      if (imgRatio > canvasRatio) {
        drawHeight = canvasWidth / imgRatio;
        y = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgRatio;
        x = (canvasWidth - drawWidth) / 2;
      }
      
      mixerCtx.drawImage(img, x, y, drawWidth, drawHeight);
    };
    img.src = thumbnail;
  }
}

// --- MIC PRE-RECORDING MONITORING (VU TEST) ---

async function startMicMonitoring() {
  // Stop existing monitor first
  stopMicMonitoring();
  
  if (!toggleMic.checked || !activeMicId || isRecording) {
    return;
  }
  
  try {
    monitorStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: activeMicId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    
    monitorContext = new (window.AudioContext || window.webkitAudioContext)();
    monitorSource = monitorContext.createMediaStreamSource(monitorStream);
    
    monitorGainNode = monitorContext.createGain();
    monitorGainNode.gain.setValueAtTime(volumeMicSlider.value / 100, monitorContext.currentTime);
    
    monitorAnalyser = monitorContext.createAnalyser();
    monitorAnalyser.fftSize = 64;
    
    monitorSource.connect(monitorGainNode);
    monitorGainNode.connect(monitorAnalyser);
    
    monitorInterval = setInterval(() => {
      if (isRecording) {
        stopMicMonitoring();
        return;
      }
      if (monitorAnalyser) {
        const array = new Uint8Array(monitorAnalyser.frequencyBinCount);
        monitorAnalyser.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
          sum += array[i];
        }
        const average = sum / array.length;
        const pct = Math.min(100, Math.round((average / 110) * 100));
        vuMicFill.style.width = `${pct}%`;
      }
    }, 100);
    
    console.log('Mic pre-recording monitoring started.');
  } catch (error) {
    console.error('Error starting mic monitoring:', error);
  }
}

function stopMicMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  if (monitorStream) {
    monitorStream.getTracks().forEach(track => track.stop());
    monitorStream = null;
  }
  
  if (monitorContext) {
    if (monitorContext.state !== 'closed') {
      monitorContext.close().catch(e => {});
    }
    monitorContext = null;
  }
  
  monitorSource = null;
  monitorGainNode = null;
  monitorAnalyser = null;
  
  if (!isRecording) {
    vuMicFill.style.width = '0%';
  }
}

// --- COUNTDOWN SYSTEM ---

function triggerCountdown() {
  // Validate selection
  if (toggleScreen.checked && !activeScreenSourceId) {
    alert('Please select a screen or window to record!');
    return;
  }
  
  if (!toggleScreen.checked && !toggleCamera.checked) {
    alert('Please select at least one video source (Screen Capture or Webcam) to record!');
    return;
  }
  
  let count = 5;
  countdownNumber.textContent = count;
  countdownOverlay.style.display = 'flex';
  
  // Play minor ticking sound if wanted (synthesized via Web Audio API)
  playBeep(440, 0.1);
  
  const countTimer = setInterval(() => {
    count--;
    
    if (count > 0) {
      countdownNumber.textContent = count;
      playBeep(440, 0.1);
    } else if (count === 0) {
      countdownNumber.textContent = "GO!";
      playBeep(880, 0.3);
    } else {
      clearInterval(countTimer);
      countdownOverlay.style.display = 'none';
      startRecording();
    }
  }, 1000);
}

// Synthesize a beep sound for the countdown
function playBeep(frequency, duration) {
  try {
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = tempCtx.createOscillator();
    const gain = tempCtx.createGain();
    
    osc.connect(gain);
    gain.connect(tempCtx.destination);
    
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, tempCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, tempCtx.currentTime + duration);
    
    osc.start();
    osc.stop(tempCtx.currentTime + duration);
    
    setTimeout(() => {
      tempCtx.close();
    }, (duration + 0.1) * 1000);
  } catch (e) {
    console.warn('Audio synthesis beep failed:', e);
  }
}

// --- RECORDING CORE ENGINE ---

async function startRecording() {
  try {
    console.log('Initializing capture streams...');
    
    // Stop pre-recording mic monitor safely to release hardware
    stopMicMonitoring();
    
    // Hide text overlay on capture start
    if (sourceOverlayLabel) {
      sourceOverlayLabel.style.display = 'none';
    }
    
    // Reset indicators
    isRecording = true;
    isPaused = false;
    btnRecord.classList.add('recording');
    btnRecordText.textContent = 'STOP RECORDING';
    btnPause.style.display = 'block';
    btnPause.textContent = 'PAUSE';
    recordingStatsContainer.style.display = 'flex';
    statusDot.className = 'status-dot recording';
    
    // Create Audio Context for real-time mixing
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioDestination = audioContext.createMediaStreamDestination();
    
    let hasAudioTrack = false;
    
    // 1. Capture screen stream
    if (toggleScreen.checked && activeScreenSourceId) {
      const constraints = {
        audio: toggleSystemAudio.checked ? {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeScreenSourceId
          }
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeScreenSourceId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 60
          }
        }
      };
      
      screenStream = await navigator.mediaDevices.getUserMedia(constraints);
      screenVideoEl.srcObject = screenStream;
      screenVideoEl.play();
      
      // Hook up system audio to mixer if available in stream
      const systemAudioTracks = screenStream.getAudioTracks();
      if (toggleSystemAudio.checked && systemAudioTracks.length > 0) {
        const sysSourceNode = audioContext.createMediaStreamSource(new MediaStream([systemAudioTracks[0]]));
        
        systemGainNode = audioContext.createGain();
        systemGainNode.gain.setValueAtTime(volumeSystemSlider.value / 100, audioContext.currentTime);
        
        systemAnalyser = audioContext.createAnalyser();
        systemAnalyser.fftSize = 64;
        
        sysSourceNode.connect(systemGainNode);
        systemGainNode.connect(systemAnalyser);
        systemGainNode.connect(audioDestination);
        hasAudioTrack = true;
        console.log('System audio track connected to Web Audio mixer.');
      }
    }
    
    // 2. Capture Webcam stream
    if (toggleCamera.checked && activeCameraId) {
      if (!cameraStream) {
        await startWebcamPreview();
      }
    }
    
    // 3. Capture Microphone stream
    if (toggleMic.checked && activeMicId) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: activeMicId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        
        const micSourceNode = audioContext.createMediaStreamSource(micStream);
        
        micGainNode = audioContext.createGain();
        micGainNode.gain.setValueAtTime(volumeMicSlider.value / 100, audioContext.currentTime);
        
        micAnalyser = audioContext.createAnalyser();
        micAnalyser.fftSize = 64;
        
        micSourceNode.connect(micGainNode);
        micGainNode.connect(micAnalyser);
        micGainNode.connect(audioDestination);
        hasAudioTrack = true;
        console.log('Microphone audio track connected to Web Audio mixer.');
      } catch (micErr) {
        console.error('Could not capture microphone device:', micErr);
      }
    }
    
    // 4. Start canvas renderer loop (video mixer)
    startCanvasMixingLoop();
    
    // 5. Gather tracks for recording
    const recordStream = new MediaStream();
    
    // Add mixed canvas video track (60fps)
    const canvasStream = mixerCanvas.captureStream(60);
    recordStream.addTrack(canvasStream.getVideoTracks()[0]);
    
    // Add mixed audio track
    if (hasAudioTrack) {
      const mixedAudioTrack = audioDestination.stream.getAudioTracks()[0];
      recordStream.addTrack(mixedAudioTrack);
    }
    
    // 6. Determine preferred format and appropriate file extension
    const formatVal = document.getElementById('select-format')?.value || 'mkv';
    console.log(`Preferred format selected by user: ${formatVal}`);
    
    let ext = formatVal === 'mkv' ? 'mkv' : 'webm';
    
    // We utilize the ultra-stable, built-in Chromium VP9/VP8 software encoders which are 100% guaranteed to work on all hardware configurations (unlike system H.264 which frequently fails to initialize on Windows GPU sandboxes).
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    let selectedMimeType = '';
    for (const candidate of candidates) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        selectedMimeType = candidate;
        break;
      }
    }
    
    if (!selectedMimeType) {
      selectedMimeType = 'video/webm';
    }
    
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `RecFlow-${timestampStr}.${ext}`;
    
    const fileResult = await window.api.startRecordingFile({
      folderPath: saveDirectory,
      filename: filename
    });
    
    if (!fileResult.success) {
      throw new Error(`Failed to initialize local file: ${fileResult.error}`);
    }
    
    // Draw initial blank frame on canvas to warm up capture stream layout parameters (prevents empty video tracks)
    mixerCtx.fillStyle = '#08080c';
    mixerCtx.fillRect(0, 0, mixerCanvas.width, mixerCanvas.height);
    
    // 7. Initialize and start MediaRecorder with optimal mimeType
    console.log(`Starting MediaRecorder with mimeType: ${selectedMimeType}`);
    mediaRecorder = new MediaRecorder(recordStream, { mimeType: selectedMimeType });
    
    // Asynchronous error handler to alert the user if encoder initialization fails
    mediaRecorder.onerror = (e) => {
      console.error('MediaRecorder asynchronous error:', e);
      alert(`MediaRecorder error: ${e.error ? e.error.message : e.message || 'Failed to encode recording.'}`);
    };
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        activeChunkWrites++;
        try {
          const arrayBuffer = await event.data.arrayBuffer();
          await window.api.appendRecordingChunk({ chunkArrayBuffer: arrayBuffer });
        } catch (err) {
          console.error('Error writing chunk:', err);
        } finally {
          activeChunkWrites--;
        }
      }
    };
    
    mediaRecorder.onstop = async () => {
      console.log('MediaRecorder stopped. Finalizing active chunk writes...');
      
      // Stop canvas loop
      cancelAnimationFrame(canvasAnimFrame);
      
      // Stop all capturing streams
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      // If camera preview wasn't explicitly checked, keep it, otherwise stop
      if (!toggleCamera.checked) {
        stopWebcamPreview();
      }
      
      // Close Web Audio
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      
      // Wait for all outstanding chunk writes to fully write to disk first
      while (activeChunkWrites > 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Finalize file
      const result = await window.api.stopRecordingFile();
      
      if (result.success) {
        // Log to history
        const durationStr = formatMs(recordingElapsedMs);
        const newRecord = {
          filePath: result.filePath,
          filename: result.filename,
          sizeBytes: result.sizeBytes,
          duration: durationStr,
          timestamp: Date.now()
        };
        
        recordingHistory.push(newRecord);
        await saveHistory();
      } else {
        alert(`Error finalizing saved recording: ${result.error}`);
      }
      
      // Reset variables
      isRecording = false;
      isPaused = false;
      btnRecord.classList.remove('recording');
      btnRecordText.textContent = 'START RECORDING';
      btnPause.style.display = 'none';
      recordingStatsContainer.style.display = 'none';
      statusDot.className = 'status-dot idle';
      
      if (sourceOverlayLabel) {
        sourceOverlayLabel.style.display = 'block';
      }
      
      // Reset VUs
      vuMicFill.style.width = '0%';
      vuSystemFill.style.width = '0%';
      
      // Restart mic monitoring testing after a short release delay
      setTimeout(() => {
        if (toggleMic.checked && !isRecording) {
          startMicMonitoring();
        }
      }, 1000);
    };
    
    // Trigger recording chunk collection every 2 seconds (safe incremental buffer saving)
    mediaRecorder.start(2000);
    
    // Start timers and audio VUs
    recordStartTime = Date.now();
    recordingElapsedMs = 0;
    
    recordTimerInterval = setInterval(() => {
      if (!isPaused) {
        recordingElapsedMs += 1000;
        recordingTimer.textContent = formatMs(recordingElapsedMs);
      }
    }, 1000);
    
    startVUMeters();
    
  } catch (err) {
    console.error('Fatal error starting recording:', err);
    alert(`Could not start recording: ${err.message}`);
    resetUIOnFailure();
  }
}

function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    isPaused = true;
    btnPause.textContent = 'RESUME';
    statusDot.className = 'status-dot idle'; // stop pulsing red
  }
}

function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    isPaused = false;
    btnPause.textContent = 'PAUSE';
    statusDot.className = 'status-dot recording';
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  if (recordTimerInterval) {
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
  }
  
  if (vuMeterInterval) {
    clearInterval(vuMeterInterval);
    vuMeterInterval = null;
  }
}

function resetUIOnFailure() {
  isRecording = false;
  isPaused = false;
  btnRecord.classList.remove('recording');
  btnRecordText.textContent = 'START RECORDING';
  btnPause.style.display = 'none';
  recordingStatsContainer.style.display = 'none';
  statusDot.className = 'status-dot idle';
  if (sourceOverlayLabel) {
    sourceOverlayLabel.style.display = 'block';
  }
  if (recordTimerInterval) clearInterval(recordTimerInterval);
  if (vuMeterInterval) clearInterval(vuMeterInterval);
  cancelAnimationFrame(canvasAnimFrame);
}

// --- CANVAS MIXING ENGINE ---

function startCanvasMixingLoop() {
  mixerCanvas.width = 1920;
  mixerCanvas.height = 1080;
  
  function drawFrame() {
    if (!isRecording) return;
    
    // 1. Draw Screen (Background layer)
    if (toggleScreen.checked && screenVideoEl.readyState >= 2) {
      mixerCtx.drawImage(screenVideoEl, 0, 0, 1920, 1080);
    } else {
      // Dark space background if screen capture is toggled off
      mixerCtx.fillStyle = '#08080c';
      mixerCtx.fillRect(0, 0, 1920, 1080);
    }
    
    // 2. Draw Webcam Overlay (Floating Layer)
    if (toggleCamera.checked && cameraVideoEl.readyState >= 2) {
      // Calculate dimension size based on percentage scale
      const overlayWidth = 1920 * (webcamSizePct / 100);
      const overlayHeight = overlayWidth * (3/4); // 4:3 camera stream aspect ratio
      
      // Calculate coordinates depending on selected position
      let x = 0;
      let y = 0;
      const margin = 40; // padding border from edges
      
      switch (webcamPosition) {
        case 'tl':
          x = margin;
          y = margin;
          break;
        case 'tr':
          x = 1920 - overlayWidth - margin;
          y = margin;
          break;
        case 'bl':
          x = margin;
          y = 1080 - overlayHeight - margin;
          break;
        case 'br':
        default:
          x = 1920 - overlayWidth - margin;
          y = 1080 - overlayHeight - margin;
          break;
      }
      
      // Draw overlay
      mixerCtx.save();
      
      if (webcamShape === 'circle') {
        const radius = overlayWidth / 2;
        const centerX = x + radius;
        const centerY = y + radius; // circle overlay will be constrained by width
        
        // Draw Shadow and Blur glow under the camera
        mixerCtx.shadowColor = 'rgba(168, 85, 247, 0.4)';
        mixerCtx.shadowBlur = 20;
        
        // Create circular clip path
        mixerCtx.beginPath();
        mixerCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        mixerCtx.clip();
        
        // Draw the camera video frame crop into the circle
        mixerCtx.drawImage(cameraVideoEl, centerX - radius, centerY - radius, radius * 2, radius * 2);
        mixerCtx.restore();
        
        // Draw neon outline border on top
        mixerCtx.save();
        mixerCtx.beginPath();
        mixerCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        mixerCtx.lineWidth = 6;
        mixerCtx.strokeStyle = '#a855f7'; // Neon Purple border
        mixerCtx.shadowColor = 'rgba(168, 85, 247, 0.6)';
        mixerCtx.shadowBlur = 10;
        mixerCtx.stroke();
        mixerCtx.restore();
      } else {
        // Rounded Rectangle
        const rectRadius = 16;
        
        // Draw glow backplate
        mixerCtx.shadowColor = 'rgba(6, 182, 212, 0.4)';
        mixerCtx.shadowBlur = 20;
        
        mixerCtx.beginPath();
        mixerCtx.roundRect(x, y, overlayWidth, overlayHeight, rectRadius);
        mixerCtx.clip();
        
        mixerCtx.drawImage(cameraVideoEl, x, y, overlayWidth, overlayHeight);
        mixerCtx.restore();
        
        // Draw outline border
        mixerCtx.save();
        mixerCtx.beginPath();
        mixerCtx.roundRect(x, y, overlayWidth, overlayHeight, rectRadius);
        mixerCtx.lineWidth = 6;
        mixerCtx.strokeStyle = '#06b6d4'; // Cyber Cyan border
        mixerCtx.shadowColor = 'rgba(6, 182, 212, 0.6)';
        mixerCtx.shadowBlur = 10;
        mixerCtx.stroke();
        mixerCtx.restore();
      }
    }
    
    canvasAnimFrame = requestAnimationFrame(drawFrame);
  }
  
  canvasAnimFrame = requestAnimationFrame(drawFrame);
}

// --- VU LEVEL METERS LOGIC ---

function startVUMeters() {
  vuMeterInterval = setInterval(() => {
    // 1. Microphone VU Level
    if (toggleMic.checked && micAnalyser && !isPaused) {
      const array = new Uint8Array(micAnalyser.frequencyBinCount);
      micAnalyser.getByteFrequencyData(array);
      let values = 0;
      const length = array.length;
      for (let i = 0; i < length; i++) {
        values += array[i];
      }
      const average = values / length;
      // Map average level (0-255) to bar percentage width
      const pct = Math.min(100, Math.round((average / 110) * 100));
      vuMicFill.style.width = `${pct}%`;
    }
    
    // 2. System Audio VU Level
    if (toggleSystemAudio.checked && systemAnalyser && !isPaused) {
      const array = new Uint8Array(systemAnalyser.frequencyBinCount);
      systemAnalyser.getByteFrequencyData(array);
      let values = 0;
      const length = array.length;
      for (let i = 0; i < length; i++) {
        values += array[i];
      }
      const average = values / length;
      const pct = Math.min(100, Math.round((average / 110) * 100));
      vuSystemFill.style.width = `${pct}%`;
    }
  }, 100);
}

// --- UTILS FORMATTERS ---

function formatMs(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
