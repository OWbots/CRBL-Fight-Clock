const DEFAULT_SECONDS = 120;

const state = {
  configuredSeconds: DEFAULT_SECONDS,
  remainingMs: DEFAULT_SECONDS * 1000,
  mode: 'idle', // idle, prestart, running, paused, finished
  timerInterval: null,
  animationInProgress: false,
  tenSecondTicking: false,
  audioCtx: null,
  tickOsc: null,
  tickGain: null,
  lastFrameMs: null,
};

const el = {
  timeInput: document.getElementById('timeInput'),
  applyTimeBtn: document.getElementById('applyTimeBtn'),
  statusText: document.getElementById('statusText'),
  timerDisplay: document.getElementById('timerDisplay'),
  overlayText: document.getElementById('overlayText'),
  pausedHelp: document.getElementById('pausedHelp'),
};

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function tone({ frequency = 220, duration = 0.18, type = 'sawtooth', volume = 0.35, when = 0 }) {
  ensureAudio();
  const ctx = state.audioCtx;
  const start = ctx.currentTime + when;
  const stop = start + duration;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(stop + 0.01);
}

function playBuzzer() {
  tone({ frequency: 120, duration: 0.7, type: 'square', volume: 0.55 });
  tone({ frequency: 100, duration: 0.7, type: 'square', volume: 0.42, when: 0.02 });
}

function playStartCountBuzz() {
  tone({ frequency: 140, duration: 0.28, type: 'square', volume: 0.5 });
}

function playGoTripleBuzz() {
  [0, 0.12, 0.24].forEach((w, i) => tone({
    frequency: 170 + i * 20,
    duration: 0.11,
    type: 'square',
    volume: 0.52,
    when: w,
  }));
}

function startTickingSound() {
  if (state.tenSecondTicking) return;
  ensureAudio();
  state.tenSecondTicking = true;
  const ctx = state.audioCtx;
  state.tickOsc = ctx.createOscillator();
  state.tickGain = ctx.createGain();
  state.tickOsc.type = 'square';
  state.tickOsc.frequency.setValueAtTime(6, ctx.currentTime);
  state.tickGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  state.tickGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
  state.tickOsc.connect(state.tickGain).connect(ctx.destination);
  state.tickOsc.start();
}

function stopTickingSound() {
  if (!state.tenSecondTicking) return;
  state.tenSecondTicking = false;
  const ctx = state.audioCtx;
  if (state.tickGain) {
    state.tickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
  }
  if (state.tickOsc) {
    state.tickOsc.stop(ctx.currentTime + 0.06);
  }
  state.tickOsc = null;
  state.tickGain = null;
}

function parseTimeToSeconds(rawValue) {
  const match = rawValue.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const m = Number(match[1]);
  const s = Number(match[2]);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  if (s > 59) return null;
  const total = m * 60 + s;
  if (total < 1 || total > 3599) return null;
  return total;
}

function formatTime(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateDisplay() {
  const leftMs = state.remainingMs;
  el.timerDisplay.textContent = formatTime(leftMs);
  const sec = Math.ceil(leftMs / 1000);
  el.timerDisplay.classList.toggle('red', state.mode === 'running' && sec <= 10);
}

function setStatus(msg) {
  el.statusText.textContent = msg;
}

function showOverlay(text, small = false) {
  el.overlayText.classList.remove('hidden');
  el.overlayText.classList.toggle('small', small);
  el.overlayText.textContent = text;
}

function hideOverlay() {
  el.overlayText.classList.add('hidden');
}

function setMode(mode) {
  state.mode = mode;
  el.pausedHelp.classList.toggle('hidden', mode !== 'paused');
}

function clearTimerInterval() {
  if (state.timerInterval) {
    cancelAnimationFrame(state.timerInterval);
    state.timerInterval = null;
  }
  state.lastFrameMs = null;
}

async function runStartSequence() {
  if (state.animationInProgress) return;
  state.animationInProgress = true;
  setMode('prestart');
  setStatus('Get ready...');
  hideOverlay();

  showOverlay('', true);
  await sleep(5000);

  for (const count of ['3', '2', '1']) {
    showOverlay(count);
    playStartCountBuzz();
    await sleep(1000);
  }

  showOverlay('GO!');
  playGoTripleBuzz();
  await sleep(1000);
  hideOverlay();

  state.animationInProgress = false;
  startCountdown();
}

function startCountdown() {
  setMode('running');
  setStatus('Space -> Pause   r -> Reset');
  clearTimerInterval();

  const tick = (ts) => {
    if (state.mode !== 'running') return;

    if (state.lastFrameMs == null) {
      state.lastFrameMs = ts;
    }

    const delta = ts - state.lastFrameMs;
    state.lastFrameMs = ts;
    state.remainingMs -= delta;

    const sec = Math.ceil(state.remainingMs / 1000);
    if (sec <= 10 && state.remainingMs > 0) {
      startTickingSound();
    } else {
      stopTickingSound();
    }

    if (state.remainingMs <= 0) {
      state.remainingMs = 0;
      updateDisplay();
      finishCountdown();
      return;
    }

    updateDisplay();
    state.timerInterval = requestAnimationFrame(tick);
  };

  state.timerInterval = requestAnimationFrame(tick);
}

async function finishCountdown() {
  clearTimerInterval();
  stopTickingSound();
  setMode('finished');
  setStatus('Time! Press r to reset.');

  const flashes = 8;
  playBuzzer();
  for (let i = 0; i < flashes; i += 1) {
    el.timerDisplay.style.visibility = i % 2 === 0 ? 'hidden' : 'visible';
    await sleep(250);
  }
  el.timerDisplay.style.visibility = 'visible';
}

function pauseCountdown() {
  if (state.mode !== 'running') return;
  clearTimerInterval();
  stopTickingSound();
  setMode('paused');
  setStatus('Match Paused');
}

function resetCountdown() {
  clearTimerInterval();
  stopTickingSound();
  state.remainingMs = state.configuredSeconds * 1000;
  setMode('idle');
  setStatus('Press Space to Start');
  hideOverlay();
  updateDisplay();
}

async function handleSpace() {
  ensureAudio();
  if (state.mode === 'idle' || state.mode === 'paused') {
    await runStartSequence();
    return;
  }

  if (state.mode === 'running') {
    pauseCountdown();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

el.applyTimeBtn.addEventListener('click', () => {
  const parsed = parseTimeToSeconds(el.timeInput.value);
  if (!parsed) {
    setStatus('Invalid time. Use M:SS from 0:01 to 59:59');
    return;
  }

  state.configuredSeconds = parsed;
  state.remainingMs = parsed * 1000;
  setMode('idle');
  setStatus('Press Space to Start');
  stopTickingSound();
  clearTimerInterval();
  updateDisplay();
});

el.timeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    el.applyTimeBtn.click();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault();
    if (state.animationInProgress) return;
    handleSpace();
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    resetCountdown();
  }
});

updateDisplay();
