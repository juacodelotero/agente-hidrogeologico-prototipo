/* Utilidades compartidas: formato, colores, geometría, UI. */
(function () {
  'use strict';
  const U = {};

  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.fmt = (n, d = 0) => Number(n).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  U.norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[º°]/g, 'o');
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  U.fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}-${m}-${y}`; };

  // Escala de color del mockup (sulfato 1.200 → 4.800 mg/L)
  const STOPS = [[0, [31, 162, 176]], [1 / 3, [141, 198, 122]], [2 / 3, [226, 177, 60]], [1, [200, 85, 61]]];
  U.ramp = (t) => {
    t = Math.max(0, Math.min(1, t));
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (t <= STOPS[i + 1][0]) {
        const k = (t - STOPS[i][0]) / (STOPS[i + 1][0] - STOPS[i][0]);
        const c = STOPS[i][1].map((a, j) => Math.round(a + (STOPS[i + 1][1][j] - a) * k));
        return `rgb(${c.join(',')})`;
      }
    }
    return 'rgb(200,85,61)';
  };
  U.colorFor = (v, min = 1200, max = 4800) => U.ramp((v - min) / (max - min));

  // ---------- Geometría en plano local (km) ----------
  U.toKm = (lat, lon) => [(lon - MOCK.CENTER.lon) / MOCK.KM_LON, (lat - MOCK.CENTER.lat) / MOCK.KM_LAT];
  U.toLL = (x, y) => [MOCK.CENTER.lat + y * MOCK.KM_LAT, MOCK.CENTER.lon + x * MOCK.KM_LON];

  U.pointInPoly = (p, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const segDist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  U.distToPoly = (p, poly) => {
    if (U.pointInPoly(p, poly)) return 0;
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, segDist(p, poly[i], poly[(i + 1) % poly.length]));
    return d;
  };
  // Buffer de un polígono convexo (suma de Minkowski con un círculo)
  U.bufferConvex = (poly, r, seg = 10) => {
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area > 0, out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const prev = poly[(i - 1 + n) % n], cur = poly[i], next = poly[(i + 1) % n];
      const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; return ccw ? Math.atan2(-dx, dy) : Math.atan2(dx, -dy); };
      let a0 = nrm(prev, cur), a1 = nrm(cur, next);
      if (ccw) { while (a1 < a0) a1 += 2 * Math.PI; } else { while (a1 > a0) a1 -= 2 * Math.PI; }
      for (let k = 0; k <= seg; k++) { const a = a0 + (a1 - a0) * k / seg; out.push([cur[0] + r * Math.cos(a), cur[1] + r * Math.sin(a)]); }
    }
    return out;
  };

  // WGS84 → UTM zona 19S
  U.toUTM = (lat, lon, zone = 19) => {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180, lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lam0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let Nn = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) Nn += 10000000;
    return { E: Math.round(E), N: Math.round(Nn) };
  };

  // ---------- UI ----------
  U.toast = (msg) => {
    let box = document.getElementById('toasts');
    const t = U.el(`<div class="toast">${U.esc(msg)}</div>`);
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
  };

  U.downloadCSV = (name, head, rows) => {
    const q = (v) => { const s = String(v == null ? '' : v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = '﻿' + [head, ...rows].map((r) => r.map(q).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  U.wellByCode = (code) => MOCK.WELLS.find((w) => w.codigo === code);
  U.statusChip = (st) => {
    const ok = /^(Indexado|Vigente|Éxito|Activo)/.test(st), err = /^Error/.test(st);
    return `<span class="chip ${ok ? 'chip-ok' : err ? 'chip-err' : 'chip-warn'}">${U.esc(st)}</span>`;
  };

  window.U = U;
})();
