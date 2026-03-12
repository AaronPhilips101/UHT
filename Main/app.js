/**
 * SignSense – ASL Sign Language Detector + Morse Code Eye-Blink Detector
 *
 * ASL mode:   TensorFlow.js + MediaPipe Hands → 21 keypoint → letter classifier
 * Morse mode: TensorFlow.js + MediaPipe FaceMesh → Eye Aspect Ratio → blink → dot/dash
 */

'use strict';

/* ═══════════════════════════════════════════════════
   DOM REFERENCES
═══════════════════════════════════════════════════ */
const webcamEl = document.getElementById('webcam');
const canvasEl = document.getElementById('overlayCanvas');
const ctx = canvasEl.getContext('2d');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const fpsBadge = document.getElementById('fpsBadge');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMsg = document.getElementById('loadingMsg');
const noHandNotice = document.getElementById('noHandNotice');
const noFaceNotice = document.getElementById('noFaceNotice');
const detectionOverlay = document.getElementById('detectionOverlay');
const detectedLetter = document.getElementById('detectedLetter');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceLabel = document.getElementById('confidenceLabel');
const morseOverlay = document.getElementById('morseOverlay');
const eyeStatus = document.getElementById('eyeStatus');
const currentMorseEl = document.getElementById('currentMorse');
const bigLetter = document.getElementById('bigLetter');
const gestureName = document.getElementById('gestureName');
const holdFill = document.getElementById('holdFill');
const morseSequenceEl = document.getElementById('morseSequence');
const morseDecodedEl = document.getElementById('morseDecodedPreview');
const blinkDotEl = document.getElementById('blinkDotIndicator');
const blinkStateLabelEl = document.getElementById('blinkStateLabel');
const morseProgressEl = document.getElementById('morseProgressFill');
const morseProgressLblEl = document.getElementById('morseProgressLabel');
const timelineCanvas = document.getElementById('timelineCanvas');
const tlCtx = timelineCanvas.getContext('2d');
const detectedText = document.getElementById('detectedText');
const charCount = document.getElementById('charCount');
const toggleCamBtn = document.getElementById('toggleCamBtn');
const clearBtn = document.getElementById('clearBtn');
const spaceBtn = document.getElementById('spaceBtn');
const backspaceBtn = document.getElementById('backspaceBtn');
const copyBtn = document.getElementById('copyBtn');
const speakBtn = document.getElementById('speakBtn');
const printBrailleBtn = document.getElementById('printBrailleBtn');
const holdDurationEl = document.getElementById('holdDuration');
const holdDurationValEl = document.getElementById('holdDurationVal');
const minConfEl = document.getElementById('minConfidence');
const minConfValEl = document.getElementById('minConfidenceVal');
const mirrorToggle = document.getElementById('mirrorToggle');
const aslGrid = document.getElementById('aslGrid');
const aslPanel = document.getElementById('aslPanel');
const morsePanel = document.getElementById('morsePanel');
const morseRefGrid = document.getElementById('morseRefGrid');
const headerBadge = document.getElementById('headerBadge');
const cameraCard = document.querySelector('.camera-card');
const dotMaxMsEl = document.getElementById('dotMaxMs');
const dotMaxMsValEl = document.getElementById('dotMaxMsVal');
const letterGapMsEl = document.getElementById('letterGapMs');
const letterGapMsValEl = document.getElementById('letterGapMsVal');
const wordGapMsEl = document.getElementById('wordGapMs');
const wordGapMsValEl = document.getElementById('wordGapMsVal');
const earThresholdEl = document.getElementById('earThreshold');
const earThresholdValEl = document.getElementById('earThresholdVal');

// Word Detection DOM refs
const wordPanel = document.getElementById('wordPanel');
const wordCurrentEl = document.getElementById('wordCurrent');
const wordSignedSeqEl = document.getElementById('wordSignedSeq');
const wordProgressLabelEl = document.getElementById('wordProgressLabel');
const wordHoldFillEl = document.getElementById('wordHoldFill');
const wordSuggestionsEl = document.getElementById('wordSuggestions');
const wordCommitBtn = document.getElementById('wordCommitBtn');
const wordSpaceBtn = document.getElementById('wordSpaceBtn');
const wordClearSeqBtn = document.getElementById('wordClearSeqBtn');
const wordHoldDurationEl = document.getElementById('wordHoldDuration');
const wordHoldDurationValEl = document.getElementById('wordHoldDurationVal');
const wordMinConfEl = document.getElementById('wordMinConf');
const wordMinConfValEl = document.getElementById('wordMinConfVal');
const wordSeqTimeoutEl = document.getElementById('wordSeqTimeout');
const wordSeqTimeoutValEl = document.getElementById('wordSeqTimeoutVal');
const wordMirrorToggleEl = document.getElementById('wordMirrorToggle');
const wordRefGrid = document.getElementById('wordRefGrid');

// Gesture Detection DOM refs
const gesturePanel = document.getElementById('gesturePanel');
const gestureEmojiEl = document.getElementById('gestureEmoji');
const gestureLabelDisplayEl = document.getElementById('gestureLabelDisplay');
const gestureMeaningDisplayEl = document.getElementById('gestureMeaningDisplay');
const gestureConfBarEl = document.getElementById('gestureConfBar');
const gestureConfLabelEl = document.getElementById('gestureConfLabel');
const gestureHoldFillEl = document.getElementById('gestureHoldFill');
const gestureHoldLabelEl = document.getElementById('gestureHoldLabel');
const gestureHoldDurationEl = document.getElementById('gestureHoldDuration');
const gestureHoldDurationValEl = document.getElementById('gestureHoldDurationVal');
const gestureMinConfEl = document.getElementById('gestureMinConf');
const gestureMinConfValEl = document.getElementById('gestureMinConfVal');
const gestureMirrorToggleEl = document.getElementById('gestureMirrorToggle');
const gestureRefGrid = document.getElementById('gestureRefGrid');
const textCard = document.querySelector('.text-card');

/* ═══════════════════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════════════════ */
let currentMode = 'asl';   // 'asl' | 'morse' | 'words' | 'gestures' | 'ocr' | 'braille' | 'translate'
let handDetector = null;
let faceDetector = null;
let animFrameId = null;
let cameraStream = null;
let cameraActive = false;
let lastFpsTime = performance.now();
let frameCount = 0;

// ASL state
let holdLetter = null;
let holdStart = null;
let aslConfirmed = false;
let holdDuration = 1000;
let minConfidence = 0.60;
let mirrorCamera = true;

// Morse state
let morseSymbols = [];      // accumulated dots and dashes for current letter
let blinkStart = null;    // timestamp when eye closed
let eyeOpen = true;
let lastBlinkEnd = null;    // timestamp when eye last opened
let letterCommitTimer = null;
let wordCommitTimer = null;
let dotMaxMs = 300;
let letterGapMs = 1200;
let wordGapMs = 2500;
let earThreshold = 22;      // EAR * 100, below = blink
let lastHighlit = null;

// Word Detection state
let wordLetterSeq = [];         // letters signed so far (e.g. ['H','E','L','L','O'])
let wordHoldLetter = null;
let wordHoldStart = null;
let wordHoldConfirmed = false;
let wordHoldDuration = 800;     // ms to hold a letter before registering it
let wordMinConfidence = 0.55;
let wordSeqTimeout = 4000;      // ms idle before auto-resetting sequence
let wordSeqTimer = null;        // auto-reset timer ID

// Gesture Detection state
let gestureHoldName = null;     // name of gesture currently being held
let gestureHoldStart = null;
let gestureHoldConfirmed = false;
let gestureHoldDuration = 1000;
let gestureMinConfidence = 0.60;

// Timeline data: array of {type:'open'|'blink', start, end, symbol}
const timelineEvents = [];
const TIMELINE_WINDOW = 8000; // show last 8 seconds

/* ═══════════════════════════════════════════════════
   MORSE CODE TABLE
═══════════════════════════════════════════════════ */
const MORSE_TABLE = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D',
    '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H',
    '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P',
    '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3',
    '....-': '4', '.....': '5', '-....': '6', '--...': '7',
    '---..': '8', '----.': '9',
};

const MORSE_CODE = Object.fromEntries(Object.entries(MORSE_TABLE).map(([k, v]) => [v, k]));

/* ════════════════════════════════════════════════
   ASL GESTURE CLASSIFIER
════════════════════════════════════════════════ */
const GESTURE_NAMES = {
    A: 'Fist, thumb beside', B: 'Flat fingers up', C: 'Curved C-shape',
    D: 'Index up, thumb-middle touch', E: 'All fingers curled',
    F: 'Thumb+index pinch, 3 up', G: 'Index+thumb sideways', H: 'Index+middle sideways',
    I: 'Pinky up, fist', K: 'Index+middle+thumb up', L: 'L-shape: index+thumb',
    M: '3 fingers over thumb', N: '2 fingers over thumb', O: 'O-shape',
    R: 'Crossed fingers', S: 'Fist, thumb over', U: '2 fingers together up',
    V: 'Peace V-sign', W: '3 fingers up', X: 'Hooked index', Y: 'Thumb+pinky out',
};

function normalizeLandmarks(lms) {
    const w = lms[0], m9 = lms[9];
    const sz = Math.hypot(m9.x - w.x, m9.y - w.y) || 1;
    return lms.map(p => ({ x: (p.x - w.x) / sz, y: (p.y - w.y) / sz, z: (p.z - w.z) / sz }));
}

function getFingerStates(lms) {
    const n = normalizeLandmarks(lms);
    const w = n[0];
    const ext = (tip, mcp) => {
        const td = Math.hypot(tip.x - w.x, tip.y - w.y);
        const md = Math.hypot(mcp.x - w.x, mcp.y - w.y);
        return td > md * 1.4;
    };
    const halfExt = (tip, mcp) => {
        const td = Math.hypot(tip.x - w.x, tip.y - w.y);
        const md = Math.hypot(mcp.x - w.x, mcp.y - w.y);
        return td > md * 1.1 && td < md * 1.6;
    };
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    return {
        thumbExt: d(n[4], n[5]) > 0.4,
        indexExt: ext(n[8], n[5]),
        middleExt: ext(n[12], n[9]),
        ringExt: ext(n[16], n[13]),
        pinkyExt: ext(n[20], n[17]),
        indexHalf: halfExt(n[8], n[5]),
        tid: d(n[4], n[8]),   // thumb-index dist
        tmid: d(n[4], n[12]),
        imd: d(n[8], n[12]),  // index-middle dist
    };
}

function classifyASL(lms) {
    const f = getFingerStates(lms);
    const { thumbExt, indexExt, middleExt, ringExt, pinkyExt, tid, tmid, imd, indexHalf } = f;
    const allCurl = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const allExt = indexExt && middleExt && ringExt && pinkyExt;
    const sc = {};
    const s = (l, v) => sc[l] = (sc[l] || 0) + v;

    if (allCurl && thumbExt) s('A', 0.9);
    if (allExt && !thumbExt) s('B', 0.9);
    if (!allExt && !allCurl && tid > 0.25 && tid < 0.55) s('C', 0.7);
    if (indexExt && !middleExt && !ringExt && !pinkyExt && tmid < 0.3) s('D', 0.9);
    if (allCurl && !thumbExt && tid < 0.3) s('E', 0.9);
    if (tid < 0.25 && middleExt && ringExt && pinkyExt) s('F', 0.9);
    if (indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt && tid > 0.3) s('G', 0.6);
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && imd < 0.25) s('H', 0.8);
    if (!indexExt && !middleExt && !ringExt && pinkyExt && !thumbExt) s('I', 0.9);  // pinky only — must exclude thumb (Y has thumb+pinky)
    if (indexExt && middleExt && !ringExt && !pinkyExt && thumbExt && imd > 0.25) s('K', 0.7);
    if (indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt) s('L', 0.8);
    if (allCurl && !thumbExt && tid < 0.2) s('M', 0.5);
    if (allCurl && !thumbExt && tid < 0.25) s('N', 0.4);
    if (tid < 0.22 && allCurl) s('O', 0.9);
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && imd < 0.15) s('R', 0.8);
    if (allCurl && !thumbExt) s('S', 0.4);
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && imd < 0.2) s('U', 0.7);
    if (indexExt && middleExt && !ringExt && !pinkyExt && !thumbExt && imd >= 0.2) s('V', 0.8);
    if (indexExt && middleExt && ringExt && !pinkyExt) s('W', 0.8);
    if (indexHalf && !middleExt && !ringExt && !pinkyExt) s('X', 0.8);
    if (!indexExt && !middleExt && !ringExt && pinkyExt && thumbExt) s('Y', 0.95); // thumb+pinky (higher than I to win ties)

    const keys = Object.keys(sc);
    if (!keys.length) return [{ letter: '?', confidence: 0 }];
    const max = Math.max(...keys.map(k => sc[k]));
    return keys.map(k => ({ letter: k, confidence: Math.min(sc[k] / max, 1) }))
        .sort((a, b) => b.confidence - a.confidence);
}

/* ════════════════════════════════════════════════
   EYE ASPECT RATIO (EAR) BLINK DETECTOR
   MediaPipe FaceLandmarks – eye landmark indices
════════════════════════════════════════════════ */
// MediaPipe FaceMesh eye indices (normalized landmark IDs from 468-point mesh)
// Left eye: 33,160,158,133,153,144
// Right eye: 362,385,387,263,373,380
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function computeEAR(lms, eye) {
    // EAR = (||P2-P6|| + ||P3-P5||) / (2 * ||P1-P4||)
    const p = eye.map(i => lms[i]);
    if (p.some(v => !v)) return 1;
    const ver1 = dist(p[1], p[5]);
    const ver2 = dist(p[2], p[4]);
    const hor = dist(p[0], p[3]);
    return hor < 0.001 ? 1 : (ver1 + ver2) / (2 * hor);
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/* ════════════════════════════════════════════════
   MORSE DECODER
════════════════════════════════════════════════ */
function decodeMorse(symbols) {
    const code = symbols.join('');
    return MORSE_TABLE[code] || '?';
}

function commitMorseLetter() {
    if (morseSymbols.length === 0) return;
    const letter = decodeMorse(morseSymbols);
    if (letter && letter !== '?') {
        appendText(letter);
        showConfirmFlash(letter, 'morse-flash');
        highlightMorseTile(letter);
    }
    morseSymbols = [];
    updateMorseDisplay();
}

function commitMorseWord() {
    commitMorseLetter();
    appendText(' ');
}

/* ════════════════════════════════════════════════
   MODEL INIT
════════════════════════════════════════════════ */
/* Models are loaded lazily on first camera start (not on page load). */
let modelsLoading = false;
let modelsLoaded = false;

async function ensureModels() {
    if (modelsLoaded) return;
    if (modelsLoading) {
        // Wait until the other call finishes
        while (modelsLoading) await new Promise(r => setTimeout(r, 100));
        return;
    }
    modelsLoading = true;
    try {
        statusText.textContent = 'Loading TensorFlow…';
        await tf.ready();

        statusText.textContent = 'Loading Hand model (first-time only)…';
        handDetector = await handPoseDetection.createDetector(
            handPoseDetection.SupportedModels.MediaPipeHands,
            {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915',
                modelType: 'full', maxHands: 1,
            }
        );

        statusText.textContent = 'Loading Face Mesh model…';
        faceDetector = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619',
                refineLandmarks: false,
                maxFaces: 1,
            }
        );

        modelsLoaded = true;
        statusText.textContent = 'Camera active';
    } finally {
        modelsLoading = false;
    }
}

function initModels() {
    /* HTML already has the overlay hidden and button enabled.
       This is kept as a no-op safety call. */
    loadingOverlay.classList.add('hidden');
    toggleCamBtn.disabled = false;
    toggleCamBtn.innerHTML = '<span>\uD83D\uDCF7</span> Start Camera';
}

/* ════════════════════════════════════════════════
   CAMERA
════════════════════════════════════════════════ */
async function startCamera() {
    try {
        statusText.textContent = 'Requesting camera…';
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        webcamEl.srcObject = cameraStream;
        await new Promise(res => { webcamEl.onloadedmetadata = res; });
        await webcamEl.play();
        cameraActive = true;
        statusDot.classList.add('active');
        toggleCamBtn.innerHTML = '<span>⏹</span> Stop Camera';
        loadingOverlay.classList.add('hidden');

        // Enable OCR scan-cam button immediately
        if (currentMode === 'ocr') {
            ocrScanCamBtn.disabled = false;
            statusText.textContent = 'Camera active — OCR ready!';
        } else {
            // Load TF models lazily for ASL / Morse
            statusText.textContent = 'Loading AI models…';
            await ensureModels();
            statusText.textContent = 'Camera active';
            requestAnimationFrame(detectLoop);
        }
    } catch (err) {
        statusText.textContent = `Camera error: ${err.message}`;
        console.error(err);
    }
}

function stopCamera() {
    cameraActive = false;
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    webcamEl.srcObject = null;
    statusDot.classList.remove('active');
    statusText.textContent = 'Camera stopped';
    toggleCamBtn.disabled = false;
    toggleCamBtn.innerHTML = '<span>\uD83D\uDCF7</span> Start Camera';
    loadingOverlay.classList.add('hidden');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    detectionOverlay.classList.remove('visible');
    morseOverlay.classList.remove('visible');
    noHandNotice.classList.remove('visible');
    noFaceNotice.classList.remove('visible');
    holdFill.style.width = '0%';
    if (currentMode === 'ocr') ocrScanCamBtn.disabled = true;
}

/* ════════════════════════════════════════════════
   DETECTION LOOP
════════════════════════════════════════════════ */
async function detectLoop() {
    if (!cameraActive) return;

    canvasEl.width = webcamEl.videoWidth;
    canvasEl.height = webcamEl.videoHeight;

    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        fpsBadge.textContent = `${frameCount} FPS`;
        frameCount = 0;
        lastFpsTime = now;
    }

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    if (currentMode === 'asl') {
        await runASLFrame();
    } else if (currentMode === 'words') {
        await runWordFrame();
    } else if (currentMode === 'gestures') {
        await runGestureFrame();
    } else {
        await runMorseFrame();
    }

    drawTimeline();
    animFrameId = requestAnimationFrame(detectLoop);
}

/* ─── ASL Frame ─── */
async function runASLFrame() {
    noFaceNotice.classList.remove('visible');
    morseOverlay.classList.remove('visible');

    let hands = [];
    try { hands = await handDetector.estimateHands(webcamEl, { flipHorizontal: mirrorCamera }); }
    catch (e) { }

    if (hands.length > 0) {
        const kps = hands[0].keypoints;
        const kps3d = hands[0].keypoints3D || kps.map(k => ({ ...k, z: 0 }));
        drawHand(kps);
        const results = classifyASL(kps3d);
        const top = results[0];
        const pct = Math.round(top.confidence * 100);
        noHandNotice.classList.remove('visible');

        if (top.letter !== '?' && top.confidence >= minConfidence) {
            detectionOverlay.classList.add('visible');
            detectedLetter.textContent = top.letter;
            confidenceBar.style.width = `${pct}%`;
            confidenceLabel.textContent = `${pct}%`;
            updateBigLetter(top.letter);
            updateASLHold(top.letter);
            highlightASLTile(top.letter);
        } else {
            resetASLDetection();
            noHandNotice.classList.add('visible');
        }
    } else {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        detectionOverlay.classList.remove('visible');
        noHandNotice.classList.add('visible');
        resetASLDetection();
        highlightASLTile(null);
    }
}

/* ─── Word Detection Frame ─── */
async function runWordFrame() {
    noFaceNotice.classList.remove('visible');
    morseOverlay.classList.remove('visible');

    let hands = [];
    try { hands = await handDetector.estimateHands(webcamEl, { flipHorizontal: mirrorCamera }); }
    catch (e) { }

    if (hands.length > 0) {
        const kps = hands[0].keypoints;
        const kps3d = hands[0].keypoints3D || kps.map(k => ({ ...k, z: 0 }));
        drawHand(kps);
        const results = classifyASL(kps3d);
        const top = results[0];
        const pct = Math.round(top.confidence * 100);
        noHandNotice.classList.remove('visible');

        if (top.letter !== '?' && top.confidence >= wordMinConfidence) {
            detectionOverlay.classList.add('visible');
            detectedLetter.textContent = top.letter;
            confidenceBar.style.width = `${pct}%`;
            confidenceLabel.textContent = `${pct}%`;
            updateWordHold(top.letter);
        } else {
            resetWordHold();
            noHandNotice.classList.add('visible');
        }
    } else {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        detectionOverlay.classList.remove('visible');
        noHandNotice.classList.add('visible');
        resetWordHold();
    }
}

/* ─── Morse / Eye Blink Frame ─── */
async function runMorseFrame() {
    noHandNotice.classList.remove('visible');
    detectionOverlay.classList.remove('visible');

    let faces = [];
    try { faces = await faceDetector.estimateFaces(webcamEl, { flipHorizontal: true }); }
    catch (e) { }

    if (faces.length > 0) {
        const lms = faces[0].keypoints;
        drawFaceEyes(lms);
        noFaceNotice.classList.remove('visible');
        morseOverlay.classList.add('visible');

        const earL = computeEAR(lms, LEFT_EYE);
        const earR = computeEAR(lms, RIGHT_EYE);
        const ear = (earL + earR) / 2;
        const isBlinking = (ear * 100) < earThreshold;

        processBlink(isBlinking);
    } else {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        morseOverlay.classList.remove('visible');
        noFaceNotice.classList.add('visible');
    }
}

/* ════════════════════════════════════════════════
   BLINK PROCESSING
════════════════════════════════════════════════ */
function processBlink(isBlinking) {
    const now = performance.now();

    if (isBlinking && eyeOpen) {
        // Eye just closed → blink start
        eyeOpen = false;
        blinkStart = now;
        // Cancel letter/word commit timers since we're still inputting
        clearTimeout(letterCommitTimer);
        clearTimeout(wordCommitTimer);
        letterCommitTimer = null;
        wordCommitTimer = null;

        blinkDotEl.classList.add('closed');
        blinkStateLabelEl.textContent = 'Blinking…';
        eyeStatus.textContent = '😑 Blink';

        // Show real-time progress
        requestAnimationFrame(updateBlinkProgress);

    } else if (!isBlinking && !eyeOpen) {
        // Eye just opened → blink end
        const blinkDur = now - blinkStart;
        eyeOpen = true;
        lastBlinkEnd = now;

        blinkDotEl.classList.remove('closed');

        const symbol = blinkDur < dotMaxMs ? '.' : '-';
        morseSymbols.push(symbol);
        timelineEvents.push({ type: 'blink', start: blinkStart, end: now, symbol });

        blinkStateLabelEl.textContent = `Got: ${symbol === '.' ? 'Dot ·' : 'Dash —'}`;
        eyeStatus.textContent = '👁️ Open';
        morseProgressEl.style.width = '0%';

        updateMorseDisplay();
        updateCurrentMorseOverlay();

        // Schedule letter commit after gap
        letterCommitTimer = setTimeout(() => {
            commitMorseLetter();
            // Schedule word commit after longer gap
            wordCommitTimer = setTimeout(() => {
                if (detectedText.value && detectedText.value.slice(-1) !== ' ') {
                    commitMorseWord();
                }
            }, wordGapMs - letterGapMs);
        }, letterGapMs);

    } else if (!isBlinking && eyeOpen) {
        // Eyes open, normal state – update gap progress toward letter commit
        if (lastBlinkEnd && morseSymbols.length > 0) {
            const gapElapsed = now - lastBlinkEnd;
            const gapPct = Math.min((gapElapsed / letterGapMs) * 100, 100);
            morseProgressEl.style.width = `${gapPct}%`;
            morseProgressLblEl.textContent = gapPct < 100
                ? `Letter gap: ${(letterGapMs - gapElapsed).toFixed(0)}ms left`
                : 'Committing letter…';
        } else {
            morseProgressEl.style.width = '0%';
            morseProgressLblEl.textContent = 'Waiting for blink…';
        }
    }
}

function updateBlinkProgress() {
    if (eyeOpen || !blinkStart) return;
    const dur = performance.now() - blinkStart;
    const pct = Math.min((dur / (dotMaxMs * 3)) * 100, 100);
    morseProgressEl.style.width = `${pct}%`;
    morseProgressLblEl.textContent = dur < dotMaxMs ? `Dot · (${Math.round(dur)}ms)` : `Dash — (${Math.round(dur)}ms)`;
    if (!eyeOpen) requestAnimationFrame(updateBlinkProgress);
}

/* ════════════════════════════════════════════════
   DRAWING
════════════════════════════════════════════════ */
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
];

function drawHand(kps) {
    ctx.save();
    HAND_CONNECTIONS.forEach(([a, b]) => {
        if (!kps[a] || !kps[b]) return;
        ctx.beginPath();
        ctx.moveTo(kps[a].x, kps[a].y);
        ctx.lineTo(kps[b].x, kps[b].y);
        ctx.strokeStyle = 'rgba(99,102,241,0.7)';
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.stroke();
    });
    kps.forEach((kp, i) => {
        const isTip = [4, 8, 12, 16, 20].includes(i);
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, isTip ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#6366f1' : 'rgba(139,92,246,0.9)';
        ctx.shadowBlur = isTip ? 12 : 5;
        ctx.shadowColor = '#6366f1';
        ctx.fill();
        ctx.shadowBlur = 0;
    });
    ctx.restore();
}

function drawFaceEyes(lms) {
    ctx.save();
    [LEFT_EYE, RIGHT_EYE].forEach(eye => {
        ctx.beginPath();
        eye.forEach((idx, i) => {
            const p = lms[idx];
            if (!p) return;
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        const blinkColor = !eyeOpen ? 'rgba(245,158,11,0.9)' : 'rgba(6,182,212,0.6)';
        ctx.strokeStyle = blinkColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = !eyeOpen ? 'rgba(245,158,11,0.15)' : 'rgba(6,182,212,0.08)';
        ctx.fill();
        // Draw pupil/iris center
        const center = lms[eye[0]];
        if (center) {
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = !eyeOpen ? '#f59e0b' : '#06b6d4';
            ctx.shadowBlur = 10;
            ctx.shadowColor = !eyeOpen ? '#f59e0b' : '#06b6d4';
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    });
    ctx.restore();
}

/* ─── Blink timeline canvas ─── */
function drawTimeline() {
    if (currentMode !== 'morse') return;
    const W = timelineCanvas.offsetWidth || 300;
    const H = 60;
    timelineCanvas.width = W;
    timelineCanvas.height = H;
    tlCtx.clearRect(0, 0, W, H);

    const now = performance.now();
    const windowStart = now - TIMELINE_WINDOW;

    // Background grid
    tlCtx.fillStyle = 'rgba(0,0,0,0.2)';
    tlCtx.fillRect(0, 0, W, H);

    // Baseline
    tlCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    tlCtx.lineWidth = 1;
    tlCtx.beginPath(); tlCtx.moveTo(0, H / 2); tlCtx.lineTo(W, H / 2); tlCtx.stroke();

    // Draw events
    timelineEvents.forEach(ev => {
        if (ev.end < windowStart) return; // too old
        const x1 = Math.max(0, ((ev.start - windowStart) / TIMELINE_WINDOW) * W);
        const x2 = Math.min(W, ((ev.end - windowStart) / TIMELINE_WINDOW) * W);
        const isDot = ev.symbol === '.';

        tlCtx.fillStyle = isDot ? 'rgba(99,102,241,0.85)' : 'rgba(245,158,11,0.85)';
        tlCtx.shadowBlur = 6;
        tlCtx.shadowColor = isDot ? '#6366f1' : '#f59e0b';
        const bH = isDot ? H * 0.35 : H * 0.6;
        tlCtx.fillRect(x1, (H - bH) / 2, Math.max(x2 - x1, 4), bH);
        tlCtx.shadowBlur = 0;

        // Label
        tlCtx.fillStyle = '#fff';
        tlCtx.font = 'bold 11px Share Tech Mono, monospace';
        tlCtx.textAlign = 'center';
        tlCtx.fillText(ev.symbol, (x1 + x2) / 2, H * 0.5 + 4);
    });

    // Current blink indicator
    if (!eyeOpen && blinkStart) {
        const x1 = ((blinkStart - windowStart) / TIMELINE_WINDOW) * W;
        const x2 = ((now - windowStart) / TIMELINE_WINDOW) * W;
        tlCtx.fillStyle = 'rgba(245,158,11,0.4)';
        tlCtx.fillRect(Math.max(0, x1), 0, x2 - x1, H);
    }

    // Now cursor
    tlCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    tlCtx.lineWidth = 1.5;
    tlCtx.beginPath(); tlCtx.moveTo(W, 0); tlCtx.lineTo(W, H); tlCtx.stroke();

    // Clean up old events
    while (timelineEvents.length && timelineEvents[0].end < windowStart - 1000) {
        timelineEvents.shift();
    }
}

/* ════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════ */
function updateMorseDisplay() {
    const seq = morseSymbols.join(' ');
    morseSequenceEl.textContent = seq || '—';
    currentMorseEl.textContent = seq || '—';
    const decoded = morseSymbols.length ? decodeMorse(morseSymbols) : '?';
    morseDecodedEl.textContent = decoded;
}

function updateCurrentMorseOverlay() {
    const seq = morseSymbols.join(' ');
    currentMorseEl.textContent = seq || '—';
}

function updateBigLetter(letter) {
    if (bigLetter.textContent !== letter) {
        bigLetter.textContent = letter;
        bigLetter.classList.add('pop');
        setTimeout(() => bigLetter.classList.remove('pop'), 250);
    }
    gestureName.textContent = GESTURE_NAMES[letter] || letter;
}

function updateASLHold(letter) {
    if (holdLetter !== letter) {
        holdLetter = letter; holdStart = performance.now(); aslConfirmed = false;
    }
    if (!aslConfirmed) {
        const pct = Math.min(((performance.now() - holdStart) / holdDuration) * 100, 100);
        holdFill.style.width = `${pct}%`;
        if (pct >= 100) confirmASLLetter(letter);
    }
}

function resetASLDetection() {
    holdLetter = null; holdStart = null; aslConfirmed = false;
    holdFill.style.width = '0%';
    bigLetter.textContent = '?';
    gestureName.textContent = 'Waiting for hand…';
    detectionOverlay.classList.remove('visible');
}

function confirmASLLetter(letter) {
    if (aslConfirmed) return;
    aslConfirmed = true;
    appendText(letter);
    showConfirmFlash(letter, 'asl-flash');
    holdFill.style.width = '0%';
    holdLetter = null; holdStart = null;
    setTimeout(() => { aslConfirmed = false; }, 300);
}

function appendText(str) {
    detectedText.value += str;
    updateCharCount();
    detectedText.scrollTop = detectedText.scrollHeight;
}

function updateCharCount() {
    const l = detectedText.value.length;
    charCount.textContent = `${l} character${l !== 1 ? 's' : ''}`;
}

function showConfirmFlash(letter, cls) {
    const el = document.createElement('div');
    el.className = `letter-confirmed ${cls}`;
    el.textContent = letter;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 520);
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
}

/* ─── Tile highlighters ─── */
function highlightASLTile(letter) {
    if (lastHighlit === letter) return;
    if (lastHighlit) document.getElementById(`tile-${lastHighlit}`)?.classList.remove('highlighted');
    lastHighlit = letter;
    if (letter) document.getElementById(`tile-${letter}`)?.classList.add('highlighted');
}

let lastMorseHighlit = null;
function highlightMorseTile(letter) {
    if (lastMorseHighlit) document.getElementById(`mtile-${lastMorseHighlit}`)?.classList.remove('highlighted');
    lastMorseHighlit = letter;
    if (letter) {
        const el = document.getElementById(`mtile-${letter}`);
        if (el) {
            el.classList.add('highlighted');
            setTimeout(() => el.classList.remove('highlighted'), 1200);
        }
    }
}

/* ════════════════════════════════════════════════
   MODE SWITCHING
════════════════════════════════════════════════ */
const ocrPanel = document.getElementById('ocrPanel');
const ocrFreezeOverlay = document.getElementById('ocrFreezeOverlay');
const ocrScanCamBtn = document.getElementById('ocrScanCamBtn');
const ocrScanImgBtn = document.getElementById('ocrScanImgBtn');
const ocrProgressBar = document.getElementById('ocrProgressBar');
const ocrStatusText = document.getElementById('ocrStatusText');
const ocrRawResult = document.getElementById('ocrRawResult');
const ocrDropZone = document.getElementById('ocrDropZone');
const ocrFileInput = document.getElementById('ocrFileInput');
const ocrPreviewWrap = document.getElementById('ocrPreviewWrap');
const ocrPreviewImg = document.getElementById('ocrPreviewImg');
const ocrClearImg = document.getElementById('ocrClearImg');
const ocrLangEl = document.getElementById('ocrLang');
const ocrAppendToggle = document.getElementById('ocrAppendToggle');
const ocrMirrorToggleEl = document.getElementById('ocrMirrorToggle');

let ocrUploadedImage = null;   // data URL of uploaded image
let ocrWorker = null;          // Tesseract worker (lazy init)
let ocrScanning = false;
let ocrMirrorCamera = true;    // whether to mirror the webcam frame before OCR


function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));

    // Reset all panels and card classes
    aslPanel.classList.add('hidden');
    morsePanel.classList.add('hidden');
    ocrPanel.classList.add('hidden');
    // Show detected text card by default; braille/translate will hide it
    if (textCard) textCard.classList.remove('hidden');
    cameraCard.classList.remove('morse-active', 'ocr-active');
    headerBadge.classList.remove('morse-mode', 'ocr-mode');
    noHandNotice.classList.remove('visible');
    noFaceNotice.classList.remove('visible');
    detectionOverlay.classList.remove('visible');
    morseOverlay.classList.remove('visible');

    if (mode === 'asl') {
        aslPanel.classList.remove('hidden');
        headerBadge.textContent = 'ASL Alphabet Detector';
        noHandNotice.querySelector('span').textContent = '✋ Show your hand to the camera';
    } else if (mode === 'morse') {
        morsePanel.classList.remove('hidden');
        headerBadge.textContent = 'Morse Eye-Blink Detector';
        headerBadge.classList.add('morse-mode');
        cameraCard.classList.add('morse-active');
        resetASLDetection();
        morseSymbols = [];
        updateMorseDisplay();
    } else if (mode === 'ocr') {
        ocrPanel.classList.remove('hidden');
        headerBadge.textContent = 'OCR Text Scanner';
        headerBadge.classList.add('ocr-mode');
        cameraCard.classList.add('ocr-active');
        resetASLDetection();
        ocrScanCamBtn.disabled = !cameraActive;
    }
}


/* ════════════════════════════════════════════════
   BUILD REFERENCE GRIDS
════════════════════════════════════════════════ */
// ASL grid
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(l => {
    const tile = document.createElement('div');
    tile.className = 'asl-letter-tile';
    tile.textContent = l;
    tile.id = `tile-${l}`;
    tile.title = GESTURE_NAMES[l] || '';
    aslGrid.appendChild(tile);
});

// Morse reference grid (letters A-Z + digits 0-9)
[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].forEach(ch => {
    const code = MORSE_CODE[ch];
    if (!code) return;
    const tile = document.createElement('div');
    tile.className = 'morse-tile';
    tile.id = `mtile-${ch}`;
    tile.innerHTML = `<span class="morse-tile-letter">${ch}</span><span class="morse-tile-code">${code}</span>`;
    morseRefGrid.appendChild(tile);
});

/* ════════════════════════════════════════════════
   OCR ENGINE (Tesseract.js) — with image preprocessing
════════════════════════════════════════════════ */

/**
 * Preprocess an image source (data-URL, HTMLImageElement, or HTMLVideoElement)
 * into a cleaned-up canvas that Tesseract can read much more accurately:
 *  1. Draw original at 2× scale (Tesseract loves ≥300 DPI-equivalent)
 *  2. Convert to greyscale
 *  3. Boost contrast & apply threshold (remove noise)
 */
function preprocessImage(source, mirrorX = false) {
    let sw, sh;
    if (source instanceof HTMLVideoElement) {
        sw = source.videoWidth || 640;
        sh = source.videoHeight || 480;
    } else if (source instanceof HTMLImageElement) {
        sw = source.naturalWidth || source.width || 640;
        sh = source.naturalHeight || source.height || 480;
    } else {
        throw new Error('Pass HTMLVideoElement or HTMLImageElement');
    }

    const SCALE = 2;
    const w = sw * SCALE;
    const h = sh * SCALE;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.save();
    if (mirrorX) {
        ctx.scale(-1, 1);
        ctx.drawImage(source, -w, 0, w, h);
    } else {
        ctx.drawImage(source, 0, 0, w, h);
    }
    ctx.restore();

    // Greyscale + adaptive contrast stretch (no hard clipping)
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;

    // Pass 1: find luminance range
    let minL = 255, maxL = 0;
    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
    }
    const range = Math.max(maxL - minL, 1);

    // Pass 2: stretch luminance to full 0-255
    for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const out = Math.round(((lum - minL) / range) * 255);
        d[i] = d[i + 1] = d[i + 2] = out;
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
}

/** Wrap a data-URL into an Image, then preprocess */
async function preprocessDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(preprocessImage(img, false));
        img.onerror = reject;
        img.src = dataUrl;
    });
}

async function getOcrWorker() {
    if (ocrWorker) return ocrWorker;
    ocrWorker = await Tesseract.createWorker(ocrLangEl.value, 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                const pct = Math.round(m.progress * 100);
                ocrProgressBar.style.width = `${pct}%`;
                ocrStatusText.textContent = `Recognizing… ${pct}%`;
            } else if (m.status === 'loading tesseract core') {
                ocrStatusText.textContent = 'Loading OCR engine…';
            } else if (m.status === 'loading language traineddata') {
                ocrStatusText.textContent = `Loading language data…`;
            }
        },
    });
    return ocrWorker;
}

async function terminateOcrWorker() {
    if (ocrWorker) { await ocrWorker.terminate(); ocrWorker = null; }
}

async function runOCR(source, isVideo = false) {
    if (ocrScanning) return;
    ocrScanning = true;
    ocrProgressBar.style.width = '0%';
    ocrRawResult.classList.remove('visible');
    ocrRawResult.textContent = '';
    ocrStatusText.textContent = 'Preprocessing image…';
    ocrFreezeOverlay.classList.add('visible');
    ocrScanCamBtn.disabled = true;
    ocrScanImgBtn.disabled = true;

    try {
        // ── Preprocess ──────────────────────────────────────────────────
        let processedCanvas;
        if (isVideo) {
            // source is the webcam video element — mirror according to toggle
            processedCanvas = preprocessImage(source, ocrMirrorCamera);
        } else {
            // source is a data-URL (uploaded image)
            processedCanvas = await preprocessDataUrl(source);
        }

        // Show preprocessed preview so user can see what's going to OCR
        ocrPreviewImg.src = processedCanvas.toDataURL('image/png');
        ocrPreviewWrap.style.display = 'block';

        // ── Re-create worker if language changed ─────────────────────────
        if (ocrWorker && ocrWorker._lang !== ocrLangEl.value) {
            await terminateOcrWorker();
        }
        const worker = await getOcrWorker();
        worker._lang = ocrLangEl.value;

        ocrStatusText.textContent = 'Recognizing text…';
        const { data } = await worker.recognize(processedCanvas);

        // Filter out very low-confidence noise lines
        const lines = (data.lines || [])
            .filter(l => l.confidence > 30)
            .map(l => l.text.trim())
            .filter(Boolean);
        const cleaned = lines.length ? lines.join('\n') : data.text.trim();

        ocrProgressBar.style.width = '100%';
        ocrStatusText.textContent = cleaned
            ? `✅ Done! ${cleaned.length} characters found (avg confidence: ${Math.round(data.confidence)}%)`
            : '⚠️ No text detected — ensure good lighting and clear text in frame.';

        if (cleaned) {
            ocrRawResult.textContent = cleaned;
            ocrRawResult.classList.add('visible');
            if (ocrAppendToggle.checked) {
                const sep = detectedText.value && !detectedText.value.endsWith('\n') ? '\n' : '';
                appendText(sep + cleaned);
                showToast(`📋 OCR: ${cleaned.length} chars added`);
            }
        }
    } catch (err) {
        ocrStatusText.textContent = `❌ OCR Error: ${err && err.message ? err.message : String(err)}`;
        console.error('OCR error:', err);
    } finally {
        ocrFreezeOverlay.classList.remove('visible');
        ocrScanning = false;
        ocrScanCamBtn.disabled = !cameraActive;
        ocrScanImgBtn.disabled = !ocrUploadedImage;
    }
}

/* ─── Capture current camera frame ─── */
function captureCameraFrame() {
    return webcamEl; // pass the video element directly for preprocessing
}


/* ─── Drop zone events ─── */
ocrDropZone.addEventListener('click', () => ocrFileInput.click());

ocrDropZone.addEventListener('dragover', e => {
    e.preventDefault();
    ocrDropZone.classList.add('drag-over');
});
ocrDropZone.addEventListener('dragleave', () => ocrDropZone.classList.remove('drag-over'));
ocrDropZone.addEventListener('drop', e => {
    e.preventDefault();
    ocrDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
});

ocrFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
    ocrFileInput.value = '';
});

function handleImageFile(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showToast('⚠️ Please upload an image file (JPG, PNG, WebP).');
        return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
        ocrUploadedImage = ev.target.result;
        ocrPreviewImg.src = ocrUploadedImage;
        ocrPreviewWrap.style.display = 'block';
        ocrScanImgBtn.disabled = false;
        ocrStatusText.textContent = 'Image loaded — click "Scan Uploaded Image" to start.';
        ocrProgressBar.style.width = '0%';
        ocrRawResult.classList.remove('visible');
    };
    reader.readAsDataURL(file);
}

ocrClearImg.addEventListener('click', e => {
    e.stopPropagation();
    ocrUploadedImage = null;
    ocrPreviewImg.src = '';
    ocrPreviewWrap.style.display = 'none';
    ocrScanImgBtn.disabled = true;
    ocrStatusText.textContent = 'Ready to scan';
    ocrProgressBar.style.width = '0%';
    ocrRawResult.classList.remove('visible');
});

ocrScanCamBtn.addEventListener('click', async () => {
    if (!cameraActive) { showToast('⚠️ Start the camera first!'); return; }
    await runOCR(captureCameraFrame(), true);  // video element → preprocessImage
});

ocrScanImgBtn.addEventListener('click', async () => {
    if (!ocrUploadedImage) { showToast('⚠️ Upload an image first!'); return; }
    await runOCR(ocrUploadedImage, false);       // false = data-URL, no mirror needed
});

ocrMirrorToggleEl.addEventListener('change', () => {
    ocrMirrorCamera = ocrMirrorToggleEl.checked;
    webcamEl.style.transform = ocrMirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
    canvasEl.style.transform = ocrMirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
});

/* ════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════ */
document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => window.switchMode(btn.dataset.mode));
});

toggleCamBtn.addEventListener('click', () => {
    if (cameraActive) stopCamera();
    else startCamera();
});

clearBtn.addEventListener('click', () => {
    detectedText.value = '';
    morseSymbols = [];
    updateMorseDisplay();
    updateCharCount();
});

spaceBtn.addEventListener('click', () => { appendText(' '); });
backspaceBtn.addEventListener('click', () => {
    detectedText.value = detectedText.value.slice(0, -1);
    updateCharCount();
});

copyBtn.addEventListener('click', async () => {
    if (!detectedText.value) return;
    try { await navigator.clipboard.writeText(detectedText.value); showToast('✅ Copied!'); }
    catch { showToast('❌ Copy failed'); }
});

// TTS speak handler — will be overridden by the enhanced TTS module at the end of the file.
// Set onclick so it is always a single handler and can be cleanly replaced.
speakBtn.onclick = () => {
    const t = detectedText.value.trim();
    if (!t) { showToast('⚠️ Type or detect some text first!'); return; }
    try { speechSynthesis.resume(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); showToast('🔊 Speaking…'); }
    catch (e) { showToast('❌ TTS error: ' + e.message); console.error('TTS:', e); }
};

printBrailleBtn.addEventListener('click', async () => {
    // Read from the Braille section's text input
    const brailleInput = document.getElementById('brailleInput');
    const text = brailleInput ? brailleInput.value.trim() : '';
    if (!text) {
        showToast('⚠️ Type some text in the Braille input first!');
        return;
    }
    showToast('⠿ Sending to Braille Printer...');
    try {
        const response = await fetch('http://10.47.140.131:5001/print-braille', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (response.ok) {
            showToast('✅ Braille printing started!');
        } else {
            showToast('❌ Error starting Braille print');
        }
    } catch (err) {
        showToast('❌ Connection error to Raspberry Pi. Is the server running?');
        console.error('Braille print error:', err);
    }
});

// ASL settings
holdDurationEl.addEventListener('input', () => {
    holdDuration = parseInt(holdDurationEl.value);
    holdDurationValEl.textContent = `${(holdDuration / 1000).toFixed(1)}s`;
});
minConfEl.addEventListener('input', () => {
    minConfidence = parseInt(minConfEl.value) / 100;
    minConfValEl.textContent = `${minConfEl.value}%`;
});
mirrorToggle.addEventListener('change', () => {
    mirrorCamera = mirrorToggle.checked;
    webcamEl.style.transform = mirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
    canvasEl.style.transform = mirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
});

// Morse settings
dotMaxMsEl.addEventListener('input', () => {
    dotMaxMs = parseInt(dotMaxMsEl.value);
    dotMaxMsValEl.textContent = `${dotMaxMs}ms`;
});
letterGapMsEl.addEventListener('input', () => {
    letterGapMs = parseInt(letterGapMsEl.value);
    letterGapMsValEl.textContent = `${(letterGapMs / 1000).toFixed(1)}s`;
});
wordGapMsEl.addEventListener('input', () => {
    wordGapMs = parseInt(wordGapMsEl.value);
    wordGapMsValEl.textContent = `${(wordGapMs / 1000).toFixed(1)}s`;
});
earThresholdEl.addEventListener('input', () => {
    earThreshold = parseInt(earThresholdEl.value);
    earThresholdValEl.textContent = earThreshold;
});

/* ════════════════════════════════════════════════
   GESTURE PHRASE DETECTION
   Recognises common whole-hand ASL gestures from
   static hand poses using MediaPipe landmarks.
════════════════════════════════════════════════ */

/** All supported gestures with display metadata */
const GESTURE_LIBRARY = [
    { id: 'iloveyou', emoji: '🤟', label: 'I Love You', meaning: 'I love you' },
    { id: 'callme', emoji: '🤙', label: 'Call Me', meaning: 'Call me / Hang loose' },
    { id: 'peace', emoji: '✌️', label: 'Peace', meaning: 'Peace / Two / Victory' },
    { id: 'thumbsup', emoji: '👍', label: 'Thumbs Up', meaning: 'Good / Yes / Agree' },
    { id: 'thumbsdown', emoji: '👎', label: 'Thumbs Down', meaning: 'Bad / No / Disagree' },
    { id: 'stop', emoji: '✋', label: 'Hello / Stop', meaning: 'Hello / Stop / Open hand' },
    { id: 'point', emoji: '☝️', label: 'Point', meaning: 'You / Look / There' },
    { id: 'ok', emoji: '👌', label: 'OK', meaning: 'OK / Perfect' },
    { id: 'rockon', emoji: '🤘', label: 'Rock On', meaning: 'Rock on / Horns' },
    { id: 'fist', emoji: '✊', label: 'Fist', meaning: 'No / Ready / Strength' },
    { id: 'pinch', emoji: '🤌', label: 'Pinch', meaning: 'Perfect / Chef\'s kiss' },
    { id: 'three', emoji: '3️⃣', label: 'Three', meaning: 'Three / Water' },
    { id: 'four', emoji: '4️⃣', label: 'Four', meaning: 'Four' },
];

const GESTURE_MAP = Object.fromEntries(GESTURE_LIBRARY.map(g => [g.id, g]));

/**
 * Classify a single-hand pose into one of the GESTURE_LIBRARY entries.
 * @param {Array} kps2d - Raw 2-D keypoints [{x,y,score}] (screen space, pre-flip)
 * @param {Array} kps3d - 3-D normalized keypoints for getFingerStates
 * @returns {{ id, emoji, label, meaning, confidence } | null}
 */
function classifyGesture(kps2d, kps3d) {
    if (!kps2d || !kps3d || kps2d.length < 21) return null;

    // Get finger extension flags via existing helper
    const f = getFingerStates(kps3d);
    const { thumbExt, indexExt, middleExt, ringExt, pinkyExt, tid, imd } = f;

    const allCurl = !indexExt && !middleExt && !ringExt && !pinkyExt;
    const allFingersExt = indexExt && middleExt && ringExt && pinkyExt;

    // Screen-space thumb orientation: compare thumb tip y vs wrist y
    // In screen coords y increases downward, so tip.y < wrist.y means thumb points UP
    const wristY = kps2d[0].y;
    const thumbTipY = kps2d[4].y;
    // Use palm mid (index MCP = kp[5]) to define "hand height" for relative comparison
    const palmMidY = kps2d[9].y;
    const handHeight = Math.abs(wristY - palmMidY) || 1;
    const thumbAbove = (wristY - thumbTipY) > handHeight * 0.4;  // tip well above wrist
    const thumbBelow = (thumbTipY - wristY) > handHeight * 0.4;  // tip well below wrist

    // Score map — higher = more confident
    const scores = {};
    const add = (id, v) => { scores[id] = Math.max(scores[id] || 0, v); };

    // ── I Love You: thumb + index + pinky UP, middle + ring DOWN ──
    if (thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) add('iloveyou', 0.95);

    // ── Call Me / Hang Loose: thumb + pinky only ──
    if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) add('callme', 0.90);
    // iloveyou supersedes callme; ensure callme only fires if index is definitely not extended
    if (scores.iloveyou && scores.callme) delete scores.callme;

    // ── Peace / Victory / Two: index + middle spread, others down ──
    if (!thumbExt && indexExt && middleExt && !ringExt && !pinkyExt && imd > 0.18) add('peace', 0.88);
    if (!thumbExt && indexExt && middleExt && !ringExt && !pinkyExt && imd <= 0.18) add('peace', 0.65); // close together — lower conf

    // ── Open Hand / Hello / Stop: all 5 fingers up ──
    if (thumbExt && allFingersExt) add('stop', 0.85);

    // ── Four: 4 fingers up, no thumb ──
    if (!thumbExt && allFingersExt) add('four', 0.85);

    // ── Three: index + middle + ring up, no pinky, no thumb ──
    if (!thumbExt && indexExt && middleExt && ringExt && !pinkyExt) add('three', 0.85);

    // ── Thumbs Up: thumb pointing UP, all 4 fingers curled ──
    if (thumbExt && allCurl && thumbAbove) add('thumbsup', 0.92);

    // ── Thumbs Down: thumb pointing DOWN, all 4 fingers curled ──
    if (thumbExt && allCurl && thumbBelow) add('thumbsdown', 0.88);

    // ── Point: only index up ──
    if (!thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) add('point', 0.85);

    // ── OK: thumb-index tip very close, middle+ring+pinky extended ──
    if (tid < 0.18 && !indexExt && middleExt && ringExt && pinkyExt) add('ok', 0.88);

    // ── Rock On / Horns: index + pinky up, thumb optional, middle+ring curled ──
    if (!thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) add('rockon', 0.85);

    // ── Fist: all 5 fingers curled ──
    if (allCurl && !thumbExt) add('fist', 0.75);

    // ── Pinch: thumb-index very close, all others curled ──
    if (tid < 0.18 && !middleExt && !ringExt && !pinkyExt) add('pinch', 0.82);

    if (!Object.keys(scores).length) return null;

    // Find highest-confidence match
    const [bestId, bestConf] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const meta = GESTURE_MAP[bestId];
    return { ...meta, confidence: bestConf };
}

/** Current detected gesture (updated every frame) */
let _detectedGesture = null;

/**
 * Processes one animation frame for the Gesture mode.
 */
async function runGestureFrame() {
    if (!handDetector) return;

    const hands = await handDetector.estimateHands(webcamEl, { flipHorizontal: mirrorCamera });

    if (!hands.length) {
        // No hand visible
        noHandNotice.classList.add('visible');
        gestureLabelDisplayEl.textContent = 'No hand detected…';
        gestureMeaningDisplayEl.textContent = 'Show a gesture to the camera';
        gestureEmojiEl.textContent = '🤲';
        gestureConfBarEl.style.width = '0%';
        gestureConfLabelEl.textContent = '0%';
        gestureHoldFillEl.style.width = '0%';
        gestureHoldLabelEl.textContent = 'Hold to confirm';
        resetGestureHold();
        _detectedGesture = null;
        return;
    }

    noHandNotice.classList.remove('visible');
    const hand = hands[0];
    const kps2d = hand.keypoints;
    const kps3d = hand.keypoints3D;

    // Draw skeleton
    drawHand(kps2d);

    const result = classifyGesture(kps2d, kps3d);

    if (!result || result.confidence < gestureMinConfidence) {
        gestureLabelDisplayEl.textContent = 'Unrecognised gesture';
        gestureMeaningDisplayEl.textContent = 'Try a gesture from the reference grid';
        gestureEmojiEl.textContent = '❓';
        gestureConfBarEl.style.width = '0%';
        gestureConfLabelEl.textContent = '0%';
        gestureHoldFillEl.style.width = '0%';
        gestureHoldLabelEl.textContent = 'Hold to confirm';
        resetGestureHold();
        _detectedGesture = null;
        return;
    }

    _detectedGesture = result;
    const pct = Math.round(result.confidence * 100);

    // Update live display
    gestureEmojiEl.textContent = result.emoji;
    gestureLabelDisplayEl.textContent = result.label;
    gestureMeaningDisplayEl.textContent = result.meaning;
    gestureConfBarEl.style.width = `${pct}%`;
    gestureConfLabelEl.textContent = `${pct}%`;

    // Overlay label on canvas
    detectionOverlay.classList.add('visible');
    detectionOverlay.textContent = `${result.emoji} ${result.label}`;

    // Hold-to-confirm
    updateGestureHold(result);
}

/**
 * Manages the hold timer for gesture confirmation.
 */
function updateGestureHold(gesture) {
    if (gestureHoldName !== gesture.id) {
        // Different gesture — reset hold
        gestureHoldName = gesture.id;
        gestureHoldStart = performance.now();
        gestureHoldConfirmed = false;
        gestureHoldFillEl.style.width = '0%';
    }
    if (!gestureHoldConfirmed) {
        const elapsed = performance.now() - gestureHoldStart;
        const pct = Math.min((elapsed / gestureHoldDuration) * 100, 100);
        gestureHoldFillEl.style.width = `${pct}%`;
        const remaining = ((gestureHoldDuration - elapsed) / 1000).toFixed(1);
        gestureHoldLabelEl.textContent = pct < 100
            ? `Hold ${gesture.label} — ${remaining}s`
            : `✅ Committed!`;
        if (pct >= 100) confirmGesture(gesture);
    }
}

/**
 * Commits the confirmed gesture to the text output.
 */
function confirmGesture(gesture) {
    if (gestureHoldConfirmed) return;
    gestureHoldConfirmed = true;
    const text = gesture.label;
    const sep = detectedText.value && !detectedText.value.endsWith(' ') ? ' ' : '';
    appendText(sep + text);
    showConfirmFlash(gesture.emoji, 'gesture-flash');
    showToast(`✅ "${text}" added`);
    // Brief lockout before next gesture can register
    setTimeout(() => {
        gestureHoldName = null;
        gestureHoldStart = null;
        gestureHoldConfirmed = false;
        gestureHoldFillEl.style.width = '0%';
        gestureHoldLabelEl.textContent = 'Hold to confirm';
    }, 600);
}

/**
 * Resets hold state (called on mode switch or hand loss).
 */
function resetGestureHold() {
    gestureHoldName = null;
    gestureHoldStart = null;
    gestureHoldConfirmed = false;
}

/**
 * Builds (or rebuilds) the gesture reference grid.
 */
function buildGestureRefGrid() {
    gestureRefGrid.innerHTML = '';
    GESTURE_LIBRARY.forEach(g => {
        const tile = document.createElement('div');
        tile.className = 'gesture-ref-tile';
        tile.innerHTML = `<span class="gref-emoji">${g.emoji}</span><span class="gref-label">${g.label}</span>`;
        tile.title = g.meaning;
        gestureRefGrid.appendChild(tile);
    });
}

/* ── Gesture Mode Settings ── */
gestureHoldDurationEl.addEventListener('input', () => {
    gestureHoldDuration = Number(gestureHoldDurationEl.value);
    gestureHoldDurationValEl.textContent = (gestureHoldDuration / 1000).toFixed(1) + 's';
});
gestureMinConfEl.addEventListener('input', () => {
    gestureMinConfidence = Number(gestureMinConfEl.value) / 100;
    gestureMinConfValEl.textContent = gestureMinConfEl.value + '%';
});
gestureMirrorToggleEl.addEventListener('change', () => {
    mirrorCamera = gestureMirrorToggleEl.checked;
});
buildGestureRefGrid();

/* ════════════════════════════════════════════════
   WORD DETECTION — DICTIONARY
   Loaded from words.txt (one word per line).
   Falls back to a compact built-in list if the
   file is not present.
════════════════════════════════════════════════ */

/** Compact fallback — used when words.txt is absent */
const FALLBACK_DICTIONARY = [
    // Greetings & pleasantries
    'HELLO', 'HI', 'HEY', 'BYE', 'GOODBYE', 'WELCOME',
    'PLEASE', 'SORRY', 'THANKS', 'THANKYOU', 'EXCUSE',
    // People & pronouns
    'I', 'ME', 'YOU', 'HE', 'SHE', 'WE', 'THEY', 'MY', 'YOUR', 'HIS', 'HER',
    'FRIEND', 'FAMILY', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER', 'BABY',
    'BOY', 'GIRL', 'MAN', 'WOMAN', 'PERSON', 'PEOPLE', 'CHILD',
    // Basic verbs
    'LOVE', 'LIKE', 'WANT', 'NEED', 'HELP', 'GO', 'COME', 'STOP',
    'EAT', 'DRINK', 'SLEEP', 'WORK', 'PLAY', 'LOOK', 'SEE', 'HEAR',
    'KNOW', 'THINK', 'FEEL', 'GIVE', 'TAKE', 'MAKE', 'LEARN', 'UNDERSTAND',
    'CALL', 'WAIT', 'SIGN', 'MEET', 'READ', 'WRITE', 'BUY', 'PAY',
    // Questions
    'WHAT', 'WHERE', 'WHEN', 'WHY', 'HOW', 'WHO', 'WHICH',
    // Time
    'NOW', 'LATER', 'TODAY', 'TOMORROW', 'YESTERDAY', 'MORNING', 'NIGHT',
    'WEEK', 'MONTH', 'YEAR', 'TIME', 'HOUR', 'SOON', 'ALWAYS', 'NEVER',
    // Emotions / states
    'HAPPY', 'SAD', 'ANGRY', 'SCARED', 'TIRED', 'SICK', 'FINE', 'GOOD',
    'BAD', 'GREAT', 'OK', 'YES', 'NO', 'MAYBE', 'SURE', 'WRONG', 'RIGHT',
    // Places & things
    'HOME', 'SCHOOL', 'HOSPITAL', 'STORE', 'FOOD', 'WATER', 'MONEY',
    'PHONE', 'BOOK', 'CAR', 'BUS', 'HELP', 'FIRE', 'POLICE', 'DOCTOR',
    // Colors
    'RED', 'BLUE', 'GREEN', 'BLACK', 'WHITE', 'YELLOW', 'PINK', 'ORANGE',
    // Numbers (spelled)
    'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    // Common phrases (concatenated for matching)
    'ILOVEYOU', 'HOWDY', 'NICETOMEETYOU', 'AREYOUOK', 'MOREPLEASE',
    'THANKYOU', 'GOODNIGHT', 'GOODMORNING', 'SEEYOU', 'COMEBACK',
    'HELPME', 'CALLPOLICE', 'CALLFIRE', 'EMERGENCY',
];

/** Live dictionary — starts as fallback, replaced by words.txt on load */
let WORD_DICTIONARY = [...FALLBACK_DICTIONARY];

/**
 * Fetch words.txt from the project folder and replace WORD_DICTIONARY.
 * The file should contain one English word per line
 * (e.g. google-10000-english-no-swears.txt renamed to words.txt).
 * Words are uppercased and filtered to purely alphabetic entries (≥2 chars).
 */
async function loadWordDictionary() {
    if (currentMode === 'words') {
        wordSuggestionsEl.innerHTML = '<span class="word-suggest-hint">⏳ Loading dictionary…</span>';
    }
    try {
        const resp = await fetch('words.txt');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        const words = text
            .split(/\r?\n/)
            .map(w => w.trim().toUpperCase())
            .filter(w => /^[A-Z]{2,}$/.test(w));
        if (words.length === 0) throw new Error('File was empty or had no valid words');
        WORD_DICTIONARY = words;
        console.log(`[SignSense] words.txt loaded: ${words.length} words`);
        showToast(`📖 Dictionary: ${words.length.toLocaleString()} words loaded`);
        // Rebuild reference grid with the new dictionary
        buildWordRefGrid();
        if (currentMode === 'words') updateWordDisplay();
    } catch (err) {
        console.warn('[SignSense] words.txt unavailable — using built-in fallback.', err.message);
        if (currentMode === 'words') updateWordDisplay();
    }
}

/**
 * Levenshtein edit distance between two strings (case-insensitive).
 * Used to rank fuzzy suggestions.
 */
function editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
            else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Returns top-N word suggestions for the current letter sequence.
 * Priority: exact prefix match → close edit distance → others.
 */
function getWordSuggestions(letters, topN = 5) {
    if (!letters.length) return [];
    const typed = letters.join('');
    const scored = WORD_DICTIONARY.map(w => {
        const isPrefix = w.startsWith(typed);
        const dist = editDistance(typed, w.length <= typed.length ? w : w.slice(0, typed.length));
        return { word: w, score: (isPrefix ? 0 : 1) * 100 + dist };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, topN).map(s => s.word);
}

/* ════════════════════════════════════════════════
   WORD DETECTION — HOLD & COMMIT LOGIC
════════════════════════════════════════════════ */
function updateWordHold(letter) {
    // If a different letter detected, reset hold
    if (wordHoldLetter !== letter) {
        wordHoldLetter = letter;
        wordHoldStart = performance.now();
        wordHoldConfirmed = false;
        wordHoldFillEl.style.width = '0%';
    }
    if (!wordHoldConfirmed) {
        const pct = Math.min(((performance.now() - wordHoldStart) / wordHoldDuration) * 100, 100);
        wordHoldFillEl.style.width = `${pct}%`;
        wordProgressLabelEl.textContent = pct < 100
            ? `Hold ${letter} — ${(wordHoldDuration * (1 - pct / 100) / 1000).toFixed(1)}s`
            : `Registered ${letter}!`;
        if (pct >= 100) confirmWordLetter(letter);
    }
}

function confirmWordLetter(letter) {
    if (wordHoldConfirmed) return;
    wordHoldConfirmed = true;
    wordLetterSeq.push(letter);
    showConfirmFlash(letter, 'word-flash');

    // Reset sequence timeout
    clearTimeout(wordSeqTimer);
    wordSeqTimer = setTimeout(() => {
        if (wordLetterSeq.length > 0) {
            showToast('⏱️ Sequence timed out — cleared');
            resetWordSequence();
        }
    }, wordSeqTimeout);

    updateWordDisplay();
    wordHoldFillEl.style.width = '0%';
    // Small delay before accepting next letter
    setTimeout(() => { wordHoldLetter = null; wordHoldStart = null; wordHoldConfirmed = false; }, 400);
}

function resetWordHold() {
    if (!wordHoldConfirmed) {
        wordHoldLetter = null;
        wordHoldStart = null;
        wordHoldFillEl.style.width = '0%';
        wordProgressLabelEl.textContent = 'Hold a letter to add it';
    }
}

function resetWordSequence() {
    wordLetterSeq = [];
    wordHoldLetter = null;
    wordHoldStart = null;
    wordHoldConfirmed = false;
    wordHoldFillEl.style.width = '0%';
    clearTimeout(wordSeqTimer);
    wordSeqTimer = null;
    updateWordDisplay();
}

function commitWord(word) {
    if (!word) return;
    const w = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    const sep = detectedText.value && !detectedText.value.endsWith(' ') ? ' ' : '';
    appendText(sep + w);
    showConfirmFlash(w.charAt(0), 'word-flash');
    showToast(`✅ "${w}" added`);
    resetWordSequence();
}

function updateWordDisplay() {
    const seq = wordLetterSeq.join('');
    wordCurrentEl.textContent = seq || '…';
    wordSignedSeqEl.textContent = seq ? `Signed: ${wordLetterSeq.join(' · ')}` : 'Sign letters to build a word';

    const suggestions = getWordSuggestions(wordLetterSeq);
    if (suggestions.length === 0) {
        wordSuggestionsEl.innerHTML = '<span class="word-suggest-hint">No matches — keep signing…</span>';
        return;
    }
    wordSuggestionsEl.innerHTML = '';
    suggestions.forEach((word, i) => {
        const btn = document.createElement('button');
        btn.className = 'word-suggestion-chip' + (i === 0 ? ' top-match' : '');
        const typed = wordLetterSeq.join('');
        const matchLen = Math.min(typed.length, word.length);
        const matchPart = word.slice(0, matchLen);
        const restPart = word.slice(matchLen);
        btn.innerHTML = `<span class="chip-match">${matchPart}</span><span class="chip-rest">${restPart}</span>`;
        btn.title = `Click to commit "${word}"`;
        btn.addEventListener('click', () => commitWord(word));
        wordSuggestionsEl.appendChild(btn);
    });
}

/* ════════════════════════════════════════════════
   MODE SWITCHING — patch switchMode to add words
════════════════════════════════════════════════ */
const _origSwitchMode = switchMode;
// Redefine switchMode to also handle wordPanel
window.switchMode = function (mode) {
    // hide ALL extra panels before showing the one we need
    wordPanel.classList.add('hidden');
    gesturePanel.classList.add('hidden');
    braillePanel.classList.add('hidden');
    if (translatePanel) translatePanel.classList.add('hidden');
    cameraCard.classList.remove('braille-active', 'translate-active');
    headerBadge.classList.remove('braille-mode', 'translate-mode');
    _origSwitchMode(mode);

    if (mode === 'words') {
        wordPanel.classList.remove('hidden');
        headerBadge.textContent = 'Sign Word Detector';
        headerBadge.classList.remove('morse-mode', 'ocr-mode', 'gesture-mode');
        headerBadge.classList.add('word-mode');
        cameraCard.classList.remove('morse-active', 'ocr-active', 'gesture-active');
        cameraCard.classList.add('word-active');
        aslPanel.classList.add('hidden');
        morsePanel.classList.add('hidden');
        ocrPanel.classList.add('hidden');
        noHandNotice.querySelector('span').textContent = '✋ Show your hand to sign a letter';
        resetWordSequence();
        resetGestureHold();

    } else if (mode === 'gestures') {
        gesturePanel.classList.remove('hidden');
        headerBadge.textContent = 'Gesture Detector';
        headerBadge.classList.remove('morse-mode', 'ocr-mode', 'word-mode');
        headerBadge.classList.add('gesture-mode');
        cameraCard.classList.remove('morse-active', 'ocr-active', 'word-active');
        cameraCard.classList.add('gesture-active');
        aslPanel.classList.add('hidden');
        morsePanel.classList.add('hidden');
        ocrPanel.classList.add('hidden');
        noHandNotice.querySelector('span').textContent = '✋ Show a gesture to the camera';
        resetGestureHold();

    } else if (mode === 'braille') {
        braillePanel.classList.remove('hidden');
        if (textCard) textCard.classList.add('hidden');  // braille has own output
        headerBadge.textContent = 'Braille Translator';
        headerBadge.classList.remove('morse-mode', 'ocr-mode', 'word-mode', 'gesture-mode');
        headerBadge.classList.add('braille-mode');
        cameraCard.classList.remove('morse-active', 'ocr-active', 'word-active', 'gesture-active');
        cameraCard.classList.add('braille-active');
        aslPanel.classList.add('hidden');
        morsePanel.classList.add('hidden');
        ocrPanel.classList.add('hidden');
        noHandNotice.classList.remove('visible');
        noFaceNotice.classList.remove('visible');
        detectionOverlay.classList.remove('visible');
        morseOverlay.classList.remove('visible');
        resetWordSequence();
        resetGestureHold();

    } else if (mode === 'translate') {
        translatePanel.classList.remove('hidden');
        // Keep textCard visible — used by "Use Detected Text" button
        headerBadge.textContent = 'Language Translator';
        headerBadge.classList.remove('morse-mode', 'ocr-mode', 'word-mode', 'gesture-mode', 'braille-mode');
        headerBadge.classList.add('translate-mode');
        cameraCard.classList.remove('morse-active', 'ocr-active', 'word-active', 'gesture-active', 'braille-active');
        aslPanel.classList.add('hidden');
        morsePanel.classList.add('hidden');
        ocrPanel.classList.add('hidden');
        noHandNotice.classList.remove('visible');
        noFaceNotice.classList.remove('visible');
        detectionOverlay.classList.remove('visible');
        morseOverlay.classList.remove('visible');
        resetWordSequence();
        resetGestureHold();

    } else {
        headerBadge.classList.remove('word-mode', 'gesture-mode', 'braille-mode', 'translate-mode');
        cameraCard.classList.remove('word-active', 'gesture-active', 'braille-active', 'translate-active');
        if (translatePanel) translatePanel.classList.add('hidden');
        resetWordSequence();
        resetGestureHold();
    }
};


/* ════════════════════════════════════════════════
   WORD MODE SETTINGS LISTENERS
════════════════════════════════════════════════ */
wordHoldDurationEl.addEventListener('input', () => {
    wordHoldDuration = parseInt(wordHoldDurationEl.value);
    wordHoldDurationValEl.textContent = `${(wordHoldDuration / 1000).toFixed(1)}s`;
});
wordMinConfEl.addEventListener('input', () => {
    wordMinConfidence = parseInt(wordMinConfEl.value) / 100;
    wordMinConfValEl.textContent = `${wordMinConfEl.value}%`;
});
wordSeqTimeoutEl.addEventListener('input', () => {
    wordSeqTimeout = parseInt(wordSeqTimeoutEl.value);
    wordSeqTimeoutValEl.textContent = `${(wordSeqTimeout / 1000).toFixed(1)}s`;
});
wordMirrorToggleEl.addEventListener('change', () => {
    mirrorCamera = wordMirrorToggleEl.checked;
    webcamEl.style.transform = mirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
    canvasEl.style.transform = mirrorCamera ? 'scaleX(-1)' : 'scaleX(1)';
});

wordCommitBtn.addEventListener('click', () => {
    if (wordLetterSeq.length === 0) { showToast('⚠️ Sign some letters first!'); return; }
    const typed = wordLetterSeq.join('');
    const suggestions = getWordSuggestions(wordLetterSeq);
    commitWord(suggestions.length > 0 ? suggestions[0] : typed);
});
wordSpaceBtn.addEventListener('click', () => { appendText(' '); });
wordClearSeqBtn.addEventListener('click', () => { resetWordSequence(); showToast('↩ Sequence cleared'); });

/* ════════════════════════════════════════════════
   WORD REFERENCE GRID BUILDER
   Extracted as a function so it can be rebuilt
   after words.txt finishes loading.
════════════════════════════════════════════════ */
function buildWordRefGrid() {
    wordRefGrid.innerHTML = '';
    // When dictionary is large, only show a sample (first 200) to keep UI snappy
    const sample = WORD_DICTIONARY.slice(0, 200);
    sample.forEach(phrase => {
        const tile = document.createElement('div');
        tile.className = 'word-ref-tile';
        tile.textContent = phrase;
        tile.title = `Letters: ${phrase.split('').join(' · ')}`;
        tile.addEventListener('click', () => {
            wordLetterSeq = phrase.split('');
            clearTimeout(wordSeqTimer);
            updateWordDisplay();
            showToast(`Demo: ${phrase}`);
        });
        wordRefGrid.appendChild(tile);
    });
    if (WORD_DICTIONARY.length > 200) {
        const more = document.createElement('div');
        more.className = 'word-ref-tile';
        more.style.cssText = 'color:var(--text-muted);font-size:0.6rem;letter-spacing:0';
        more.textContent = `+${(WORD_DICTIONARY.length - 200).toLocaleString()} more…`;
        wordRefGrid.appendChild(more);
    }
}
// Initial grid build with fallback dictionary
buildWordRefGrid();

/* ════════════════════════════════════════════════
   BRAILLE MODULE
   Grade-1 (uncontracted) Braille translator.
   Text → Braille Unicode  |  Braille Unicode → Text
════════════════════════════════════════════════ */

/**
 * Full Grade-1 Braille mapping.
 * Keys are uppercase letters, digits, space, and common punctuation.
 * Values are Unicode Braille Pattern characters (U+2800 block).
 */
const BRAILLE_MAP = {
    // Letters A–Z
    'A': '⠁', 'B': '⠃', 'C': '⠉', 'D': '⠙', 'E': '⠑',
    'F': '⠋', 'G': '⠛', 'H': '⠓', 'I': '⠊', 'J': '⠚',
    'K': '⠅', 'L': '⠇', 'M': '⠍', 'N': '⠝', 'O': '⠕',
    'P': '⠏', 'Q': '⠟', 'R': '⠗', 'S': '⠎', 'T': '⠞',
    'U': '⠥', 'V': '⠧', 'W': '⠺', 'X': '⠭', 'Y': '⠽', 'Z': '⠵',
    // Digits (preceded by number indicator ⠼ in real Braille; we inline them for simplicity)
    '1': '⠁', '2': '⠃', '3': '⠉', '4': '⠙', '5': '⠑',
    '6': '⠋', '7': '⠛', '8': '⠓', '9': '⠊', '0': '⠚',
    // Space
    ' ': '⠀',
    // Common punctuation
    ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '!': '⠖',
    '(': '⠦', ')': '⠴', '?': '⠦', '-': '⠤', '/': '⠌',
    '\'': '⠄', '"': '⠄', '&': '⠯', '#': '⠼', '@': '⠈⠁',
};

/** Reverse map: Braille character → text character (letters only) */
const BRAILLE_REVERSE = {};
// Build reverse from A-Z (digits share braille chars with letters so skip)
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch => {
    BRAILLE_REVERSE[BRAILLE_MAP[ch]] = ch;
});
// Punctuation reverse
const PUNCT_REVERSE = {
    '⠂': ',', '⠆': ';', '⠒': ':', '⠲': '.', '⠖': '!',
    '⠤': '-', '⠌': '/', '⠴': ')', '⠀': ' ',
};
Object.assign(BRAILLE_REVERSE, PUNCT_REVERSE);

/** Number indicator used to prefix digit runs */
const NUM_INDICATOR = '⠼';

/**
 * Encode plain text → Braille Unicode string.
 * Handles uppercase indicator (⠠) before capitals.
 * @param {string} text
 * @returns {string}
 */
function textToBraille(text) {
    let result = '';
    let inNumber = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const upper = ch.toUpperCase();
        const isDigit = /[0-9]/.test(ch);
        const isLetter = /[A-Za-z]/.test(ch);
        const isSpace = ch === ' ';

        if (isDigit) {
            if (!inNumber) {
                result += NUM_INDICATOR; // number indicator
                inNumber = true;
            }
            result += BRAILLE_MAP[ch] || '⠿';
        } else {
            inNumber = false;
            if (isLetter) {
                // Capital indicator before uppercase letters
                if (ch === ch.toUpperCase()) result += '⠠';
                result += BRAILLE_MAP[upper] || '⠿';
            } else if (isSpace) {
                result += '⠀'; // braille space
            } else {
                // Punctuation / special char
                result += BRAILLE_MAP[ch] || ch;
            }
        }
    }
    return result || '—';
}

/**
 * Decode Braille Unicode string → plain text.
 * Handles capital indicator (⠠) and number indicator (⠼).
 * @param {string} braille
 * @returns {string}
 */
function brailleToText(braille) {
    const chars = [...braille]; // iterate by codepoint
    let result = '';
    let capitalize = false;
    let inNumber = false;
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c === '⠠') { capitalize = true; inNumber = false; continue; }
        if (c === NUM_INDICATOR) { inNumber = true; capitalize = false; continue; }
        if (c === '⠀') { result += ' '; inNumber = false; capitalize = false; continue; }

        // Not in the Unicode Braille block ?
        if (c < '⠀' || c > '⣿') {
            result += c; inNumber = false; capitalize = false; continue;
        }

        const decoded = BRAILLE_REVERSE[c] || c;
        if (inNumber) {
            // Digits share braille patterns with A-J; map back to digit
            const DIGIT_MAP = { 'A': '1', 'B': '2', 'C': '3', 'D': '4', 'E': '5', 'F': '6', 'G': '7', 'H': '8', 'I': '9', 'J': '0' };
            result += DIGIT_MAP[decoded] || decoded;
        } else if (capitalize) {
            result += decoded.toUpperCase();
            capitalize = false;
        } else {
            result += decoded.toLowerCase();
        }
    }
    return result || '—';
}

/** Build the Braille alphabet reference grid */
function buildBrailleRefGrid() {
    const grid = document.getElementById('brailleRefGrid');
    if (!grid) return;
    grid.innerHTML = '';
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch => {
        const tile = document.createElement('div');
        tile.className = 'braille-ref-tile';
        tile.innerHTML = `<span class="bref-braille">${BRAILLE_MAP[ch]}</span><span class="bref-letter">${ch}</span>`;
        tile.title = `${ch} = ${BRAILLE_MAP[ch]}`;
        grid.appendChild(tile);
    });
    // Add a few common punctuation tiles
    const PUNCT_PREVIEW = [',', '.', '?', '!', '-', ' '];
    PUNCT_PREVIEW.forEach(ch => {
        const label = ch === ' ' ? 'SPC' : ch;
        const tile = document.createElement('div');
        tile.className = 'braille-ref-tile braille-ref-punct';
        tile.innerHTML = `<span class="bref-braille">${BRAILLE_MAP[ch] || '?'}</span><span class="bref-letter">${label}</span>`;
        grid.appendChild(tile);
    });
}

/* ── DOM refs ── */
const braillePanel = document.getElementById('braillePanel');
const brailleInputEl = document.getElementById('brailleInput');
const brailleResultEl = document.getElementById('brailleResult');
const brailleConvertBtn = document.getElementById('brailleConvertBtn');
const brailleCopyBtn = document.getElementById('brailleCopyBtn');
const brailleAppendBtn = document.getElementById('brailleAppendBtn');
const brailleDecodeInputEl = document.getElementById('brailleDecodeInput');
const brailleDecodeResultEl = document.getElementById('brailleDecodeResult');
const brailleDecodeBtn = document.getElementById('brailleDecodeBtn');
const brailleDecodeAppendBtn = document.getElementById('brailleDecodeAppendBtn');

/* ── Convert: Text → Braille ── */
brailleConvertBtn.addEventListener('click', () => {
    const input = brailleInputEl.value;
    if (!input.trim()) { showToast('⚠️ Enter some text first!'); return; }
    const output = textToBraille(input);
    brailleResultEl.textContent = output;
    showToast('⠿ Converted to Braille!');
});

// Live preview as user types
brailleInputEl.addEventListener('input', () => {
    if (brailleInputEl.value.trim()) {
        brailleResultEl.textContent = textToBraille(brailleInputEl.value);
    } else {
        brailleResultEl.textContent = '—';
    }
});

brailleCopyBtn.addEventListener('click', async () => {
    const text = brailleResultEl.textContent;
    if (!text || text === '—') { showToast('⚠️ Nothing to copy!'); return; }
    try { await navigator.clipboard.writeText(text); showToast('✅ Braille copied!'); }
    catch { showToast('❌ Copy failed'); }
});

brailleAppendBtn.addEventListener('click', () => {
    const text = brailleResultEl.textContent;
    if (!text || text === '—') { showToast('⚠️ Nothing to append!'); return; }
    appendText(text);
    showToast('✅ Braille appended to detected text');
});

/* ── Convert: Braille → Text ── */
brailleDecodeBtn.addEventListener('click', () => {
    const input = brailleDecodeInputEl.value;
    if (!input.trim()) { showToast('⚠️ Paste Braille Unicode first!'); return; }
    const decoded = brailleToText(input);
    brailleDecodeResultEl.textContent = decoded;
    showToast('🔤 Decoded from Braille!');
});

// Live decode preview
brailleDecodeInputEl.addEventListener('input', () => {
    if (brailleDecodeInputEl.value.trim()) {
        brailleDecodeResultEl.textContent = brailleToText(brailleDecodeInputEl.value);
    } else {
        brailleDecodeResultEl.textContent = '—';
    }
});

brailleDecodeAppendBtn.addEventListener('click', () => {
    const text = brailleDecodeResultEl.textContent;
    if (!text || text === '—') { showToast('⚠️ Nothing to append!'); return; }
    appendText(text);
    showToast('✅ Decoded text appended');
});

// Build the reference grid on load
buildBrailleRefGrid();

/* ════════════════════════════════════════════════
   MORSE EXTRAS
   1. Text → Morse encoder
   2. Morse → Text decoder
   3. Manual keyboard input pad
   4. Web Audio API playback
════════════════════════════════════════════════ */

/* ─── Text → Morse encoder ─── */

/**
 * Encode a plain-text string to Morse code.
 * Letters separated by single space, words by ' / '.
 */
function textToMorse(text) {
    return text.toUpperCase().split(' ').map(word => {
        return word.split('').map(ch => MORSE_CODE[ch] || '?').join(' ');
    }).join(' / ');
}

const morseTextInputEl = document.getElementById('morseTextInput');
const morseEncodedResultEl = document.getElementById('morseEncodedResult');
const morseEncodeBtn = document.getElementById('morseEncodeBtn');
const morseCopyCodeBtn = document.getElementById('morseCopyCodeBtn');
const morsePlayFromTextBtn = document.getElementById('morsePlayFromTextBtn');

// Live encode as user types
morseTextInputEl.addEventListener('input', () => {
    const v = morseTextInputEl.value;
    morseEncodedResultEl.textContent = v.trim() ? textToMorse(v) : '—';
});

morseEncodeBtn.addEventListener('click', () => {
    const v = morseTextInputEl.value;
    if (!v.trim()) { showToast('⚠️ Enter some text first!'); return; }
    morseEncodedResultEl.textContent = textToMorse(v);
    showToast('· − Encoded!');
});

morseCopyCodeBtn.addEventListener('click', async () => {
    const t = morseEncodedResultEl.textContent;
    if (!t || t === '—') { showToast('⚠️ Nothing to copy'); return; }
    try { await navigator.clipboard.writeText(t); showToast('✅ Morse code copied!'); }
    catch { showToast('❌ Copy failed'); }
});

morsePlayFromTextBtn.addEventListener('click', () => {
    const v = morseTextInputEl.value.trim();
    if (!v) { showToast('⚠️ Enter text to play!'); return; }
    playMorseString(textToMorse(v));
});

/* ─── Morse → Text decoder ─── */

/**
 * Decode a Morse string → text.
 * Expects dots/dashes separated by spaces, words by ' / '.
 * Accepts '.' or '·', '-' or '−' (thin or full dash).
 */
function morseToText(morseStr) {
    // Normalise: replace fancy dot/dash chars
    const clean = morseStr
        .replace(/[·•]/g, '.')
        .replace(/[−–—]/g, '-')
        .trim();
    return clean.split(/\s*\/\s*/).map(word => {
        return word.trim().split(/\s+/).map(code => {
            return MORSE_TABLE[code] || (code === '' ? '' : '?');
        }).join('');
    }).join(' ');
}

const morseCodeInputEl = document.getElementById('morseCodeInput');
const morseDecodedResultEl = document.getElementById('morseDecodedResult');
const morseDecodeBtn = document.getElementById('morseDecodeBtn');
const morseDecodeAppendBtnEl = document.getElementById('morseDecodeAppendBtn');

// Live decode
morseCodeInputEl.addEventListener('input', () => {
    const v = morseCodeInputEl.value;
    morseDecodedResultEl.textContent = v.trim() ? morseToText(v) : '—';
});

morseDecodeBtn.addEventListener('click', () => {
    const v = morseCodeInputEl.value;
    if (!v.trim()) { showToast('⚠️ Enter Morse code first!'); return; }
    morseDecodedResultEl.textContent = morseToText(v);
    showToast('🔤 Decoded!');
});

morseDecodeAppendBtnEl.addEventListener('click', () => {
    const t = morseDecodedResultEl.textContent;
    if (!t || t === '—') { showToast('⚠️ Nothing to append'); return; }
    appendText(t);
    showToast('✅ Decoded text appended');
});


/* ─── Web Audio Morse Playback ─── */

let audioCtx = null;
let morsePlayScheduled = [];   // array of scheduled AudioContext timeouts for stopping
let morseIsPlaying = false;
let morseAudioWpm = 13;
let morseAudioFreq = 600;

const morsePlayBtn = document.getElementById('morsePlayBtn');
const morseStopBtn = document.getElementById('morseStopBtn');
const morseAudioWpmEl = document.getElementById('morseAudioWpm');
const morseAudioWpmValEl = document.getElementById('morseAudioWpmVal');
const morseAudioFreqEl = document.getElementById('morseAudioFreq');
const morseAudioFreqValEl = document.getElementById('morseAudioFreqVal');
const morseAudioBarEl = document.getElementById('morseAudioBar');
const morseAudioStatusEl = document.getElementById('morseAudioStatus');

morseAudioWpmEl.addEventListener('input', () => {
    morseAudioWpm = parseInt(morseAudioWpmEl.value);
    morseAudioWpmValEl.textContent = morseAudioWpm;
});
morseAudioFreqEl.addEventListener('input', () => {
    morseAudioFreq = parseInt(morseAudioFreqEl.value);
    morseAudioFreqValEl.textContent = morseAudioFreq + ' Hz';
});

function getOrCreateAudioCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/**
 * Schedule a single beep tone.
 * @param {AudioContext} ctx
 * @param {number} startSec - context-time in seconds when beep starts
 * @param {number} durSec   - duration in seconds
 * @param {number} freq     - tone frequency Hz
 */
function scheduleBeep(ctx, startSec, durSec, freq) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    // Soft-click envelope to avoid pops
    gain.gain.setValueAtTime(0, startSec);
    gain.gain.linearRampToValueAtTime(0.5, startSec + 0.005);
    gain.gain.setValueAtTime(0.5, startSec + durSec - 0.005);
    gain.gain.linearRampToValueAtTime(0, startSec + durSec);
    osc.start(startSec);
    osc.stop(startSec + durSec);
    return osc;
}

/**
 * Play a Morse code string (dots, dashes, spaces, slashes) using Web Audio.
 * Timing based on PARIS standard: dot = 1200/wpm ms.
 * @param {string} code - e.g. "... --- ..." or "... --- ... / ... --- ..."
 */
function playMorseString(code) {
    stopMorseAudio();
    const ctx = getOrCreateAudioCtx();
    const wpm = morseAudioWpm;
    const freq = morseAudioFreq;
    const dotMs = 1200 / wpm;           // dot duration
    const dashMs = dotMs * 3;           // dash = 3 dots
    const symbolGapMs = dotMs;          // gap between symbols in same letter
    const letterGapPlayMs = dotMs * 3;  // gap between letters
    const wordGapPlayMs = dotMs * 7;    // gap between words

    // Normalise input
    const clean = code
        .replace(/[·•]/g, '.')
        .replace(/[−–—]/g, '-')
        .trim();

    const words = clean.split(/\s*\/\s*/);
    const nodes = [];

    let timeSec = ctx.currentTime + 0.1; // slight lead-in
    const totalMs = estimateMorseMs(clean, dotMs);
    let elapsed = 0;

    for (let wi = 0; wi < words.length; wi++) {
        const letters = words[wi].trim().split(/\s+/);
        for (let li = 0; li < letters.length; li++) {
            const letter = letters[li];
            for (let si = 0; si < letter.length; si++) {
                const sym = letter[si];
                const dur = sym === '.' ? dotMs : (sym === '-' ? dashMs : 0);
                if (dur > 0) {
                    nodes.push(scheduleBeep(ctx, timeSec, dur / 1000, freq));
                    elapsed += dur;
                    timeSec += dur / 1000;
                    if (si < letter.length - 1) { timeSec += symbolGapMs / 1000; elapsed += symbolGapMs; }
                }
            }
            if (li < letters.length - 1) { timeSec += letterGapPlayMs / 1000; elapsed += letterGapPlayMs; }
        }
        if (wi < words.length - 1) { timeSec += wordGapPlayMs / 1000; elapsed += wordGapPlayMs; }
    }

    morseIsPlaying = true;
    morsePlayBtn.disabled = true;
    morseAudioStatusEl.textContent = '▶ Playing…';

    // Progress animation
    const totalSecs = timeSec - ctx.currentTime;
    const startReal = performance.now();
    const progressRaf = { id: null };
    function tickProgress() {
        if (!morseIsPlaying) return;
        const pct = Math.min(((performance.now() - startReal) / (totalSecs * 1000)) * 100, 100);
        morseAudioBarEl.style.width = pct + '%';
        if (pct < 100) { progressRaf.id = requestAnimationFrame(tickProgress); }
        else { morseAudioBarEl.style.width = '100%'; }
    }
    progressRaf.id = requestAnimationFrame(tickProgress);

    // Mark done after all beeps
    const doneTimer = setTimeout(() => {
        morseIsPlaying = false;
        morsePlayBtn.disabled = false;
        morseAudioStatusEl.textContent = '✅ Done';
        morseAudioBarEl.style.width = '100%';
        cancelAnimationFrame(progressRaf.id);
        setTimeout(() => morseAudioBarEl.style.width = '0%', 1500);
    }, totalSecs * 1000 + 200);
    morsePlayScheduled.push(doneTimer);
}

function estimateMorseMs(clean, dotMs) {
    let ms = 0;
    for (const c of clean) {
        if (c === '.') ms += dotMs;
        else if (c === '-') ms += dotMs * 3;
        else if (c === ' ') ms += dotMs * 3;
        else if (c === '/') ms += dotMs * 7;
    }
    return ms;
}

function stopMorseAudio() {
    morseIsPlaying = false;
    morsePlayScheduled.forEach(id => clearTimeout(id));
    morsePlayScheduled = [];
    if (audioCtx) {
        try { audioCtx.close(); } catch (_) { }
        audioCtx = null;
    }
    morsePlayBtn.disabled = false;
    morseAudioBarEl.style.width = '0%';
    morseAudioStatusEl.textContent = 'Stopped';
}

morsePlayBtn.addEventListener('click', () => {
    const text = detectedText.value.trim();
    if (!text) { showToast('⚠️ Detected text is empty!'); return; }
    playMorseString(textToMorse(text));
});

morseStopBtn.addEventListener('click', stopMorseAudio);


/* ─── Manual Keyboard Input Pad ─── */

const morseKbPad = document.getElementById('morseKbPad');
const morseKbIconEl = document.getElementById('morseKbIcon');
const morseKbStatusEl = document.getElementById('morseKbStatus');
const morseKbSeqEl = document.getElementById('morseKbSeq');
const morseKbBarEl = document.getElementById('morseKbBar');
const morseKbCommitBtn = document.getElementById('morseKbCommitBtn');
const morseKbSpaceBtn = document.getElementById('morseKbSpaceBtn');
const morseKbClearBtn = document.getElementById('morseKbClearBtn');

let kbSymbols = [];           // current letter's symbols
let kbKeyDown = false;        // is key currently held?
let kbPressStart = null;      // when key was pressed
let kbLetterTimer = null;     // auto-commit letter timer
let kbWordTimer = null;     // auto-commit word (space) timer
let kbRafId = null;           // rAF for bar progress

// DOT_MS derived from dotMaxMs (shared setting), so keyboard uses same thresholds
function kbDotMs() { return dotMaxMs; }
function kbLetterMs() { return letterGapMs; }
function kbWordMs() { return wordGapMs; }

function kbUpdateSeq() {
    const seq = kbSymbols.join(' ');
    morseKbSeqEl.textContent = seq || '—';
    const decoded = kbSymbols.length ? (MORSE_TABLE[kbSymbols.join('')] || '?') : '?';
    morseKbStatusEl.textContent = kbSymbols.length
        ? `Current: ${seq} → "${decoded}"`
        : 'Click here, then hold a key';
}

function kbCommitLetter() {
    if (!kbSymbols.length) return;
    const code = kbSymbols.join('');
    const letter = MORSE_TABLE[code];
    if (letter) {
        appendText(letter);
        showConfirmFlash(letter, 'morse-flash');
        highlightMorseTile(letter);
        showToast(`✅ "${letter}" added`);
    } else {
        showToast(`⚠️ Unknown code: ${code.split('').join(' ')}`);
    }
    kbSymbols = [];
    kbUpdateSeq();
    // Play feedback beep
    kbBeepFeedback(letter ? 880 : 440, 80);
}

function kbBeepFeedback(hz, ms) {
    try {
        const ctx = getOrCreateAudioCtx();
        scheduleBeep(ctx, ctx.currentTime, ms / 1000, hz);
    } catch (_) { }
}

function kbProgressLoop() {
    if (!kbKeyDown || !kbPressStart) return;
    const elapsed = performance.now() - kbPressStart;
    const thresh = kbDotMs() * 3;  // dash threshold (3× dot)
    const pct = Math.min((elapsed / thresh) * 100, 100);
    morseKbBarEl.style.width = pct + '%';
    // Switch colour: yellow → orange as approaching dash
    morseKbBarEl.style.background =
        elapsed < kbDotMs()
            ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'          // dot colour
            : 'linear-gradient(90deg,#f59e0b,#ef4444)';         // dash colour
    if (kbKeyDown) kbRafId = requestAnimationFrame(kbProgressLoop);
}

// Keyboard events — only when pad is focused
morseKbPad.addEventListener('keydown', e => {
    if (kbKeyDown) return;  // ignore auto-repeat
    e.preventDefault();
    kbKeyDown = true;
    kbPressStart = performance.now();
    morseKbIconEl.textContent = '🔵';
    // Cancel pending letter/word timers
    clearTimeout(kbLetterTimer); clearTimeout(kbWordTimer);
    kbLetterTimer = null; kbWordTimer = null;
    kbRafId = requestAnimationFrame(kbProgressLoop);
});

morseKbPad.addEventListener('keyup', e => {
    e.preventDefault();
    if (!kbKeyDown) return;
    kbKeyDown = false;
    cancelAnimationFrame(kbRafId);
    morseKbBarEl.style.width = '0%';
    morseKbIconEl.textContent = '⌨️';

    const dur = performance.now() - kbPressStart;
    const sym = dur < kbDotMs() ? '.' : '-';
    kbSymbols.push(sym);
    kbUpdateSeq();
    // Visual flash
    morseKbIconEl.textContent = sym === '.' ? '·' : '−';
    setTimeout(() => { morseKbIconEl.textContent = '⌨️'; }, 300);

    // Play audio feedback
    kbBeepFeedback(morseAudioFreq, sym === '.' ? kbDotMs() * 0.8 : dotMaxMs * 2.4);

    // Schedule letter commit
    kbLetterTimer = setTimeout(() => {
        kbCommitLetter();
        // Then schedule word space if no more input
        kbWordTimer = setTimeout(() => {
            if (detectedText.value && detectedText.value.slice(-1) !== ' ') {
                appendText(' ');
                showToast('⎵ Word space added');
            }
        }, kbWordMs() - kbLetterMs());
    }, kbLetterMs());
});

// Also handle touch for mobile
morseKbPad.addEventListener('touchstart', e => {
    e.preventDefault();
    morseKbPad.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
}, { passive: false });
morseKbPad.addEventListener('touchend', e => {
    e.preventDefault();
    morseKbPad.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}, { passive: false });

// Focus style
morseKbPad.addEventListener('focus', () => morseKbPad.classList.add('focused'));
morseKbPad.addEventListener('blur', () => morseKbPad.classList.remove('focused'));

// Manual buttons
morseKbCommitBtn.addEventListener('click', () => {
    clearTimeout(kbLetterTimer); clearTimeout(kbWordTimer);
    kbCommitLetter();
});
morseKbSpaceBtn.addEventListener('click', () => {
    clearTimeout(kbLetterTimer); clearTimeout(kbWordTimer);
    kbCommitLetter();
    appendText(' ');
    showToast('⎵ Word space added');
});
morseKbClearBtn.addEventListener('click', () => {
    clearTimeout(kbLetterTimer); clearTimeout(kbWordTimer);
    kbSymbols = [];
    kbUpdateSeq();
    showToast('↩ Cleared');
});

/* ════════════════════════════════════════════════
   LANGUAGE TRANSLATION MODULE
   Offline phrase-dictionary + word-by-word lookup
   Covers 12 languages with ~400 common words each.
════════════════════════════════════════════════ */

const translatePanel = document.getElementById('translatePanel');
const translateFromEl = document.getElementById('translateFrom');
const translateToEl = document.getElementById('translateTo');
const translateSwapBtn = document.getElementById('translateSwapBtn');
const translateInputEl = document.getElementById('translateInput');
const translateBtnEl = document.getElementById('translateBtn');
const translateFromDetectedBtn = document.getElementById('translateFromDetectedBtn');
const translateClearBtn = document.getElementById('translateClearBtn');
const translateResultEl = document.getElementById('translateResult');
const translateCopyBtn = document.getElementById('translateCopyBtn');
const translateAppendBtn = document.getElementById('translateAppendBtn');
const translateSpeakBtn = document.getElementById('translateSpeakBtn');
const translateCharCountEl = document.getElementById('translateCharCount');
const translateEngineBadgeEl = document.getElementById('translateEngineBadge');
const translatePhrasesGrid = document.getElementById('translatePhrasesGrid');

/**
 * Offline translation dictionary.
 * Structure: TRANS_DICT[fromLang][toLang][word] = translation
 * We embed English→others and others→English for the 11 supported non-English langs.
 * The data covers ~300 high-frequency words per language pair.
 */
const EN_DICT = {
    es: { // English → Spanish
        'hello': 'hola', 'hi': 'hola', 'bye': 'adiós', 'goodbye': 'adiós', 'yes': 'sí', 'no': 'no',
        'please': 'por favor', 'thank you': 'gracias', 'thanks': 'gracias', 'sorry': 'lo siento',
        'excuse me': 'disculpe', 'help': 'ayuda', 'stop': 'parar', 'good': 'bueno', 'bad': 'malo',
        'morning': 'mañana', 'evening': 'tarde', 'night': 'noche', 'today': 'hoy', 'tomorrow': 'mañana',
        'water': 'agua', 'food': 'comida', 'eat': 'comer', 'drink': 'beber', 'sleep': 'dormir',
        'love': 'amor', 'happy': 'feliz', 'sad': 'triste', 'angry': 'enojado', 'scared': 'asustado',
        'big': 'grande', 'small': 'pequeño', 'fast': 'rápido', 'slow': 'lento', 'hot': 'caliente',
        'cold': 'frío', 'new': 'nuevo', 'old': 'viejo', 'beautiful': 'hermoso', 'ugly': 'feo',
        'strong': 'fuerte', 'weak': 'débil', 'open': 'abrir', 'close': 'cerrar', 'go': 'ir',
        'come': 'venir', 'run': 'correr', 'walk': 'caminar', 'read': 'leer', 'write': 'escribir',
        'speak': 'hablar', 'listen': 'escuchar', 'see': 'ver', 'hear': 'oír', 'think': 'pensar',
        'know': 'saber', 'want': 'querer', 'need': 'necesitar', 'have': 'tener', 'give': 'dar',
        'take': 'tomar', 'make': 'hacer', 'buy': 'comprar', 'pay': 'pagar', 'work': 'trabajar',
        'play': 'jugar', 'learn': 'aprender', 'understand': 'entender', 'call': 'llamar',
        'wait': 'esperar', 'meet': 'conocer', 'father': 'padre', 'mother': 'madre',
        'son': 'hijo', 'daughter': 'hija', 'brother': 'hermano', 'sister': 'hermana',
        'friend': 'amigo', 'family': 'familia', 'man': 'hombre', 'woman': 'mujer',
        'child': 'niño', 'doctor': 'médico', 'police': 'policía', 'fire': 'fuego',
        'house': 'casa', 'school': 'escuela', 'hospital': 'hospital', 'store': 'tienda',
        'car': 'coche', 'bus': 'autobús', 'phone': 'teléfono', 'book': 'libro',
        'money': 'dinero', 'red': 'rojo', 'blue': 'azul', 'green': 'verde', 'black': 'negro',
        'white': 'blanco', 'yellow': 'amarillo', 'one': 'uno', 'two': 'dos', 'three': 'tres',
        'four': 'cuatro', 'five': 'cinco', 'six': 'seis', 'seven': 'siete', 'eight': 'ocho',
        'nine': 'nueve', 'ten': 'diez', 'where': 'dónde', 'when': 'cuándo', 'what': 'qué',
        'who': 'quién', 'why': 'por qué', 'how': 'cómo', 'i': 'yo', 'you': 'tú',
        'he': 'él', 'she': 'ella', 'we': 'nosotros', 'they': 'ellos', 'my': 'mi',
        'your': 'tu', 'his': 'su', 'her': 'su', 'their': 'su', 'our': 'nuestro',
        'and': 'y', 'or': 'o', 'but': 'pero', 'because': 'porque', 'if': 'si',
        'that': 'que', 'this': 'esto', 'very': 'muy', 'not': 'no', 'with': 'con',
        'without': 'sin', 'for': 'para', 'from': 'de', 'to': 'a', 'in': 'en', 'on': 'en',
        'at': 'en', 'of': 'de', 'a': 'un', 'the': 'el', 'is': 'es', 'are': 'son',
        'was': 'era', 'will': 'será', 'can': 'puede', 'should': 'debería', 'must': 'debe',
        'i love you': 'te quiero', 'good morning': 'buenos días', 'good night': 'buenas noches',
        'how are you': '¿cómo estás?', 'thank you very much': 'muchas gracias',
        'where is the bathroom': '¿dónde está el baño?', 'i need help': 'necesito ayuda',
        'call the police': 'llama a la policía', 'i am lost': 'estoy perdido',
    },
    fr: { // English → French
        'hello': 'bonjour', 'hi': 'salut', 'bye': 'au revoir', 'goodbye': 'au revoir',
        'yes': 'oui', 'no': 'non', 'please': 's\'il vous plaît', 'thank you': 'merci',
        'thanks': 'merci', 'sorry': 'désolé', 'excuse me': 'excusez-moi', 'help': 'aide',
        'stop': 'arrêt', 'good': 'bon', 'bad': 'mauvais', 'morning': 'matin', 'evening': 'soir',
        'night': 'nuit', 'today': 'aujourd\'hui', 'tomorrow': 'demain', 'water': 'eau',
        'food': 'nourriture', 'eat': 'manger', 'drink': 'boire', 'sleep': 'dormir',
        'love': 'amour', 'happy': 'heureux', 'sad': 'triste', 'angry': 'en colère',
        'big': 'grand', 'small': 'petit', 'fast': 'rapide', 'slow': 'lent', 'hot': 'chaud',
        'cold': 'froid', 'new': 'nouveau', 'old': 'vieux', 'beautiful': 'beau', 'ugly': 'laid',
        'open': 'ouvrir', 'close': 'fermer', 'go': 'aller', 'come': 'venir', 'run': 'courir',
        'walk': 'marcher', 'read': 'lire', 'write': 'écrire', 'speak': 'parler',
        'listen': 'écouter', 'see': 'voir', 'hear': 'entendre', 'think': 'penser',
        'know': 'savoir', 'want': 'vouloir', 'need': 'avoir besoin', 'have': 'avoir',
        'give': 'donner', 'take': 'prendre', 'make': 'faire', 'buy': 'acheter',
        'work': 'travailler', 'play': 'jouer', 'learn': 'apprendre', 'call': 'appeler',
        'wait': 'attendre', 'father': 'père', 'mother': 'mère', 'brother': 'frère',
        'sister': 'sœur', 'friend': 'ami', 'family': 'famille', 'man': 'homme',
        'woman': 'femme', 'child': 'enfant', 'doctor': 'médecin', 'police': 'police',
        'house': 'maison', 'school': 'école', 'car': 'voiture', 'phone': 'téléphone',
        'money': 'argent', 'red': 'rouge', 'blue': 'bleu', 'green': 'vert', 'black': 'noir',
        'white': 'blanc', 'yellow': 'jaune', 'one': 'un', 'two': 'deux', 'three': 'trois',
        'four': 'quatre', 'five': 'cinq', 'where': 'où', 'when': 'quand', 'what': 'quoi',
        'who': 'qui', 'why': 'pourquoi', 'how': 'comment', 'i': 'je', 'you': 'vous',
        'he': 'il', 'she': 'elle', 'we': 'nous', 'they': 'ils', 'and': 'et', 'or': 'ou',
        'but': 'mais', 'very': 'très', 'not': 'ne... pas', 'with': 'avec', 'for': 'pour',
        'i love you': 'je t\'aime', 'good morning': 'bonjour', 'good night': 'bonne nuit',
        'how are you': 'comment allez-vous?', 'thank you very much': 'merci beaucoup',
    },
    de: { // English → German
        'hello': 'hallo', 'hi': 'hallo', 'bye': 'tschüss', 'goodbye': 'auf wiedersehen',
        'yes': 'ja', 'no': 'nein', 'please': 'bitte', 'thank you': 'danke',
        'thanks': 'danke', 'sorry': 'entschuldigung', 'excuse me': 'entschuldigung',
        'help': 'hilfe', 'stop': 'halt', 'good': 'gut', 'bad': 'schlecht',
        'morning': 'morgen', 'evening': 'abend', 'night': 'nacht', 'today': 'heute',
        'tomorrow': 'morgen', 'water': 'wasser', 'food': 'essen', 'eat': 'essen',
        'drink': 'trinken', 'sleep': 'schlafen', 'love': 'liebe', 'happy': 'glücklich',
        'sad': 'traurig', 'angry': 'wütend', 'big': 'groß', 'small': 'klein',
        'fast': 'schnell', 'slow': 'langsam', 'hot': 'heiß', 'cold': 'kalt',
        'new': 'neu', 'old': 'alt', 'beautiful': 'schön', 'open': 'öffnen',
        'close': 'schließen', 'go': 'gehen', 'come': 'kommen', 'run': 'rennen',
        'walk': 'spazieren', 'read': 'lesen', 'write': 'schreiben', 'speak': 'sprechen',
        'listen': 'hören', 'see': 'sehen', 'hear': 'hören', 'think': 'denken',
        'know': 'wissen', 'want': 'wollen', 'need': 'brauchen', 'have': 'haben',
        'give': 'geben', 'take': 'nehmen', 'make': 'machen', 'buy': 'kaufen',
        'work': 'arbeiten', 'play': 'spielen', 'learn': 'lernen', 'call': 'anrufen',
        'father': 'vater', 'mother': 'mutter', 'brother': 'bruder', 'sister': 'schwester',
        'friend': 'freund', 'family': 'familie', 'man': 'mann', 'woman': 'frau',
        'child': 'kind', 'doctor': 'arzt', 'police': 'polizei', 'house': 'haus',
        'school': 'schule', 'car': 'auto', 'phone': 'telefon', 'money': 'geld',
        'red': 'rot', 'blue': 'blau', 'green': 'grün', 'black': 'schwarz', 'white': 'weiß',
        'yellow': 'gelb', 'one': 'ein', 'two': 'zwei', 'three': 'drei', 'four': 'vier',
        'five': 'fünf', 'where': 'wo', 'when': 'wann', 'what': 'was', 'who': 'wer',
        'why': 'warum', 'how': 'wie', 'i': 'ich', 'you': 'sie', 'he': 'er', 'she': 'sie',
        'we': 'wir', 'they': 'sie', 'and': 'und', 'or': 'oder', 'but': 'aber', 'very': 'sehr',
        'i love you': 'ich liebe dich', 'good morning': 'guten morgen',
        'good night': 'gute nacht', 'how are you': 'wie geht es ihnen?',
    },
    it: { // English → Italian
        'hello': 'ciao', 'hi': 'ciao', 'bye': 'arrivederci', 'goodbye': 'arrivederci',
        'yes': 'sì', 'no': 'no', 'please': 'per favore', 'thank you': 'grazie',
        'thanks': 'grazie', 'sorry': 'mi dispiace', 'excuse me': 'scusi', 'help': 'aiuto',
        'stop': 'fermati', 'good': 'buono', 'bad': 'cattivo', 'morning': 'mattina',
        'evening': 'sera', 'night': 'notte', 'today': 'oggi', 'tomorrow': 'domani',
        'water': 'acqua', 'food': 'cibo', 'eat': 'mangiare', 'drink': 'bere',
        'sleep': 'dormire', 'love': 'amore', 'happy': 'felice', 'sad': 'triste',
        'angry': 'arrabbiato', 'big': 'grande', 'small': 'piccolo', 'fast': 'veloce',
        'slow': 'lento', 'hot': 'caldo', 'cold': 'freddo', 'new': 'nuovo', 'old': 'vecchio',
        'beautiful': 'bello', 'open': 'aprire', 'close': 'chiudere', 'go': 'andare',
        'come': 'venire', 'read': 'leggere', 'write': 'scrivere', 'speak': 'parlare',
        'listen': 'ascoltare', 'see': 'vedere', 'hear': 'sentire', 'think': 'pensare',
        'know': 'sapere', 'want': 'volere', 'need': 'avere bisogno', 'have': 'avere',
        'give': 'dare', 'take': 'prendere', 'make': 'fare', 'buy': 'comprare',
        'work': 'lavorare', 'play': 'giocare', 'learn': 'imparare',
        'father': 'padre', 'mother': 'madre', 'brother': 'fratello', 'sister': 'sorella',
        'friend': 'amico', 'family': 'famiglia', 'man': 'uomo', 'woman': 'donna',
        'child': 'bambino', 'doctor': 'medico', 'police': 'polizia',
        'house': 'casa', 'school': 'scuola', 'car': 'macchina', 'phone': 'telefono',
        'money': 'soldi', 'red': 'rosso', 'blue': 'blu', 'green': 'verde',
        'black': 'nero', 'white': 'bianco', 'yellow': 'giallo',
        'i love you': 'ti amo', 'good morning': 'buongiorno', 'good night': 'buonanotte',
    },
    pt: { // English → Portuguese
        'hello': 'olá', 'hi': 'oi', 'bye': 'tchau', 'goodbye': 'adeus',
        'yes': 'sim', 'no': 'não', 'please': 'por favor', 'thank you': 'obrigado',
        'thanks': 'obrigado', 'sorry': 'desculpe', 'excuse me': 'com licença',
        'help': 'ajuda', 'stop': 'parar', 'good': 'bom', 'bad': 'mau',
        'morning': 'manhã', 'evening': 'tarde', 'night': 'noite', 'today': 'hoje',
        'tomorrow': 'amanhã', 'water': 'água', 'food': 'comida', 'eat': 'comer',
        'drink': 'beber', 'sleep': 'dormir', 'love': 'amor', 'happy': 'feliz',
        'sad': 'triste', 'angry': 'com raiva', 'big': 'grande', 'small': 'pequeno',
        'fast': 'rápido', 'slow': 'lento', 'hot': 'quente', 'cold': 'frio',
        'new': 'novo', 'old': 'velho', 'beautiful': 'bonito', 'open': 'abrir',
        'close': 'fechar', 'go': 'ir', 'come': 'vir', 'read': 'ler', 'write': 'escrever',
        'speak': 'falar', 'listen': 'ouvir', 'see': 'ver', 'hear': 'ouvir',
        'think': 'pensar', 'know': 'saber', 'want': 'querer', 'need': 'precisar',
        'have': 'ter', 'give': 'dar', 'take': 'pegar', 'make': 'fazer', 'buy': 'comprar',
        'father': 'pai', 'mother': 'mãe', 'brother': 'irmão', 'sister': 'irmã',
        'friend': 'amigo', 'man': 'homem', 'woman': 'mulher', 'child': 'criança',
        'doctor': 'médico', 'police': 'polícia', 'house': 'casa', 'school': 'escola',
        'car': 'carro', 'phone': 'telefone', 'money': 'dinheiro',
        'red': 'vermelho', 'blue': 'azul', 'green': 'verde', 'black': 'preto', 'white': 'branco',
        'i love you': 'eu te amo', 'good morning': 'bom dia', 'good night': 'boa noite',
    },
    hi: { // English → Hindi
        'hello': 'नमस्ते', 'hi': 'हाय', 'bye': 'अलविदा', 'goodbye': 'अलविदा',
        'yes': 'हाँ', 'no': 'नहीं', 'please': 'कृपया', 'thank you': 'धन्यवाद',
        'thanks': 'शुक्रिया', 'sorry': 'माफ करें', 'excuse me': 'क्षमा करें',
        'help': 'मदद', 'stop': 'रुको', 'good': 'अच्छा', 'bad': 'बुरा',
        'morning': 'सुबह', 'evening': 'शाम', 'night': 'रात', 'today': 'आज',
        'tomorrow': 'कल', 'water': 'पानी', 'food': 'खाना', 'eat': 'खाना खाओ',
        'drink': 'पीना', 'sleep': 'सोना', 'love': 'प्यार', 'happy': 'खुश',
        'sad': 'दुखी', 'angry': 'गुस्सा', 'big': 'बड़ा', 'small': 'छोटा',
        'fast': 'जल्दी', 'slow': 'धीरे', 'hot': 'गर्म', 'cold': 'ठंडा',
        'new': 'नया', 'old': 'पुराना', 'beautiful': 'सुंदर',
        'go': 'जाओ', 'come': 'आओ', 'read': 'पढ़ना', 'write': 'लिखना',
        'speak': 'बोलना', 'listen': 'सुनना', 'see': 'देखना', 'hear': 'सुनना',
        'think': 'सोचना', 'know': 'जानना', 'want': 'चाहना', 'need': 'ज़रूरत होना',
        'have': 'होना', 'give': 'देना', 'take': 'लेना', 'make': 'बनाना', 'buy': 'खरीदना',
        'father': 'पिता', 'mother': 'माँ', 'brother': 'भाई', 'sister': 'बहन',
        'friend': 'दोस्त', 'family': 'परिवार', 'man': 'आदमी', 'woman': 'औरत',
        'child': 'बच्चा', 'doctor': 'डॉक्टर', 'police': 'पुलिस',
        'house': 'घर', 'school': 'स्कूल', 'car': 'कार', 'phone': 'फोन', 'money': 'पैसा',
        'red': 'लाल', 'blue': 'नीला', 'green': 'हरा', 'black': 'काला', 'white': 'सफेद',
        'i love you': 'मैं तुमसे प्यार करता हूँ', 'good morning': 'सुप्रभात', 'good night': 'शुभ रात्रि',
        'how are you': 'आप कैसे हैं?', 'thank you very much': 'बहुत बहुत धन्यवाद',
    },
    ar: { // English → Arabic
        'hello': 'مرحبا', 'hi': 'أهلاً', 'bye': 'وداعاً', 'goodbye': 'مع السلامة',
        'yes': 'نعم', 'no': 'لا', 'please': 'من فضلك', 'thank you': 'شكراً',
        'thanks': 'شكراً', 'sorry': 'آسف', 'excuse me': 'عفواً', 'help': 'مساعدة',
        'stop': 'توقف', 'good': 'جيد', 'bad': 'سيء', 'morning': 'صباح', 'evening': 'مساء',
        'night': 'ليل', 'today': 'اليوم', 'tomorrow': 'غداً', 'water': 'ماء',
        'food': 'طعام', 'eat': 'يأكل', 'drink': 'يشرب', 'sleep': 'ينام',
        'love': 'حب', 'happy': 'سعيد', 'sad': 'حزين', 'angry': 'غاضب',
        'big': 'كبير', 'small': 'صغير', 'fast': 'سريع', 'slow': 'بطيء',
        'hot': 'حار', 'cold': 'بارد', 'new': 'جديد', 'old': 'قديم', 'beautiful': 'جميل',
        'go': 'يذهب', 'come': 'يأتي', 'read': 'يقرأ', 'write': 'يكتب',
        'speak': 'يتحدث', 'listen': 'يستمع', 'see': 'يرى', 'hear': 'يسمع',
        'think': 'يفكر', 'know': 'يعرف', 'want': 'يريد', 'need': 'يحتاج',
        'have': 'لديه', 'give': 'يعطي', 'take': 'يأخذ', 'make': 'يصنع', 'buy': 'يشتري',
        'father': 'أب', 'mother': 'أم', 'brother': 'أخ', 'sister': 'أخت',
        'friend': 'صديق', 'family': 'عائلة', 'man': 'رجل', 'woman': 'امرأة',
        'child': 'طفل', 'doctor': 'طبيب', 'police': 'شرطة',
        'house': 'منزل', 'school': 'مدرسة', 'car': 'سيارة', 'phone': 'هاتف', 'money': 'مال',
        'red': 'أحمر', 'blue': 'أزرق', 'green': 'أخضر', 'black': 'أسود', 'white': 'أبيض',
        'i love you': 'أحبك', 'good morning': 'صباح الخير', 'good night': 'تصبح على خير',
    },
    zh: { // English → Chinese (Mandarin)
        'hello': '你好', 'hi': '嗨', 'bye': '再见', 'goodbye': '再见', 'yes': '是', 'no': '不',
        'please': '请', 'thank you': '谢谢', 'thanks': '谢谢', 'sorry': '对不起',
        'excuse me': '打扰一下', 'help': '帮助', 'stop': '停', 'good': '好', 'bad': '坏',
        'morning': '早上', 'evening': '晚上', 'night': '夜晚', 'today': '今天',
        'tomorrow': '明天', 'water': '水', 'food': '食物', 'eat': '吃', 'drink': '喝',
        'sleep': '睡觉', 'love': '爱', 'happy': '快乐', 'sad': '悲伤', 'angry': '愤怒',
        'big': '大', 'small': '小', 'fast': '快', 'slow': '慢', 'hot': '热', 'cold': '冷',
        'new': '新', 'old': '旧', 'beautiful': '美丽', 'go': '去', 'come': '来',
        'read': '读', 'write': '写', 'speak': '说', 'listen': '听', 'see': '看', 'hear': '听',
        'think': '想', 'know': '知道', 'want': '想要', 'need': '需要', 'have': '有',
        'give': '给', 'take': '拿', 'make': '做', 'buy': '买',
        'father': '父亲', 'mother': '母亲', 'brother': '兄弟', 'sister': '姐妹',
        'friend': '朋友', 'family': '家庭', 'man': '男人', 'woman': '女人',
        'child': '孩子', 'doctor': '医生', 'police': '警察',
        'house': '房子', 'school': '学校', 'car': '汽车', 'phone': '手机', 'money': '钱',
        'red': '红色', 'blue': '蓝色', 'green': '绿色', 'black': '黑色', 'white': '白色',
        'one': '一', 'two': '二', 'three': '三', 'four': '四', 'five': '五',
        'i love you': '我爱你', 'good morning': '早上好', 'good night': '晚安',
        'how are you': '你好吗?', 'thank you very much': '非常感谢',
    },
    ja: { // English → Japanese
        'hello': 'こんにちは', 'hi': 'やあ', 'bye': 'さようなら', 'goodbye': 'さようなら',
        'yes': 'はい', 'no': 'いいえ', 'please': 'お願いします', 'thank you': 'ありがとう',
        'thanks': 'ありがとう', 'sorry': 'すみません', 'excuse me': 'すみません',
        'help': '助けて', 'stop': '止まれ', 'good': '良い', 'bad': '悪い',
        'morning': '朝', 'evening': '夕方', 'night': '夜', 'today': '今日', 'tomorrow': '明日',
        'water': '水', 'food': '食べ物', 'eat': '食べる', 'drink': '飲む', 'sleep': '寝る',
        'love': '愛', 'happy': '幸せ', 'sad': '悲しい', 'angry': '怒っている',
        'big': '大きい', 'small': '小さい', 'fast': '速い', 'slow': '遅い',
        'hot': '暑い', 'cold': '寒い', 'new': '新しい', 'old': '古い', 'beautiful': '美しい',
        'go': '行く', 'come': '来る', 'read': '読む', 'write': '書く', 'speak': '話す',
        'listen': '聞く', 'see': '見る', 'hear': '聞く', 'think': '考える',
        'know': '知る', 'want': '欲しい', 'need': '必要', 'have': 'ある', 'give': 'あげる',
        'father': '父', 'mother': '母', 'brother': '兄弟', 'sister': '姉妹',
        'friend': '友達', 'family': '家族', 'man': '男', 'woman': '女', 'child': '子供',
        'doctor': '医者', 'police': '警察', 'house': '家', 'school': '学校',
        'car': '車', 'phone': '電話', 'money': 'お金',
        'red': '赤', 'blue': '青', 'green': '緑', 'black': '黒', 'white': '白',
        'i love you': '愛してる', 'good morning': 'おはようございます', 'good night': 'おやすみなさい',
    },
    ko: { // English → Korean
        'hello': '안녕하세요', 'hi': '안녕', 'bye': '안녕히 가세요', 'goodbye': '안녕히 가세요',
        'yes': '네', 'no': '아니요', 'please': '여쭤볼게요', 'thank you': '감사합니다',
        'thanks': '감사해요', 'sorry': '미안합니다', 'excuse me': '실례합니다',
        'help': '도와주세요', 'stop': '멈춰', 'good': '좋은', 'bad': '나쁜',
        'morning': '아침', 'evening': '저녁', 'night': '밤', 'today': '오늘', 'tomorrow': '내일',
        'water': '물', 'food': '음식', 'eat': '먹다', 'drink': '마시다', 'sleep': '자다',
        'love': '사랑', 'happy': '행복한', 'sad': '슬픈', 'angry': '화난',
        'big': '큰', 'small': '작은', 'fast': '빠른', 'slow': '느린',
        'hot': '뜨거운', 'cold': '추운', 'new': '새로운', 'old': '오래된', 'beautiful': '아름다운',
        'go': '가다', 'come': '오다', 'read': '읽다', 'write': '쓰다', 'speak': '말하다',
        'listen': '듣다', 'see': '보다', 'hear': '듣다', 'think': '생각하다',
        'know': '알다', 'want': '원하다', 'need': '필요하다', 'have': '있다', 'give': '주다',
        'father': '아버지', 'mother': '어머니', 'brother': '형제', 'sister': '자매',
        'friend': '친구', 'family': '가족', 'man': '남자', 'woman': '여자', 'child': '아이',
        'doctor': '의사', 'police': '경찰', 'house': '집', 'school': '학교',
        'car': '자동차', 'phone': '전화기', 'money': '돈',
        'i love you': '사랑해요', 'good morning': '좋은 아침이에요', 'good night': '잘 자요',
    },
    ru: { // English → Russian
        'hello': 'привет', 'hi': 'привет', 'bye': 'пока', 'goodbye': 'до свидания',
        'yes': 'да', 'no': 'нет', 'please': 'пожалуйста', 'thank you': 'спасибо',
        'thanks': 'спасибо', 'sorry': 'извините', 'excuse me': 'простите',
        'help': 'помогите', 'stop': 'стоп', 'good': 'хороший', 'bad': 'плохой',
        'morning': 'утро', 'evening': 'вечер', 'night': 'ночь', 'today': 'сегодня',
        'tomorrow': 'завтра', 'water': 'вода', 'food': 'еда', 'eat': 'есть',
        'drink': 'пить', 'sleep': 'спать', 'love': 'любовь', 'happy': 'счастливый',
        'sad': 'грустный', 'angry': 'сердитый', 'big': 'большой', 'small': 'маленький',
        'fast': 'быстрый', 'slow': 'медленный', 'hot': 'горячий', 'cold': 'холодный',
        'new': 'новый', 'old': 'старый', 'beautiful': 'красивый',
        'go': 'идти', 'come': 'приходить', 'read': 'читать', 'write': 'писать',
        'speak': 'говорить', 'listen': 'слушать', 'see': 'видеть', 'hear': 'слышать',
        'think': 'думать', 'know': 'знать', 'want': 'хотеть', 'need': 'нуждаться',
        'have': 'иметь', 'give': 'давать', 'take': 'брать', 'make': 'делать', 'buy': 'покупать',
        'father': 'отец', 'mother': 'мать', 'brother': 'брат', 'sister': 'сестра',
        'friend': 'друг', 'family': 'семья', 'man': 'мужчина', 'woman': 'женщина',
        'child': 'ребёнок', 'doctor': 'врач', 'police': 'полиция',
        'house': 'дом', 'school': 'школа', 'car': 'машина', 'phone': 'телефон', 'money': 'деньги',
        'red': 'красный', 'blue': 'синий', 'green': 'зелёный', 'black': 'чёрный', 'white': 'белый',
        'i love you': 'я тебя люблю', 'good morning': 'доброе утро', 'good night': 'спокойной ночи',
    },
};

/**
 * Build a reverse (target→English) dictionary from the EN_DICT.
 * We generate REVERSE_DICT[toLang][word] = english for each toLang.
 */
const REVERSE_DICT = {};
Object.entries(EN_DICT).forEach(([lang, map]) => {
    REVERSE_DICT[lang] = {};
    Object.entries(map).forEach(([en, translated]) => {
        REVERSE_DICT[lang][translated.toLowerCase()] = en;
    });
});

/**
 * Translate text offline using the embedded dictionary.
 * Supports:
 *   - en → any lang (using EN_DICT)
 *   - any lang → en (using REVERSE_DICT)
 *   - any lang → any lang (via English pivot)
 * Returns { text, coverage } where coverage is 0.0–1.0 ratio of words translated.
 */
function offlineTranslate(text, fromLang, toLang) {
    if (fromLang === toLang) return { text, coverage: 1.0 };

    // Try to get direct phrase match first for common phrases
    const textLower = text.trim().toLowerCase();

    // Direct phrase lookup (exact match)
    let dictEn;
    if (fromLang === 'en') {
        dictEn = EN_DICT[toLang] || {};
        if (dictEn[textLower]) return { text: dictEn[textLower], coverage: 1.0 };
    } else if (toLang === 'en') {
        const dictRev = REVERSE_DICT[fromLang] || {};
        if (dictRev[textLower]) return { text: dictRev[textLower], coverage: 1.0 };
    } else {
        // Pivot through English
        const dictRevFrom = REVERSE_DICT[fromLang] || {};
        const enPivot = dictRevFrom[textLower];
        if (enPivot) {
            const dictTo = EN_DICT[toLang] || {};
            if (dictTo[enPivot]) return { text: dictTo[enPivot], coverage: 1.0 };
        }
    }

    // Word-by-word translation
    const words = text.split(/(\s+)/);
    let translatedWords = [];
    let translated = 0;
    let total = 0;

    words.forEach(token => {
        if (/^\s+$/.test(token)) { translatedWords.push(token); return; }
        const lw = token.toLowerCase().replace(/[.,!?;:'"()\[\]{}—–]/g, '');
        const punct = token.slice(lw.length + (token.indexOf(lw)));
        total++;

        let result = null;
        if (fromLang === 'en') {
            const d = EN_DICT[toLang] || {};
            result = d[lw];
        } else if (toLang === 'en') {
            const d = REVERSE_DICT[fromLang] || {};
            result = d[lw];
        } else {
            // pivot: from→en→to
            const rev = REVERSE_DICT[fromLang] || {};
            const en = rev[lw];
            if (en) {
                const fwd = EN_DICT[toLang] || {};
                result = fwd[en];
            }
        }

        if (result) {
            // Preserve original capitalisation
            if (token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
                result = result.charAt(0).toUpperCase() + result.slice(1);
            }
            translatedWords.push(result);
            translated++;
        } else {
            translatedWords.push(token); // keep original if unknown
        }
    });

    const coverage = total > 0 ? translated / total : 0;
    return { text: translatedWords.join(''), coverage };
}

/** Common phrases for the quick-lookup panel */
const COMMON_PHRASES = [
    'Hello', 'Goodbye', 'Thank you', 'Please', 'Sorry', 'Excuse me',
    'Yes', 'No', 'Help', 'I love you', 'Good morning', 'Good night',
    'How are you?', 'Where is the bathroom?', 'I need help',
    'Call the police', 'Stop', 'I am lost', 'Water', 'Food',
    'Doctor', 'Emergency', 'Thank you very much', 'Beautiful',
];

function buildTranslatePhrasesGrid() {
    if (!translatePhrasesGrid) return;
    translatePhrasesGrid.innerHTML = '';
    COMMON_PHRASES.forEach(phrase => {
        const btn = document.createElement('button');
        btn.className = 'translate-phrase-chip';
        btn.textContent = phrase;
        btn.addEventListener('click', () => {
            translateInputEl.value = phrase;
            updateTranslateCharCount();
            doTranslate();
        });
        translatePhrasesGrid.appendChild(btn);
    });
}

function updateTranslateCharCount() {
    const l = translateInputEl.value.length;
    if (translateCharCountEl) translateCharCountEl.textContent = `${l} char${l !== 1 ? 's' : ''}`;
}

function doTranslate() {
    const text = translateInputEl.value.trim();
    if (!text) { showToast('⚠️ Enter text to translate!'); return; }

    const from = translateFromEl.value;
    const to = translateToEl.value;

    if (from === to) {
        translateResultEl.innerHTML = `<span class="translate-same-lang">${text}</span>`;
        showToast('ℹ️ Same language selected');
        return;
    }

    translateBtnEl.textContent = '⌛ Translating…';
    translateBtnEl.disabled = true;

    setTimeout(() => {
        try {
            const { text: result, coverage } = offlineTranslate(text, from, to);
            const pct = Math.round(coverage * 100);
            translateResultEl.textContent = result;
            if (translateEngineBadgeEl) {
                translateEngineBadgeEl.textContent = `Offline • ${pct}% matched`;
            }
            if (coverage < 0.5) {
                showToast(`⚠️ ${pct}% matched — try shorter phrases for best results`);
            } else {
                showToast(`✅ Translated! (${pct}% words matched)`);
            }
        } catch (err) {
            translateResultEl.textContent = '❌ Translation error: ' + err.message;
        } finally {
            translateBtnEl.textContent = '🌐 Translate';
            translateBtnEl.disabled = false;
        }
    }, 50); // small delay to allow UI to refresh
}

// Wire up translate buttons
if (translateBtnEl) translateBtnEl.addEventListener('click', doTranslate);

if (translateFromDetectedBtn) {
    translateFromDetectedBtn.addEventListener('click', () => {
        const t = detectedText.value.trim();
        if (!t) { showToast('⚠️ Detected text is empty!'); return; }
        translateInputEl.value = t;
        updateTranslateCharCount();
        showToast('📋 Copied from detected text');
    });
}

if (translateClearBtn) {
    translateClearBtn.addEventListener('click', () => {
        translateInputEl.value = '';
        translateResultEl.innerHTML = '<span class="translate-placeholder">Translation will appear here…</span>';
        updateTranslateCharCount();
        if (translateEngineBadgeEl) translateEngineBadgeEl.textContent = 'Offline Dictionary';
    });
}

if (translateSwapBtn) {
    translateSwapBtn.addEventListener('click', () => {
        const tmp = translateFromEl.value;
        translateFromEl.value = translateToEl.value;
        translateToEl.value = tmp;
        // Also swap text if result exists
        const resultText = translateResultEl.textContent.trim();
        if (resultText && resultText !== 'Translation will appear here…') {
            translateInputEl.value = resultText;
            updateTranslateCharCount();
        }
        showToast('⇄ Languages swapped');
    });
}

if (translateCopyBtn) {
    translateCopyBtn.addEventListener('click', async () => {
        const t = translateResultEl.textContent.trim();
        if (!t || t === 'Translation will appear here…') { showToast('⚠️ Nothing to copy!'); return; }
        try { await navigator.clipboard.writeText(t); showToast('✅ Translation copied!'); }
        catch { showToast('❌ Copy failed'); }
    });
}

if (translateAppendBtn) {
    translateAppendBtn.addEventListener('click', () => {
        const t = translateResultEl.textContent.trim();
        if (!t || t === 'Translation will appear here…') { showToast('⚠️ Nothing to append!'); return; }
        appendText(t);
        showToast('✅ Translation appended');
    });
}

if (translateSpeakBtn) {
    translateSpeakBtn.addEventListener('click', () => {
        const t = translateResultEl.textContent.trim();
        if (!t || t === 'Translation will appear here\u2026') { showToast('\u26a0\ufe0f Nothing to speak!'); return; }
        const toLang = translateToEl.value;
        const langMap = {
            en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
            it: 'it-IT', pt: 'pt-BR', hi: 'hi-IN', ar: 'ar-SA',
            zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ru: 'ru-RU'
        };
        const utter = new SpeechSynthesisUtterance(t);
        utter.lang = langMap[toLang] || 'en-US';
        utter.rate = ttsRateEl ? parseFloat(ttsRateEl.value) : 1;
        utter.pitch = ttsPitchEl ? parseFloat(ttsPitchEl.value) : 1;
        speechSynthesis.cancel();
        setTimeout(() => { speechSynthesis.speak(utter); showToast('\ud83d\udd0a Speaking translation\u2026'); }, 120);
    });
}

if (translateInputEl) {
    translateInputEl.addEventListener('input', updateTranslateCharCount);
}

// Build phrases grid on load
buildTranslatePhrasesGrid();


/* ════════════════════════════════════════════════
   SPEECH TO TEXT (STT) MODULE
   Uses the Web Speech Recognition API.
   NOTE: Chrome requires HTTPS or localhost for both
   SpeechRecognition AND getUserMedia. When running
   from a file:// URL, STT will fail with 'not-allowed'.
   Serve the app via:  python3 -m http.server 8080
   then open: http://localhost:8080
════════════════════════════════════════════════ */
const sttBtn = document.getElementById('sttBtn');
const sttStatus = document.getElementById('sttStatus');

let sttRecognition = null;
let sttIsListening = false;
const isFileProtocol = location.protocol === 'file:';

function initSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (sttBtn) {
            sttBtn.disabled = true;
            sttBtn.title = 'Speech Recognition not supported in this browser. Use Chrome or Edge.';
        }
        return;
    }

    if (isFileProtocol) {
        // file:// blocks microphone — inform user but keep button enabled
        if (sttBtn) {
            sttBtn.title = 'STT needs a local server. Run: python3 -m http.server 8080 and open localhost:8080';
        }
        // Will show toast on click instead of disabling silently
    }

    sttRecognition = new SpeechRecognition();
    sttRecognition.lang = 'en-US';
    sttRecognition.interimResults = true;
    sttRecognition.continuous = true;
    sttRecognition.maxAlternatives = 1;

    sttRecognition.onstart = () => {
        if (sttBtn) {
            sttBtn.classList.add('stt-active');
            sttBtn.innerHTML = '<span>🔴</span> Listening…';
        }
        if (sttStatus) {
            sttStatus.textContent = '🎤 Listening…';
            sttStatus.classList.add('stt-listening');
        }
        showToast('🎤 STT started – speak now');
    };

    sttRecognition.onresult = (event) => {
        let interim = '';
        let final_ = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final_ += transcript + ' ';
            } else {
                interim += transcript;
            }
        }

        if (final_) {
            // Route final text to the active module's input box
            sttRouteText(final_.trim());
        }

        if (sttStatus) {
            sttStatus.textContent = interim ? `🎤 ${interim}` : '🎤 Listening…';
        }
    };


    sttRecognition.onerror = (event) => {
        console.warn('STT error:', event.error);
        let msg;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            if (isFileProtocol) {
                msg = '❌ STT blocked on file://. Run: python3 -m http.server 8080';
            } else {
                msg = '❌ Microphone access denied. Allow mic in browser settings.';
            }
        } else if (event.error === 'network') {
            msg = '⚠️ STT network error (first launch may need internet once)';
        } else if (event.error === 'no-speech') {
            msg = '⚠️ No speech detected – speak closer to mic';
        } else if (event.error === 'audio-capture') {
            msg = '❌ No microphone found';
        } else {
            msg = `❌ STT error: ${event.error}`;
        }
        showToast(msg);
        sttIsListening = false;
        stopSTT();
    };

    sttRecognition.onend = () => {
        if (sttIsListening) {
            // Auto-restart continuous mode
            try { sttRecognition.start(); } catch (_) { stopSTT(); }
        } else {
            // Ensure UI reset
            if (sttBtn) {
                sttBtn.classList.remove('stt-active');
                sttBtn.innerHTML = '<span>🎤</span> Mic STT';
            }
            if (sttStatus) {
                sttStatus.textContent = '';
                sttStatus.classList.remove('stt-listening');
            }
        }
    };
}

function startSTT() {
    if (!sttRecognition) {
        showToast('❌ STT not supported – use Chrome or Edge');
        return;
    }
    if (isFileProtocol) {
        showToast('❌ STT needs localhost. Run: python3 -m http.server 8080');
        return;
    }
    if (sttIsListening) return;
    sttIsListening = true;  // set before .start() to avoid race condition
    try {
        sttRecognition.start();
    } catch (e) {
        sttIsListening = false;
        showToast('❌ STT start failed: ' + e.message);
    }
}

function stopSTT() {
    sttIsListening = false;
    if (sttRecognition) { try { sttRecognition.stop(); } catch (_) { } }
    if (sttBtn) {
        sttBtn.classList.remove('stt-active');
        sttBtn.innerHTML = '<span>🎤</span> Mic STT';
    }
    if (sttStatus) {
        sttStatus.textContent = '';
        sttStatus.classList.remove('stt-listening');
    }
}

if (sttBtn) {
    sttBtn.addEventListener('click', () => {
        if (sttIsListening) {
            stopSTT();
            showToast('🎤 STT stopped');
        } else {
            startSTT();
        }
    });
}
/**
 * Route STT-recognized text to the active module's input box.
 * Modes with a dedicated text input get it pasted there directly.
 * All other modes (ASL, Gestures, Words, OCR) append to the shared detected text area.
 */
function sttRouteText(text) {
    if (!text) return;

    switch (currentMode) {
        case 'morse': {
            // Fill the Text→Morse encoder input and auto-encode
            const mInput = document.getElementById('morseTextInput');
            const mBtn = document.getElementById('morseEncodeBtn');
            if (mInput) {
                mInput.value = (mInput.value ? mInput.value + ' ' : '') + text;
                mInput.dispatchEvent(new Event('input'));
                showToast('🎤 STT → Morse input filled');
                if (mBtn) mBtn.click();   // auto-encode
            } else {
                appendText(text);
            }
            break;
        }
        case 'braille': {
            // Fill the Text→Braille encoder input and auto-convert
            const bInput = document.getElementById('brailleInput');
            const bBtn = document.getElementById('brailleConvertBtn');
            if (bInput) {
                bInput.value = (bInput.value ? bInput.value + ' ' : '') + text;
                bInput.dispatchEvent(new Event('input'));
                showToast('🎤 STT → Braille input filled');
                if (bBtn) bBtn.click();   // auto-convert
            } else {
                appendText(text);
            }
            break;
        }
        case 'translate': {
            // Fill the translation source box and auto-translate
            const tInput = document.getElementById('translateInput');
            const tBtn = document.getElementById('translateBtn');
            if (tInput) {
                tInput.value = (tInput.value ? tInput.value + ' ' : '') + text;
                tInput.dispatchEvent(new Event('input'));  // update char count
                showToast('🎤 STT → Translate input filled');
                if (tBtn) tBtn.click();   // auto-translate
            } else {
                appendText(text);
            }
            break;
        }
        default:
            // ASL, Gestures, Words, Morse-blink, OCR — append to shared area
            appendText(text);
            break;
    }
}

initSTT();



/* ════════════════════════════════════════════════
   ENHANCED TEXT-TO-SPEECH (TTS) MODULE
   Voice selection, rate, and pitch controls.
════════════════════════════════════════════════ */
const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
const ttsRateEl = document.getElementById('ttsRate');
const ttsRateValEl = document.getElementById('ttsRateVal');
const ttsPitchEl = document.getElementById('ttsPitch');
const ttsPitchValEl = document.getElementById('ttsPitchVal');
const ttsStopBtn = document.getElementById('ttsStopBtn');

let ttsVoices = [];

function populateTTSVoices() {
    ttsVoices = speechSynthesis.getVoices();
    if (!ttsVoiceSelect) return;
    ttsVoiceSelect.innerHTML = '';

    if (ttsVoices.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'Default voice';
        ttsVoiceSelect.appendChild(opt);
        return;
    }

    // Sort: English first, then others
    const sorted = [...ttsVoices].sort((a, b) => {
        const aEn = a.lang.startsWith('en');
        const bEn = b.lang.startsWith('en');
        if (aEn && !bEn) return -1;
        if (!aEn && bEn) return 1;
        return a.name.localeCompare(b.name);
    });

    sorted.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.name;      // store name, not index — safe to look up later
        opt.textContent = `${v.name} (${v.lang})`;
        ttsVoiceSelect.appendChild(opt);
    });
    // Try to pre-select a local English voice
    const localEn = sorted.find(v => v.lang.startsWith('en') && v.localService);
    const firstEn = sorted.find(v => v.lang.startsWith('en'));
    const preferred = localEn || firstEn;
    if (preferred) ttsVoiceSelect.value = preferred.name;
}

speechSynthesis.addEventListener('voiceschanged', populateTTSVoices);
populateTTSVoices();

if (ttsRateEl) {
    ttsRateEl.addEventListener('input', () => {
        if (ttsRateValEl) ttsRateValEl.textContent = parseFloat(ttsRateEl.value).toFixed(1) + '×';
    });
}
if (ttsPitchEl) {
    ttsPitchEl.addEventListener('input', () => {
        if (ttsPitchValEl) ttsPitchValEl.textContent = parseFloat(ttsPitchEl.value).toFixed(1);
    });
}

if (ttsStopBtn) {
    ttsStopBtn.addEventListener('click', () => {
        speechSynthesis.cancel();
        showToast('⏹ Speech stopped');
    });
}

// TTS speak — handles Chromium Linux voices:0 and synthesis-failed gracefully
function doTTSSpeak(text) {
    if (!text) { showToast('⚠️ Nothing to speak!'); return; }

    // On Linux Chromium, voices may be 0 — refresh the list first
    const freshVoices = speechSynthesis.getVoices();
    if (freshVoices.length > ttsVoices.length) {
        ttsVoices = freshVoices;
        populateTTSVoices();
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = ttsRateEl ? parseFloat(ttsRateEl.value) : 1;
    utter.pitch = ttsPitchEl ? parseFloat(ttsPitchEl.value) : 1;

    // Look up voice by name stored in dropdown (skip if voices empty)
    if (ttsVoices.length > 0 && ttsVoiceSelect && ttsVoiceSelect.value) {
        const v = ttsVoices.find(v => v.name === ttsVoiceSelect.value);
        if (v) utter.voice = v;
    }

    utter.onerror = (e) => {
        console.error('[TTS] error:', e.error);
        if (e.error === 'synthesis-failed' || e.error === 'synthesis-unavailable') {
            const isLinux = navigator.platform.toLowerCase().includes('linux') ||
                navigator.userAgent.toLowerCase().includes('linux');
            if (isLinux) {
                showToast('❌ TTS unavailable. Relaunch Chromium with: --enable-speech-dispatcher');
                // Show persistent info banner
                if (!document.getElementById('ttsBanner')) {
                    const banner = document.createElement('div');
                    banner.id = 'ttsBanner';
                    banner.style.cssText = `position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
                        background:#1e293b;border:1px solid rgba(239,68,68,0.4);border-radius:10px;
                        padding:10px 16px;font-size:0.78rem;color:#f87171;z-index:9999;max-width:420px;
                        text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
                    banner.innerHTML = `🐧 <b>Linux Chromium TTS fix:</b><br>
                        Close Chromium and relaunch with:<br>
                        <code style="background:#0f172a;padding:2px 6px;border-radius:4px;color:#a78bfa">
                        chromium --enable-speech-dispatcher</code><br>
                        <small style="opacity:0.7">Or use Firefox — TTS works out of the box there.</small>
                        <button onclick="this.parentNode.remove()" style="display:block;margin:6px auto 0;
                        background:transparent;border:1px solid #f87171;border-radius:6px;color:#f87171;
                        padding:2px 10px;cursor:pointer;font-size:0.72rem;">Dismiss</button>`;
                    document.body.appendChild(banner);
                    setTimeout(() => banner?.remove(), 15000);
                }
            } else {
                showToast('❌ TTS synthesis failed – try refreshing the page');
            }
        } else {
            showToast('❌ TTS error: ' + e.error);
        }
    };

    // Chrome freeze fix: resume() before cancel()/speak()
    try { speechSynthesis.resume(); } catch (_) { }
    speechSynthesis.cancel();
    setTimeout(() => {
        try {
            speechSynthesis.speak(utter);
            if (ttsVoices.length > 0) showToast('🔊 Speaking…');
        } catch (e) {
            showToast('❌ TTS error: ' + e.message);
            console.error('[TTS] speak() threw:', e);
        }
    }, 150);
}


speakBtn.onclick = () => {
    const t = detectedText.value.trim();
    if (!t) { showToast('⚠️ Nothing to speak!'); return; }
    doTTSSpeak(t);
};



/* ════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════ */
// Unlock UI immediately; TF models load lazily on first camera start
initModels();
// Try to load the external words.txt dictionary in the background
loadWordDictionary();
