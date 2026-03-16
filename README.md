# SignSense (Universal Helper Tool - UHT)

**SignSense** is a comprehensive, multi-modal accessibility web application designed to bridge communication gaps for individuals with various disabilities. It features real-time American Sign Language (ASL) detection, Morse code eye-blink translation, Optical Character Recognition (OCR), Braille translation and physical printing, and offline language translation. 

The application is built to run **completely offline** using local AI models, ensuring privacy and reliability without depending on an internet connection.

---

## 🌟 Key Features

### 🖥️ Frontend (Web App)
- **✋ ASL Alphabet & Gesture Detection:** Translates hand signs and gestures into text using MediaPipe Hands and TensorFlow.js in real-time via the webcam.
- **💬 Sign Words:** Allows users to string together ASL letters to build and confirm full words.
- **👁️ Morse Code Blinks:** Detects eye blinks using MediaPipe Face Mesh, translating long and short blinks into Morse code and then into text.
- **📸 OCR Scanner:** Extracts text from dragged-and-dropped images or live camera frames using Tesseract.js.
- **⠿ Braille Support:** Translates text to Braille Unicode. Supports a hardware bridge for physical Braille printing.
- **🌐 Offline Translation:** Translates text across multiple languages using a built-in offline dictionary system.
- **🔊 Speech-to-Text (STT) & Text-to-Speech (TTS):** Integrated voice capabilities for reading detected text aloud or inputting text natively through the microphone.

### 🔌 Hardware Integration (Raspberry Pi & Arduino)
- **Local Braille Printing:** Through the `Rasp/` and `Arduino/` directories, SignSense interfaces with physical hardware to print Braille.
  - A **Flask Server** (`server.py`) runs on a Raspberry Pi, receiving Braille translation requests via HTTP POST (`/print-braille`).
  - It converts letters into a 6-bit binary string (e.g., `a -> 100000`) and sends it over Serial to an **Arduino**.
  - The **Arduino** (`braille.ino`) reads the serial pattern and actuates physical servos or solenoids to render the tactile Braille dots.

---

## 📂 Project Structure

```
UHT/
│
├── Main/                  # Core Frontend Web Application
│   ├── index.html         # Main UI and structural entry point
│   ├── app.js             # Core logic handling models, camera, UI, and hardware APIs
│   ├── style.css          # Styling for a modern, glassmorphic UI
│   ├── libs/              # Downloaded JS libraries (TFJS, MediaPipe, Tesseract) - Offline
│   └── models/            # Downloaded AI models & language packs
│
├── Rasp/                  # Raspberry Pi Bridge Server
│   ├── server.py          # Flask HTTP server that sends commands over serial
│   └── braille.py         # Helper script for braille logic
│
├── Arduino/               # Microcontroller Code
│   └── braille.ino        # Arduino sketch to control physical Braille hardware
│
└── scripts/               # Setup & Utility Scripts
    ├── download_offline_assets.py  # Downloads all JS/WASM/Model assets for offline use
    ├── download_mp_full.py         # Downloader for MediaPipe specific models
    └── download_fonts.py           # Offline font setup
```

---

## 🚀 Setup & Installation

### 1. Download Offline Assets
For SignSense to work entirely offline, you must first download the AI models and libraries. Ensure you have Python installed, then run:

```bash
cd "scripts"
python download_offline_assets.py
```
*This script will populate `Main/libs` and `Main/models` with TensorFlow.js, MediaPipe Hands, MediaPipe Face Mesh, Tesseract.js WASM binaries, and OCR language data.*

### 2. Run the Web Application
Because the application relies on WASM and local file loading (CORS policies restrict loading `.wasm` via `file:///`), you need to serve the `Main` directory through a local web server:

```bash
cd "Main"
# Use Python's built-in HTTP server
python -m http.server 8000
```
Then, open your browser and navigate to `http://localhost:8000/index.html`.

### 3. Setup the Braille Hardware Bridge (Optional)
If you are connecting the physical Braille printer:
1. **Arduino:** Flash `Arduino/braille.ino` to your Arduino using the Arduino IDE.
2. **Raspberry Pi:** Connect the Arduino to the Pi via USB (default expects `/dev/ttyUSB0`).
3. Install dependencies: `pip install flask flask-cors pyserial`.
4. Run the backend bridge server:

```bash
cd Rasp
python server.py
# Server starts on port 5001
```
Now, clicking "Print to Braille" on the web UI will trigger the physical printer.

---

## 🛠️ Built With
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Computer Vision:** TensorFlow.js, MediaPipe Hands, MediaPipe Face Mesh
- **OCR:** Tesseract.js v5
- **Hardware Integration:** Python (Flask, PySerial), C++ (Arduino)

## 🔒 Privacy First
By keeping all AI processing locally on your device's browser, SignSense guarantees that **no video frames, images, or audio data ever leave your computer**, prioritizing user privacy and security at all times.
