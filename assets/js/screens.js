/* Pantallas: Fichas de pozo, Documentos, Capa semántica y Auditoría. */
(function () {
  'use strict';
  const { esc, fmt, $, norm, statusChip, wellByCode } = U;
  const Q = window.Queries;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel === v ? ' selected' : ''}>${esc(l)}</option>`;

  // Tabla en grilla (estilo del mockup)
  function gridTable({ cols, head, rows, empty = 'Sin resultados para los filtros aplicados.' }) {
    return `<div class="grid-table"><div class="grid" style="grid-template-columns:${cols}">
      ${head.map((h) => `<span class="h">${esc(h)}</span>`).join('')}
      ${rows.length ? rows.map((r) => `<div class="row${r.click ? ' click' : ''}${r.sel ? ' sel' : ''}${r.fresh ? ' fresh' : ''}"${r.attrs || ''}>${r.cells.map((c) => `<div class="c${c.cls ? ' ' + c.cls : ''}">${c.html}</div>`).join('')}</div>`).join('') : `<div class="empty">${empty}</div>`}
    </div></div>`;
  }
  const C = (html, cls) => ({ html: `<span>${html}</span>`, cls });

  // =====================================================================
  // FICHAS DE POZO
  // =====================================================================
  const fichas = { root: $('#screen-fichas'), q: '', sector: '', tipo: '', map: null, chart: null, range: 'all' };

  function renderFichaList() {
    const f = fichas;
    destroyFicha();
    f.root.innerHTML = `<section class="table-screen"><div class="table-main">
      <div class="toolbar">
        <label class="search">⌕ <input id="fq" placeholder="Buscar por código, sector o tipo…" value="${esc(f.q)}"></label>
        <select class="select" id="fs">${opt('', 'Sector: todos', f.sector)}${['Norte', 'Núcleo', 'Sur'].map((s) => opt(s, s, f.sector)).join('')}</select>
        <select class="select" id="ft">${opt('', 'Tipo: todos', f.tipo)}${['Monitoreo', 'Bombeo', 'Piezómetro'].map((s) => opt(s, s, f.tipo)).join('')}</select>
        <button class="btn btn-primary" id="fexp">Exportar CSV</button>
      </div>
      <span class="note" id="fnote"></span>
      <div id="ftable"></div></div></section>`;
    const draw = () => {
      const t = norm(f.q);
      const list = MOCK.WELLS.filter((w) => (!f.sector || w.sector === f.sector) && (!f.tipo || w.tipo === f.tipo) && (!t || norm(`${w.codigo} ${w.sector} ${w.tipo}`).includes(t)));
      $('#fnote').textContent = `${list.length} de ${MOCK.WELLS.length} puntos de monitoreo · haz clic en una fila para abrir la ficha 360.`;
      $('#ftable').innerHTML = gridTable({
        cols: '0.8fr 0.8fr 0.9fr 0.7fr 0.9fr 0.9fr 0.9fr 0.7fr 1fr',
        head: ['Pozo', 'Sector', 'Tipo', 'Estado', 'Nivel (m b.s.)', 'Litio (mg/L)', 'Sulfato (mg/L)', 'Registros', 'Habilitación'],
        rows: list.map((w) => {
          const s = Q.wellStats(w);
          return { click: true, attrs: ` data-ficha="${w.codigo}"`, cells: [C(`<b>${w.codigo}</b>`, 'mono'), C(w.sector), C(w.tipo), C(statusChip(w.estado)), C(fmt(w.niveles[23], 2), 'mono'), C(fmt(s.li), 'mono'), C(fmt(s.so4), 'mono'), C(w.registros, 'mono'), C(U.fmtDate(w.inicio), 'mono')] };
        })
      });
      f.list = list;
    };
    $('#fq').addEventListener('input', (e) => { f.q = e.target.value; draw(); });
    $('#fs').addEventListener('change', (e) => { f.sector = e.target.value; draw(); });
    $('#ft').addEventListener('change', (e) => { f.tipo = e.target.value; draw(); });
    $('#fexp').addEventListener('click', () => U.downloadCSV('pozos.csv', ['codigo', 'sector', 'tipo', 'lat', 'lon', 'nivel_m_bs', 'registros'], f.list.map((w) => [w.codigo, w.sector, w.tipo, w.lat, w.lon, w.niveles[23], w.registros])));
    draw();
  }

  function destroyFicha() {
    if (fichas.map) { fichas.map.remove(); fichas.map = null; }
    if (fichas.chart) { fichas.chart.destroy(); fichas.chart = null; }
  }

  function pct(a, b) { return (a - b) / b * 100; }
  function renderFicha(code) {
    const w = wellByCode(code);
    if (!w) { U.toast(`No existe el pozo ${code}`); location.hash = '#/fichas'; return; }
    destroyFicha();
    const st = Q.wellStats(w);
    const utm = U.toUTM(w.lat, w.lon);
    const q = w.quimica, last = q[q.length - 1];
    const tri = (k) => pct(avg(q.slice(-3).map((x) => x[k])), avg(q.slice(-6, -3).map((x) => x[k])));
    const dN = w.niveles[23] - w.niveles[11];
    const docs = MOCK.DOCUMENTS.filter((d) => d.pozos.includes(code));
    const margin = w.umbralNivel - w.niveles[23];
    const arrow = (v, goodUp) => {
      if (Math.abs(v) < 1) return ['Sin variación relevante', '#5A6B7B'];
      return [`${v > 0 ? '▲' : '▼'} ${fmt(Math.abs(v), 1)} % vs. trimestre anterior`, (v > 0) === goodUp ? '#1D6E55' : '#A5402D'];
    };
    const kLi = arrow(tri('litio'), true), kSo = arrow(tri('sulfato'), false), kCe = arrow(tri('conductividad'), false);
    const lastDate = U.fmtDate(last.fecha);
    const kpis = [
      { l: 'Nivel freático', v: fmt(w.niveles[23], 2), u: 'm b.s.', d: `${dN > 0 ? '▼' : '▲'} ${fmt(Math.abs(dN), 2)} m vs. oct 2025`, c: dN > 0 ? '#A5402D' : '#1D6E55', dt: 'Transductor · 31-10-2026 23:00' },
      { l: 'Litio', v: fmt(last.litio), u: 'mg/L', d: kLi[0], c: kLi[1], dt: `Muestra · ${lastDate}` },
      { l: 'Sulfato', v: fmt(last.sulfato), u: 'mg/L', d: kSo[0], c: kSo[1], dt: `Muestra · ${lastDate}` },
      { l: 'Conductividad', v: fmt(last.conductividad), u: 'mS/cm', d: kCe[0], c: kCe[1], dt: `In situ · ${lastDate}` }
    ];
    const conds = [
      { tag: 'Umbral', t: `Nivel de alerta: ${fmt(w.umbralNivel, 2)} m bajo superficie. ${margin > 0 ? `Nivel actual a ${fmt(margin, 2)} m del umbral.` : 'Nivel actual sobre el umbral.'}`, src: 'Plan de Alerta Temprana rev. 4 · §5.2', bg: '#FDF3E1', color: '#8A5A0B' },
      { tag: 'Frecuencia', t: w.tipo === 'Piezómetro' ? 'Medición de nivel manual mensual.' : 'Medición de nivel continua (transductor) y química mensual.', src: 'RCA · Programa de seguimiento', bg: '#E0F3F4', color: '#00808A' },
      { tag: 'Umbral', t: `Sulfato: revisión obligatoria si supera 4.000 mg/L en dos campañas consecutivas. ${st.so4 > 4000 ? 'Promedio 12 m sobre el umbral.' : 'Promedio 12 m bajo el umbral.'}`, src: 'Plan de Alerta Temprana rev. 4 · §6.1', bg: '#FDF3E1', color: '#8A5A0B' },
      { tag: 'Mantención', t: 'Recalibración del transductor programada para 2026-12-05.', src: 'Orden de trabajo OT-26-1187 (ficticia)', bg: '#EEF1F4', color: '#3A4A59' }
    ];
    const citing = docs.map((d) => {
      const chs = d.capitulos.filter((c) => c.pozos.includes(code));
      return { d, m: chs.map((c) => `cap. ${c.n} ${c.t} · pp. ${c.p}`).join(' · ') };
    });
    fichas.root.innerHTML = `<section class="ficha">
      <a class="back-link" href="#/fichas">← Todas las fichas</a>
      <div class="ficha-head">
        <span class="code">${w.codigo}</span>
        <span class="pill pill-teal">Sector ${w.sector}</span>
        <span class="pill pill-grey">Pozo de ${w.tipo.toLowerCase()} · salmuera</span>
        <span class="pill pill-ok">${w.estado}</span>
        <span class="actions"><button class="btn" id="askAgent">Preguntar al agente sobre este pozo</button><button class="btn" id="expFicha">Exportar ficha</button></span>
      </div>
      <div class="ficha-grid">
        <div class="card ficha-loc">
          <div class="ficha-map"><div id="fmap" style="position:absolute;inset:0"></div></div>
          <div class="kv">
            <span>UTM Este</span><span class="mono">${fmt(utm.E)}</span>
            <span>UTM Norte</span><span class="mono">${fmt(utm.N)}</span>
            <span>Lat / Lon (WGS84)</span><span class="mono">${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}</span>
            <span>Cota terreno</span><span>${fmt(w.cota, 1)} m s.n.m.</span>
            <span>Profundidad</span><span>${w.profundidad} m</span>
            <span>Habilitación</span><span>Inicio ${w.inicio}</span>
            <span>Registros de química</span><span>${w.registros}</span>
          </div>
        </div>
        <div class="ficha-right">
          <div class="kpis">${kpis.map((k) => `<div class="kpi"><span class="l">${k.l}</span><span class="v"><b>${k.v}</b><span>${k.u}</span></span><span class="d" style="color:${k.c}">${k.d}</span><span class="dt">${k.dt}</span></div>`).join('')}</div>
          <div class="card hist-card">
            <div class="hd"><b>Serie histórica de niveles</b><span class="muted">m bajo superficie · ${w.inicio.slice(0, 4)}–2026</span>
              <span class="range-tabs"><button data-rg="12">1 a</button><button data-rg="60">5 a</button><button data-rg="all" class="on">Todo</button></span></div>
            <div class="hist-box"><canvas id="fchart"></canvas></div>
          </div>
        </div>
      </div>
      <div class="ficha-bottom">
        <div class="card"><div class="card-title">Condiciones vigentes</div>
          ${conds.map((c) => `<div class="cond"><span class="tag" style="background:${c.bg};color:${c.color}">${c.tag}</span><span class="tx"><span>${esc(c.t)}</span><small>${esc(c.src)}</small></span></div>`).join('')}</div>
        <div class="card"><div class="card-title">Informes que citan ${w.codigo} <span>· ${citing.length}</span></div>
          ${citing.length ? citing.map(({ d, m }) => `<div class="citing"><span class="type-tag type-${d.tipo}">${d.tipo === 'Word' ? 'DOC' : d.tipo}</span><span class="tx"><a data-doc="${d.id}">${esc(d.titulo)}</a><small>${esc(m)}</small></span><span class="dt">${U.fmtDate(d.fecha)}</span></div>`).join('') : '<div class="citing muted">Ningún documento indexado cita este pozo.</div>'}</div>
      </div></section>`;

    fichas.map = Maps.locationMap($('#fmap'), w);
    const mono = { family: "'IBM Plex Mono', monospace", size: 10 };
    const drawChart = (rg) => {
      const data = rg === 'all' ? w.historico : w.historico.slice(-rg);
      if (fichas.chart) fichas.chart.destroy();
      fichas.chart = new Chart($('#fchart'), {
        type: 'line',
        data: { labels: data.map((d) => d.key), datasets: [
          { data: data.map((d) => d.v), borderColor: '#00808A', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 3, tension: 0.2 },
          { data: data.map(() => w.umbralNivel), borderColor: '#C8553D', borderDash: [4, 3], borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 0 }
        ] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0A2240', filter: (i) => i.datasetIndex === 0, callbacks: { label: (c) => ` Nivel: ${fmt(c.parsed.y, 2)} m b.s.` } } },
          scales: {
            y: { reverse: true, suggestedMax: w.umbralNivel + 0.05, grid: { color: '#E6EBEF' }, border: { display: false }, ticks: { font: mono, color: '#5A6B7B', callback: (v) => fmt(v, 1) } },
            x: { grid: { display: false }, ticks: { font: mono, color: '#5A6B7B', maxRotation: 0, autoSkip: true, maxTicksLimit: 8, callback: function (v) { const k = this.getLabelForValue(v); return rg === 12 ? k.slice(5) + '/' + k.slice(2, 4) : k.slice(0, 4); } } }
          }
        },
        plugins: [{ id: 'thrLabel', afterDatasetsDraw(ch) { const y = ch.scales.y.getPixelForValue(w.umbralNivel); const c = ch.ctx; c.save(); c.fillStyle = '#C8553D'; c.font = "10px 'IBM Plex Mono'"; c.textAlign = 'right'; c.fillText(`Umbral ${fmt(w.umbralNivel, 2)} m`, ch.chartArea.right - 4, y - 5); c.restore(); } }]
      });
    };
    drawChart('all');
    fichas.root.querySelector('.range-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      fichas.root.querySelectorAll('.range-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      drawChart(b.dataset.rg === 'all' ? 'all' : +b.dataset.rg);
    });
    $('#askAgent').addEventListener('click', () => { location.hash = '#/consulta'; setTimeout(() => Consulta.askFromOutside(`Evolución del nivel del agua del pozo ${code} en los últimos 12 meses vs. el año anterior`), 80); });
    $('#expFicha').addEventListener('click', () => U.downloadCSV(`ficha_${code}.csv`, ['mes', 'nivel_m_bs'], w.historico.map((h) => [h.key, h.v.toFixed(2)])));
  }

  // =====================================================================
  // DOCUMENTOS
  // =====================================================================
  const docs = { root: $('#screen-documentos'), q: '', tipo: '', estado: '', sel: null };
  function renderDocs() {
    const s = docs;
    const D = MOCK.DOCUMENTS;
    const idx = D.filter((d) => d.estado === 'Indexado').length, proc = D.filter((d) => /Indexando|cola/.test(d.estado)).length, err = D.filter((d) => /Error/.test(d.estado)).length;
    s.root.innerHTML = `<section class="table-screen"><div class="table-main">
      <div class="toolbar">
        <label class="search">⌕ <input id="dq" placeholder="Buscar por título, contenido, capítulo o código de pozo…" value="${esc(s.q)}"></label>
        <select class="select" id="dt">${opt('', 'Tipo: todos', s.tipo)}${opt('PDF', 'PDF', s.tipo)}${opt('Word', 'Word', s.tipo)}</select>
        <select class="select" id="de">${opt('', 'Estado: todos', s.estado)}${opt('Indexado', 'Indexado', s.estado)}${opt('proc', 'En proceso', s.estado)}${opt('Error', 'Con error', s.estado)}</select>
        <button class="btn btn-primary" id="dup">Subir documento</button>
      </div>
      <span class="note" id="dnote"></span>
      <div id="dtable"></div></div><div id="ddetail"></div></section>`;
    const draw = () => {
      const t = norm(s.q);
      const list = D.filter((d) => {
        if (s.tipo && d.tipo !== s.tipo) return false;
        if (s.estado === 'Indexado' && d.estado !== 'Indexado') return false;
        if (s.estado === 'proc' && !/Indexando|cola/.test(d.estado)) return false;
        if (s.estado === 'Error' && !/Error/.test(d.estado)) return false;
        if (!t) return true;
        const hay = norm([d.titulo, d.resumen, d.etiquetas.join(' '), d.pozos.join(' '), d.capitulos.map((c) => c.t + ' ' + (c.extracto || '')).join(' ')].join(' '));
        return t.split(/\s+/).every((k) => hay.includes(k));
      });
      $('#dnote').textContent = `${D.length} documentos · ${idx} indexados · ${proc} en proceso · ${err} con error. ${t ? `${list.length} coinciden con la búsqueda. ` : ''}Fuente: SharePoint Hidrogeología (simulado).`;
      $('#dtable').innerHTML = gridTable({
        cols: '2.6fr 0.6fr 1fr 0.9fr 1.6fr 0.6fr', head: ['Documento', 'Tipo', 'Estado de indexación', 'Fecha', 'Etiquetas', 'Citas'],
        rows: list.map((d) => ({ click: true, sel: d.id === s.sel, attrs: ` data-docrow="${d.id}"`, cells: [
          C(esc(d.titulo), 'link'), C(`<span class="type-tag type-${d.tipo}">${d.tipo === 'Word' ? 'Word' : d.tipo}</span>`), C(statusChip(d.estado)), C(d.fecha, 'mono'), C(esc(d.etiquetas.join(' · ')), 'muted'), C(d.citas || '—', 'mono')] }))
      });
      drawDetail();
    };
    const drawDetail = () => {
      const d = D.find((x) => x.id === s.sel);
      $('#ddetail').innerHTML = !d ? '' : `<aside class="detail">
        <div class="detail-head"><span class="row1"><span class="type-tag type-${d.tipo}">${d.tipo}</span><span class="mono muted" style="font-size:11px">${d.id}</span>${statusChip(d.estado)}<button class="x" data-close>✕</button></span>
          <b style="font-size:14px;line-height:1.35">${esc(d.titulo)}</b><span class="muted" style="font-size:11px">${esc(d.autor)} · ${U.fmtDate(d.fecha)} · ${d.paginas} págs.</span></div>
        <div class="detail-sec"><span class="section-label">Resumen</span><span>${esc(d.resumen)}</span></div>
        ${d.capitulos.length ? `<div class="detail-sec"><span class="section-label">Capítulos indexados</span>${d.capitulos.map((c) => `<div class="chapter"><span class="n">${c.n}</span><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span><b style="font-weight:500">${esc(c.t)}</b> <span class="muted">· pp. ${c.p}</span></span>${c.extracto ? `<span class="muted" style="font-size:12px">«${esc(c.extracto)}»</span>` : ''}${c.pozos.length ? `<div class="well-links">${c.pozos.map((p) => `<a data-ficha="${p}">${p}</a>`).join('')}</div>` : ''}</div></div>`).join('')}</div>` : ''}
        <div class="detail-sec"><span class="sbx-line" style="margin:0"><span class="dot"></span>El agente solo lee el índice semántico; el archivo original permanece en SharePoint.</span></div>
      </aside>`;
    };
    $('#dq').addEventListener('input', (e) => { s.q = e.target.value; draw(); });
    $('#dt').addEventListener('change', (e) => { s.tipo = e.target.value; draw(); });
    $('#de').addEventListener('change', (e) => { s.estado = e.target.value; draw(); });
    $('#dup').addEventListener('click', () => U.toast('La carga de documentos no está disponible en el prototipo'));
    s.root.onclick = (e) => {
      const r = e.target.closest('[data-docrow]');
      if (r) { s.sel = r.dataset.docrow === s.sel ? null : r.dataset.docrow; draw(); }
      if (e.target.closest('[data-close]')) { s.sel = null; draw(); }
    };
    draw();
  }

  // =====================================================================
  // CAPA SEMÁNTICA
  // =====================================================================
  const sem = { root: $('#screen-semantica'), tab: 'vistas', q: '' };
  const SEM_TABS = [['vistas', 'Vistas'], ['relaciones', 'Relaciones'], ['metricas', 'Métricas'], ['verificadas', 'Consultas verificadas']];
  function renderSem() {
    const s = sem;
    s.root.innerHTML = `<section class="table-screen"><div class="table-main">
      <div class="tabs">${SEM_TABS.map(([k, l]) => `<span class="tab${k === s.tab ? ' active' : ''}" data-tab="${k}">${l} <span class="n">${MOCK.SEMANTIC[k].rows.length}</span></span>`).join('')}</div>
      <div class="toolbar">
        <label class="search">⌕ <input id="sq" placeholder="Buscar vista, columna o alias…" value="${esc(s.q)}"></label>
        <select class="select"><option>Esquema: hidro</option></select>
        <select class="select"><option>Estado: publicadas</option><option>Estado: borrador</option></select>
        <button class="btn btn-primary" id="sadd">${s.tab === 'verificadas' ? '+ Verificar consulta' : '+ Agregar'}</button>
      </div>
      <span class="note">El agente solo puede consultar las vistas listadas aquí. Las celdas con borde punteado son editables; los cambios se publican como nueva versión (v3.2 vigente).</span>
      <div id="stable"></div></div></section>`;
    const draw = () => {
      const T = MOCK.SEMANTIC[s.tab], t = norm(s.q);
      const rows = T.rows.map((r, ri) => ({ r, ri })).filter(({ r }) => !t || norm(r.join(' ')).includes(t));
      $('#stable').innerHTML = gridTable({
        cols: T.cols, head: T.head,
        rows: rows.map(({ r, ri }) => ({ cells: r.map((c, i) => {
          if (s.tab === 'verificadas' && i === 4) return C(statusChip(c));
          if (T.edit.includes(i)) return { html: `<span class="edit" contenteditable="true" spellcheck="false" data-ri="${ri}" data-ci="${i}">${esc(c)}</span>` };
          return C(esc(c), T.mono.includes(i) ? 'mono' : '');
        }) }))
      });
    };
    s.root.querySelector('.tabs').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { s.tab = t.dataset.tab; renderSem(); } });
    $('#sq').addEventListener('input', (e) => { s.q = e.target.value; draw(); });
    $('#sadd').addEventListener('click', () => U.toast('Edición estructural deshabilitada en el prototipo'));
    s.root.onfocusout = (e) => {
      const c = e.target.closest('[contenteditable]'); if (!c) return;
      const T = MOCK.SEMANTIC[s.tab], ri = +c.dataset.ri, ci = +c.dataset.ci, v = c.textContent.trim();
      if (T.rows[ri][ci] !== v) { T.rows[ri][ci] = v; U.toast('Cambio guardado como borrador · se publicará en v3.3'); }
    };
    s.root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.isContentEditable) { e.preventDefault(); e.target.blur(); } };
    draw();
  }

  // =====================================================================
  // AUDITORÍA
  // =====================================================================
  const aud = { root: $('#screen-auditoria'), q: '', user: '', res: '', period: '7', sel: 'A-0412' };
  let auditSeq = 413;
  const EXTRA_SQL = {
    'A-0390': "SELECT documento_id, titulo, capitulo, paginas\nFROM hidro.v_documentos_citas\nWHERE punto_codigo = 'PZ-121'\nORDER BY fecha_documento DESC;",
    'A-0384': "SELECT p.codigo, MAX(q.conductividad) AS ce_max_30d\nFROM hidro.v_puntos_monitoreo p\nJOIN hidro.v_quimica q ON q.punto_id = p.id\nWHERE p.sector = 'Sur'\n  AND q.fecha >= CURRENT_DATE - INTERVAL '30 days'\nGROUP BY 1 ORDER BY 2 DESC;",
    'A-0371': "SELECT n.punto_codigo, n.nivel_m_bs, c.umbral_nivel\nFROM hidro.v_niveles n\nJOIN hidro.v_condiciones c ON c.punto_codigo = n.punto_codigo\nWHERE n.fecha = (SELECT MAX(fecha) FROM hidro.v_niveles)\n  AND n.nivel_m_bs >= c.umbral_nivel - 0.10;",
    'A-0409': "SELECT p.sector, AVG(q.litio_mg_l) AS li_prom\nFROM hidro.v_puntos_monitoreo p\nJOIN hidro.v_quimica q ON q.punto_id = p.id\nWHERE q.fecha >= CURRENT_DATE - INTERVAL '3 months'\nGROUP BY 1;"
  };
  const parseDate = (s) => { const [d, m, y] = s.slice(0, 10).split('-'); return new Date(+y, +m - 1, +d); };

  function auditDetail(r) {
    if (r.sql) return r;
    const ex = MOCK.AUDIT_ERRORS[r.id];
    if (ex) return { ...r, ...ex, output: '—', docsList: [] };
    let base = null;
    if (r.kind === 'mapa' || r.kind === 'nivel') base = Q.bySuggestion(r.kind);
    if (base) r = { ...r, ambig: base.ambig };
    const docsList = ['Informe Trimestral Hidroquímico Q3-2026', 'Plan de Alerta Temprana rev. 4', 'Campaña de niveles octubre 2026', 'Pruebas de bombeo PZ-107 y PZ-118'].slice(0, r.docs);
    return { ...r, sql: base ? base.sql : (EXTRA_SQL[r.id] || '-- SQL no disponible'), script: base ? base.script : 'from sandbox import result, publish\npublish.table(result.df)', output: base ? base.output : 'Tabla', docsList };
  }

  function renderAud() {
    const s = aud;
    const users = [...new Set(MOCK.AUDIT.map((r) => r.usuario))];
    s.root.innerHTML = `<section class="table-screen"><div class="table-main">
      <div class="toolbar">
        <label class="search">⌕ <input id="aq" placeholder="Buscar por petición, usuario o ID…" value="${esc(s.q)}"></label>
        <select class="select" id="au">${opt('', 'Usuario: todos', s.user)}${users.map((u) => opt(u, u, s.user)).join('')}</select>
        <select class="select" id="ar">${opt('', 'Resultado: todos', s.res)}${['Éxito', 'Error', 'Sin resultado'].map((x) => opt(x, x, s.res)).join('')}</select>
        <select class="select" id="ap">${opt('7', 'Últimos 7 días', s.period)}${opt('1', 'Último día', s.period)}${opt('all', 'Todo el período', s.period)}</select>
        <button class="btn btn-primary" id="aexp">Exportar CSV</button>
      </div>
      <span class="note" id="anote"></span>
      <div id="atable"></div></div><div id="adetail"></div></section>`;
    const filtered = () => {
      const t = norm(s.q);
      const ref = Math.max(...MOCK.AUDIT.map((r) => parseDate(r.fecha).getTime()));
      return MOCK.AUDIT.filter((r) => (!s.user || r.usuario === s.user) && (!s.res || r.resultado === s.res)
        && (s.period === 'all' || (ref - parseDate(r.fecha).getTime()) / 86400000 < +s.period)
        && (!t || norm(`${r.id} ${r.usuario} ${r.peticion}`).includes(t)));
    };
    const draw = () => {
      const list = filtered();
      $('#anote').textContent = `${list.length} interacciones · cada consulta ejecutada en Consulta agrega una fila aquí.`;
      $('#atable').innerHTML = gridTable({
        cols: '0.7fr 0.9fr 1.2fr 2.4fr 0.5fr 0.9fr 0.5fr 0.6fr', head: ['ID', 'Usuario', 'Fecha y hora', 'Petición', 'Docs', 'Resultado', 'Filas', 'Tiempo'],
        rows: list.map((r) => { const fresh = r.fresh; r.fresh = false; return { click: true, sel: r.id === s.sel, fresh, attrs: ` data-aud="${r.id}"`, cells: [
          C(r.id, 'mono'), C(esc(r.usuario)), C(r.fecha, 'mono'), C(esc(r.peticion)), C(r.docs, 'mono'), C(statusChip(r.resultado)), C(r.filas, 'mono'), C(r.tiempo, 'mono')] }; })
      });
      drawDetail();
      return list;
    };
    const drawDetail = () => {
      const r0 = MOCK.AUDIT.find((x) => x.id === s.sel);
      if (!r0) { $('#adetail').innerHTML = ''; return; }
      const r = auditDetail(r0);
      const ok = r.resultado === 'Éxito';
      const mail = r.usuario.replace('. ', '.').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + '@albemarle.com';
      $('#adetail').innerHTML = `<aside class="detail">
        <div class="detail-head"><span class="row1"><b>Detalle de interacción</b><span class="mono muted" style="font-size:11px">${r.id}</span><span style="margin-left:auto">${statusChip(r.resultado)}</span></span>
          <span style="line-height:1.45">${esc(r.peticion)}</span><span class="muted" style="font-size:11px">${esc(r.usuario)} · ${mail} · ${r.fecha}</span></div>
        <div class="detail-stats"><div><span>Filas</span><b>${r.filas}</b></div><div><span>Tiempo</span><b>${r.tiempo}</b></div><div><span>Salida</span><b>${esc(r.output || '—')}</b></div></div>
        <div class="detail-sec"><span class="section-label">Documentos usados</span><span>${r.docsList && r.docsList.length ? esc(r.docsList.join(' · ')) : 'Ninguno'}</span></div>
        ${r.ambig && r.ambig.length ? `<div class="detail-sec"><span class="section-label">Incertidumbres de interpretación</span>${r.ambig.map((a) => `<span class="aud-ambig"><span class="chip ${a.tipo === 'ambigua' ? 'chip-warn' : 'chip-rule'}">${a.tipo === 'ambigua' ? 'Ambigua' : 'Regla'}</span><span><b>${esc(a.term)}</b> → ${esc(a.aplicada)}${a.alternativa ? ` <span class="muted">(alternativa: ${esc(a.alternativa)})</span>` : ''}</span></span>`).join('')}</div>` : ''}
        ${r.err ? `<div class="err-box">${esc(r.err)}</div>` : ''}
        ${!ok && !r.err ? `<div class="err-box" style="background:#FDF3E1;color:#8A5A0B">La petición no coincidió con consultas habilitadas; no se ejecutó código.</div>` : ''}
        <div class="detail-sec" style="border-bottom:0">
          <span class="section-label">SQL ejecutado</span><pre class="code">${U.highlight(r.sql)}</pre>
          <span class="section-label" style="margin-top:8px">Script ejecutado</span><pre class="code">${U.highlight(r.script)}</pre>
          <span class="sbx-line"><span class="dot"></span>Ejecutado en entorno aislado · contenedor sbx-07</span>
        </div></aside>`;
    };
    $('#aq').addEventListener('input', (e) => { s.q = e.target.value; draw(); });
    $('#au').addEventListener('change', (e) => { s.user = e.target.value; draw(); });
    $('#ar').addEventListener('change', (e) => { s.res = e.target.value; draw(); });
    $('#ap').addEventListener('change', (e) => { s.period = e.target.value; draw(); });
    $('#aexp').addEventListener('click', () => U.downloadCSV('auditoria.csv', ['id', 'usuario', 'fecha', 'peticion', 'docs', 'resultado', 'filas', 'tiempo'], filtered().map((r) => [r.id, r.usuario, r.fecha, r.peticion, r.docs, r.resultado, r.filas, r.tiempo])));
    s.root.onclick = (e) => { const r = e.target.closest('[data-aud]'); if (r) { s.sel = r.dataset.aud; draw(); } };
    draw();
  }

  window.Screens = {
    fichas(code) { if (code) renderFicha(code); else renderFichaList(); },
    leaveFichas() { destroyFicha(); },
    documentos(id) { if (id) docs.sel = id; renderDocs(); },
    semantica() { renderSem(); },
    auditoria() { renderAud(); },
    nextAuditId() { return 'A-' + String(auditSeq).padStart(4, '0'); },
    addAudit(row) {
      const d = new Date();
      const id = row.id || Screens.nextAuditId();
      auditSeq++;
      const fecha = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${d.toTimeString().slice(0, 5)}`;
      MOCK.AUDIT.unshift({ usuario: 'F. Zúñiga', fecha, kind: null, fresh: true, ...row, id });
      aud.sel = id;
    }
  };
})();
