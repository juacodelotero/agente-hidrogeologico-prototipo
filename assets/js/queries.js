/* Consultas predefinidas del agente simulado: interpretación, pasos, SQL/script y datos. */
(function () {
  'use strict';
  const { fmt, esc, norm, wellByCode } = U;
  const W = MOCK.WELLS;
  const M = MOCK.MONTHS;
  const s1 = (ms) => fmt(ms / 1000, 1) + ' s';
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const dec = (v, d = 2) => fmt(v, d);
  const docTitle = (id) => MOCK.DOCUMENTS.find((d) => d.id === id).titulo;

  // ---------- Resaltado de código ----------
  const KW = 'SELECT|FROM|WHERE|AND|OR|AS|JOIN|ON|GROUP|BY|ORDER|WITH|CROSS|LEFT|INNER|HAVING|DESC|ASC|COUNT|AVG|MAX|MIN|DATE|INTERVAL|CURRENT_DATE|IN|NOT|NULL|LIMIT|OVER|PARTITION|ROW_NUMBER|DISTINCT|CASE|WHEN|THEN|ELSE|END|import|from|as|def|return|for|in|if|else|lambda|True|False|None';
  const TOK = new RegExp(`(--[^\\n]*|#[^\\n]*)|('(?:[^'\\\\\\n])*'|"(?:[^"\\\\\\n])*")|\\b(\\d+(?:\\.\\d+)?)\\b|\\b(${KW})\\b`, 'g');
  U.highlight = (src) => {
    let out = '', last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? 'cm' : m[2] ? 'str' : m[3] ? 'num' : 'kw';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = TOK.lastIndex;
    }
    return out + esc(src.slice(last));
  };

  // ---------- Datos derivados ----------
  const wellStats = (w) => ({
    so4: Math.round(avg(w.quimica.map((q) => q.sulfato))),
    li: Math.round(avg(w.quimica.map((q) => q.litio))),
    ce: Math.round(avg(w.quimica.map((q) => q.conductividad))),
    n: w.quimica.length,
    dist: U.distToPoly([w.xKm, w.yKm], MOCK.POLYGON_X.km)
  });

  // ======================================================================
  // a) Mapa: pozos a < 2 km del Polígono X con sulfato promedio
  // ======================================================================
  function buildMapa() {
    const rows = W.map((w) => ({ w, ...wellStats(w) })).filter((r) => r.dist <= 2).sort((a, b) => b.so4 - a.so4);
    const top = rows.slice(0, 3);
    const over = rows.filter((r) => r.so4 > 4000);
    const min = Math.min(...rows.map((r) => r.so4)), max = Math.max(...rows.map((r) => r.so4));
    const inside = rows.filter((r) => r.dist === 0).length;
    return {
      kind: 'mapa', output: 'Mapa', rows: rows.length, data: rows,
      question: 'Mostrar en un mapa los pozos a menos de 2 km del polígono X, con su promedio de sulfato del último año',
      short: 'Pozos a < 2 km del polígono X con sulfato promedio',
      docs: ['DOC-002', 'DOC-003'],
      steps: [
        ['Interpretando petición', 'Entidad: pozos · filtro espacial 2 km · métrica: sulfato promedio 12 m', 620,
          'Se identificó una consulta espacial (buffer de 2.000 m alrededor de "Polígono X"), la métrica verificada "Sulfato promedio" y la ventana temporal "último año" (nov 2025 – oct 2026). Salida esperada: mapa.'],
        ['Consultando capa semántica', '3 vistas · 1 métrica · 2 relaciones', 430,
          'Vistas: hidro.v_puntos_monitoreo, hidro.v_quimica, hidro.v_poligonos. Métrica: so4_prom_12m (mg/L). Solo se leyeron nombres de columnas, tipos y descripciones; ningún valor de la base.'],
        ['Revisando documentos', '2 informes relevantes', 1080,
          'Informe Trimestral Hidroquímico Q3-2026 (define el Polígono X como zona de seguimiento, cap. 2) y Plan de Alerta Temprana rev. 4 (umbral de sulfato 4.000 mg/L, §6).'],
        ['Ejecutando script', `${rows.length} filas · entorno aislado`, 2260,
          'SQL y script ejecutados en el contenedor sbx-07. El agente recibió únicamente el esquema del resultado y el conteo de filas.']
      ],
      sql: `WITH buffer AS (
  SELECT ST_Buffer(geom, 2000) AS g
  FROM hidro.v_poligonos
  WHERE nombre = 'Polígono X'
)
SELECT p.codigo, p.sector, p.tipo,
       ST_Distance(p.geom, x.geom)/1000 AS dist_km,
       AVG(q.sulfato_mg_l) AS so4_prom,
       AVG(q.litio_mg_l)   AS li_prom,
       COUNT(*)            AS n_muestras
FROM hidro.v_puntos_monitoreo p
JOIN hidro.v_quimica q ON q.punto_id = p.id
JOIN buffer b ON ST_Intersects(p.geom, b.g)
CROSS JOIN hidro.v_poligonos x
WHERE x.nombre = 'Polígono X'
  AND q.fecha >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY 1,2,3,4;`,
      script: `import geopandas as gpd
from sandbox import result, publish

gdf = gpd.GeoDataFrame(result.df,
        geometry=result.geom, crs=32719)
publish.map(
  gdf, color_by="so4_prom",
  cmap="aqua_to_red", basemap="satellite",
  overlays=["Polígono X", "buffer_2km"],
  filters=["tipo", "so4_prom", "sector"],
  popup=["codigo","sector","so4_prom",
         "li_prom","dist_km","n_muestras"])`,
      answer: `<p>Hay <b>${rows.length} puntos de monitoreo</b> dentro del radio de 2 km del Polígono X (${inside} de ellos dentro del polígono). El sulfato promedio del último año va de <b>${fmt(min)} a ${fmt(max)} mg/L</b>; los tres valores más altos son ${top.map((r) => `<b>${r.w.codigo}</b> (${fmt(r.so4)} mg/L, ${r.w.sector})`).join(', ')}.</p>
               <p>${over.length} pozos superan el umbral de 4.000 mg/L definido en el Plan de Alerta Temprana rev. 4. Puedes filtrar por tipo, rango y sector en el panel derecho.</p>`,
      resultTitle: 'Pozos a < 2 km del Polígono X',
      resultMeta: `${rows.length} puntos · sulfato promedio nov 2025 – oct 2026`,
      csv: { head: ['codigo', 'sector', 'tipo', 'dist_km', 'so4_prom_mg_l', 'li_prom_mg_l', 'n_muestras', 'lat', 'lon'],
        rows: rows.map((r) => [r.w.codigo, r.w.sector, r.w.tipo, r.dist.toFixed(2), r.so4, r.li, r.n, r.w.lat, r.w.lon]) }
    };
  }

  // ======================================================================
  // b) Gráfico: nivel del agua 12 meses vs año anterior
  // ======================================================================
  function buildNivel(code) {
    const w = wellByCode(code);
    const prev = w.niveles.slice(0, 12), curr = w.niveles.slice(12);
    const diffs = curr.map((v, i) => v - prev[i]);
    const meanDiff = avg(diffs);
    const maxI = diffs.reduce((bi, d, i) => (Math.abs(d) > Math.abs(diffs[bi]) ? i : bi), 0);
    const last = curr[11], lastPrev = prev[11];
    const margin = w.umbralNivel - last;
    const deeper = meanDiff > 0;
    return {
      kind: 'nivel', output: 'Gráfico', rows: 24, well: code, data: { w, prev, curr },
      question: `Evolución del nivel del agua del pozo ${code} en los últimos 12 meses vs. el año anterior`,
      short: `Nivel de ${code} vs. año anterior`,
      docs: ['DOC-003', 'DOC-004'],
      steps: [
        ['Interpretando petición', `Entidad: ${code} · métrica: nivel · comparación interanual`, 520,
          'Ventanas: nov 2025 – oct 2026 contra nov 2024 – oct 2025. Agregación mensual. Salida esperada: gráfico de líneas.'],
        ['Consultando capa semántica', '1 vista · 2 métricas', 340,
          'Vista hidro.v_niveles; métricas nivel_mensual (m bajo superficie) y delta_nivel_ia. El eje se invierte porque un valor mayor indica un nivel más profundo.'],
        ['Revisando documentos', '2 informes relevantes', 820,
          `Plan de Alerta Temprana rev. 4: umbral de nivel de ${dec(w.umbralNivel)} m para ${code}. Campaña de niveles octubre 2026: validación de la última medición manual.`],
        ['Ejecutando script', '24 filas · entorno aislado', 1580,
          'Ejecutado en el contenedor sbx-03. El agente recibió solo el esquema del resultado.']
      ],
      sql: `SELECT date_trunc('month', fecha) AS mes,
       AVG(nivel_m_bs)            AS nivel,
       COUNT(*)                   AS n_lecturas
FROM hidro.v_niveles
WHERE punto_codigo = '${code}'
  AND fecha >= DATE '2024-11-01'
  AND fecha <  DATE '2026-11-01'
GROUP BY 1
ORDER BY 1;`,
      script: `from sandbox import result, publish
df = result.df
df["periodo"] = df.mes.apply(
  lambda m: "actual" if m >= "2025-11-01"
            else "anterior")
df["mes_rel"] = df.mes.dt.strftime("%b")
publish.line(df, x="mes_rel", y="nivel",
  series="periodo", invert_y=True,
  ref_line={"y": ${w.umbralNivel.toFixed(2)}, "label": "Umbral"})`,
      answer: `<p>En los últimos 12 meses el nivel de <b>${code}</b> estuvo, en promedio, <b>${dec(Math.abs(meanDiff))} m ${deeper ? 'más profundo' : 'más somero'}</b> que en el mismo período anterior. La mayor brecha se registró en <b>${M[12 + maxI].label} ${M[12 + maxI].year}</b> (${dec(Math.abs(diffs[maxI]))} m); en octubre el nivel fue ${dec(last)} m contra ${dec(lastPrev)} m.</p>
               <p>${margin > 0 ? `El nivel sigue <b>${dec(margin)} m sobre el umbral de alerta</b> (${dec(w.umbralNivel)} m).` : `<b>El nivel supera el umbral de alerta</b> (${dec(w.umbralNivel)} m).`}</p>`,
      resultTitle: `Nivel freático ${code}`,
      resultMeta: 'promedio mensual · comparación interanual',
      csv: { head: ['mes', 'nivel_m_bs', 'periodo'], rows: w.niveles.map((v, i) => [M[i].key, v.toFixed(2), i >= 12 ? 'actual' : 'anterior']) }
    };
  }

  // ======================================================================
  // c) Tabla: última concentración de litio por pozo en un sector
  // ======================================================================
  function buildLitio(sector) {
    const rows = W.filter((w) => w.sector === sector).map((w) => {
      const q = w.quimica, l = q[q.length - 1], p = q[q.length - 2];
      return { w, fecha: l.fecha, li: l.litio, prev: p.litio, delta: (l.litio - p.litio) / p.litio * 100, ce: l.conductividad };
    }).sort((a, b) => b.li - a.li);
    const hi = rows[0], lo = rows[rows.length - 1];
    const mean = Math.round(avg(rows.map((r) => r.li)));
    const big = rows.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
    return {
      kind: 'litio', output: 'Tabla', rows: rows.length, sector, data: rows,
      question: `¿Cuál es la última concentración de litio en cada pozo del sector ${sector}?`,
      short: `Última concentración de litio, sector ${sector}`,
      docs: ['DOC-002'],
      steps: [
        ['Interpretando petición', `Entidad: pozos sector ${sector} · métrica: último valor de litio`, 480,
          `Filtro por atributo sector = '${sector}'. Se usa la métrica verificada li_ultimo (última muestra válida por punto). Salida esperada: tabla.`],
        ['Consultando capa semántica', '2 vistas · 1 métrica · 1 relación', 360,
          'Vistas hidro.v_puntos_monitoreo y hidro.v_quimica, relación v_quimica.punto_id → v_puntos_monitoreo.id. Se aplicó la consulta verificada "Última concentración de litio por pozo en un sector".'],
        ['Revisando documentos', '1 informe relevante', 760,
          'Informe Trimestral Hidroquímico Q3-2026, capítulo 3 (resultados por sector): confirma laboratorio y método de análisis (ICP-OES).'],
        ['Ejecutando script', `${rows.length} filas · entorno aislado`, 1320,
          'Ejecutado en el contenedor sbx-05. El agente recibió solo el esquema del resultado y el conteo de filas.']
      ],
      sql: `SELECT codigo, tipo, fecha, litio_mg_l,
       litio_prev, conductividad
FROM (
  SELECT p.codigo, p.tipo, q.fecha,
         q.litio_mg_l, q.conductividad,
         LAG(q.litio_mg_l) OVER w AS litio_prev,
         ROW_NUMBER()      OVER (PARTITION BY p.id
                                 ORDER BY q.fecha DESC) AS rn
  FROM hidro.v_puntos_monitoreo p
  JOIN hidro.v_quimica q ON q.punto_id = p.id
  WHERE p.sector = '${sector}'
  WINDOW w AS (PARTITION BY p.id ORDER BY q.fecha)
) t
WHERE rn = 1
ORDER BY litio_mg_l DESC;`,
      script: `from sandbox import result, publish
df = result.df
df["var_pct"] = (df.litio_mg_l - df.litio_prev) \\
                / df.litio_prev * 100
publish.table(df,
  columns=["codigo","tipo","fecha","litio_mg_l",
           "var_pct","conductividad"],
  format={"litio_mg_l": "{:,.0f}",
          "var_pct": "{:+.1f} %"},
  bar="litio_mg_l")`,
      answer: `<p>Los <b>${rows.length} pozos del sector ${sector}</b> tienen muestra de litio en octubre 2026. La concentración más alta está en <b>${hi.w.codigo}</b> (${fmt(hi.li)} mg/L) y la más baja en <b>${lo.w.codigo}</b> (${fmt(lo.li)} mg/L); el promedio del sector es ${fmt(mean)} mg/L.</p>
               <p>La mayor variación respecto de la muestra anterior es la de <b>${big.w.codigo}</b> (${big.delta > 0 ? '+' : ''}${dec(big.delta, 1)} %). Ningún valor queda fuera del rango permitido por la capa semántica (0 – 5.000 mg/L).</p>`,
      resultTitle: `Última concentración de litio · sector ${sector}`,
      resultMeta: `${rows.length} pozos · muestra más reciente por punto`,
      csv: { head: ['codigo', 'tipo', 'fecha', 'litio_mg_l', 'var_pct', 'conductividad_ms_cm'], rows: rows.map((r) => [r.w.codigo, r.w.tipo, r.fecha, r.li, r.delta.toFixed(1), r.ce]) }
    };
  }

  // ======================================================================
  // d) Ficha 360 de un pozo
  // ======================================================================
  function buildFicha(code) {
    const w = wellByCode(code);
    const st = wellStats(w);
    const docs = MOCK.DOCUMENTS.filter((d) => d.pozos.includes(code));
    return {
      kind: 'ficha', output: 'Ficha', rows: 1, well: code, data: { w, st, docs },
      question: `Ficha del pozo ${code}`,
      short: `Ficha del pozo ${code}`,
      docs: docs.map((d) => d.id),
      steps: [
        ['Interpretando petición', `Entidad: ${code} · vista 360`, 380,
          `Se reconoció el código de pozo ${code} y la intención "ficha". Salida esperada: ficha 360 (atributos, KPIs, serie histórica, condiciones y documentos).`],
        ['Consultando capa semántica', '4 vistas · 3 métricas', 410,
          'Vistas hidro.v_puntos_monitoreo, hidro.v_niveles, hidro.v_quimica y hidro.v_condiciones. Métricas: nivel_mensual, li_prom_12m, so4_prom_12m.'],
        ['Revisando documentos', `${docs.length} informes citan ${code}`, 940,
          docs.length ? docs.map((d) => d.titulo).join(' · ') : 'Ningún documento indexado cita este pozo.'],
        ['Ejecutando script', '5 consultas · entorno aislado', 1450,
          'Ejecutado en el contenedor sbx-02. Se compusieron 5 consultas en paralelo; el agente recibió solo los esquemas.']
      ],
      sql: `-- 1) Atributos
SELECT codigo, sector, tipo, estado, cota_m,
       profundidad_m, fecha_habilitacion, geom
FROM hidro.v_puntos_monitoreo WHERE codigo = '${code}';
-- 2) Último nivel y serie
SELECT fecha, nivel_m_bs FROM hidro.v_niveles
WHERE punto_codigo = '${code}' ORDER BY fecha;
-- 3) Química reciente
SELECT fecha, litio_mg_l, sulfato_mg_l, conductividad
FROM hidro.v_quimica q
JOIN hidro.v_puntos_monitoreo p ON p.id = q.punto_id
WHERE p.codigo = '${code}' ORDER BY fecha DESC LIMIT 2;`,
      script: `from sandbox import results, publish
attrs, niveles, quimica, conds, citas = results
publish.card(
  title="${code}",
  attributes=attrs.iloc[0],
  kpis=[niveles.tail(1), quimica.head(1)],
  series=niveles, ref_line=conds.umbral_nivel,
  conditions=conds, documents=citas,
  layout="ficha_360")`,
      answer: `<p>Esta es la ficha 360 de <b>${code}</b> (${w.tipo.toLowerCase()}, sector ${w.sector}). Último nivel: <b>${dec(w.niveles[23])} m b.s.</b>; sulfato promedio 12 m: ${fmt(st.so4)} mg/L; litio promedio: ${fmt(st.li)} mg/L. ${docs.length} informes indexados lo citan.</p>`,
      resultTitle: `Ficha 360 · ${code}`,
      resultMeta: `${w.sector} · ${w.tipo}`,
      csv: { head: ['codigo', 'sector', 'tipo', 'lat', 'lon', 'nivel_m_bs', 'so4_prom', 'li_prom', 'ce_prom'], rows: [[code, w.sector, w.tipo, w.lat, w.lon, w.niveles[23], st.so4, st.li, st.ce]] }
    };
  }

  // ======================================================================
  // e) Pozos citados en el capítulo Topografía del informe N°1 con > 10 registros
  // ======================================================================
  function buildTopografia() {
    const doc = MOCK.DOCUMENTS.find((d) => d.id === 'DOC-001');
    const ch = doc.capitulos.find((c) => c.t === 'Topografía');
    const cited = ch.pozos.map(wellByCode);
    const ok = cited.filter((w) => w.registros > 10).sort((a, b) => b.registros - a.registros);
    const out = cited.filter((w) => w.registros <= 10);
    return {
      kind: 'topografia', output: 'Mapa', rows: ok.length, data: { doc, ch, ok, out },
      question: 'Pozos citados en el capítulo Topografía del informe N°1 con más de 10 registros',
      short: 'Pozos del cap. Topografía (informe N°1) con > 10 registros',
      docs: ['DOC-001'],
      steps: [
        ['Interpretando petición', 'Documento: informe N°1 · capítulo: Topografía · filtro: registros > 10', 560,
          'Se combinó una búsqueda documental (citas por capítulo) con un filtro cuantitativo sobre el número de registros de química por pozo. Salida esperada: mapa con referencia al documento.'],
        ['Consultando capa semántica', '3 vistas · 1 relación', 390,
          'Vistas hidro.v_documentos_citas, hidro.v_puntos_monitoreo y hidro.v_quimica. Relación v_documentos_citas.punto_codigo → v_puntos_monitoreo.codigo.'],
        ['Revisando documentos', `1 informe · ${ch.pozos.length} pozos citados`, 1240,
          `${doc.titulo}, capítulo ${ch.n} "${ch.t}" (pp. ${ch.p}). Se encontraron ${ch.pozos.length} códigos de pozo citados en el texto y en la tabla 2.3.`],
        ['Ejecutando script', `${ok.length} filas · entorno aislado`, 1690,
          `Ejecutado en el contenedor sbx-07. ${out.length} pozos citados quedaron fuera por tener 10 registros o menos.`]
      ],
      sql: `WITH citados AS (
  SELECT DISTINCT punto_codigo
  FROM hidro.v_documentos_citas
  WHERE documento_id = 'DOC-001'   -- Informe N°1
    AND capitulo = 'Topografía'
)
SELECT p.codigo, p.sector, p.tipo,
       COUNT(q.id) AS n_registros,
       MAX(q.fecha) AS ultimo_registro
FROM citados c
JOIN hidro.v_puntos_monitoreo p ON p.codigo = c.punto_codigo
LEFT JOIN hidro.v_quimica q ON q.punto_id = p.id
GROUP BY 1,2,3
HAVING COUNT(q.id) > 10
ORDER BY n_registros DESC;`,
      script: `from sandbox import result, docs, publish
cita = docs.get("DOC-001").chapter("Topografía")
publish.map(result.gdf(crs=32719),
  color_by="n_registros", cmap="aqua_to_red",
  basemap="satellite",
  popup=["codigo","sector","tipo","n_registros"])
publish.reference(cita, pages="${ch.p}",
  highlight=result.df.codigo.tolist())`,
      answer: `<p>El capítulo <b>${ch.n} "${ch.t}"</b> del <b>${esc(doc.titulo)}</b> cita ${ch.pozos.length} pozos. De ellos, <b>${ok.length} tienen más de 10 registros</b>; el que tiene más datos es ${ok[0].codigo} (${ok[0].registros} registros).</p>
               <p>Quedaron fuera ${out.map((w) => `${w.codigo} (${w.registros})`).join(', ')}. La referencia al documento está en el panel derecho.</p>`,
      resultTitle: 'Pozos citados en «Topografía» · informe N°1',
      resultMeta: `${ok.length} de ${ch.pozos.length} pozos con > 10 registros`,
      csv: { head: ['codigo', 'sector', 'tipo', 'n_registros', 'lat', 'lon'], rows: ok.map((w) => [w.codigo, w.sector, w.tipo, w.registros, w.lat, w.lon]) }
    };
  }

  // ---------- Catálogo y emparejamiento ----------
  const SUGGESTIONS = [
    { kind: 'mapa', tag: 'Mapa', text: 'Mostrar en un mapa los pozos a menos de 2 km del polígono X, con su promedio de sulfato del último año' },
    { kind: 'nivel', tag: 'Gráfico', text: 'Evolución del nivel del agua del pozo PZ-101 en los últimos 12 meses vs. el año anterior' },
    { kind: 'litio', tag: 'Tabla', text: '¿Cuál es la última concentración de litio en cada pozo del sector Norte?' },
    { kind: 'ficha', tag: 'Ficha 360', text: 'Ficha del pozo PZ-118' },
    { kind: 'topografia', tag: 'Mapa + documento', text: 'Pozos citados en el capítulo Topografía del informe N°1 con más de 10 registros' }
  ];

  function interpret(text) {
    const t = norm(text);
    const m = t.match(/pz\s*-?\s*(\d{3})/);
    const well = m && wellByCode('PZ-' + m[1]) ? 'PZ-' + m[1] : null;
    const has = (...k) => k.some((x) => t.includes(x));
    const sector = /\bsur\b/.test(t) ? 'Sur' : /\bnucleo\b/.test(t) ? 'Núcleo' : 'Norte';

    if (m && !well) return { unknownWell: 'PZ-' + m[1] };
    if (well && has('ficha', '360', 'detalle', 'resumen')) return buildFicha(well);
    if (has('topograf') || (has('informe', 'capitulo') && has('citad', 'registro', 'mencion'))) return buildTopografia();
    if (has('nivel', 'freatic', 'evolucion', 'interanual', 'profundidad')) return buildNivel(well || 'PZ-101');
    if (has('litio')) return buildLitio(sector);
    if (has('sulfato', 'poligono', 'mapa', '2 km', 'buffer', 'cerca')) return buildMapa();
    if (well) return buildFicha(well);
    return null;
  }

  const bySuggestion = (kind) => ({ mapa: buildMapa, nivel: () => buildNivel('PZ-101'), litio: () => buildLitio('Norte'), ficha: () => buildFicha('PZ-118'), topografia: buildTopografia }[kind]());

  window.Queries = { interpret, bySuggestion, SUGGESTIONS, docTitle, s1, wellStats };
})();
