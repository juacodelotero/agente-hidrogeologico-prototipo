# Agente de Datos Hidrogeológicos · Prototipo visual

Prototipo web **estático e interactivo** para demostrar la experiencia del "Agente de Datos Hidrogeológicos".
No se conecta a ningún LLM ni API: todas las respuestas del agente son **simuladas** y usan **datos ficticios**.

> Prototipo visual con datos ficticios · SilocyData

## Qué incluye

| Pantalla | Qué se puede hacer |
|---|---|
| **Consulta** | Chat con historial y consultas guardadas. 6 consultas predefinidas (sugerencias e historial) y texto libre con reconocimiento por palabras clave. Pasos animados del agente (incluida la detección de ambigüedades), bloque «Interpretación aplicada», SQL y script Python por consulta, descarga CSV/GeoJSON/PNG. |
| **Fichas de pozo** | Listado filtrable de 30 pozos y ficha 360 (mapa satelital, KPIs, serie histórica, condiciones e informes que lo citan). |
| **Documentos** | Repositorio con buscador (título, contenido, capítulo o código de pozo) y panel de detalle. |
| **Capa semántica** | Pestañas Vistas, Relaciones, Métricas y Consultas verificadas. Celdas editables (borrador local). |
| **Auditoría** | Tabla con filtros y panel de detalle con las incertidumbres de interpretación. Cada consulta ejecutada en el chat agrega una fila. |

### Consultas que el agente "entiende"

1. *Mostrar en un mapa los pozos a menos de 2 km del polígono X, con su promedio de sulfato del último año* → mapa con polígono, buffer, popups y filtros.
2. *Evolución del nivel del agua del pozo PZ-101 en los últimos 12 meses vs. el año anterior* → gráfico de líneas (funciona con cualquier pozo PZ-101…PZ-145).
3. *¿Cuál es la última concentración de litio en cada pozo del sector Norte?* → tabla y texto (también "sector Sur" o "Núcleo").
4. *Ficha del pozo PZ-118* → abre la ficha 360 (también otros códigos).
5. *Pozos citados en el capítulo Topografía del informe N°1 con más de 10 registros* → mapa y referencia al documento.
6. *¿Cuál es el promedio de calcio del último año en los pozos del sector Núcleo?* → tabla con dos ambigüedades declaradas (unidad no indicada y "último año": 12 meses hasta la última muestra o año calendario), con ambas columnas.

Cada respuesta muestra un bloque **Interpretación aplicada**: las ambigüedades que el agente detectó y la alternativa que no aplicó, y lo que resolvió con reglas de la capa semántica. Ese registro queda también en la auditoría.

Si el texto no coincide, el agente muestra las consultas disponibles.

## Estructura

```
index.html            Shell de la app (layout, navegación)
assets/css/styles.css Estilos (paleta y tipografía del mockup)
assets/js/utils.js    Formato, colores, geometría (buffer, distancias, UTM)
assets/js/maps.js     Mapas Leaflet sobre Esri World Imagery
assets/js/queries.js  Consultas simuladas: pasos, SQL, scripts, respuestas
assets/js/consulta.js Chat y render de resultados
assets/js/screens.js  Fichas, Documentos, Capa semántica, Auditoría
assets/js/app.js      Router por hash (#/consulta, #/fichas/PZ-118, …)
data/mock.js          Datos ficticios (30 pozos, series, documentos)
```

Librerías por CDN con versión fija: Leaflet 1.9.4 y Chart.js 4.4.1 (cdnjs). Mapa base: Esri World Imagery (sin token, sin API keys).

## Correr localmente

Funciona abriendo `index.html` directamente en el navegador. Para una experiencia idéntica a GitHub Pages, sirve la carpeta con un servidor simple:

```bash
python -m http.server 8080
```

y abre <http://localhost:8080>. (Alternativa con Node: `npx serve .`)

Se necesita conexión a internet para las librerías CDN, las fuentes y las teselas satelitales.

## Publicar en GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`, que publica el sitio en cada push a `main`.
En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

El sitio incluye `<meta name="robots" content="noindex, nofollow">` para que no lo indexen los buscadores. Ten en cuenta que en un repositorio público el link sigue siendo accesible para quien lo tenga.
