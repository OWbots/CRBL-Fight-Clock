const timerContainer = document.getElementById('timerContainer');
const statusLine = document.getElementById('statusLine');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const pauseInfo = document.getElementById('pauseInfo');
const minutesInput = document.getElementById('durationMinutes');
const secondsInput = document.getElementById('durationSeconds');
const applyDurationBtn = document.getElementById('applyDuration');

const SEGMENTS = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};

const state = {
  configuredSeconds: 120,
  remainingMs: 120000,
  phase: 'idle', // idle | prestart_black | prestart_countdown | running | paused | finished
  rafId: null,
  runStartTs: null,
  runStartMs: null,
  tickingInterval: null,
  flashInterval: null,
  flashVisible: true,
  audio: null
};

function clampDuration(mins, secs) {
  const total = mins * 60 + secs;
  return Math.max(1, Math.min(3599, total));
}

function formatTimeFromMs(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildDigits(timeText, isRed = false) {
  timerContainer.innerHTML = '';
  const chars = timeText.split('');
  const digitCount = chars.filter((c) => /\d/.test(c)).length;

  const widthPerDigit = digitCount >= 4 ? 17 : 22;
  timerContainer.style.setProperty('--digit-width', `${widthPerDigit}vw`);
  timerContainer.style.setProperty('--digit-height', `${Math.round(widthPerDigit * 1.8)}vw`);
  timerContainer.style.setProperty('--digit-color', isRed ? 'var(--red)' : 'var(--cyan)');

  chars.forEach((ch) => {
    if (ch === ':') {
      const colon = document.createElement('div');
      colon.className = 'colon';
      timerContainer.appendChild(colon);
      return;
    }

    const digit = document.createElement('div');
    digit.className = 'digit';

    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg) => {
      const segment = document.createElement('div');
      segment.className = `segment ${seg === 'a' || seg === 'd' || seg === 'g' ? 'h' : 'v'} ${seg}`;
      if (SEGMENTS[ch]?.includes(seg)) {
        segment.classList.add('on');
      }
      digit.appendChild(segment);
    });

    timerContainer.appendChild(digit);
  });
}

function updateDisplay() {
  const red = state.phase === 'running' && state.remainingMs <= 10000;
  buildDigits(formatTimeFromMs(state.remainingMs), red);
}

function ensureAudioContext() {
  if (!state.audio) {
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audio.state === 'suspended') {
    state.audio.resume();
  }
}

function playTone({ freq = 220, type = 'sawtooth', duration = 0.2, gain = 0.25, when = 0 }) {
  ensureAudioContext();
  const t = state.audio.currentTime + when;
  const osc = state.audio.createOscillator();
  const g = state.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(state.audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playBuzz() {
  playTone({ freq: 120, type: 'square', duration: 0.24, gain: 0.45 });
}

function playGoTripleBuzz() {
  playTone({ freq: 180, type: 'square', duration: 0.1, gain: 0.4, when: 0.0 });
  playTone({ freq: 220, type: 'square', duration: 0.1, gain: 0.4, when: 0.13 });
  playTone({ freq: 260, type: 'square', duration: 0.1, gain: 0.4, when: 0.26 });
}

function startTickingLoop() {
  stopTickingLoop();
  state.tickingInterval = setInterval(() => {
    if (state.phase !== 'running' || state.remainingMs > 10000 || state.remainingMs <= 0) {
      return;
    }
    playTone({ freq: 4, type: 'square', duration: 0.08, gain: 0.22 });
  }, 250);
}

function stopTickingLoop() {
  if (state.tickingInterval) {
    clearInterval(state.tickingInterval);
    state.tickingInterval = null;
  }
}

function playFinalBuzzer() {
  playTone({ freq: 90, type: 'sawtooth', duration: 1.9, gain: 0.65 });
}

function runTimer() {
  state.phase = 'running';
  statusLine.textContent = 'Space to Pause, r to Reset';
  pauseInfo.classList.add('hidden');
  state.runStartTs = performance.now();
  state.runStartMs = state.remainingMs;
  startTickingLoop();

  const frame = (ts) => {
    if (state.phase !== 'running') {
      return;
    }
    const elapsed = ts - state.runStartTs;
    state.remainingMs = Math.max(0, state.runStartMs - elapsed);
    updateDisplay();

    if (state.remainingMs <= 0) {
      finishTimer();
      return;
    }

    state.rafId = requestAnimationFrame(frame);
  };

  state.rafId = requestAnimationFrame(frame);
}

function stopRunningAnimation() {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

function finishTimer() {
  stopRunningAnimation();
  stopTickingLoop();
  state.phase = 'finished';
  statusLine.textContent = "Time's up! Press r to reset";
  state.remainingMs = 0;
  updateDisplay();
  playFinalBuzzer();

  let flashes = 0;
  state.flashInterval = setInterval(() => {
    state.flashVisible = !state.flashVisible;
    timerContainer.style.visibility = state.flashVisible ? 'visible' : 'hidden';
    flashes += 1;
    if (flashes >= 8) {
      clearInterval(state.flashInterval);
      state.flashInterval = null;
      timerContainer.style.visibility = 'visible';
    }
  }, 250);
}

function setDurationFromInputs() {
  const mins = Number(minutesInput.value || 0);
  const secs = Number(secondsInput.value || 0);
  const total = clampDuration(mins, secs);
  state.configuredSeconds = total;
  state.remainingMs = total * 1000;
  state.phase = 'idle';
  statusLine.textContent = 'Press Space to Start';
  pauseInfo.classList.add('hidden');
  stopRunningAnimation();
  stopTickingLoop();
  if (state.flashInterval) {
    clearInterval(state.flashInterval);
    state.flashInterval = null;
    timerContainer.style.visibility = 'visible';
  }
  const normalizedMins = Math.floor(total / 60);
  const normalizedSecs = total % 60;
  minutesInput.value = normalizedMins;
  secondsInput.value = normalizedSecs;
  updateDisplay();
}

async function runPreStart({ includeBlackScreen }) {
  state.phase = includeBlackScreen ? 'prestart_black' : 'prestart_countdown';
  pauseInfo.classList.add('hidden');
  overlay.classList.remove('hidden');

  if (includeBlackScreen) {
    overlayText.textContent = '';
    await sleep(5000);
  }

  state.phase = 'prestart_countdown';
  for (const value of ['3', '2', '1']) {
    overlayText.textContent = value;
    playBuzz();
    await sleep(1000);
  }

  overlayText.textContent = 'GO!';
  playGoTripleBuzz();
  await sleep(1000);
  overlay.classList.add('hidden');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pauseTimer() {
  if (state.phase !== 'running') {
    return;
  }
  stopRunningAnimation();
  stopTickingLoop();
  state.phase = 'paused';
  statusLine.textContent = 'Match Paused';
  pauseInfo.classList.remove('hidden');
}

async function startOrResume() {
  if (state.phase === 'running' || state.phase === 'prestart_black' || state.phase === 'prestart_countdown') {
    return;
  }
  if (state.phase === 'finished') {
    return;
  }

  if (state.phase === 'idle') {
    await runPreStart({ includeBlackScreen: true });
  } else if (state.phase === 'paused') {
    await runPreStart({ includeBlackScreen: false });
  }

  runTimer();
}

function resetTimer() {
  stopRunningAnimation();
  stopTickingLoop();
  if (state.flashInterval) {
    clearInterval(state.flashInterval);
    state.flashInterval = null;
    timerContainer.style.visibility = 'visible';
  }

  state.phase = 'idle';
  state.remainingMs = state.configuredSeconds * 1000;
  statusLine.textContent = 'Press Space to Start';
  pauseInfo.classList.add('hidden');
  overlay.classList.add('hidden');
  updateDisplay();
}

applyDurationBtn.addEventListener('click', setDurationFromInputs);
minutesInput.addEventListener('change', setDurationFromInputs);
secondsInput.addEventListener('change', setDurationFromInputs);

window.addEventListener('keydown', async (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (state.phase === 'running') {
      pauseTimer();
      return;
    }
    await startOrResume();
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetTimer();
  }
});

updateDisplay();
