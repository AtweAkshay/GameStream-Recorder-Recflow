# 🎮 GameStream Recorder - Recflow

A premium, completely local desktop screen recording application designed for gamers, creators, and presenters. **RecFlow** lets you record your screens/windows, webcam, microphone, and computer sounds simultaneously into a single high-quality video file, instantly ready for YouTube upload.

---

## ✨ Key Features

* **⚡ 100% Local & Private**: No cloud connections, no subscriptions, no accounts. All recordings are compiled in real-time onto your machine.
* **🎥 Multi-Source Composition**: Record your game/desktop, webcam, microphone, and system sounds simultaneously.
* **🔮 Premium Glassmorphic Dashboard**: Sleek cyberpunk theme with glowing HSL accents, active timers, and smooth hover micro-animations.
* **👾 Dynamic Webcam Overlay**:
  * Shape options: Circular avatar bubble (perfect for gaming) or Rounded Rectangle.
  * Positioning: Snap to any screen corner (Top-Left, Top-Right, Bottom-Left, Bottom-Right).
  * Scale: Custom size slider (10% to 30% of canvas resolution).
  * **Real-time Adjustments**: Resize or reposition your webcam *during* live recording!
* **🎙️ Advanced Audio Mixer & LED VU Meters**:
  * Tune microphone and game volume individually using active gain sliders.
  * Monitor your signal active frequencies in real-time via pulsing LED VU Level Bars (green/yellow/red).
* **🔊 Pre-Recording Mic Tester**: Speak and watch the VU meter bounce *before* you hit start, ensuring your voice settings are perfect!
* **🛡️ Crash-Resilient Local Saving**: Video data is written to disk in **2-second incremental chunks**. If your laptop runs out of battery or crashes mid-game, your recording is safe up to the last 2 seconds!
* **📦 Portable Distribution**: Packs into a single, standalone **108MB ZIP file** that you can copy to a USB or send to friends. No install wizards needed—just extract and double-click `Local Screen Recorder.exe` to run anywhere!

---

## 🛠️ Tech Stack & Architecture

* **Framework**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
* **Video Mixer**: High-performance HTML5 Canvas frame loop rendering at 60 FPS.
* **Audio Mixer**: Web Audio API (integrating multiple device sources, GainNodes, and AnalyserNodes).
* **Recorder**: Chromium MediaStream + MediaRecorder API.
* **Packaging**: Electron-Packager + PowerShell Zip compression.

---

## 🚀 Development & Running Locally

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+ recommended)
* NPM

### Setup & Run
1. Clone the repository or extract the project folder:
   ```bash
   cd ScreenRecorderApp
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Launch the local development app:
   ```bash
   npm start
   ```

---

## 📦 Compiling and Packaging

To compile a standalone, portable Windows build:

1. **Bundle Source Code**:
   ```bash
   npm run package
   ```
   This creates an unpacked native folder inside `dist/Local Screen Recorder-win32-x64/`.

2. **Generate Portable ZIP**:
   ```bash
   npm run zip
   ```
   This packages the folder into a high-speed `dist/Local-Screen-Recorder.zip` (~108 MB) for instant sharing!

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
