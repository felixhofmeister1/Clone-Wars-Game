/* Dictionary & vocabulary: built-in SAT word list with definitions and
   examples, online lookup (Free Dictionary API) for any other word,
   double-click lookup inside passages, saved words, and flashcards. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;

  const words = () => SAT.vocab || [];
  const find = (w) => words().find((x) => x[0].toLowerCase() === String(w).toLowerCase());
  const saved = () => SAT.store.get('vocab.saved', []);
  const known = () => new Set(SAT.store.get('vocab.known', []));
  function toggleSave(word) {
    const s = saved(), i = s.indexOf(word);
    if (i >= 0) s.splice(i, 1); else s.unshift(word);
    SAT.store.set('vocab.saved', s);
    return i < 0;
  }
  /* Simple stemming so "exacerbated" finds "exacerbate". */
  function lookupLocal(w) {
    w = String(w).toLowerCase().replace(/[^a-z-]/g, '');
    if (!w) return null;
    const tries = [w, w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ed$/, ''), w.replace(/d$/, ''), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ly$/, ''), w.replace(/ies$/, 'y'), w.replace(/ied$/, 'y')];
    for (const t of tries) { const f = find(t); if (f) return f; }
    return null;
  }
  const cache = {};
  async function lookupOnline(w) {
    w = String(w).toLowerCase().trim();
    if (cache[w]) return cache[w];
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 6000);
    try {
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), ctrl ? { signal: ctrl.signal } : {});
      if (!r.ok) return (cache[w] = { none: true });
      const data = await r.json();
      const e = data[0];
      const out = { word: e.word, phonetic: e.phonetic || (e.phonetics.find((p) => p.text) || {}).text || '', audio: (e.phonetics.find((p) => p.audio) || {}).audio || '', meanings: [] };
      data.forEach((d) => d.meanings.forEach((m) => out.meanings.push({ pos: m.partOfSpeech, defs: m.definitions.slice(0, 3).map((x) => ({ d: x.definition, ex: x.example })), syn: (m.synonyms || []).slice(0, 6) })));
      return (cache[w] = out);
    } catch (e) { return { offline: true }; }
    finally { clearTimeout(timer); }
  }

  function localCard(entry) {
    const [w, pos, def, ex, syn] = entry;
    const star = h('button.icon-btn.star' + (saved().includes(w) ? '.on' : ''), { title: 'Save word', 'aria-label': 'Save ' + w, html: U.icon('star') });
    star.addEventListener('click', () => star.classList.toggle('on', toggleSave(w)));
    return h('div.dict-card', h('div.dict-head', h('h3', w), h('span.pos', pos), h('span.spacer'), speakBtn(w), star),
      h('p.def', def), ex ? h('p.ex', { html: '“' + U.esc(ex) + '”' }) : null, syn ? h('p.syn', { html: '<b>Similar:</b> ' + U.esc(syn) }) : null);
  }
  function speakBtn(w) {
    const b = h('button.icon-btn', { title: 'Pronounce', 'aria-label': 'Pronounce ' + w, html: U.icon('volume') });
    b.addEventListener('click', () => { try { const u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* unsupported */ } });
    return window.speechSynthesis ? b : null;
  }
  function onlineCard(res, w) {
    if (res.offline) return h('p.muted', 'Couldn’t reach the online dictionary. Check your connection; the built-in SAT word list still works offline.');
    if (res.none) return h('p.muted', 'No definition found for “' + w + '”.');
    const star = h('button.icon-btn.star' + (saved().includes(res.word) ? '.on' : ''), { title: 'Save word', html: U.icon('star') });
    star.addEventListener('click', () => star.classList.toggle('on', toggleSave(res.word)));
    const card = h('div.dict-card', h('div.dict-head', h('h3', res.word), h('span.pos', res.phonetic || ''), h('span.spacer'), speakBtn(res.word), star));
    res.meanings.slice(0, 4).forEach((m) => {
      card.appendChild(h('p.pos-line', h('span.pos', m.pos)));
      const ol = h('ol.defs');
      m.defs.forEach((d) => ol.appendChild(h('li', d.d, d.ex ? h('div.ex', '“' + d.ex + '”') : null)));
      card.appendChild(ol);
      if (m.syn.length) card.appendChild(h('p.syn', { html: '<b>Synonyms:</b> ' + U.esc(m.syn.join(', ')) }));
    });
    card.appendChild(h('p.muted.small', 'Source: Free Dictionary API (dictionaryapi.dev)'));
    return card;
  }

  async function renderLookup(host, w) {
    host.innerHTML = '';
    if (!w) { host.appendChild(h('p.muted', 'Type a word, or double-click any word in a passage to look it up.')); return; }
    const local = lookupLocal(w);
    if (local) host.appendChild(localCard(local));
    const matches = words().filter((x) => x[0].startsWith(w.toLowerCase()) && x !== local).slice(0, 6);
    if (matches.length) host.appendChild(h('div.dict-sugg', h('span.muted.small', 'SAT words: '), ...matches.map((m) => { const b = h('button.chip-btn', { text: m[0] }); b.addEventListener('click', () => host.dispatchEvent(new CustomEvent('pick', { detail: m[0] }))); return b; })));
    if (!local) {
      const wait = h('p.muted', 'Looking up “' + w + '” online…');
      host.appendChild(wait);
      const res = await lookupOnline(w);
      wait.replaceWith(onlineCard(res, w));
    }
  }

  function buildDict(body, api) {
    const tabs = ['Look up', 'Word list', 'Flashcards', 'Saved'];
    let tab = 0;
    const tabBar = h('div.tabs');
    const host = h('div.dict-host');
    body.appendChild(tabBar); body.appendChild(host);
    const btns = tabs.map((t, i) => { const b = h('button.tab', { text: t }); b.addEventListener('click', () => show(i)); tabBar.appendChild(b); return b; });
    let lookupInput = null;
    function show(i, arg) {
      tab = i; btns.forEach((b, k) => b.classList.toggle('on', k === i));
      host.innerHTML = '';
      if (i === 0) {
        lookupInput = h('input.input', { type: 'search', placeholder: 'Look up a word…', value: arg || '', 'aria-label': 'Word to look up' });
        const out = h('div.dict-out');
        const go = U.debounce(() => renderLookup(out, lookupInput.value.trim()), 350);
        lookupInput.addEventListener('input', go);
        out.addEventListener('pick', (e) => { lookupInput.value = e.detail; renderLookup(out, e.detail); });
        host.appendChild(h('div.search-row', h('span.search-ic', { html: U.icon('search') }), lookupInput));
        host.appendChild(out);
        renderLookup(out, arg || '');
        setTimeout(() => lookupInput.focus(), 30);
      } else if (i === 1) {
        const q = h('input.input', { type: 'search', placeholder: 'Filter ' + words().length + ' SAT words…' });
        const list = h('div.word-list');
        const fill = () => {
          const f = q.value.toLowerCase().trim();
          list.innerHTML = '';
          words().filter((x) => !f || x[0].includes(f) || x[2].toLowerCase().includes(f)).slice(0, 400).forEach((x) => {
            const d = h('details.word-item', h('summary', h('b', x[0]), ' ', h('span.pos', x[1]), ' — ', h('span.muted', x[2])), localCard(x));
            list.appendChild(d);
          });
        };
        q.addEventListener('input', U.debounce(fill, 150));
        host.appendChild(q); host.appendChild(list); fill();
      } else if (i === 2) {
        flashcards(host);
      } else {
        const s = saved();
        if (!s.length) host.appendChild(h('p.muted', 'Tap the star on any word to save it here.'));
        s.forEach((w) => { const l = lookupLocal(w); if (l) host.appendChild(localCard(l)); else { const d = h('div'); host.appendChild(d); lookupOnline(w).then((res) => d.replaceWith(onlineCard(res, w))); } });
      }
    }
    api.onArg = (w) => show(0, w);
    show(0);
  }

  function flashcards(host) {
    const onlySaved = h('input', { type: 'checkbox' });
    const k = known();
    const pool = () => (onlySaved.checked ? words().filter((x) => saved().includes(x[0])) : words()).filter((x) => !known().has(x[0]));
    let deck = U.random.shuffle(pool()), idx = 0, flipped = false;
    const card = h('button.flashcard', { type: 'button', 'aria-live': 'polite' });
    const count = h('span.muted.small');
    const knowBtn = h('button.btn.btn-primary', { html: U.icon('check') + ' I know it' });
    const learnBtn = h('button.btn', { html: U.icon('refresh') + ' Still learning' });
    const reset = h('button.btn.btn-ghost.btn-sm', { text: 'Reset progress' });
    function paint() {
      const total = (onlySaved.checked ? words().filter((x) => saved().includes(x[0])) : words()).length;
      count.textContent = 'Known: ' + (total - pool().length) + ' / ' + total;
      if (!deck.length) { card.innerHTML = '<div class="fc-front">🎉 You know every word in this deck!</div>'; return; }
      const x = deck[idx % deck.length];
      card.classList.toggle('flipped', flipped);
      card.innerHTML = flipped ? '<div class="fc-back"><div class="pos">' + U.esc(x[1]) + '</div><p>' + U.esc(x[2]) + '</p>' + (x[3] ? '<p class="ex">“' + U.esc(x[3]) + '”</p>' : '') + '</div>'
        : '<div class="fc-front"><div class="fc-word">' + U.esc(x[0]) + '</div><div class="muted small">Tap to flip</div></div>';
    }
    card.addEventListener('click', () => { flipped = !flipped; paint(); });
    knowBtn.addEventListener('click', () => {
      if (!deck.length) return;
      const x = deck.splice(idx % deck.length, 1)[0]; k.add(x[0]); SAT.store.set('vocab.known', Array.from(k));
      flipped = false; paint();
    });
    learnBtn.addEventListener('click', () => { idx++; flipped = false; paint(); });
    reset.addEventListener('click', () => { SAT.store.set('vocab.known', []); k.clear(); deck = U.random.shuffle(pool()); idx = 0; paint(); });
    onlySaved.addEventListener('change', () => { deck = U.random.shuffle(pool()); idx = 0; flipped = false; paint(); });
    host.appendChild(h('div.fc-top', h('label.small', onlySaved, ' Saved words only'), h('span.spacer'), count));
    host.appendChild(card);
    host.appendChild(h('div.fc-actions', learnBtn, knowBtn));
    host.appendChild(h('div.center', reset));
    paint();
  }

  SAT.tools.dict = { title: 'Dictionary & Vocabulary', icon: 'dict', w: 440, h: 560, build: buildDict };

  /* Double-click a word in a passage or question to see its meaning. */
  function attachLookup(root) {
    if (root.__dict) return; root.__dict = true;
    root.addEventListener('dblclick', (e) => {
      if (!(SAT.settings && SAT.settings.get('dblLookup') !== false)) return;
      if (!e.target.closest('.reading')) return;
      const sel = window.getSelection(), w = String(sel).trim();
      if (!w || /\s/.test(w) || w.length > 30) return;
      const rect = sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
      const anchor = h('span', { style: { position: 'fixed', left: (rect ? rect.left : e.clientX) + 'px', top: (rect ? rect.top : e.clientY) + 'px', width: (rect ? rect.width : 1) + 'px', height: (rect ? rect.height : 1) + 'px' } });
      document.body.appendChild(anchor);
      const box = h('div.dict-pop');
      const more = h('button.btn.btn-sm', { text: 'Open in dictionary' });
      more.addEventListener('click', () => { U.closePopover(); SAT.openTool('dict', w.replace(/[^a-z-]/gi, '')); });
      U.popover(anchor, box, { onClose: () => anchor.remove() });
      renderLookup(box, w.replace(/[^a-z-]/gi, '')).then(() => { box.appendChild(more); });
    });
  }
  SAT.dict = { attachLookup, lookupLocal, lookupOnline, wordOfDay() { const ws = words(); if (!ws.length) return null; return ws[U.hash(U.today()) % ws.length]; } };
})();
