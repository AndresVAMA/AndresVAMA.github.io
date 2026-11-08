/* AI Way · comportamiento del sitio: tema, menú y gráficas plotly con carga diferida. Sin dependencias. */
(function () {
  'use strict';
  var raiz = document.documentElement;
  var base = document.body.getAttribute('data-raiz') || '';

  /* ---------- Tema claro / oscuro ---------- */
  var botonTema = document.getElementById('tema');
  function aplicarTema(t) {
    raiz.setAttribute('data-theme', t);
    if (botonTema) {
      botonTema.setAttribute('aria-pressed', String(t === 'dark'));
      botonTema.setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  aplicarTema(raiz.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (botonTema) {
    botonTema.addEventListener('click', function () {
      var t = raiz.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      aplicarTema(t);
      try { localStorage.setItem('aiway-tema', t); } catch (e) { /* almacenamiento no disponible */ }
    });
  }

  /* ---------- Menú en pantallas angostas ---------- */
  var botonMenu = document.getElementById('menu-btn');
  var nav = document.getElementById('nav');
  if (botonMenu && nav) {
    botonMenu.addEventListener('click', function () {
      var abierto = nav.classList.toggle('abierto');
      botonMenu.setAttribute('aria-expanded', String(abierto));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('abierto'); botonMenu.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('abierto')) {
        nav.classList.remove('abierto'); botonMenu.setAttribute('aria-expanded', 'false'); botonMenu.focus();
      }
    });
  }

  /* ---------- Gráficas plotly ---------- */
  var plots = document.querySelectorAll('.plot[data-fig]');
  if (!plots.length) return;
  var promesaPlotly = null;
  function cargarPlotly() {
    if (window.Plotly) return Promise.resolve();
    if (!promesaPlotly) {
      promesaPlotly = new Promise(function (ok, mal) {
        var s = document.createElement('script');
        s.src = base + 'assets/js/plotly.min.js';
        s.onload = ok; s.onerror = mal;
        document.head.appendChild(s);
      });
    }
    return promesaPlotly;
  }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function mezclar(a, b) {
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') mezclar(a[k], b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  function angosto(el) { return el.clientWidth < 640; }
  function adaptar(fig, el) {
    var L = copia(fig.layout || {});
    delete L.width; delete L.height;
    L.autosize = true;
    var m = L.margin || {};
    if (angosto(el)) {
      L.margin = { l: Math.min(m.l == null ? 60 : m.l, 56), r: Math.min(m.r == null ? 24 : m.r, 56), t: Math.min(m.t == null ? 40 : m.t, 80), b: Math.min(m.b == null ? 40 : m.b, 96), pad: 0 };
      L.font = mezclar(L.font || {}, { size: 11 });
      if (L.showlegend !== false) {
        L.legend = mezclar(L.legend || {}, { orientation: 'h', x: 0, xanchor: 'left', y: -0.14, yanchor: 'top', font: { size: 11 } });
      }
      if (L.sliders && L.sliders.length && L.showlegend !== false) {
        /* con deslizador: la leyenda va debajo del eje y el deslizador más abajo, para que no se encimen */
        L.sliders.forEach(function (s) { s.y = -0.34; s.yanchor = 'top'; });
        L.margin.b = 150;
      }
      L.dragmode = false;
      ['xaxis', 'yaxis', 'xaxis2', 'yaxis2', 'xaxis3', 'yaxis3'].forEach(function (k) { if (L[k]) L[k].automargin = true; });
      var mov = el.getAttribute('data-movil');
      if (mov) { try { mezclar(L, JSON.parse(mov)); } catch (e) { /* sin ajuste */ } }
    }
    return L;
  }
  /* barra de herramientas: solo al pasar el cursor en escritorio; oculta en pantallas angostas (estorba a 375 px) */
  function config(el) {
    return { responsive: true, displaylogo: false, scrollZoom: false, displayModeBar: angosto(el) ? false : 'hover',
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] };
  }

  function dibujar(el) {
    if (el.getAttribute('data-estado')) return;
    el.setAttribute('data-estado', 'cargando');
    Promise.all([cargarPlotly(), fetch(el.getAttribute('data-fig')).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })]).then(function (res) {
      var fig = res[1];
      var aviso = el.querySelector('.cargando');
      if (aviso) aviso.remove();
      var estrecho = angosto(el);
      return window.Plotly.newPlot(el, fig.data, adaptar(fig, el), config(el)).then(function () {
        if (fig.frames && fig.frames.length) window.Plotly.addFrames(el, fig.frames);
        el.setAttribute('data-estado', 'listo');
        if ('ResizeObserver' in window) {
          new ResizeObserver(function () {
            var ahora = angosto(el);
            if (ahora !== estrecho) { estrecho = ahora; window.Plotly.react(el, fig.data, adaptar(fig, el), config(el)); }
          }).observe(el);
        }
      });
    }).catch(function () {
      el.setAttribute('data-estado', 'error');
      var aviso = el.querySelector('.cargando');
      if (aviso) aviso.textContent = 'No se pudo cargar la gráfica interactiva. Recarga la página para intentarlo de nuevo.';
    });
  }
  /* Gancho de verificación (pruebas automáticas en pestañas en segundo plano, donde IntersectionObserver no dispara) */
  window.AIWay = { dibujarTodo: function () { plots.forEach(dibujar); } };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); dibujar(en.target); } });
    }, { rootMargin: '300px 0px' });
    plots.forEach(function (el) { io.observe(el); });
  } else {
    plots.forEach(dibujar);
  }
})();
