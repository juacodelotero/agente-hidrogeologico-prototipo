/* Router por hash y arranque de la aplicación. */
(function () {
  'use strict';
  const { $, $$ } = U;
  const NAV = {
    consulta: ['Consulta', 'Agente conversacional'],
    fichas: ['Fichas de pozo', 'Vista 360 del punto de monitoreo'],
    documentos: ['Documentos', 'Repositorio de informes indexados'],
    semantica: ['Capa semántica', 'Administración de vistas y métricas autorizadas'],
    auditoria: ['Auditoría', 'Registro de interacciones con el agente']
  };
  let current = null;

  function route() {
    const parts = (location.hash || '#/consulta').replace(/^#\/?/, '').split('/');
    const screen = NAV[parts[0]] ? parts[0] : 'consulta';
    const arg = parts[1] ? decodeURIComponent(parts[1]) : null;

    if (current === 'fichas' && screen !== 'fichas') Screens.leaveFichas();
    $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== 'screen-' + screen));
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.screen === screen));
    const [title, sub] = NAV[screen];
    $('#pageTitle').textContent = screen === 'fichas' && arg ? `Ficha de pozo · ${arg}` : title;
    $('#pageSub').textContent = sub;
    document.title = `${title} · Agente de Datos Hidrogeológicos`;
    document.body.classList.remove('nav-open', 'side-open');

    if (screen === 'consulta') Consulta.onShow();
    else Screens[screen](arg);
    current = screen;
  }

  $('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); document.body.classList.toggle('nav-open'); });
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('nav-open') && !e.target.closest('#nav')) document.body.classList.remove('nav-open');
  });

  window.addEventListener('hashchange', route);
  Consulta.init();
  route();
})();
