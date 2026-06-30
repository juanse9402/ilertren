/**
 * editor.js — Route editor, fully isolated from GPS and audio logic.
 * Communicates with the rest of the app only through state and route.js.
 */

import { getState, setState } from './state.js';
import { saveRouteToStorage, validateRoute, clearRouteEdits } from './route.js';
import { saveAudio } from './db.js';
import { logInfo, logSuccess, logWarn, logError } from './logger.js';

const EDITED_KEY = 'routemaker_route_edited_v1';
let _els = {};

/**
 * Bind editor to DOM elements.
 * @param {Object} elements - { screen, stopsList, btnOpen, btnClose, btnAdd, btnExport, btnReset }
 */
export function initEditor(elements) {
  _els = elements;

  _els.btnOpen.addEventListener('click', openEditor);
  _els.btnClose.addEventListener('click', closeEditor);
  _els.btnAdd.addEventListener('click', addStop);
  _els.btnExport.addEventListener('click', exportRoute);
  if (_els.btnReset) {
    _els.btnReset.addEventListener('click', resetRoute);
  }
}

function openEditor() {
  // Pause GPS when entering editor
  window.dispatchEvent(new CustomEvent('editor:open'));
  setState({ editorOpen: true });
  _els.screen.classList.remove('hidden');
  render();
  logInfo('Editor abierto.');
}

function closeEditor() {
  setState({ editorOpen: false });
  _els.screen.classList.add('hidden');
  window.dispatchEvent(new CustomEvent('editor:close'));
  logInfo('Editor cerrado.');
}

function resetRoute() {
  if (!confirm('¿Restablecer la ruta original del servidor?\n\nEsto borrará todas tus modificaciones locales y recargará la aplicación.')) return;
  clearRouteEdits();
  logInfo('Cambios locales borrados. Recargando...');
  location.reload();
}

function markRouteAsEdited() {
  try {
    localStorage.setItem(EDITED_KEY, 'true');
  } catch { /* safe to ignore */ }
}

function addStop() {
  const { route } = getState();
  const updated = [...route, { name: 'Nueva Parada', lat: 0, lon: 0, audio: '' }];
  markRouteAsEdited();
  setState({ route: updated });
  saveRouteToStorage(updated);
  render();
  // Scroll to new stop
  setTimeout(() => {
    _els.stopsList.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  }, 50);
}

function exportRoute() {
  const { route } = getState();
  if (route.length === 0) {
    logWarn('No hay paradas para exportar.');
    return;
  }
  const json = JSON.stringify(route, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'route.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Clear local edit flag upon export, assuming the user will upload it
  try {
    localStorage.removeItem(EDITED_KEY);
  } catch { /* ignore */ }
  
  logSuccess('Ruta exportada como route.json y marca de edición local limpia.');
}

/**
 * Persist a field change for a stop at index.
 */
function updateStopField(index, field, rawValue) {
  const { route } = getState();
  const updated = route.map((stop, i) => {
    if (i !== index) return stop;
    const value = (field === 'lat' || field === 'lon')
      ? parseFloat(rawValue)
      : String(rawValue);
    return { ...stop, [field]: value };
  });

  const { valid, errors } = validateRoute(updated);
  if (!valid) {
    // Only warn on console, do not alert as it interrupts typing
    console.warn(`[editor] Validación: ${errors.join(' | ')}`);
  }

  markRouteAsEdited();
  setState({ route: updated });
  saveRouteToStorage(updated);
}

/**
 * Capture current GPS position for a stop.
 */
function captureGPS(index) {
  if (!navigator.geolocation) {
    logError('GPS no disponible en este dispositivo.');
    return;
  }

  logInfo('Capturando posición GPS...');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      markRouteAsEdited();
      updateStopField(index, 'lat', pos.coords.latitude);
      updateStopField(index, 'lon', pos.coords.longitude);
      render();
      logSuccess(`GPS capturado para parada ${index + 1}: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
    },
    (err) => {
      logError(`Error capturando GPS: ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 10_000 }
  );
}

/**
 * Upload audio file to IndexedDB for a stop.
 */
async function uploadAudio(index, file) {
  if (!file) return;

  const MAX_MB = 50;
  if (file.size > MAX_MB * 1024 * 1024) {
    logWarn(`El archivo es demasiado grande (máx. ${MAX_MB}MB).`);
    return;
  }

  const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|m4a|ogg|wav|webm|aac)$/i)) {
    logWarn(`Formato no soportado: ${file.type || file.name}`);
    return;
  }

  logInfo(`Guardando audio: ${file.name}...`);

  try {
    const key = `indexeddb_${Date.now()}_${index}`;
    await saveAudio(key, file);
    markRouteAsEdited();
    updateStopField(index, 'audio', key);
    render();
    logSuccess(`Audio guardado: ${file.name}`);
  } catch (e) {
    logError(`Error guardando audio: ${e.message}`);
  }
}

/**
 * Delete a stop at index.
 */
function deleteStop(index) {
  const { route } = getState();
  if (!confirm(`¿Eliminar "${route[index]?.name ?? `Parada ${index + 1}`}"?`)) return;
  const updated = route.filter((_, i) => i !== index);
  markRouteAsEdited();
  setState({ route: updated });
  saveRouteToStorage(updated);
  render();
  logInfo(`Parada ${index + 1} eliminada.`);
}

/**
 * Render the full editor stop list.
 */
export function render() {
  const { route } = getState();
  _els.stopsList.innerHTML = '';

  if (route.length === 0) {
    _els.stopsList.innerHTML = '<li class="empty-state">No hay paradas. Añade una para empezar.</li>';
    return;
  }

  route.forEach((stop, index) => {
    const isLocalAudio = stop.audio?.startsWith('indexeddb_');
    const audioLabel = isLocalAudio
      ? '🎧 Audio local guardado'
      : (stop.audio || 'Sin audio');

    const li = document.createElement('li');
    li.className = 'stop-item';
    li.innerHTML = `
      <div class="stop-header">
        <span class="stop-number">${index + 1}</span>
        <input
          type="text"
          class="stop-name-input"
          placeholder="Nombre de la parada"
          value="${_escapeHtml(stop.name)}"
          aria-label="Nombre parada ${index + 1}"
          data-index="${index}"
          data-field="name"
        >
      </div>

      <div class="field-row">
        <label class="field-upload-label" for="audio-${index}">🎵 Subir audio</label>
        <input
          id="audio-${index}"
          type="file"
          accept="audio/*"
          aria-label="Subir audio para parada ${index + 1}"
          data-index="${index}"
          class="audio-file-input"
        >
        <span class="audio-display">${_escapeHtml(audioLabel)}</span>
      </div>

      <div class="coords-row">
        <input
          type="number"
          placeholder="Latitud"
          value="${stop.lat || ''}"
          step="0.000001"
          min="-90" max="90"
          aria-label="Latitud parada ${index + 1}"
          data-index="${index}"
          data-field="lat"
          class="coord-input"
        >
        <input
          type="number"
          placeholder="Longitud"
          value="${stop.lon || ''}"
          step="0.000001"
          min="-180" max="180"
          aria-label="Longitud parada ${index + 1}"
          data-index="${index}"
          data-field="lon"
          class="coord-input"
        >
      </div>

      <button class="btn-gps-capture" data-index="${index}">📍 Usar mi ubicación</button>
      <button class="btn-delete" data-index="${index}">Eliminar parada</button>
    `;

    // Bind events - use input for instant reactive save
    li.querySelector('.stop-name-input').addEventListener('input', (e) => {
      updateStopField(index, 'name', e.target.value);
    });

    li.querySelectorAll('.coord-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        // Only trigger update if it is a valid floating point representation
        // to prevent parsing "-" or "42." prematurely as NaN and discarding the edit.
        if (!isNaN(val) || e.target.value === '' || e.target.value === '-') {
          updateStopField(index, e.target.dataset.field, e.target.value);
        }
      });
    });

    li.querySelector('.audio-file-input').addEventListener('change', (e) => {
      uploadAudio(index, e.target.files[0]);
    });

    li.querySelector('.btn-gps-capture').addEventListener('click', () => {
      captureGPS(index);
    });

    li.querySelector('.btn-delete').addEventListener('click', () => {
      deleteStop(index);
    });

    _els.stopsList.appendChild(li);
  });
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
