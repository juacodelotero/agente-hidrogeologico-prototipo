/* Pantalla Consulta: chat, simulación de pasos del agente y render de resultados. */
(function () {
  'use strict';
  const { esc, fmt, $, el, sleep, colorFor } = U;
  const Q = window.Queries;

  const scroll = $('#chatScroll');
  const input = $('#prompt');
  const sendBtn = $('#sendBtn');
  let running = false;
  const liveMaps = [];

  // ---------- Estado lateral ----------
  const now = () => new Date();
  const hhmm = (d) => d.toTimeString().slice(0, 5);
  const ddmmyyyy = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

  const history = [
    { label: 'Pozos a < 2 km del polígono X con sulfato promedio', meta: '11-11 09:42', kind: 'mapa' },
    { label: 'Nivel de PZ-101 vs. año anterior', meta: '10-11 17:30', kind: 'nivel' },
    { label: 'Última concentración de litio, sector Norte', meta: '10-11 15:12', kind: 'litio' },
    { label: 'Ficha del pozo PZ-118', meta: '10-11 11:03', kind: 'ficha' },
    { label: 'Pozos del cap. Topografía (informe N°1) con > 10 registros', meta: '09-11 16:40', kind: 'topografia' },
    { label: 'Calcio promedio del último año, sector Núcleo', meta: '09-11 10:15', kind: 'calcio' }
  ].map((h) => ({ ...h, build: () => Q.bySuggestion(h.kind) }));

  const saved = [
    { label: 'Sulfato cerca de polígonos de seguimiento', meta: 'Mapa · semanal', text: Q.SUGGESTIONS[0].text },
    { label: 'Niveles PZ-101 interanual', meta: 'Gráfico · mensual', text: Q.SUGGESTIONS[1].text },
    { label: 'Litio por pozo, sector Norte', meta: 'Tabla', text: Q.SUGGESTIONS[2].text }
  ];
  let activeHistory = null;

  function renderSide(flashFirst) {
    $('#savedList').innerHTML = saved.map((s, i) => `<div class="side-item${flashFirst === 'saved' && i === saved.length - 1 ? ' new' : ''}" data-saved="${i}"><span class="t strong">${esc(s.label)}</span><span class="m">${esc(s.meta)}</span></div>`).join('');
    $('#historyList').innerHTML = history.map((h, i) => `<div class="side-item${h === activeHistory ? ' active' : ''}${flashFirst === 'history' && i === 0 ? ' new' : ''}" data-hist="${i}"><span class="t">${esc(h.label)}</span><span class="m">${esc(h.meta)}</span></div>`).join('');
  }
  $('#side').addEventListener('click', (e) => {
    const s = e.target.closest('[data-saved]'), h = e.target.closest('[data-hist]');
    document.body.classList.remove('side-open');
    if (s) { newConversation(false); ask(saved[+s.dataset.saved].text); }
    if (h) restore(history[+h.dataset.hist]);
  });
  $('#newQuery').addEventListener('click', () => { document.body.classList.remove('side-open'); newConversation(true); });
  $('#histToggle').addEventListener('click', () => document.body.classList.toggle('side-open'));

  // ---------- Bienvenida ----------
  function suggestionCards() {
    return `<div class="sugg-grid">${Q.SUGGESTIONS.map((s) => `<button class="sugg" data-ask="${esc(s.text)}"><span class="k">${esc(s.tag)}</span><span class="q">${esc(s.text)}</span></button>`).join('')}</div>`;
  }
  function newConversation(showWelcome) {
    if (running) return;
    liveMaps.length = 0;
    activeHistory = null; renderSide();
    scroll.innerHTML = showWelcome ? `
      <div class="welcome">
        <div style="display:flex;align-items:center;gap:12px;"><div class="ia-badge" style="width:36px;height:36px;font-size:13px;">IA</div><h2>¿Qué necesitas saber de los pozos hoy?</h2></div>
        <p>El agente traduce tu pregunta a SQL sobre la capa semántica autorizada, revisa los informes indexados y ejecuta el análisis en un entorno aislado: nunca ve los valores de la base. Prueba una de estas consultas o escribe la tuya.</p>
        ${suggestionCards()}
      </div>` : '';
    input.focus();
  }
  scroll.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ask]');
    if (a && !running) { if (scroll.querySelector('.welcome')) scroll.innerHTML = ''; ask(a.dataset.ask); }
  });

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t || running) return;
    input.value = '';
    if (scroll.querySelector('.welcome')) scroll.innerHTML = '';
    ask(t);
  });

  const toBottom = () => { scroll.scrollTop = scroll.scrollHeight; };

  // ---------- Flujo principal ----------
  async function ask(text, opts = {}) {
    if (running) return;
    running = true; sendBtn.disabled = true;
    activeHistory = null; renderSide();
    scroll.appendChild(el(`<div class="msg-user">${esc(text)}</div>`));
    toBottom();
    const r = opts.result || Q.interpret(text);
    if (!r || r.unknownWell) await noMatch(text, r && r.unknownWell);
    else await runAgent(text, r, true);
    running = false; sendBtn.disabled = false;
    input.focus();
  }

  async function noMatch(text, unknownWell) {
    const block = el(`<div class="msg-agent"><div class="ia-badge">IA</div><div class="agent-body"><div class="card steps"></div></div></div>`);
    scroll.appendChild(block);
    const steps = block.querySelector('.steps');
    const st = stepEl(['Interpretando petición', '', 0, '']);
    steps.appendChild(st); st.classList.replace('pending', 'running');
    toBottom();
    await sleep(900);
    finishStep(st, unknownWell ? `El código ${unknownWell} no existe en v_puntos_monitoreo` : 'Sin coincidencia con consultas verificadas', '0,7 s',
      unknownWell ? `Se buscó ${unknownWell} en la vista hidro.v_puntos_monitoreo. Los códigos disponibles van de PZ-101 a PZ-145 (30 pozos ficticios).` : 'La petición no coincide con ninguna de las consultas habilitadas en este prototipo. No se generó SQL ni se ejecutó código.');
    const body = block.querySelector('.agent-body');
    body.appendChild(el(`<div class="answer"><p>${unknownWell ? `No encontré el pozo <b>${esc(unknownWell)}</b> en la capa semántica. ` : ''}En este prototipo puedes probar estas consultas, que el agente resuelve con datos ficticios:</p></div>`));
    body.appendChild(el(`<div class="sugg-chips">${Q.SUGGESTIONS.map((s) => `<button class="sugg-chip" data-ask="${esc(s.text)}">${esc(s.text)}</button>`).join('')}</div>`));
    body.appendChild(el(`<div class="note">También funcionan variantes como «nivel del pozo PZ-124», «ficha PZ-107» o «litio en el sector Sur».</div>`));
    toBottom();
    Screens.addAudit({ peticion: text, docs: 0, resultado: 'Sin resultado', filas: 0, tiempo: '0,7 s', output: '—', sql: '-- No ejecutado: la petición no coincide con consultas habilitadas', script: '-- No ejecutado', docsList: [] });
  }

  function stepEl([label, summary, , detail]) {
    const s = el(`<div class="step pending"><div class="step-head"><span class="step-ico"></span><span class="step-label">${esc(label)}</span><span class="step-sum">${esc(summary)}</span><span class="step-time"></span><span class="step-caret">▸</span></div><div class="step-detail">${esc(detail)}</div></div>`);
    s.querySelector('.step-head').addEventListener('click', () => {
      if (s.classList.contains('pending') || s.classList.contains('running')) return;
      s.classList.toggle('open');
      s.querySelector('.step-caret').textContent = s.classList.contains('open') ? '▾' : '▸';
    });
    return s;
  }
  function finishStep(s, summary, time, detail) {
    s.classList.remove('pending', 'running');
    s.querySelector('.step-ico').textContent = '✓';
    if (summary != null) s.querySelector('.step-sum').textContent = summary;
    if (detail != null) s.querySelector('.step-detail').textContent = detail;
    s.querySelector('.step-time').textContent = time;
  }

  function ambigCard(list) {
    const nA = list.filter((a) => a.tipo === 'ambigua').length;
    return el(`<div class="card ambig">
      <div class="ambig-head"><b>Interpretación aplicada</b><span class="muted">${nA ? `${nA} ${nA === 1 ? 'ambigüedad declarada' : 'ambigüedades declaradas'} · queda en el registro de auditoría` : 'Sin ambigüedades · resuelto con reglas de la capa semántica'}</span></div>
      ${list.map((a) => `<div class="ambig-row">
        <span class="chip ${a.tipo === 'ambigua' ? 'chip-warn' : 'chip-rule'}">${a.tipo === 'ambigua' ? 'Ambigua' : 'Regla de negocio'}</span>
        <div><b>${esc(a.term)}</b> · ${esc(a.aplicada)}${a.alternativa ? `<span class="alt">Alternativa no aplicada: ${esc(a.alternativa)}</span>` : ''}</div>
      </div>`).join('')}</div>`);
  }

  async function runAgent(text, r, animate) {
    const block = el(`<div class="msg-agent"><div class="ia-badge">IA</div><div class="agent-body"><div class="card steps"></div></div></div>`);
    scroll.appendChild(block);
    const body = block.querySelector('.agent-body');
    const steps = block.querySelector('.steps');
    const els = r.steps.map((s) => { const e = stepEl(s); e.querySelector('.step-sum').textContent = ''; steps.appendChild(e); return e; });
    let total = 0;
    const times = r.steps.map((s) => Math.round(s[2] * (animate ? 0.9 + Math.random() * 0.2 : 1)));
    toBottom();
    for (let i = 0; i < els.length; i++) {
      if (animate) {
        els[i].classList.replace('pending', 'running');
        els[i].querySelector('.step-label').textContent = r.steps[i][0] + '…';
        await sleep(Math.max(350, times[i] * 0.85));
        els[i].querySelector('.step-label').textContent = r.steps[i][0];
      }
      finishStep(els[i], r.steps[i][1], Q.s1(times[i]));
      total += times[i];
    }

    // Acordeón de SQL y script
    const sqlT = el(`<div class="sql-toggle"><span class="mono">&lt;/&gt;</span>Ver SQL y script generado<span class="caret">▸</span></div>`);
    const code = el(`<div class="code-grid">
      <div class="code-pane"><span class="fname">consulta.sql <button data-copy="sql">Copiar</button></span><pre class="code">${U.highlight(r.sql)}</pre></div>
      <div class="code-pane"><span class="fname">render.py <button data-copy="py">Copiar</button></span><pre class="code">${U.highlight(r.script)}</pre></div></div>`);
    sqlT.addEventListener('click', () => { code.classList.toggle('open'); sqlT.querySelector('.caret').textContent = code.classList.contains('open') ? '▾' : '▸'; });
    code.addEventListener('click', (e) => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      const txt = b.dataset.copy === 'sql' ? r.sql : r.script;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => U.toast('Copiado al portapapeles'), () => U.toast('No se pudo copiar en este navegador'));
    });
    steps.appendChild(sqlT); steps.appendChild(code);

    // Respuesta + resultado
    const auditId = Screens.nextAuditId();
    const d = now();
    const totalS = Q.s1(total + 180);
    body.appendChild(el(`<div class="answer">${r.answer}</div>`));
    if (r.ambig && r.ambig.length) body.appendChild(ambigCard(r.ambig));
    const card = el(`<div class="card result">
      <div class="result-head"><span class="title">${esc(r.resultTitle)}</span><span class="muted">${esc(r.resultMeta)}</span><span class="sandbox-badge"><span class="dot"></span>Datos procesados en entorno aislado</span></div>
      <div class="result-body"></div>
      <div class="result-foot">
        <div class="dropdown"><button class="btn" data-act="dl">Descargar ▾</button><div class="dropdown-menu">
          <button data-dl="csv">CSV (datos del resultado)</button>
          ${r.output === 'Mapa' ? '<button data-dl="geojson">GeoJSON (puntos)</button>' : ''}
          ${r.output === 'Gráfico' ? '<button data-dl="png">PNG (imagen del gráfico)</button>' : ''}
          <button disabled>PDF · no disponible en prototipo</button></div></div>
        <button class="btn" data-act="save">Guardar consulta</button>
        <button class="btn btn-flag" data-act="flag">Marcar respuesta incorrecta</button>
        <span class="id">consulta #${auditId.replace('A-', 'A-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-')} · ${totalS}</span>
      </div></div>`);
    body.appendChild(card);
    const ctx = {};
    RENDER[r.kind](card.querySelector('.result-body'), r, ctx, animate);
    wireFooter(card, r, text, ctx);
    if (animate) toBottom(); else block.scrollIntoView({ block: 'start' });

    if (animate) {
      Screens.addAudit({ id: auditId, peticion: text, docs: r.docs.length, resultado: 'Éxito', filas: r.rows, tiempo: totalS, output: r.output, sql: r.sql, script: r.script, docsList: r.docs.map(Q.docTitle), ambig: r.ambig });
      history.unshift({ label: r.short, meta: 'Hoy ' + hhmm(d), kind: r.kind, build: () => r });
      renderSide('history');
      if (r.kind === 'ficha') {
        await sleep(1600);
        if (location.hash.startsWith('#/consulta') || location.hash === '' ) location.hash = '#/fichas/' + r.well;
      }
    }
  }

  function restore(h) {
    if (running) return;
    newConversation(false);
    activeHistory = h; renderSide();
    const r = h.build();
    scroll.appendChild(el(`<div class="msg-user">${esc(r.question)}</div>`));
    runAgent(r.question, r, false);
  }

  function wireFooter(card, r, text, ctx) {
    const dd = card.querySelector('.dropdown');
    card.querySelector('.result-foot').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'dl') { dd.classList.toggle('open'); return; }
      dd.classList.remove('open');
      if (b.dataset.dl === 'csv') U.downloadCSV(`resultado_${r.kind}.csv`, r.csv.head, r.csv.rows);
      if (b.dataset.dl === 'geojson') {
        const gj = { type: 'FeatureCollection', features: r.csv.rows.map((row) => {
          const o = {}; r.csv.head.forEach((h, i) => { o[h] = row[i]; });
          return { type: 'Feature', geometry: { type: 'Point', coordinates: [+o.lon, +o.lat] }, properties: o };
        }) };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' }));
        a.download = `resultado_${r.kind}.geojson`; document.body.appendChild(a); a.click(); a.remove();
      }
      if (b.dataset.dl === 'png' && ctx.chart) {
        const a = document.createElement('a'); a.href = ctx.chart.toBase64Image('image/png', 1); a.download = `grafico_${r.well}.png`; document.body.appendChild(a); a.click(); a.remove();
      }
      if (b.dataset.act === 'save') {
        if (saved.some((s) => s.text === r.question)) { U.toast('Esta consulta ya está en Guardadas'); return; }
        saved.push({ label: r.short, meta: `${r.output} · guardada hoy`, text: r.question });
        renderSide('saved'); U.toast('Consulta guardada');
      }
      if (b.dataset.act === 'flag') {
        b.classList.toggle('on');
        const on = b.classList.contains('on');
        b.textContent = on ? 'Marcada como incorrecta · deshacer' : 'Marcar respuesta incorrecta';
        if (on) U.toast('Gracias. La revisión quedará registrada en Auditoría.');
      }
    });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) dd.classList.remove('open'); });
  }

  // ---------- Renderizadores de resultado ----------
  const dist = (d) => (d === 0 ? 'dentro' : fmt(d, 1) + ' km');
  const popupHTML = (w, color, rows) => `
    <div class="pop-head"><span class="sw" style="background:${color}"></span><b>${w.codigo}</b><span class="muted">Sector ${w.sector}</span></div>
    <div class="pop-grid">${rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>
    <a class="pop-link" data-ficha="${w.codigo}">Abrir ficha de pozo →</a>`;

  const RENDER = {
    mapa(box, r) {
      const rows = r.data;
      const lo = Math.floor(Math.min(...rows.map((x) => x.so4)) / 10) * 10;
      const hi = Math.ceil(Math.max(...rows.map((x) => x.so4)) / 10) * 10;
      const tipos = ['Monitoreo', 'Bombeo', 'Piezómetro'].filter((t) => rows.some((x) => x.w.tipo === t));
      const sectores = ['Núcleo', 'Norte', 'Sur'].filter((t) => rows.some((x) => x.w.sector === t));
      const f = { cats: Object.fromEntries(tipos.map((t) => [t, true])), sec: Object.fromEntries(sectores.map((t) => [t, true])), lo, hi };
      box.innerHTML = `<div class="map-wrap"><div class="map-area"></div>
        <div class="map-side">
          <div style="display:flex;flex-direction:column;gap:2px;"><span style="font-weight:600">Filtros automáticos</span><span class="muted" style="font-size:11px">Generados a partir del resultado</span></div>
          <div class="filter-block"><span class="section-label">Categoría</span>
            ${tipos.map((t) => `<div class="check-row" data-cat="${t}"><span class="check-box">✓</span><span>${t}</span><span class="n">${rows.filter((x) => x.w.tipo === t).length}</span></div>`).join('')}</div>
          <div class="filter-block"><span class="section-label">Rango de sulfato (mg/L)</span>
            <div class="range2"><div class="track"></div><div class="fill"></div>
              <input type="range" min="${lo}" max="${hi}" step="10" value="${lo}" data-r="lo" aria-label="Sulfato mínimo">
              <input type="range" min="${lo}" max="${hi}" step="10" value="${hi}" data-r="hi" aria-label="Sulfato máximo"></div>
            <div class="range-vals"><span data-v="lo">${fmt(lo)}</span><span data-v="hi">${fmt(hi)}</span></div></div>
          <div class="filter-block"><span class="section-label">Sector</span><div class="seg-chips">
            ${sectores.map((s) => `<span class="seg-chip" data-sec="${s}">${s} · ${rows.filter((x) => x.w.sector === s).length}</span>`).join('')}</div></div>
          <span class="count"></span>
        </div></div>`;
      const api = Maps.resultMap(box.querySelector('.map-area'), {
        polygon: true,
        legend: { title: 'Sulfato promedio (mg/L)', ticks: ['1.200', '2.400', '3.600', '4.800'] },
        points: rows.map((x) => {
          const c = colorFor(x.so4);
          return { w: x.w, color: c, popup: popupHTML(x.w, c, [['Sulfato prom. 12 m', `<b>${fmt(x.so4)} mg/L</b>`], ['Litio prom. 12 m', `${fmt(x.li)} mg/L`], ['Distancia a polígono', dist(x.dist)], ['Muestras', x.n], ['Tipo', x.w.tipo]]) };
        })
      });
      liveMaps.push(api);
      const so4 = Object.fromEntries(rows.map((x) => [x.w.codigo, x.so4]));
      const side = box.querySelector('.map-side');
      const [rLo, rHi] = side.querySelectorAll('input[type=range]');
      const fill = side.querySelector('.fill');
      const apply = () => {
        api.setVisible((w) => f.cats[w.tipo] && f.sec[w.sector] && so4[w.codigo] >= f.lo && so4[w.codigo] <= f.hi);
        const n = rows.filter((x) => f.cats[x.w.tipo] && f.sec[x.w.sector] && x.so4 >= f.lo && x.so4 <= f.hi).length;
        side.querySelector('.count').textContent = `${n} de ${rows.length} pozos visibles. Haz clic en un punto para ver sus atributos.`;
        const span = hi - lo || 1;
        fill.style.left = ((f.lo - lo) / span * 100) + '%';
        fill.style.right = ((hi - f.hi) / span * 100) + '%';
        side.querySelector('[data-v=lo]').textContent = fmt(f.lo);
        side.querySelector('[data-v=hi]').textContent = fmt(f.hi);
      };
      side.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cat]'), s = e.target.closest('[data-sec]');
        if (c) { f.cats[c.dataset.cat] = !f.cats[c.dataset.cat]; c.classList.toggle('off', !f.cats[c.dataset.cat]); apply(); }
        if (s) { f.sec[s.dataset.sec] = !f.sec[s.dataset.sec]; s.classList.toggle('off', !f.sec[s.dataset.sec]); apply(); }
      });
      const onRange = (e) => {
        let a = +rLo.value, b = +rHi.value;
        if (a > b) { if (e.target === rLo) a = b; else b = a; rLo.value = a; rHi.value = b; }
        f.lo = a; f.hi = b;
        rLo.style.zIndex = a > lo + (hi - lo) * 0.9 ? 3 : 1;
        apply();
      };
      rLo.addEventListener('input', onRange); rHi.addEventListener('input', onRange);
      apply();
    },

    topografia(box, r) {
      const { doc, ch, ok, out } = r.data;
      const sc = (n) => colorFor(n, 10, 50);
      box.innerHTML = `<div class="map-wrap"><div class="map-area"></div>
        <div class="map-side">
          <div style="display:flex;flex-direction:column;gap:2px;"><span style="font-weight:600">Referencia documental</span><span class="muted" style="font-size:11px">Fuente de las citas</span></div>
          <div class="doc-ref">
            <span style="display:flex;gap:8px;align-items:center"><span class="type-tag type-PDF">PDF</span><span class="mono muted" style="font-size:11px">${doc.id}</span></span>
            <span class="t">${esc(doc.titulo)}</span>
            <span class="muted" style="font-size:12px">Capítulo ${ch.n} · ${ch.t} · pp. ${ch.p}</span>
            <blockquote>${esc(ch.extracto)}</blockquote>
            <a data-doc="${doc.id}">Abrir en Documentos →</a>
          </div>
          <div class="filter-block"><span class="section-label">Pozos citados (${ch.pozos.length})</span>
            <div class="well-links">${ok.map((w) => `<a data-ficha="${w.codigo}">${w.codigo}</a>`).join('')}</div>
            <span class="muted" style="font-size:11px;line-height:1.5">Excluidos por tener ≤ 10 registros: ${out.map((w) => `<span class="mono">${w.codigo}</span> (${w.registros})`).join(', ')}</span></div>
          <span class="count">${ok.length} pozos en el mapa · color según n.º de registros de química.</span>
        </div></div>`;
      const api = Maps.resultMap(box.querySelector('.map-area'), {
        polygon: false,
        legend: { title: 'Registros de química', ticks: ['10', '20', '30', '40', '50'] },
        points: ok.map((w) => {
          const c = sc(w.registros);
          return { w, color: c, popup: popupHTML(w, c, [['Registros', `<b>${w.registros}</b>`], ['Tipo', w.tipo], ['Citado en', `cap. ${ch.n} · ${ch.t}`], ['Cota terreno', `${fmt(w.cota, 1)} m s.n.m.`]]) };
        })
      });
      liveMaps.push(api);
    },

    nivel(box, r, ctx) {
      const { w, prev, curr } = r.data;
      const labels = MOCK.MONTHS.slice(12).map((m) => m.label);
      const meanDiff = curr.reduce((a, v, i) => a + v - prev[i], 0) / 12;
      box.innerHTML = `<div class="chart-body">
        <div class="chart-legend"><span><i class="sw-line"></i>Nov 2025 – Oct 2026</span><span><i class="sw-dash"></i>Nov 2024 – Oct 2025</span><span><i class="sw-thr"></i>Umbral ${fmt(w.umbralNivel, 2)} m</span><span class="right">Profundidad al nivel freático (m bajo superficie)</span></div>
        <div class="chart-box"><canvas></canvas></div>
        <div class="kpi-strip">
          <div><span>Nivel actual (oct 2026)</span><b>${fmt(curr[11], 2)} m</b></div>
          <div><span>Oct 2025</span><b>${fmt(prev[11], 2)} m</b></div>
          <div><span>Diferencia interanual promedio</span><b>${meanDiff > 0 ? '+' : ''}${fmt(meanDiff, 2)} m</b></div>
          <div><span>Umbral de alerta vigente</span><b>${fmt(w.umbralNivel, 2)} m</b></div>
        </div></div>`;
      const mono = { family: "'IBM Plex Mono', monospace", size: 11 };
      ctx.chart = new Chart(box.querySelector('canvas'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Nov 2025 – Oct 2026', data: curr, borderColor: '#00808A', borderWidth: 2.5, pointBackgroundColor: '#fff', pointBorderColor: '#00808A', pointBorderWidth: 2, pointRadius: curr.map((_, i) => (i === 11 ? 5 : 3.5)), tension: 0.25 },
            { label: 'Nov 2024 – Oct 2025', data: prev, borderColor: '#8A99A6', borderWidth: 2, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0.25 },
            { label: 'Umbral de alerta', data: labels.map(() => w.umbralNivel), borderColor: '#C8553D', borderWidth: 1.4, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 0 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0A2240', titleFont: { family: "'IBM Plex Sans'" }, bodyFont: mono, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, 2)} m` } }
          },
          scales: {
            y: { reverse: true, suggestedMin: Math.min(...prev, ...curr) - 0.1, suggestedMax: w.umbralNivel + 0.05, grid: { color: '#E6EBEF' }, border: { display: false }, ticks: { font: mono, color: '#5A6B7B', callback: (v) => fmt(v, 2) } },
            x: { grid: { display: false }, ticks: { font: mono, color: '#5A6B7B' } }
          }
        }
      });
    },

    litio(box, r) {
      const max = Math.max(...r.data.map((x) => x.li));
      box.innerHTML = `<div style="overflow:auto"><table class="res-table">
        <thead><tr><th>Pozo</th><th>Tipo</th><th>Última muestra</th><th class="num">Litio (mg/L)</th><th class="num">Var. vs. anterior</th><th class="num">Conductividad (mS/cm)</th><th></th></tr></thead>
        <tbody>${r.data.map((x) => `<tr>
          <td class="mono"><b>${x.w.codigo}</b></td><td>${x.w.tipo}</td><td class="mono">${U.fmtDate(x.fecha)}</td>
          <td class="num"><span class="bar-cell"><i style="width:${Math.round(x.li / max * 90)}px"></i>${fmt(x.li)}</span></td>
          <td class="num ${x.delta >= 0 ? 'delta-up' : 'delta-down'}">${x.delta >= 0 ? '▲' : '▼'} ${fmt(Math.abs(x.delta), 1)} %</td>
          <td class="num">${x.ce}</td>
          <td><a data-ficha="${x.w.codigo}">Ficha →</a></td></tr>`).join('')}</tbody></table></div>`;
    },

    calcio(box, r) {
      const max = Math.max(...r.data.map((x) => x.m12));
      box.innerHTML = `<div style="overflow:auto"><table class="res-table">
        <thead><tr><th>Pozo</th><th>Tipo</th><th>Última muestra</th><th class="num">Ca prom. 12 m (mg/L)<br><span class="th-sub">aplicada</span></th><th class="num">Ca prom. 2026 (mg/L)<br><span class="th-sub">alternativa</span></th><th class="num">Diferencia</th><th></th></tr></thead>
        <tbody>${r.data.map((x) => `<tr>
          <td class="mono"><b>${x.w.codigo}</b></td><td>${x.w.tipo}</td><td class="mono">${U.fmtDate(x.last)}</td>
          <td class="num"><span class="bar-cell"><i style="width:${Math.round(x.m12 / max * 90)}px"></i>${fmt(x.m12)}</span></td>
          <td class="num muted">${fmt(x.y26)}</td>
          <td class="num ${x.diff >= 0 ? 'delta-up' : 'delta-down'}">${x.diff >= 0 ? '+' : '−'}${fmt(Math.abs(x.diff), 1)} %</td>
          <td><a data-ficha="${x.w.codigo}">Ficha →</a></td></tr>`).join('')}</tbody></table></div>`;
    },

    ficha(box, r, ctx, animate) {
      const { w, st, docs } = r.data;
      box.innerHTML = `<div class="mini-ficha">
        <span class="code">${w.codigo}</span>
        <span class="pill pill-teal">Sector ${w.sector}</span><span class="pill pill-grey">${w.tipo}</span><span class="pill pill-ok">${w.estado}</span>
        <span style="margin-left:auto;display:flex;gap:8px;align-items:center;">
          ${animate ? '<span class="opening"><i></i>Abriendo ficha 360…</span>' : ''}
          <button class="btn btn-teal" data-ficha="${w.codigo}">Abrir ficha 360 →</button></span>
      </div>
      <div class="kpi-strip" style="margin:0 14px 14px;">
        <div><span>Nivel freático (oct 2026)</span><b>${fmt(w.niveles[23], 2)} m b.s.</b></div>
        <div><span>Sulfato prom. 12 m</span><b>${fmt(st.so4)} mg/L</b></div>
        <div><span>Litio prom. 12 m</span><b>${fmt(st.li)} mg/L</b></div>
        <div><span>Informes que lo citan</span><b>${docs.length}</b></div>
      </div>`;
      if (animate) setTimeout(() => { const o = box.querySelector('.opening'); if (o) o.remove(); }, 1700);
    }
  };

  // Enlaces globales a fichas/documentos desde popups y tablas
  document.addEventListener('click', (e) => {
    const f = e.target.closest('[data-ficha]');
    if (f) { e.preventDefault(); location.hash = '#/fichas/' + f.dataset.ficha; return; }
    const d = e.target.closest('[data-doc]');
    if (d) { e.preventDefault(); location.hash = '#/documentos/' + d.dataset.doc; }
  });

  window.Consulta = {
    init() { renderSide(); newConversation(true); },
    onShow() { liveMaps.forEach((m) => m.invalidate()); },
    askFromOutside(text) { if (running) return; if (scroll.querySelector('.welcome')) scroll.innerHTML = ''; ask(text); }
  };
})();
