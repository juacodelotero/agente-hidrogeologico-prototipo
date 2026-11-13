/* Mapas Leaflet con mapa base satelital Esri World Imagery (sin token). */
(function () {
  'use strict';
  const ESRI_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ESRI_TOPO = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
  const ATTR = 'Imágenes © Esri, Maxar, Earthstar Geographics';

  const baseLayer = (kind) => L.tileLayer(kind === 'topo' ? ESRI_TOPO : ESRI_SAT, { maxZoom: 18, maxNativeZoom: 17, attribution: ATTR });

  function wellIcon(w, color, selected) {
    return L.divIcon({
      className: 'well-icon',
      iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -10],
      html: `<div class="well-marker${selected ? ' sel' : ''}"><div class="pt" style="background:${color}"></div><span class="lb">${w.codigo}</span></div>`
    });
  }

  /**
   * Mapa de resultado del agente.
   * opts: { points:[{w, color, popup}], polygon:bool, bounds?, legend:{title,ticks,gradient} }
   */
  function resultMap(container, opts) {
    container.innerHTML = `
      <div class="lmap"></div>
      <div class="map-ctrl"><button data-z="in" title="Acercar">+</button><button data-z="out" title="Alejar">−</button><button data-z="fit" title="Centrar resultado">⌖</button></div>
      <div class="map-layers"><button data-b="sat" class="on">Satélite</button><button data-b="topo">Topográfico</button><button data-b="layers" class="on" title="Mostrar/ocultar capas de referencia">Capas</button></div>
      ${opts.legend ? `<div class="map-legend"><span style="font-weight:600">${opts.legend.title}</span><div class="bar"${opts.legend.gradient ? ` style="background:${opts.legend.gradient}"` : ''}></div><div class="ticks">${opts.legend.ticks.map((t) => `<span>${t}</span>`).join('')}</div></div>` : ''}
      <span class="map-scale">WGS84 · UTM 19S</span>`;
    const map = L.map(container.querySelector('.lmap'), { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix(false);
    map.setView([MOCK.CENTER.lat, MOCK.CENTER.lon], 12);
    // La rueda del mouse solo hace zoom después de hacer clic en el mapa (evita secuestrar el scroll del chat)
    map.on('click focus', () => map.scrollWheelZoom.enable());
    map.on('mouseout', () => map.scrollWheelZoom.disable());
    let base = baseLayer('sat').addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    const refLayer = L.layerGroup().addTo(map);
    if (opts.polygon) {
      const P = MOCK.POLYGON_X;
      const buf = U.bufferConvex(P.km, 2).map(([x, y]) => U.toLL(x, y));
      L.polygon(buf, { color: '#FFFFFF', weight: 1.4, opacity: 0.85, dashArray: '6 5', fill: false, interactive: false }).addTo(refLayer);
      L.polygon(P.coords, { color: '#00D2DC', weight: 2.2, fillColor: '#00A3AD', fillOpacity: 0.16, interactive: false }).addTo(refLayer);
      L.marker(U.toLL(-0.6, 1.4), { interactive: false, icon: L.divIcon({ className: 'poly-label', html: 'Polígono X', iconSize: null }) }).addTo(refLayer);
      const top = buf.reduce((a, b) => (b[0] > a[0] ? b : a));
      L.marker([top[0] - 0.004, top[1] + 0.02], { interactive: false, icon: L.divIcon({ className: 'poly-label small', html: 'Buffer 2 km', iconSize: null }) }).addTo(refLayer);
    }

    const markers = new Map();
    let selected = null;
    opts.points.forEach((p) => {
      const m = L.marker([p.w.lat, p.w.lon], { icon: wellIcon(p.w, p.color, false), riseOnHover: true });
      m.bindPopup(p.popup, { className: 'well-popup', closeButton: true, autoPanPadding: [30, 30], maxWidth: 260, minWidth: 240 });
      m.on('popupopen', () => { selected = p.w.codigo; refreshIcons(); });
      m.on('popupclose', () => { if (selected === p.w.codigo) { selected = null; refreshIcons(); } });
      m.addTo(map);
      markers.set(p.w.codigo, { m, p, visible: true });
    });
    function refreshIcons() {
      markers.forEach(({ m, p }) => m.setIcon(wellIcon(p.w, p.color, p.w.codigo === selected)));
    }

    const fit = () => {
      const pts = [...markers.values()].filter((x) => x.visible).map((x) => [x.p.w.lat, x.p.w.lon]);
      if (opts.polygon) MOCK.POLYGON_X.coords.forEach((c) => pts.push(c));
      if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.12), { animate: true });
    };
    // Primer encuadre: el contenedor puede tener 0×0 hasta que se pinte
    let tries = 0;
    const firstFit = () => {
      map.invalidateSize();
      if (map.getSize().x < 50 && tries++ < 40) { setTimeout(firstFit, 150); return; }
      fit();
    };
    setTimeout(firstFit, 30);

    container.querySelector('.map-ctrl').addEventListener('click', (e) => {
      const z = e.target.closest('button')?.dataset.z; if (!z) return;
      if (z === 'in') map.zoomIn(); else if (z === 'out') map.zoomOut(); else fit();
    });
    container.querySelector('.map-layers').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.dataset.b;
      if (k === 'layers') {
        b.classList.toggle('on');
        if (b.classList.contains('on')) refLayer.addTo(map); else map.removeLayer(refLayer);
        return;
      }
      container.querySelectorAll('[data-b="sat"],[data-b="topo"]').forEach((x) => x.classList.toggle('on', x === b));
      map.removeLayer(base); base = baseLayer(k).addTo(map); base.bringToBack();
    });

    return {
      map,
      setVisible(pred) {
        markers.forEach((x) => {
          const v = !!pred(x.p.w);
          if (v && !x.visible) x.m.addTo(map);
          if (!v && x.visible) { x.m.closePopup(); map.removeLayer(x.m); }
          x.visible = v;
        });
      },
      open(code) { const x = markers.get(code); if (x && x.visible) x.m.openPopup(); },
      invalidate() { map.invalidateSize(); },
      fit
    };
  }

  /** Mini mapa de ubicación para la ficha 360 */
  function locationMap(container, w) {
    const map = L.map(container, { zoomControl: false, attributionControl: true, dragging: true, scrollWheelZoom: false }).setView([w.lat, w.lon], 14);
    map.attributionControl.setPrefix(false);
    baseLayer('sat').addTo(map);
    L.marker([w.lat, w.lon], { interactive: false, icon: L.divIcon({ className: 'well-icon', iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="loc-dot"></div>' }) }).addTo(map);
    setTimeout(() => map.invalidateSize(), 30);
    return map;
  }

  window.Maps = { resultMap, locationMap };
})();
