# Tasks — Portar + Blindar RouteMaker

- `[x]` **1. state.js** — Persistencia de progreso en localStorage
- `[x]` **2. gps.js** — `startRoute()` con closest stop + resume
- `[x]` **3. audio.js** — `unlockAudio()` para móviles
- `[x]` **4. route.js** — Restore progress al cargar + clear al completar
- `[x]` **5. main.js** — Wire up: wake lock, visibility, audio unlock, startRoute
- `[x]` **6. sw.js** — Service Worker para offline
- `[x]` **7. Verificación** — Imports/exports verificados, bugfix cached variable
- `[x]` **8. Hardening GPS** — Auto-restart en código 2 (pérdida de señal) y GPS Watchdog timer
- `[x]` **9. Hardening Audio** — Revertir incremento de stop index si falla reproducción
