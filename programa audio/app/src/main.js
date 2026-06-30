/**
 * main.js — Orchestrator.
 * Connects modules to DOM. Contains zero business logic.
 * Business logic lives in gps.js, audio.js, route.js, editor.js.
 *
 * Hardening:
 *  - Screen Wake Lock: prevents device from sleeping during navigation
 *  - Page Visibility: logs when app goes to background
 *  - Audio Unlock: silent WAV trick for iOS/Android autoplay
 *  - Global error boundary: catches uncaught errors
 *  - Service Worker registration for offline capability
 */

import { getState, setState, subscribe, resetTriggerLog, clearSavedProgress } from './state.js';
import { initLogger, logInfo, logSuccess, logWarn, logError } from './logger.js';
import { loadRoute } from './route.js';
import { initAudio, playCurrentStop, stopAudio, unlockAudio, pauseAudio, resumeAudio } from './audio.js';
import { startGPS, stopGPS, startRoute } from './gps.js';
import { initEditor } from './editor.js';
import { castVideo } from './cast.js';

// ─── DOM References ───────────────────────────────────────────────────────────

const el = {
  // Status
  gpsPill:      document.getElementById('gpsPill'),
  gpsDot:       document.getElementById('gpsDot'),
  gpsStatus:    document.getElementById('gpsStatus'),
  accuracyBadge: document.getElementById('accuracyBadge'),
  currentTimeClock: document.getElementById('currentTimeClock'),

  // Info card
  stopSelector:  document.getElementById('stopSelector'),
  distanceValue: document.getElementById('distanceValue'),
  stopCounter:   document.getElementById('stopCounter'),
  progressBar:   document.getElementById('progressBar'),

  // GPS Error Retry
  btnGpsRetry: document.getElementById('btnGpsRetry'),

  // RGPD Modal
  rgpdModal:      document.getElementById('rgpdModal'),
  btnRgpdToggle:  document.getElementById('btnRgpdToggle'),
  rgpdMoreInfo:   document.getElementById('rgpdMoreInfo'),
  btnRgpdAccept:  document.getElementById('btnRgpdAccept'),

  // Controls (Visual Redesign Hold & Pause/Stop)
  holdBtn:      document.getElementById('holdBtn'),
  holdFill:     document.getElementById('holdFill'),
  holdCore:     document.getElementById('holdCore'),
  holdLabel:    document.getElementById('holdLabel'),
  holdHint:     document.getElementById('holdHint'),
  pauseRow:     document.getElementById('pauseRow'),
  pauseBtn:     document.getElementById('pauseBtn'),
  pauseIcon:    document.getElementById('pauseIcon'),
  pauseLabel:   document.getElementById('pauseLabel'),
  stopBtn:      document.getElementById('stopBtn'),
  btnRestart:   document.getElementById('btnRestart'),
  btnPlayLast:  document.getElementById('btnPlayLast'),
  btnSkip:      document.getElementById('btnSkip'),

  // Log
  logList: document.getElementById('logList'),

  // Audio
  audioPlayer: document.getElementById('audioPlayer'),

  // Map Stats
  mapEta:          document.getElementById('mapEta'),
  mapStopCounter:  document.getElementById('mapStopCounter'),
  mapTimeInRoute:  document.getElementById('mapTimeInRoute'),
  mapSpeed:        document.getElementById('mapSpeed'),
  mapRouteTraveled:document.getElementById('mapRouteTraveled'),
  mapVehicleMarker:document.getElementById('mapVehicleMarker'),

  // Editor
  editorScreen:   document.getElementById('editorScreen'),
  editorStopsList: document.getElementById('editorStopsList'),
  btnOpenEditor:  document.getElementById('btnOpenEditor'),
  btnCloseEditor: document.getElementById('btnCloseEditor'),
  btnAddStop:     document.getElementById('btnAddStop'),
  btnExport:      document.getElementById('btnExport'),
  btnResetRoute:  document.getElementById('btnResetRoute'),

  // Theme toggle
  btnTheme: document.getElementById('btnTheme'),
};

// ─── Wake Lock ────────────────────────────────────────────────────────────────

let _wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => {
      _wakeLock = null;
      logInfo('Wake Lock liberado (pantalla puede apagarse).');
    });
    logInfo('🔒 Pantalla bloqueada: no se apagará durante la ruta.');
  } catch (err) {
    logWarn(`Wake Lock no disponible: ${err.message}`);
  }
}

async function releaseWakeLock() {
  if (_wakeLock) {
    try { await _wakeLock.release(); } catch { /* already released */ }
    _wakeLock = null;
  }
}

// Re-acquire wake lock when page becomes visible again (required by spec)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const { gpsStatus } = getState();
    if (gpsStatus === 'running' && !_wakeLock) {
      await requestWakeLock();
    }
  }
});

// ─── Page Visibility ──────────────────────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  const { gpsStatus } = getState();
  if (document.visibilityState === 'hidden' && gpsStatus === 'running') {
    logWarn('⚠ App en segundo plano. El GPS sigue activo.');
  } else if (document.visibilityState === 'visible' && gpsStatus === 'running') {
    logInfo('App visible de nuevo. GPS continúa.');
  }
});

// ─── UI Update Functions ──────────────────────────────────────────────────────

function populateStopSelector(route) {
  if (!el.stopSelector) return;
  el.stopSelector.innerHTML = '';
  if (route.length === 0) {
    el.stopSelector.innerHTML = '<option value="empty" disabled selected>Sin ruta cargada</option>';
    return;
  }
  route.forEach((stop, index) => {
    const opt = document.createElement('option');
    opt.value = index;
    opt.textContent = `${String(index + 1).padStart(2, '0')}. ${stop.name}`;
    el.stopSelector.appendChild(opt);
  });
}

const Estados = { INACTIVO: 'inactivo', ACTIVO: 'activo', PAUSADO: 'pausado' };

function aplicarEstado(estado) {
  const { currentStopIndex } = getState();
  if (el.btnSkip) el.btnSkip.disabled = estado === Estados.INACTIVO;
  if (el.btnPlayLast) el.btnPlayLast.disabled = estado === Estados.INACTIVO || currentStopIndex === 0;
  if (el.btnRestart) el.btnRestart.disabled = estado === Estados.INACTIVO;
}

// (Leaflet map features disabled)

function updateRouteUI() {
  const { route, currentStopIndex } = getState();
  const total = route.length;

  if (total === 0) {
    if (el.stopSelector) {
      el.stopSelector.innerHTML = '<option value="empty" disabled selected>Sin ruta cargada</option>';
      el.stopSelector.disabled = true;
    }
    if (el.stopCounter) el.stopCounter.textContent = '— / —';
    if (el.mapStopCounter) el.mapStopCounter.textContent = '— / —';
    return;
  }

  if (el.stopSelector) {
    el.stopSelector.disabled = false;
  }

  if (currentStopIndex >= total) {
    if (el.stopSelector) {
      let optComp = el.stopSelector.querySelector('option[value="completed"]');
      if (!optComp) {
        optComp = document.createElement('option');
        optComp.value = 'completed';
        optComp.textContent = '¡Ruta completada!';
        optComp.disabled = true;
        el.stopSelector.appendChild(optComp);
      }
      el.stopSelector.value = 'completed';
    }
    if (el.distanceValue) el.distanceValue.textContent = '—';
    if (el.stopCounter) el.stopCounter.textContent = `${total} / ${total}`;
    if (el.mapStopCounter) el.mapStopCounter.textContent = `${total} / ${total}`;
    releaseWakeLock();
    return;
  }

  if (el.stopSelector) {
    const optComp = el.stopSelector.querySelector('option[value="completed"]');
    if (optComp) optComp.remove();
    el.stopSelector.value = currentStopIndex;
  }
  
  if (el.stopCounter) {
    el.stopCounter.textContent = `${currentStopIndex + 1} / ${total}`;
  }
  if (el.mapStopCounter) {
    el.mapStopCounter.textContent = `${currentStopIndex + 1} / ${total}`;
  }



  // Update progress strip label with active stop name
  const elAudioLabel = document.getElementById('audioLabel');
  if (elAudioLabel && route[currentStopIndex]) {
    elAudioLabel.textContent = `Audio: ${route[currentStopIndex].name}`;
  }

  if (el.btnPlayLast) {
    const { gpsStatus } = getState();
    el.btnPlayLast.disabled = gpsStatus === 'idle' || currentStopIndex === 0;
  }
}

function updateGPSStatusUI(status, errorMsg) {
  if (!el.gpsPill || !el.gpsStatus || !el.gpsDot) return;
  
  if (status === 'running') {
    el.gpsPill.className = 'pill pill-gps-active';
    el.gpsStatus.textContent = 'GPS activo';
    el.gpsDot.classList.add('active');
  } else if (status === 'paused') {
    el.gpsPill.className = 'pill pill-gps-paused';
    el.gpsStatus.textContent = 'GPS en pausa';
    el.gpsDot.classList.remove('active');
  } else if (status === 'error') {
    el.gpsPill.className = 'pill pill-gps-off';
    el.gpsStatus.textContent = errorMsg || 'Error GPS';
    el.gpsDot.classList.remove('active');
  } else {
    el.gpsPill.className = 'pill pill-gps-off';
    el.gpsStatus.textContent = 'GPS inactivo';
    el.gpsDot.classList.remove('active');
  }
}

function updateAudioStatusUI(status) {
  if (el.btnSkip) {
    el.btnSkip.disabled = false;
  }
}

// ─── Hold-to-Start Button Logic ────────────────────────────────────────────────

let holdStartTime = null;
let holdRafId = null;
let routeStarted = false;
const CIRCUMFERENCE = 478;
const HOLD_MS = 1500;

function setHoldProgress(p) {
  if (el.holdFill) {
    el.holdFill.style.strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * p);
  }
}

function holdTick(timestamp) {
  if (!holdStartTime) holdStartTime = timestamp;
  const elapsed = timestamp - holdStartTime;
  const p = Math.min(elapsed / HOLD_MS, 1);
  setHoldProgress(p);
  if (p >= 1) {
    onHoldComplete();
    return;
  }
  holdRafId = requestAnimationFrame(holdTick);
}

function onHoldPress(e) {
  if (routeStarted) return;
  if (e.cancelable) e.preventDefault();
  holdStartTime = null;
  if (el.holdCore) el.holdCore.style.transform = 'scale(0.96)';
  holdRafId = requestAnimationFrame(holdTick);
}

function onHoldRelease() {
  if (routeStarted) return;
  cancelAnimationFrame(holdRafId);
  if (el.holdCore) el.holdCore.style.transform = 'scale(1)';
  setHoldProgress(0);
  holdStartTime = null;
}

async function onHoldComplete() {
  const { route } = getState();
  if (route.length === 0) {
    logError('No hay ruta cargada. Edita o importa una ruta primero.');
    holdReset();
    return;
  }

  // Unlock audio on first user gesture (iOS/Android requirement)
  await unlockAudio();

  // Check GPS consent first
  if (localStorage.getItem('routemaker_gps_consent') !== 'true') {
    window.dispatchEvent(new CustomEvent('gps:request-consent', {
      detail: {
        callback: async () => {
          await executeRouteStart();
        }
      }
    }));
  } else {
    await executeRouteStart();
  }
}

function holdReset() {
  routeStarted = false;
  cancelAnimationFrame(holdRafId);
  if (el.holdCore) {
    el.holdCore.style.transform = 'scale(1)';
    el.holdCore.classList.remove('started');
  }
  setHoldProgress(0);
  holdStartTime = null;
  if (el.holdLabel) el.holdLabel.textContent = 'Iniciar ruta';
  if (el.holdHint) el.holdHint.textContent = 'Mantén pulsado 1.5s';
}

async function executeRouteStart() {
  routeStarted = true;
  if (el.holdCore) {
    el.holdCore.style.transform = 'scale(1)';
    el.holdCore.classList.add('started');
    el.holdCore.classList.add('running'); // animación pulso: ruta activa
  }
  if (el.holdLabel) el.holdLabel.textContent = 'Ruta iniciada';
  if (el.holdHint) el.holdHint.textContent = 'GPS activo';

  // Update GPS pill visual state
  updateGPSStatusUI('running');

  // Trigger GPS route tracking
  await startRoute();
  await requestWakeLock();

  // Show pause/stop row
  if (el.pauseRow) el.pauseRow.classList.add('visible');
  if (el.stopBtn) el.stopBtn.classList.add('visible');

  // Start travel timer
  startRouteTimer();

  aplicarEstado(Estados.ACTIVO);
}

// ─── Journey Stopwatch Logic ──────────────────────────────────────────────────

let routeTimerStartTimestamp = null;
let routeTimeElapsedMs = 0;
let routeTimerInterval = null;

function startRouteTimer() {
  if (routeTimerInterval) clearInterval(routeTimerInterval);
  routeTimerStartTimestamp = Date.now();
  routeTimerInterval = setInterval(() => {
    const elapsed = routeTimeElapsedMs + (Date.now() - routeTimerStartTimestamp);
    updateRouteTimerDisplay(elapsed);
  }, 1000);
}

function stopRouteTimer() {
  if (routeTimerInterval) {
    clearInterval(routeTimerInterval);
    routeTimerInterval = null;
  }
  if (routeTimerStartTimestamp) {
    routeTimeElapsedMs += Date.now() - routeTimerStartTimestamp;
    routeTimerStartTimestamp = null;
  }
}

function updateRouteTimerDisplay(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  const timeStr = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  if (el.mapTimeInRoute) el.mapTimeInRoute.textContent = timeStr;
}

// ─── Clock logic ──────────────────────────────────────────────────────────────

function startClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (el.currentTimeClock) el.currentTimeClock.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 15000);
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

let routePaused = false;

function wireControls() {
  // Circular Hold-to-Start Event Listeners
  if (el.holdBtn) {
    // Prevent magnifying glass / copy-paste popup menus on touch devices during hold
    el.holdBtn.addEventListener('contextmenu', e => e.preventDefault());

    const startTarget = el.holdCore || el.holdBtn;
    startTarget.addEventListener('mousedown', onHoldPress);
    startTarget.addEventListener('touchstart', e => {
      if (e.cancelable) e.preventDefault();
      onHoldPress(e);
    }, { passive: false });
    
    window.addEventListener('mouseup', onHoldRelease);
    window.addEventListener('touchend', onHoldRelease);
    window.addEventListener('touchcancel', onHoldRelease);
  }

  // Pause / Resume Route Event Listener
  if (el.pauseBtn) {
    el.pauseBtn.addEventListener('click', () => {
      routePaused = !routePaused;
      if (routePaused) {
        // Apply Paused Visuals
        el.pauseBtn.classList.add('is-paused');
        if (el.pauseIcon) el.pauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        if (el.pauseLabel) el.pauseLabel.textContent = 'Reanudar ruta';
        if (el.holdHint) el.holdHint.textContent = 'GPS en pausa';
        updateGPSStatusUI('paused');

        // Geolocation & Audio Pause actions
        stopGPS();
        pauseAudio();
        stopRouteTimer();
        if (el.holdCore) el.holdCore.classList.remove('running'); // pausa: quitar pulso
      } else {
        // Apply Active Visuals
        el.pauseBtn.classList.remove('is-paused');
        if (el.pauseIcon) el.pauseIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
        if (el.pauseLabel) el.pauseLabel.textContent = 'Pausar ruta';
        if (el.holdHint) el.holdHint.textContent = 'GPS activo';
        updateGPSStatusUI('running');

        // Geolocation & Audio Resume actions
        startGPS();
        resumeAudio();
        startRouteTimer();
        if (el.holdCore) el.holdCore.classList.add('running'); // reanudado: volver pulso
      }
    });
  }

  // Stop Route Event Listener
  if (el.stopBtn) {
    el.stopBtn.addEventListener('click', () => {
      routeStarted = false;
      routePaused = false;
      
      // Call GPS & Audio stop actions
      stopGPS();
      stopAudio();
      stopRouteTimer();

      // Reset stopwatch
      routeTimeElapsedMs = 0;
      updateRouteTimerDisplay(0);

      // Revert Circular hold visual state
      holdReset();
      if (el.holdCore) el.holdCore.classList.remove('running', 'started');
      updateGPSStatusUI('idle');

      // Hide pause/stop row
      if (el.pauseRow) el.pauseRow.classList.remove('visible');
      el.stopBtn.classList.remove('visible');

      // Revert Pause button inner content
      if (el.pauseBtn) {
        el.pauseBtn.classList.remove('is-paused');
        if (el.pauseIcon) el.pauseIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
        if (el.pauseLabel) el.pauseLabel.textContent = 'Pausar ruta';
      }

      aplicarEstado(Estados.INACTIVO);
    });
  }

  // PlayLast: immediately replay the last visited stop
  if (el.btnPlayLast) {
    el.btnPlayLast.addEventListener('click', () => {
      const { currentStopIndex } = getState();
      if (currentStopIndex > 0) {
        logInfo('Repitiendo parada anterior...');
        setState({ currentStopIndex: currentStopIndex - 1 });
        playCurrentStop();
      }
    });
  }

  // Skip: manually advance to next stop and play immediately
  if (el.btnSkip) {
    el.btnSkip.addEventListener('click', () => {
      logInfo('Parada omitida manualmente.');
      playCurrentStop();
    });
  }

  // Restart: reset index and trigger log, clear saved progress
  if (el.btnRestart) {
    el.btnRestart.addEventListener('click', () => {
      if (!confirm('¿Reiniciar la ruta completa desde el principio?')) return;
      
      stopAudio();
      stopGPS();
      stopRouteTimer();
      routeTimeElapsedMs = 0;
      updateRouteTimerDisplay(0);

      setState({ currentStopIndex: 0 });
      resetTriggerLog();
      clearSavedProgress();
      releaseWakeLock();
      
      // Fully reset visual elements
      holdReset();
      updateGPSStatusUI('idle');

      if (el.pauseRow) el.pauseRow.classList.remove('visible');
      if (el.stopBtn) el.stopBtn.classList.remove('visible');
      if (el.pauseBtn) {
        el.pauseBtn.classList.remove('is-paused');
        if (el.pauseIcon) el.pauseIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
        if (el.pauseLabel) el.pauseLabel.textContent = 'Pausar ruta';
      }

      // Mostrar la imagen de inicio en el Chromecast
      try {
        const imageUrl = `${window.location.origin}/SDVideo/StartingImage.png`;
        castVideo(imageUrl, 'Vitoria Casco Viejo 2026');
      } catch (e) {
        console.error('Error al enviar imagen de inicio al Chromecast:', e);
      }

      logInfo('Ruta reiniciada completa. Mantén pulsado para iniciar.');
      updateRouteUI();
      aplicarEstado(Estados.INACTIVO);
    });
  }

  // Retry GPS
  if (el.btnGpsRetry) {
    el.btnGpsRetry.addEventListener('click', () => {
      logInfo('Reintentando activar GPS...');
      el.btnGpsRetry.classList.add('hidden');
      startGPS();
    });
  }

  // Dropdown manual stop selection
  if (el.stopSelector) {
    el.stopSelector.addEventListener('change', (e) => {
      const { route } = getState();
      const newIndex = parseInt(e.target.value, 10);
      if (Number.isFinite(newIndex) && newIndex >= 0 && newIndex < route.length) {
        stopAudio();
        setState({ currentStopIndex: newIndex });
        if (el.distanceValue) el.distanceValue.textContent = '—';
        logInfo(`Parada cambiada manualmente a: ${route[newIndex].name}`);
      }
    });
  }
}

function wireGPSEvents() {
  // Distance updates from GPS module
  window.addEventListener('gps:distance', (e) => {
    const { distance, accuracy, speed, latitude, longitude } = e.detail;
    if (el.distanceValue) el.distanceValue.textContent  = distance;
    if (el.accuracyBadge) el.accuracyBadge.textContent  = `±${accuracy}m`;
    
    // Update schematic map details
    if (el.mapEta) {
      el.mapEta.textContent = `🚏 Próxima en ${distance} m`;
    }
    if (el.mapSpeed) {
      const kmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : 0;
      el.mapSpeed.textContent = `${kmh} km/h`;
    }


  });

  window.addEventListener('gps:started', () => {
    updateGPSStatusUI('running');
    aplicarEstado(Estados.ACTIVO);
  });

  window.addEventListener('gps:stopped', () => {
    updateGPSStatusUI('idle');
    if (el.distanceValue) el.distanceValue.textContent = '—';
    aplicarEstado(Estados.PAUSADO);
  });

  window.addEventListener('gps:error', (e) => {
    const { message } = e.detail || {};
    updateGPSStatusUI('error', message);
  });
}

function initRGPD() {
  const modal = el.rgpdModal;
  const btnToggle = el.btnRgpdToggle;
  const moreInfo = el.rgpdMoreInfo;
  const btnAccept = el.btnRgpdAccept;

  if (!modal || !btnToggle || !moreInfo || !btnAccept) return;

  btnToggle.addEventListener('click', () => {
    const isExpanded = btnToggle.getAttribute('aria-expanded') === 'true';
    btnToggle.setAttribute('aria-expanded', !isExpanded);
    moreInfo.classList.toggle('hidden', isExpanded);
  });

  window.addEventListener('gps:request-consent', (e) => {
    const callback = e.detail?.callback;
    modal.classList.remove('hidden');
    
    const onAccept = () => {
      localStorage.setItem('routemaker_gps_consent', 'true');
      modal.classList.add('hidden');
      if (typeof callback === 'function') callback();
    };
    
    btnAccept.addEventListener('click', onAccept, { once: true });
  });
}

// Warning if there are unexported edits
window.addEventListener('beforeunload', (e) => {
  const isEdited = localStorage.getItem('routemaker_route_edited_v1') === 'true';
  if (isEdited) {
    e.preventDefault();
    e.returnValue = '';
  }
});

function wireEditorEvents() {
  // Pause GPS and release wake lock when editor opens
  window.addEventListener('editor:open', () => {
    stopGPS();
    releaseWakeLock();
    stopRouteTimer();
  });
}

// ─── State Subscriptions ──────────────────────────────────────────────────────

function wireStateSubscriptions() {
  subscribe(['currentStopIndex', 'route'], updateRouteUI);
  subscribe('route', (newRoute) => {
    populateStopSelector(newRoute);
  });
  subscribe('gpsStatus',   (val) => updateGPSStatusUI(val));
  subscribe('audioStatus', (val) => updateAudioStatusUI(val));
}

// ─── Service Worker ───────────────────────────────────────────────────────────

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    logInfo(`Service Worker registrado (scope: ${reg.scope}).`);
  } catch (err) {
    logWarn(`Service Worker no registrado: ${err.message}`);
  }
}

// ─── Audio Playback Progress Tracking ────────────────────────────────────────

function wireAudioProgressEvents() {
  if (!el.audioPlayer || !el.progressBar) return;

  const formatTime = (secs) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  el.audioPlayer.addEventListener('timeupdate', () => {
    const current = el.audioPlayer.currentTime || 0;
    const duration = el.audioPlayer.duration || 0;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    el.progressBar.style.width = `${percent}%`;

    const elCurrent = document.getElementById('audioCurrentTime');
    if (elCurrent) {
      elCurrent.textContent = formatTime(current);
    }
  });

  el.audioPlayer.addEventListener('durationchange', () => {
    const duration = el.audioPlayer.duration || 0;
    const elDuration = document.getElementById('audioDuration');
    if (elDuration) {
      elDuration.textContent = formatTime(duration);
    }
  });

  const resetProgressUI = () => {
    el.progressBar.style.width = '0%';
    const elCurrent = document.getElementById('audioCurrentTime');
    const elDuration = document.getElementById('audioDuration');
    if (elCurrent) elCurrent.textContent = '0:00';
    if (elDuration) elDuration.textContent = '0:00';
  };

  el.audioPlayer.addEventListener('emptied', resetProgressUI);
  el.audioPlayer.addEventListener('ended', resetProgressUI);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    // 1. Logger
    initLogger(el.logList);
    logInfo('RouteMaker iniciando...');

    // 2. Audio player
    initAudio(el.audioPlayer);

    // 3. Editor
    initEditor({
      screen:    el.editorScreen,
      stopsList: el.editorStopsList,
      btnOpen:   el.btnOpenEditor,
      btnClose:  el.btnCloseEditor,
      btnAdd:    el.btnAddStop,
      btnExport: el.btnExport,
      btnReset:  el.btnResetRoute,
    });

    // 4. Wire UI
    wireControls();
    wireGPSEvents();
    wireEditorEvents();
    wireStateSubscriptions();
    wireAudioProgressEvents();
    
    // Initialize RGPD modal listeners
    initRGPD();

    // Initialize theme (light/dark) toggle
    initTheme();

    // Start local time clock
    startClock();

    // Set initial button states
    aplicarEstado(Estados.INACTIVO);

    // 5. Load route
    const loaded = await loadRoute();
    if (loaded) {
      populateStopSelector(getState().route);
      updateRouteUI();
      logSuccess('Listo. Mantén pulsado "Iniciar Ruta" para comenzar.');
    } else {
      if (el.holdLabel) {
        el.holdLabel.textContent = 'Sin ruta';
      }
    }

    // 6. Service Worker (non-blocking)
    registerServiceWorker();

  } catch (err) {
    console.error('[RouteMaker] Fatal boot error:', err);
    if (el.stopSelector) el.stopSelector.innerHTML = '<option disabled selected>Error de inicio</option>';
    if (el.logList) {
      const li = document.createElement('li');
      li.dataset.level = 'error';
      li.innerHTML = `<span class="log-time">—</span><span class="log-msg">Error fatal: ${err.message}</span>`;
      el.logList.prepend(li);
    }
  }
}

// ─── Theme Toggle (Modo Claro / Oscuro) ─────────────────────────────────────────────

function initTheme() {
  const btn = el.btnTheme;
  if (!btn) return;

  // Restore last saved preference
  const saved = localStorage.getItem('routemaker_theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    btn.textContent = '🌙';
    btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
  }

  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    if (isLight) {
      btn.textContent = '🌙';
      btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
      localStorage.setItem('routemaker_theme', 'light');
    } else {
      btn.textContent = '\u2600\uFE0F'; // ☀️
      btn.setAttribute('aria-label', 'Cambiar a modo claro');
      localStorage.setItem('routemaker_theme', 'dark');
    }
  });
}

// ─── Global Error Boundary ───────────────────────────────────────────────────

window.addEventListener('unhandledrejection', (e) => {
  console.error('[RouteMaker] Unhandled promise rejection:', e.reason);
  logError?.(`Error no controlado: ${e.reason?.message ?? e.reason}`);
});

window.addEventListener('error', (e) => {
  console.error('[RouteMaker] Uncaught error:', e.error);
  logError?.(`Error: ${e.error?.message ?? e.message}`);
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
