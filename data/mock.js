/*
 * Datos FICTICIOS para el prototipo "Agente de Datos Hidrogeológicos".
 * Ningún valor corresponde a mediciones reales. Coordenadas WGS84 inventadas
 * en el entorno del Salar de Atacama. Los valores se generan con una semilla
 * fija, por lo que son idénticos en cada carga.
 */
(function () {
  'use strict';

  // ---------- PRNG determinista ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20261113);
  const noise = (amp) => (rand() * 2 - 1) * amp;
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------- Referencia espacial ----------
  // Centro desplazado al salar abierto, al este de las pozas de evaporación (sin pozos sobre las piscinas)
  const CENTER = { lat: -23.546, lon: -68.2175 };
  const KM_LAT = 1 / 110.574;
  const KM_LON = 1 / (111.32 * Math.cos(CENTER.lat * Math.PI / 180));
  const toLatLon = (x, y) => [
    +(CENTER.lat + y * KM_LAT).toFixed(6),
    +(CENTER.lon + x * KM_LON).toFixed(6)
  ];

  // ---------- Meses ----------
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MONTHS = []; // nov 2024 → oct 2026 (24 meses)
  for (let i = 0; i < 24; i++) {
    const m = (10 + i) % 12, y = 2024 + Math.floor((10 + i) / 12);
    MONTHS.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, label: MES[m], year: y, m });
  }

  // ---------- Polígono X (vértices en km respecto al centro) ----------
  const POLY_KM = [[-1.8, 2.4], [1.2, 3.0], [2.4, 0.3], [1.5, -2.4], [-1.2, -3.0], [-2.55, -0.3]];
  const POLYGON_X = {
    nombre: 'Polígono X',
    descripcion: 'Zona de seguimiento hidroquímico definida en el Informe Trimestral Q3-2026 (ficticio).',
    km: POLY_KM,
    coords: POLY_KM.map(([x, y]) => toLatLon(x, y))
  };

  // ---------- Pozos ----------
  // [código, sector, tipo, xKm, yKm, sulfato, litio, conductividad, nivelBase, profundidad, cota, inicio, registros]
  const RAW = [
    ['PZ-101', 'Núcleo', 'Monitoreo', -0.30, 0.00, 2850, 1420, 212, 1.55, 60, 2301.4, '2014-03-12', 48],
    ['PZ-103', 'Norte', 'Monitoreo', -3.00, 7.00, 1390, 960, 176, 1.22, 45, 2303.8, '2016-05-04', 22],
    ['PZ-104', 'Núcleo', 'Monitoreo', 0.75, 1.20, 3320, 1510, 221, 1.68, 60, 2301.1, '2014-06-20', 41],
    ['PZ-106', 'Norte', 'Bombeo', 2.50, 8.00, 1720, 1090, 184, 2.05, 80, 2302.9, '2017-09-11', 18],
    ['PZ-107', 'Núcleo', 'Bombeo', 1.80, -1.80, 4180, 1880, 238, 2.32, 80, 2300.6, '2015-01-15', 36],
    ['PZ-109', 'Norte', 'Piezómetro', 5.50, 6.50, 1560, 1020, 181, 1.41, 30, 2304.2, '2019-02-27', 9],
    ['PZ-110', 'Norte', 'Monitoreo', -5.50, 5.00, 1280, 940, 172, 1.18, 45, 2304.9, '2016-11-08', 14],
    ['PZ-112', 'Norte', 'Monitoreo', -1.50, 3.60, 1310, 980, 178, 1.30, 50, 2302.5, '2015-04-02', 27],
    ['PZ-113', 'Norte', 'Piezómetro', 0.50, 11.00, 1190, 905, 169, 1.12, 30, 2306.1, '2020-08-19', 7],
    ['PZ-115', 'Norte', 'Monitoreo', 1.20, 4.35, 1650, 1040, 185, 1.37, 50, 2302.7, '2015-07-21', 31],
    ['PZ-116', 'Norte', 'Bombeo', 4.00, 12.00, 1840, 1110, 189, 2.18, 80, 2305.4, '2018-03-30', 12],
    ['PZ-118', 'Núcleo', 'Bombeo', 2.55, -3.30, 4620, 1960, 246, 2.41, 80, 2300.2, '2015-01-28', 39],
    ['PZ-119', 'Sur', 'Monitoreo', 3.50, -7.00, 2390, 1290, 201, 1.62, 55, 2299.4, '2017-06-14', 19],
    ['PZ-121', 'Núcleo', 'Monitoreo', 0.75, -3.90, 4050, 1830, 233, 1.74, 60, 2300.4, '2014-10-09', 44],
    ['PZ-122', 'Núcleo', 'Piezómetro', 7.00, -3.00, 3240, 1580, 219, 1.49, 35, 2300.9, '2019-10-02', 8],
    ['PZ-124', 'Sur', 'Monitoreo', -1.80, -4.50, 2210, 1250, 198, 1.58, 55, 2299.8, '2016-02-17', 26],
    ['PZ-125', 'Sur', 'Piezómetro', -4.00, -8.00, 1980, 1150, 192, 1.33, 30, 2298.9, '2020-01-23', 6],
    ['PZ-127', 'Sur', 'Monitoreo', 0.50, -9.50, 2460, 1310, 204, 1.66, 55, 2298.5, '2017-12-05', 17],
    ['PZ-129', 'Sur', 'Piezómetro', -3.30, -1.80, 1920, 1120, 190, 1.29, 30, 2300.7, '2018-05-16', 10],
    ['PZ-130', 'Sur', 'Bombeo', 5.00, -10.50, 2720, 1380, 209, 2.26, 80, 2298.1, '2018-09-07', 15],
    ['PZ-131', 'Sur', 'Monitoreo', -6.50, -6.00, 1870, 1100, 188, 1.44, 50, 2299.6, '2019-04-25', 10],
    ['PZ-133', 'Norte', 'Piezómetro', -2.85, 2.10, 1480, 1010, 180, 1.26, 30, 2302.0, '2018-07-12', 16],
    ['PZ-135', 'Núcleo', 'Monitoreo', -7.00, 0.50, 2640, 1360, 207, 1.59, 60, 2301.8, '2016-08-29', 21],
    ['PZ-136', 'Núcleo', 'Bombeo', -0.75, -1.35, 3010, 1640, 224, 2.28, 80, 2300.9, '2015-03-03', 34],
    ['PZ-138', 'Núcleo', 'Bombeo', 7.50, 2.00, 3480, 1690, 228, 2.36, 80, 2301.3, '2017-02-14', 20],
    ['PZ-140', 'Sur', 'Monitoreo', -0.45, -4.60, 2580, 1390, 205, 1.63, 55, 2299.9, '2016-04-26', 24],
    ['PZ-141', 'Núcleo', 'Piezómetro', -6.00, -3.00, 2290, 1260, 199, 1.38, 35, 2300.3, '2020-06-10', 5],
    ['PZ-142', 'Norte', 'Piezómetro', 3.30, 2.40, 2040, 1150, 193, 1.34, 30, 2302.3, '2018-10-30', 13],
    ['PZ-144', 'Núcleo', 'Monitoreo', 6.50, -6.00, 3570, 1720, 230, 1.70, 60, 2299.7, '2017-11-21', 23],
    ['PZ-145', 'Núcleo', 'Monitoreo', 3.60, -0.30, 3760, 1770, 231, 1.72, 60, 2301.0, '2016-01-19', 29]
  ];

  // Serie fija para PZ-101 (coherente con el mockup): nov 2024 → oct 2026
  const PZ101_LEVELS = [
    1.55, 1.57, 1.53, 1.50, 1.52, 1.55, 1.57, 1.59, 1.61, 1.62, 1.64, 1.65,
    1.66, 1.68, 1.64, 1.62, 1.65, 1.69, 1.72, 1.75, 1.77, 1.79, 1.81, 1.83
  ];

  function seriesAround(base, amp, count) {
    const raw = Array.from({ length: count }, () => base + noise(amp));
    const mean = raw.reduce((a, b) => a + b, 0) / count;
    return raw.map((v) => v * base / mean); // promedio exacto = base
  }

  const WELLS = RAW.map((r) => {
    const [codigo, sector, tipo, x, y, so4, li, ce, nivelBase, profundidad, cota, inicio, registros] = r;
    const [lat, lon] = toLatLon(x, y);

    // Nivel mensual (m bajo superficie), 24 meses: estacional + leve profundización el 2.º año
    let niveles;
    if (codigo === 'PZ-101') niveles = PZ101_LEVELS.slice();
    else {
      const trend = tipo === 'Bombeo' ? 0.22 : 0.10;
      niveles = MONTHS.map((mo, i) => r2(
        nivelBase + Math.sin((i + 1) / 12 * 2 * Math.PI) * 0.04 + (i >= 12 ? trend * (0.4 + (i - 12) / 18) : 0) + noise(0.025)
      ));
    }

    // Química: 12 muestras mensuales (nov 2025 → oct 2026) con promedio exacto
    const so4s = seriesAround(so4, so4 * 0.06, 12).map(Math.round);
    const lis = seriesAround(li, li * 0.04, 12).map(Math.round);
    const ces = seriesAround(ce, ce * 0.03, 12).map(Math.round);
    const quimica = MONTHS.slice(12).map((mo, i) => ({
      fecha: `${mo.key}-${String(8 + Math.floor(rand() * 18)).padStart(2, '0')}`,
      sulfato: so4s[i], litio: lis[i], conductividad: ces[i],
      // Calcio derivado del sulfato (sin consumir el generador aleatorio), con alza leve en 2026
      calcio: Math.round(so4s[i] * (0.095 + (so4 % 7) / 250) * (0.85 + 0.03 * i))
    }));

    // Serie histórica larga (para la ficha 360): desde el año de habilitación
    const startYear = +inicio.slice(0, 4), startMonth = +inicio.slice(5, 7) - 1;
    const histN = (2024 - startYear) * 12 + (10 - startMonth);
    const historico = [];
    let lv = nivelBase - 0.45 - rand() * 0.2;
    const step = (nivelBase - lv) / Math.max(histN, 1);
    for (let i = 0; i < histN; i++) {
      lv += step + noise(0.012);
      const m = (startMonth + i) % 12, yy = startYear + Math.floor((startMonth + i) / 12);
      historico.push({ key: `${yy}-${String(m + 1).padStart(2, '0')}`, v: r2(lv + Math.sin(i / 12 * 2 * Math.PI) * 0.035) });
    }
    MONTHS.forEach((mo, i) => historico.push({ key: mo.key, v: niveles[i] }));

    return {
      codigo, sector, tipo, lat, lon, xKm: x, yKm: y,
      estado: 'Activo', profundidad, cota, inicio, registros,
      umbralNivel: r2(nivelBase + (codigo === 'PZ-101' ? 0.55 : 0.5)),
      so4Prom: so4, liProm: li, ceProm: ce,
      niveles, quimica, historico
    };
  });

  // ---------- Documentos ficticios ----------
  const DOCUMENTS = [
    {
      id: 'DOC-001', titulo: 'Informe N°1 — Línea base hidrogeológica 2026', tipo: 'PDF', estado: 'Indexado',
      fecha: '2026-04-20', etiquetas: ['línea base', 'topografía', 'Núcleo'], autor: 'Consultora Hidro Andes (ficticia)', paginas: 86,
      resumen: 'Caracterización de línea base del sistema acuífero: topografía, geología, hidrogeología e hidroquímica de los puntos de monitoreo.',
      capitulos: [
        { n: '1', t: 'Introducción', p: '1–6', pozos: [] },
        { n: '2', t: 'Topografía', p: '7–24', pozos: ['PZ-101', 'PZ-104', 'PZ-109', 'PZ-110', 'PZ-112', 'PZ-113', 'PZ-115', 'PZ-116', 'PZ-129', 'PZ-133', 'PZ-136', 'PZ-142'],
          extracto: 'Las cotas de terreno de los puntos de monitoreo se levantaron con GNSS diferencial (campaña febrero 2026). La pendiente media del sector Norte hacia el núcleo es de 0,8 ‰, con un desnivel máximo de 6,2 m entre PZ-116 y PZ-136.' },
        { n: '3', t: 'Geología e hidrogeología', p: '25–48', pozos: ['PZ-107', 'PZ-118', 'PZ-121', 'PZ-145'] },
        { n: '4', t: 'Hidroquímica', p: '49–70', pozos: ['PZ-101', 'PZ-107', 'PZ-118', 'PZ-121', 'PZ-124'] },
        { n: '5', t: 'Conclusiones', p: '71–86', pozos: [] }
      ]
    },
    {
      id: 'DOC-002', titulo: 'Informe Trimestral Hidroquímico Q3-2026', tipo: 'PDF', estado: 'Indexado',
      fecha: '2026-10-15', etiquetas: ['hidroquímica', 'Núcleo'], autor: 'Gerencia de Hidrogeología', paginas: 54,
      resumen: 'Resultados de las campañas de muestreo jul–sep 2026. Define el Polígono X como zona de seguimiento por tendencia al alza de sulfato.',
      capitulos: [
        { n: '1', t: 'Resumen ejecutivo', p: '1–4', pozos: [] },
        { n: '2', t: 'Polígono X: zona de seguimiento', p: '5–18', pozos: ['PZ-101', 'PZ-104', 'PZ-107', 'PZ-118', 'PZ-121', 'PZ-136', 'PZ-145'],
          extracto: 'Se define el Polígono X como zona de seguimiento debido al incremento sostenido de sulfato en los pozos de bombeo del sector Núcleo.' },
        { n: '3', t: 'Resultados por sector', p: '19–46', pozos: ['PZ-112', 'PZ-115', 'PZ-124', 'PZ-140', 'PZ-142'] }
      ]
    },
    {
      id: 'DOC-003', titulo: 'Plan de Alerta Temprana rev. 4', tipo: 'PDF', estado: 'Indexado',
      fecha: '2026-08-01', etiquetas: ['RCA', 'umbrales'], autor: 'Gerencia de Medio Ambiente', paginas: 38,
      resumen: 'Umbrales de nivel y de calidad química por punto de control y protocolo de respuesta ante superaciones.',
      capitulos: [
        { n: '5', t: 'Umbrales de nivel', p: '9–15', pozos: ['PZ-101', 'PZ-104', 'PZ-118', 'PZ-121'],
          extracto: 'Para PZ-101 se establece un umbral de alerta de nivel de 2,10 m bajo superficie.' },
        { n: '6', t: 'Umbrales hidroquímicos', p: '16–22', pozos: ['PZ-107', 'PZ-118', 'PZ-121', 'PZ-145'],
          extracto: 'Revisión obligatoria si el sulfato supera 4.000 mg/L en dos campañas consecutivas.' }
      ]
    },
    {
      id: 'DOC-004', titulo: 'Campaña de niveles octubre 2026', tipo: 'PDF', estado: 'Indexado',
      fecha: '2026-11-03', etiquetas: ['niveles', 'Norte', 'Sur'], autor: 'Equipo de terreno', paginas: 22,
      resumen: 'Mediciones manuales y descarga de transductores de octubre 2026 en los tres sectores.',
      capitulos: [
        { n: '2', t: 'Mediciones sector Norte', p: '4–9', pozos: ['PZ-103', 'PZ-106', 'PZ-110', 'PZ-112', 'PZ-115', 'PZ-133'] },
        { n: '3', t: 'Mediciones sectores Núcleo y Sur', p: '10–18', pozos: ['PZ-101', 'PZ-124', 'PZ-127', 'PZ-140'] }
      ]
    },
    {
      id: 'DOC-005', titulo: 'Pruebas de bombeo PZ-107 y PZ-118', tipo: 'PDF', estado: 'Indexado',
      fecha: '2026-07-22', etiquetas: ['bombeo', 'Núcleo'], autor: 'Consultora Hidro Andes (ficticia)', paginas: 31,
      resumen: 'Pruebas de caudal constante de 72 h y estimación de transmisividad en el sector Núcleo.',
      capitulos: [
        { n: '3', t: 'Prueba de caudal constante', p: '8–20', pozos: ['PZ-107', 'PZ-118', 'PZ-121'],
          extracto: 'La transmisividad estimada para PZ-118 es de 420 m²/d, con un descenso máximo de 3,4 m a las 72 h.' }
      ]
    },
    {
      id: 'DOC-006', titulo: 'Modelo conceptual hidrogeológico 2026', tipo: 'Word', estado: 'Indexando 64%',
      fecha: '2026-11-08', etiquetas: ['modelo', 'acuífero'], autor: 'Gerencia de Hidrogeología', paginas: 112,
      resumen: 'Actualización del modelo conceptual. Indexación en curso.', capitulos: []
    },
    {
      id: 'DOC-007', titulo: 'Minuta reunión comité ambiental 09-2026', tipo: 'Word', estado: 'Error de lectura',
      fecha: '2026-09-30', etiquetas: ['comité'], autor: 'Secretaría comité', paginas: 4,
      resumen: 'El archivo no pudo procesarse (formato protegido).', capitulos: []
    }
  ];
  DOCUMENTS.forEach((d) => {
    const set = new Set();
    d.capitulos.forEach((c) => c.pozos.forEach((p) => set.add(p)));
    d.pozos = [...set];
    d.citas = d.capitulos.reduce((a, c) => a + c.pozos.length, 0) || null;
  });

  // ---------- Capa semántica (del mockup) ----------
  const SEMANTIC = {
    vistas: {
      cols: '1.1fr 1fr 0.7fr 2fr 1.1fr 0.6fr 1.2fr',
      head: ['Vista', 'Columna', 'Tipo', 'Descripción', 'Alias de negocio', 'Unidad', 'Valores permitidos'], mono: [0, 1, 2], edit: [3, 4, 5, 6],
      rows: [
        ['v_puntos_monitoreo', 'codigo', 'text', 'Código único del punto de monitoreo', 'Pozo', '—', 'PZ-###'],
        ['v_puntos_monitoreo', 'sector', 'text', 'Sector hidrogeológico del salar', 'Sector', '—', 'Norte, Sur, Núcleo'],
        ['v_puntos_monitoreo', 'tipo', 'text', 'Función del punto', 'Tipo de pozo', '—', 'Monitoreo, Bombeo, Piezómetro'],
        ['v_puntos_monitoreo', 'geom', 'geometry', 'Ubicación del punto', 'Ubicación', 'UTM 19S', '—'],
        ['v_quimica', 'litio_mg_l', 'numeric', 'Concentración de litio disuelto', 'Litio', 'mg/L', '0 – 5.000'],
        ['v_quimica', 'sulfato_mg_l', 'numeric', 'Concentración de sulfato', 'Sulfato', 'mg/L', '0 – 40.000'],
        ['v_quimica', 'calcio_mg_l', 'numeric', 'Concentración de calcio disuelto', 'Calcio', 'mg/L', '0 – 3.000'],
        ['v_quimica', 'conductividad', 'numeric', 'Conductividad eléctrica in situ', 'Conductividad', 'mS/cm', '0 – 300'],
        ['v_quimica', 'fecha', 'date', 'Fecha de toma de muestra', 'Fecha muestra', '—', '≥ 2010-01-01'],
        ['v_niveles', 'nivel_m_bs', 'numeric', 'Profundidad al nivel freático', 'Nivel', 'm b.s.', '0 – 80'],
        ['v_niveles', 'metodo', 'text', 'Método de medición', 'Método', '—', 'Manual, Transductor'],
        ['v_poligonos', 'nombre', 'text', 'Nombre de polígono de seguimiento', 'Polígono', '—', 'Catálogo (18)'],
        ['v_documentos_citas', 'capitulo', 'text', 'Capítulo del informe donde se cita el punto', 'Capítulo', '—', '—']
      ]
    },
    relaciones: {
      cols: '1.2fr 1fr 1.2fr 1fr 0.8fr 1.6fr',
      head: ['Vista origen', 'Columna', 'Vista destino', 'Columna', 'Cardinalidad', 'Notas'], mono: [0, 1, 2, 3], edit: [5],
      rows: [
        ['v_quimica', 'punto_id', 'v_puntos_monitoreo', 'id', 'N : 1', 'Una muestra pertenece a un punto'],
        ['v_niveles', 'punto_codigo', 'v_puntos_monitoreo', 'codigo', 'N : 1', 'Medición manual o transductor'],
        ['v_puntos_monitoreo', 'geom', 'v_poligonos', 'geom', 'espacial', 'ST_Intersects / ST_DWithin'],
        ['v_condiciones', 'punto_id', 'v_puntos_monitoreo', 'id', 'N : 1', 'Condiciones de RCA y plan de alerta'],
        ['v_documentos_citas', 'punto_codigo', 'v_puntos_monitoreo', 'codigo', 'N : 1', 'Generada por indexación de informes']
      ]
    },
    metricas: {
      cols: '1.1fr 2.2fr 0.7fr 1fr 1.4fr',
      head: ['Métrica', 'Fórmula', 'Unidad', 'Ventana de tiempo', 'Alias'], mono: [0, 1], edit: [2, 3, 4],
      rows: [
        ['so4_prom_12m', 'AVG(v_quimica.sulfato_mg_l)', 'mg/L', '12 meses móviles', 'Sulfato promedio'],
        ['li_prom_12m', 'AVG(v_quimica.litio_mg_l)', 'mg/L', '12 meses móviles', 'Litio promedio'],
        ['li_ultimo', 'LAST_VALUE(v_quimica.litio_mg_l) OVER (PARTITION BY punto)', 'mg/L', 'Última muestra', 'Última concentración de litio'],
        ['ca_prom', 'AVG(v_quimica.calcio_mg_l)', 'mg/L', 'Sin definir', 'Calcio promedio'],
        ['nivel_mensual', 'AVG(v_niveles.nivel_m_bs) GROUP BY mes', 'm b.s.', 'Mensual', 'Nivel del agua'],
        ['delta_nivel_ia', 'nivel_mensual(t) − nivel_mensual(t−12)', 'm', 'Interanual', 'Variación interanual'],
        ['ce_max_30d', 'MAX(v_quimica.conductividad)', 'mS/cm', '30 días', 'Conductividad máxima']
      ]
    },
    verificadas: {
      cols: '2.4fr 1fr 1fr 0.8fr 0.8fr',
      head: ['Pregunta', 'Verificada por', 'Fecha', 'Usos', 'Estado'], mono: [], edit: [],
      rows: [
        ['Pozos a menos de N km de un polígono con su sulfato promedio', 'M. Fuentes', '2026-10-02', '38', 'Vigente'],
        ['Nivel mensual de un pozo vs. mismo período año anterior', 'F. Zúñiga', '2026-09-18', '61', 'Vigente'],
        ['Última concentración de litio por pozo en un sector', 'M. Fuentes', '2026-08-27', '22', 'Vigente'],
        ['Pozos citados en un capítulo de informe con N registros', 'P. Soto', '2026-07-14', '11', 'Vigente'],
        ['Balance de extracción mensual por sector', 'J. Araya', '2026-06-10', '9', 'En revisión']
      ]
    }
  };

  // ---------- Auditoría inicial (del mockup) ----------
  const AUDIT = [
    ['A-0412', 'F. Zúñiga', '11-11-2026 09:42', 'Pozos a < 2 km del polígono X con sulfato promedio', 2, 'Éxito', 14, '4,4 s', 'mapa'],
    ['A-0409', 'M. Fuentes', '11-11-2026 09:15', 'Litio promedio por sector, último trimestre', 1, 'Éxito', 3, '2,9 s', 'litio'],
    ['A-0401', 'J. Araya', '11-11-2026 08:57', 'Extracción mensual por pozo de bombeo 2026', 0, 'Error', 0, '6,1 s', null],
    ['A-0398', 'F. Zúñiga', '10-11-2026 17:30', 'Nivel de PZ-101 vs. año anterior', 1, 'Éxito', 24, '3,2 s', 'nivel'],
    ['A-0390', 'P. Soto', '10-11-2026 16:04', 'Informes que mencionan PZ-121', 4, 'Éxito', 4, '1,8 s', null],
    ['A-0384', 'M. Fuentes', '10-11-2026 12:22', 'Conductividad máxima 30 días, sector Sur', 0, 'Éxito', 9, '2,2 s', null],
    ['A-0377', 'P. Soto', '10-11-2026 10:48', 'Datos personales de operadores de turno', 0, 'Error', 0, '0,7 s', null],
    ['A-0371', 'J. Araya', '09-11-2026 18:11', 'Pozos que superan el umbral de nivel', 1, 'Éxito', 4, '3,5 s', null]
  ].map(([id, usuario, fecha, peticion, docs, resultado, filas, tiempo, kind]) => ({ id, usuario, fecha, peticion, docs, resultado, filas, tiempo, kind }));

  const AUDIT_ERRORS = {
    'A-0401': { err: 'La vista "v_extraccion" no está autorizada en la capa semántica. El agente no generó SQL fuera de las vistas permitidas.', sql: '-- No ejecutado\n-- Vista solicitada: hidro.v_extraccion (no autorizada)', script: '-- No ejecutado' },
    'A-0377': { err: 'Petición bloqueada por política: solicita datos personales fuera del alcance de la capa semántica.', sql: '-- No ejecutado', script: '-- No ejecutado' }
  };

  window.MOCK = { CENTER, KM_LAT, KM_LON, MONTHS, POLYGON_X, WELLS, DOCUMENTS, SEMANTIC, AUDIT, AUDIT_ERRORS };
})();
