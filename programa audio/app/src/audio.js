/**
 * audio.js — Audio playback with a strict state machine.
 *
 * States: idle → playing → idle (loop)
 *                        → error → idle
 *
 * Guarantees:
 *  - Only one audio plays at a time
 *  - currentStopIndex increments ONLY after successful play starts (onloadeddata)
 *  - Object URLs are revoked after use to prevent memory leaks
 */

import { getState, setState } from './state.js';
import { logInfo, logSuccess, logWarn, logError } from './logger.js';
import { getAudio } from './db.js';
import { castVideo } from './cast.js';

const AUDIO_PREFIX = 'indexeddb_';
let _player = null;
let _ambientPlayer = null;
let _currentObjectUrl = null;
let _unlocked = false;

// Minimal valid WAV (silence) for iOS/Android audio unlock
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Bind to the <audio> DOM element.
 * @param {HTMLAudioElement} el
 */
export function initAudio(el) {
  _player = el;

  _ambientPlayer = new Audio('assets/ambientetren.mp3');
  _ambientPlayer.loop = true;
  _ambientPlayer.volume = 0.15; // 15% base volume

  _player.addEventListener('ended', () => {
    _revokeCurrentUrl();
    setState({ audioStatus: 'idle' });
    logInfo('Audio finalizado.');
    if (_ambientPlayer) _ambientPlayer.volume = 0.15; // Restore ambient volume
  });

  _player.addEventListener('error', () => {
    _revokeCurrentUrl();
    
    // Ignore errors triggered by intentional resource resets (empty src or data URI silent WAV)
    const src = _player.src;
    if (!src || src === '' || src === window.location.href || src.startsWith('data:')) {
      setState({ audioStatus: 'idle' });
      return;
    }
    
    setState({ audioStatus: 'error' });
    logError(`Error de reproducción: ${_player.error?.message ?? 'desconocido'}`);
    // Auto-recover to idle so GPS can continue
    setState({ audioStatus: 'idle' });
    if (_ambientPlayer) _ambientPlayer.volume = 0.15; // Restore ambient volume
  });
}

/**
 * Play ambient track
 */
export function playAmbient() {
  if (_ambientPlayer) {
    _ambientPlayer.play().catch(e => logWarn(`No se pudo iniciar ambiente: ${e.message}`));
  }
}

/**
 * Pause ambient track
 */
export function pauseAmbient() {
  if (_ambientPlayer) {
    _ambientPlayer.pause();
  }
}

/**
 * Stop ambient track completely
 */
export function stopAmbient() {
  if (_ambientPlayer) {
    _ambientPlayer.pause();
    _ambientPlayer.currentTime = 0;
  }
}

/**
 * Check if ambient track is playing
 */
export function isAmbientPlaying() {
  return _ambientPlayer && !_ambientPlayer.paused;
}

/**
 * Toggle ambient track manually
 */
export function toggleAmbient() {
  if (!_ambientPlayer) return false;
  if (_ambientPlayer.paused) {
    _ambientPlayer.play().catch(e => console.warn('Toggle ambient error:', e));
    return true;
  } else {
    _ambientPlayer.pause();
    return false;
  }
}

/**
 * Unlock audio playback on mobile devices.
 * Must be called from a user gesture (click/tap) handler.
 * Safe to call multiple times — only executes once.
 */
export async function unlockAudio() {
  if (_unlocked || !_player) return;
  try {
    _player.src = SILENT_WAV;
    await _player.play();
    _player.pause();
    _player.src = '';
    _unlocked = true;

    // Also unlock ambient player if needed
    if (_ambientPlayer) {
      const prevVol = _ambientPlayer.volume;
      _ambientPlayer.volume = 0;
      await _ambientPlayer.play();
      _ambientPlayer.pause();
      _ambientPlayer.volume = prevVol;
    }
  } catch {
    // Silently fail — will retry on next user gesture
  }
}

function _revokeCurrentUrl() {
  if (_currentObjectUrl) {
    URL.revokeObjectURL(_currentObjectUrl);
    _currentObjectUrl = null;
  }
}

/**
 * Resolve the audio source for a stop.
 * Returns an object URL (for IndexedDB blobs) or a string path.
 * @param {Object} stop
 * @returns {Promise<string>}
 */
async function _resolveSource(stop) {
  if (!stop.audio) throw new Error('Esta parada no tiene audio asignado.');

  if (stop.audio.startsWith(AUDIO_PREFIX)) {
    const blob = await getAudio(stop.audio);
    if (!blob) throw new Error(`Audio local no encontrado: "${stop.audio}"`);
    _currentObjectUrl = URL.createObjectURL(blob);
    return _currentObjectUrl;
  }

  return `./audios/${stop.audio}`;
}

/**
 * Play the audio for the stop at currentStopIndex.
 * Advances the index only after playback begins successfully.
 *
 * @returns {Promise<void>}
 */
export async function playCurrentStop() {
  const { route, currentStopIndex } = getState();

  if (currentStopIndex >= route.length) {
    logInfo('Fin de ruta. No hay más paradas.');
    return;
  }

  const stop = route[currentStopIndex];
  logInfo(`▶ Reproduciendo: ${stop.name}`);

  // Sincronizar transmisión al Chromecast
  try {
    const stopNumStr = String(currentStopIndex + 1).padStart(2, '0');
    const videoFilename = stop.audio.replace(/\.wav$/i, '.mp4');
    const videoUrl = `${window.location.origin}/SDVideo/${stopNumStr}/${videoFilename}`;
    castVideo(videoUrl, stop.name);
  } catch (err) {
    console.error('Error enviando video al Chromecast:', err);
  }

  // Stop any current playback cleanly first
  stopAudio();

  setState({ audioStatus: 'playing' });

  // Duck ambient volume
  if (_ambientPlayer) {
    _ambientPlayer.volume = 0.05; // 5% ducked volume
  }

  // Safety net: ensure audio is unlocked on mobile
  if (!_unlocked) await unlockAudio();

  try {
    const src = await _resolveSource(stop);

    await new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(_player.error?.message ?? 'Error cargando audio'));
      };

      function cleanup() {
        _player.removeEventListener('canplaythrough', onReady);
        _player.removeEventListener('error', onError);
      }

      _player.addEventListener('canplaythrough', onReady, { once: true });
      _player.addEventListener('error', onError, { once: true });

      _player.src = src;
      _player.load();
    });

    await _player.play();

    // Audio started successfully — advance index NOW
    setState({ currentStopIndex: currentStopIndex + 1 });
    logSuccess(`Parada completada: ${stop.name}`);

  } catch (err) {
    _revokeCurrentUrl();
    setState({ audioStatus: 'error' });
    logError(`Error en "${stop.name}": ${err.message}`);
    // Recover: don't advance index so user can retry or skip manually
    setState({ audioStatus: 'idle' });
  }
}

/**
 * Stop audio immediately and reset.
 */
export function stopAudio() {
  if (_player) {
    _player.pause();
    _player.currentTime = 0;
  }
  _revokeCurrentUrl();
  setState({ audioStatus: 'idle' });
  if (_ambientPlayer) _ambientPlayer.volume = 0.15; // Restore ambient volume
}

/**
 * Pause audio playback in progress.
 */
export function pauseAudio() {
  if (_player && !_player.paused) {
    _player.pause();
    setState({ audioStatus: 'paused' });
    if (_ambientPlayer) _ambientPlayer.volume = 0.15; // Restore ambient volume while paused
  }
}
/**
 * Resume paused audio playback.
 */
export function resumeAudio() {
  if (_player && _player.paused && _player.src) {
    if (_ambientPlayer) _ambientPlayer.volume = 0.05; // Duck again before resuming
    _player.play().then(() => {
      setState({ audioStatus: 'playing' });
    }).catch(err => {
      logError(`Error reanudando audio: ${err.message}`);
      setState({ audioStatus: 'error' });
      if (_ambientPlayer) _ambientPlayer.volume = 0.15; // Restore on error
    });
  }
}
