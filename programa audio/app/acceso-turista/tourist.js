const UI = {
    // Screens
    languageScreen: document.getElementById('languageScreen'),
    tourScreen: document.getElementById('tourScreen'),
    
    // Language Buttons
    langBtns: document.querySelectorAll('.lang-btn'),
    btnChangeLang: document.getElementById('btnChangeLang'),
    
    // Tour Controls & Info
    btnPlay: document.getElementById('btnPlay'),
    btnPause: document.getElementById('btnPause'),
    currentStopName: document.getElementById('currentStopName'),
    distanceValue: document.getElementById('distanceValue'),
    gpsDot: document.getElementById('gpsDot'),
    gpsStatus: document.getElementById('gpsStatus'),
    stopImage: document.getElementById('stopImage'),
    
    // Audio
    audioPlayer: document.getElementById('audioPlayer')
};

let route = [];
let currentStopIndex = 0;
let watchId = null;
let isRunning = false;
let selectedLang = 'es';
let _wakeLock = null;
let _unlocked = false;
let isChangingAudio = false;

const RADIUS_METERS = 10;
const PROGRESS_KEY = 'routemaker_tourist_progress_v1';
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

// Text translations
const translations = {
    es: {
        start: "Iniciar Tour",
        pause: "Pausar Tour",
        gpsSearch: "Buscando GPS...",
        gpsActive: "GPS Activo",
        gpsError: "Error GPS",
        nextStop: "Punto Actual",
        langBtn: "🌐 Idioma",
        resumeConfirm: "Tienes un tour en curso.\n\nPróxima parada guardada:\n{stopName}\n\n¿Deseas continuar desde ahí?\n\n(Pulsa Cancelar para calcular tu ubicación más cercana)"
    },
    en: {
        start: "Start Tour",
        pause: "Pause Tour",
        gpsSearch: "Searching GPS...",
        gpsActive: "GPS Active",
        gpsError: "GPS Error",
        nextStop: "Current Stop",
        langBtn: "🌐 Language",
        resumeConfirm: "You have a tour in progress.\n\nNext saved stop:\n{stopName}\n\nDo you want to continue from there?\n\n(Press Cancel to calculate your nearest location)"
    },
    fr: {
        start: "Démarrer Tour",
        pause: "Pause",
        gpsSearch: "Recherche GPS...",
        gpsActive: "GPS Actif",
        gpsError: "Erreur GPS",
        nextStop: "Arrêt Actuel",
        langBtn: "🌐 Langue",
        resumeConfirm: "Vous avez une visite en cours.\n\nProchain arrêt enregistré:\n{stopName}\n\nSouhaitez-vous continuer à partir de là?\n\n(Appuyez sur Annuler pour calculer votre position la plus proche)"
    }
};

// --- IndexedDB para Audios Locales (Shared with Driver App) ---
const DB_NAME = "GPSAudioDB";
const STORE_NAME = "audios";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAudioFromDB(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Route Loading
async function loadRoute() {
    try {
        const response = await fetch('route.json?t=' + new Date().getTime());
        route = await response.json();
        console.log(`Ruta descargada: ${route.length} paradas.`);
        
        // Restore saved progress
        const saved = localStorage.getItem(PROGRESS_KEY);
        if (saved !== null) {
            const idx = parseInt(saved, 10);
            if (Number.isFinite(idx) && idx >= 0 && idx < route.length) {
                currentStopIndex = idx;
                console.log(`Progreso de turista restaurado en la parada index: ${idx}`);
            }
        }
        
        updateUI();
    } catch (error) {
        console.error(`Error cargando ruta: ${error.message}`);
        // Fallback to driver's saved route if possible
        const savedRoute = localStorage.getItem('backupRoute');
        if (savedRoute) {
            route = JSON.parse(savedRoute);
            updateUI();
        }
    }
}

function updateUI() {
    if (currentStopIndex < route.length) {
        const stop = route[currentStopIndex];
        UI.currentStopName.textContent = stop.name;
        if (stop.image) {
            UI.stopImage.src = stop.image;
        }
    } else {
        UI.currentStopName.textContent = "FIN DEL TOUR";
        UI.distanceValue.textContent = "--";
        localStorage.removeItem(PROGRESS_KEY);
        stopGPS();
    }
}

// Mobile Audio Unlock
async function unlockAudio() {
    if (_unlocked) return;
    try {
        UI.audioPlayer.src = SILENT_WAV;
        await UI.audioPlayer.play();
        UI.audioPlayer.pause();
        UI.audioPlayer.src = '';
        _unlocked = true;
        console.log("Audio unlocked successfully for mobile");
    } catch (e) {
        console.warn("Audio unlock failed, will retry on next interaction", e);
    }
}

// Screen Wake Lock API
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        _wakeLock = await navigator.wakeLock.request('screen');
        console.log("Wake Lock acquired. Screen will not sleep.");
    } catch (err) {
        console.warn(`Wake Lock request failed: ${err.message}`);
    }
}

async function releaseWakeLock() {
    if (_wakeLock) {
        try { await _wakeLock.release(); } catch {}
        _wakeLock = null;
        console.log("Wake Lock released.");
    }
}

// Re-acquire wake lock when tab becomes visible again
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isRunning && !_wakeLock) {
        await requestWakeLock();
    }
});

async function playCurrentStopAudio() {
    if (currentStopIndex >= route.length) return;
    if (isChangingAudio) return;
    
    isChangingAudio = true;
    const stop = route[currentStopIndex];
    
    let audioSrc = stop.audio;
    if (typeof stop.audio === 'object') {
        audioSrc = stop.audio[selectedLang] || stop.audio['es'] || Object.values(stop.audio)[0];
    }
    
    // Advance index immediately to prevent GPS from triggering it again
    if (!audioSrc) {
        isChangingAudio = false;
        return;
    }

    UI.audioPlayer.pause();
    
    try {
        if (audioSrc.startsWith('indexeddb_')) {
            const blob = await getAudioFromDB(audioSrc);
            if (blob) {
                UI.audioPlayer.src = URL.createObjectURL(blob);
            }
        } else {
            // Read from shared parent audios/ folder
            UI.audioPlayer.src = `../audios/${audioSrc}`;
        }
        
        UI.audioPlayer.load();
        await UI.audioPlayer.play();

        // Audio started successfully — advance index and save progress now
        currentStopIndex++;
        localStorage.setItem(PROGRESS_KEY, currentStopIndex.toString());
        updateUI();
    } catch (e) {
        console.error(`Error al reproducir: ${e.message}`);
    } finally {
        isChangingAudio = false;
    }
}

// GPS Tracking
function startGPS() {
    if (!navigator.geolocation) {
        console.error("Geolocalización no soportada.");
        return;
    }
    isRunning = true;
    UI.btnPlay.classList.add('hidden');
    UI.btnPause.classList.remove('hidden');
    UI.gpsDot.classList.add('active');
    UI.gpsStatus.textContent = translations[selectedLang].gpsActive;

    requestWakeLock();

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            if (currentStopIndex >= route.length) return;
            const currentLat = position.coords.latitude;
            const currentLon = position.coords.longitude;
            const targetStop = route[currentStopIndex];
            
            const distance = calculateDistance(currentLat, currentLon, targetStop.lat, targetStop.lon);
            UI.distanceValue.textContent = Math.round(distance);
            
            if (distance <= RADIUS_METERS) {
                playCurrentStopAudio();
            }
        },
        (error) => {
            console.error(`Error GPS: ${error.message}`);
            UI.gpsDot.classList.remove('active');
            UI.gpsStatus.textContent = translations[selectedLang].gpsError;
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

function stopGPS() {
    isRunning = false;
    UI.btnPlay.classList.remove('hidden');
    UI.btnPause.classList.add('hidden');
    UI.gpsDot.classList.remove('active');
    UI.gpsStatus.textContent = translations[selectedLang].pause;
    
    releaseWakeLock();

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function findClosestStopAndStart() {
    if (!navigator.geolocation) {
        console.error("Geolocalización no soportada.");
        startGPS();
        return;
    }
    
    const savedProgress = localStorage.getItem(PROGRESS_KEY);
    if (savedProgress !== null) {
        const savedIndex = parseInt(savedProgress, 10);
        if (savedIndex >= 0 && savedIndex < route.length) {
            const stopName = route[savedIndex].name;
            const confirmText = translations[selectedLang].resumeConfirm.replace('{stopName}', stopName);
            const wantsResume = confirm(confirmText);
            if (wantsResume) {
                currentStopIndex = savedIndex;
                console.log(`Tour reanudado desde: ${stopName}`);
                updateUI();
                startGPS();
                return;
            }
        }
    }
    
    UI.gpsStatus.textContent = translations[selectedLang].gpsSearch;
    console.log("Calculando el punto más cercano para el turista...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const currentLat = position.coords.latitude;
            const currentLon = position.coords.longitude;
            
            let candidateStops = [];
            let minDistance = Infinity;
            
            for (let i = 0; i < route.length; i++) {
                const dist = calculateDistance(currentLat, currentLon, route[i].lat, route[i].lon);
                candidateStops.push({ index: i, distance: dist });
                if (dist < minDistance) {
                    minDistance = dist;
                }
            }
            
            const threshold = Math.max(minDistance + 20, 40);
            const validCandidates = candidateStops.filter(s => s.distance <= threshold);
            validCandidates.sort((a, b) => a.index - b.index);
            
            currentStopIndex = validCandidates[0].index;
            localStorage.setItem(PROGRESS_KEY, currentStopIndex.toString());
            
            console.log(`Tour iniciado desde punto más cercano: ${route[currentStopIndex].name} (${Math.round(validCandidates[0].distance)}m)`);
            updateUI();
            startGPS();
        },
        (error) => {
            console.error(`Error GPS inicial: ${error.message}. Iniciando desde punto 1.`);
            currentStopIndex = 0;
            localStorage.setItem(PROGRESS_KEY, currentStopIndex.toString());
            updateUI();
            startGPS();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function applyTranslations() {
    const t = translations[selectedLang];
    document.getElementById('currentStopLabel').textContent = t.nextStop;
    UI.btnPlay.innerHTML = `<span class="icon">▶</span> ${t.start}`;
    UI.btnPause.innerHTML = `<span class="icon">⏸</span> ${t.pause}`;
    UI.gpsStatus.textContent = t.gpsSearch;
    UI.btnChangeLang.textContent = t.langBtn;
}

// Event Listeners
UI.langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedLang = btn.dataset.lang;
        UI.languageScreen.classList.remove('active');
        UI.languageScreen.classList.add('hidden');
        UI.tourScreen.classList.remove('hidden');
        UI.tourScreen.classList.add('active');
        applyTranslations();
        updateUI();
    });
});

UI.btnChangeLang.addEventListener('click', () => {
    stopGPS();
    UI.tourScreen.classList.remove('active');
    UI.tourScreen.classList.add('hidden');
    UI.languageScreen.classList.remove('hidden');
    UI.languageScreen.classList.add('active');
});

UI.btnPlay.addEventListener('click', async () => {
    // Unlock audio player for mobile devices
    await unlockAudio();
    
    // Smart start: offer resume or locate closest stop
    findClosestStopAndStart();
});

UI.btnPause.addEventListener('click', stopGPS);

// Init
window.onload = loadRoute;
