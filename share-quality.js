'use strict';
/* Consivo v0.6.1 — perfis de qualidade de captura. Independente do Electron. */
(function (root) {
  const PROFILES = Object.freeze({
    '480': Object.freeze({ width: 854, height: 480 }),
    '720': Object.freeze({ width: 1280, height: 720 }),
    '1080': Object.freeze({ width: 1920, height: 1080 }),
    '1440': Object.freeze({ width: 2560, height: 1440 })
  });
  const FPS_OPTIONS = Object.freeze([15, 30, 60]);
  function normalizeShareSettings(input = {}) {
    const resolution = String(input.shareResolution ?? '1080');
    const frameRate = Number(input.shareFps ?? 30);
    return {
      shareResolution: Object.hasOwn(PROFILES, resolution) ? resolution : '1080',
      shareFps: FPS_OPTIONS.includes(frameRate) ? frameRate : 30
    };
  }
  function captureConstraints(raw) {
    const pref = normalizeShareSettings(raw);
    const { width, height } = PROFILES[pref.shareResolution];
    return {
      audio: false,
      video: {
        width: { ideal: width, max: width },
        height: { ideal: height, max: height },
        frameRate: { ideal: pref.shareFps, max: pref.shareFps }
      }
    };
  }
  function requestedLabel(raw) {
    const pref = normalizeShareSettings(raw);
    const { width, height } = PROFILES[pref.shareResolution];
    return `${pref.shareResolution}p (${width}×${height}) · até ${pref.shareFps} FPS`;
  }
  function capturedLabel(track) {
    const settings = track?.getSettings?.() || {};
    const w = Number(settings.width), h = Number(settings.height), f = Number(settings.frameRate);
    if (!(w > 0 && h > 0)) return 'O sistema ainda não informou a resolução capturada.';
    return `Captura informada: ${Math.round(w)}×${Math.round(h)}` +
      (f > 0 ? ` · taxa configurada: ${Math.round(f)} FPS` : '') +
      ' (não é uma medição de FPS efetivos).';
  }
  const api = Object.freeze({ PROFILES, FPS_OPTIONS, normalizeShareSettings, captureConstraints, requestedLabel, capturedLabel });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ConsivoShareQuality = api;
})(typeof window !== 'undefined' ? window : null);
