/* Boot: load the question bank, apply the saved style, wire up routes,
   the navigation bar, and the quick style switcher. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h, V = SAT.views, R = SAT.router;

  SAT.bank.load();
  SAT.themes.apply(SAT.settings.get('theme'), { preview: true });
  U.hydrateIcons(document);

  R.on('/home', V.home);
  R.on('/tests', V.tests);
  R.on('/test/run', () => SAT.runner.mount(U.$('#view')), { immersive: true });
  R.on('/results/:id', V.results);
  R.on('/review/:id/:m/:q', V.review);
  R.on('/practice', V.practice);
  R.on('/practice/run', () => { U.$('#view').innerHTML = ''; SAT.practice.mount(U.$('#view')); }, { focus: true });
  R.on('/learn', V.learn);
  R.on('/learn/:skill', V.lesson);
  R.on('/tools', V.tools);
  R.on('/progress', V.progress);
  R.on('/settings', V.settings);

  SAT.bus.on('route', (r) => {
    const top = r.path.split('/')[1] || 'home';
    const map = { test: 'tests', results: 'tests', review: 'tests' };
    U.$$('#mainnav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === (map[top] || top)));
    document.body.classList.toggle('focus-mode', !!r.opts.focus);
    U.closePopover();
  });

  /* Quick style switcher in the header. */
  U.$('#theme-quick').addEventListener('click', (e) => {
    const cur = SAT.settings.get('theme');
    const box = h('div.theme-quick');
    box.appendChild(h('p.eyebrow', 'Style'));
    SAT.themes.list.forEach((t) => {
      const b = h('button.tq-item' + (t.id === cur ? '.on' : ''), { type: 'button' }, h('span.tq-sw', ...t.sw.slice(0, 3).map((c) => h('i', { style: { background: c } }))), h('span', t.name));
      b.addEventListener('click', () => { SAT.themes.apply(t.id); U.$$('.tq-item', box).forEach((x) => x.classList.toggle('on', x === b)); });
      box.appendChild(b);
    });
    box.appendChild(h('a.link.small', { href: '#/settings' }, 'All settings →'));
    U.popover(e.currentTarget, box, { cls: 'tq-pop' });
  });

  /* Keep charts and figures legible when the theme changes mid-page. */
  SAT.bus.on('settings', (s) => { if (s.k === 'theme' && R.current && R.current.path === '/home') V.home(); });

  R.start();
})();
