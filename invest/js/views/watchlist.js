/* Watchlist tab: multiple lists, sorting, drag-to-reorder editing. */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const U = App.U;
  const UI = App.UI;
  const esc = U.esc;
  App.views = App.views || {};

  let editing = false;
  let sortMode = 'manual';

  function sorted(items) {
    if (sortMode === 'manual') return items;
    const D = App.D;
    const q = (id) => D.quote(id) || {};
    const arr = items.slice();
    if (sortMode === 'chg') arr.sort((a, b) => (q(b).chp ?? -Infinity) - (q(a).chp ?? -Infinity));
    if (sortMode === 'name') arr.sort((a, b) => ((D.asset(a) || {}).s || '').localeCompare((D.asset(b) || {}).s || ''));
    if (sortMode === 'cap') arr.sort((a, b) => (D.toUSD(q(b).mc, D.cur(D.asset(b) || {}, q(b))) || -1) - (D.toUSD(q(a).mc, D.cur(D.asset(a) || {}, q(a))) || -1));
    return arr;
  }

  App.views.watchlist = {
    title: 'Watchlist',
    render(el) {
      this.el = el;
      const S = App.S;
      const w = S.list();
      const mk = U.usMarket();
      el.innerHTML = `
        ${UI.header(w.name, {
          small: w.name,
          sub: `<button class="list-switch" data-act="lists">${esc(S.state.watchlists.length > 1 ? 'Switch list' : 'Lists')} ${U.icon('chevD')}</button><span class="mstatus"><i class="status-dot ${mk.open ? 'open' : ''}"></i> ${esc(mk.label)}</span>`,
          actions: `<button class="icon-btn" data-act="sort" aria-label="Sort">${U.icon('filter')}</button><button class="icon-btn ${editing ? 'on' : ''}" data-act="edit" aria-label="Edit">${U.icon(editing ? 'check' : 'edit')}</button><button class="icon-btn" data-act="add" aria-label="Add symbol">${U.icon('plus')}</button>`
        })}
        <div data-part="list"></div>
        <p class="footer-note">Tap a colored pill to switch between percent change, price change and market value. Crypto updates live; stocks refresh with each data run${App.S.settings.finnhubKey ? ' and live via Finnhub' : ' (add a free Finnhub key in Settings for real-time US stocks)'}.</p>`;
      this.drawList();
      el.onclick = (e) => this.onClick(e);
    },
    drawList() {
      const el = this.el;
      const w = App.S.list();
      const box = el.querySelector('[data-part="list"]');
      if (!w.items.length) {
        box.innerHTML = UI.empty('star', 'No symbols yet', 'Add stocks, crypto, ETFs, gold, currencies or NFTs to follow them here.', `<button class="btn primary" data-act="add">${U.icon('plus')} Add symbol</button>`);
        return;
      }
      if (editing) {
        box.innerHTML = `<div class="list" data-sortable>${w.items.map((id) => {
          const a = App.D.asset(id);
          return `<div class="edit-row" data-id="${esc(id)}"><button class="del" data-act="del" data-id="${esc(id)}" aria-label="Remove">${U.icon('trash')}</button><span class="r-main"><span class="r-sym">${esc(a ? a.s : id)}</span><span class="r-name">${esc(a ? a.n : '')}</span></span><span class="grip" aria-label="Drag to reorder">${U.icon('grip')}</span></div>`;
        }).join('')}</div><div class="btn-row"><button class="btn secondary" data-act="rename">Rename list</button>${App.S.state.watchlists.length > 1 ? '<button class="btn danger" data-act="dellist">Delete list</button>' : ''}</div>`;
        this.wireDrag(box.querySelector('[data-sortable]'));
        return;
      }
      box.innerHTML = `<div class="list">${sorted(w.items).map((id) => UI.row(id)).join('')}</div>`;
    },
    wireDrag(list) {
      let dragEl = null;
      let startY = 0;
      let from = 0;
      const rows = () => Array.from(list.querySelectorAll('.edit-row'));
      list.addEventListener('pointerdown', (e) => {
        const grip = e.target.closest('.grip');
        if (!grip) return;
        dragEl = grip.closest('.edit-row');
        from = rows().indexOf(dragEl);
        startY = e.clientY;
        dragEl.classList.add('dragging');
        dragEl.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      list.addEventListener('pointermove', (e) => {
        if (!dragEl) return;
        dragEl.style.transform = `translateY(${e.clientY - startY}px)`;
        const others = rows().filter((r) => r !== dragEl);
        const target = others.find((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
        if (target) list.insertBefore(dragEl, target); else list.appendChild(dragEl);
        startY = e.clientY;
        dragEl.style.transform = '';
      });
      const end = () => {
        if (!dragEl) return;
        const to = rows().indexOf(dragEl);
        dragEl.classList.remove('dragging');
        dragEl = null;
        if (to !== from) App.S.reorder(App.S.list().id, from, to);
      };
      list.addEventListener('pointerup', end);
      list.addEventListener('pointercancel', end);
    },
    async onClick(e) {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const S = App.S;
      const k = act.dataset.act;
      if (k === 'add') {
        UI.picker({ title: 'Add to ' + S.list().name, onPick: (id) => { if (!S.inList(id)) S.toggleWatch(id); UI.toast('Added ' + (App.D.asset(id) || {}).s, 'starFill'); this.drawList(); App.D.syncFinnhub(); } });
      } else if (k === 'edit') {
        editing = !editing;
        this.render(this.el);
      } else if (k === 'del') {
        S.toggleWatch(act.dataset.id);
        this.drawList();
      } else if (k === 'sort') {
        const opts = [['manual', 'Manual order'], ['chg', 'Biggest gainers first'], ['name', 'Symbol A–Z'], ['cap', 'Market value']];
        const s = UI.sheet({ title: 'Sort watchlist', body: `<div class="group">${opts.map(([v, l]) => `<button class="gitem" data-v="${v}"><span class="gi-main"><span class="gi-t">${esc(l)}</span></span>${sortMode === v ? U.icon('check') : ''}</button>`).join('')}</div>` });
        s.body.addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b) { sortMode = b.dataset.v; s.close(); this.drawList(); } });
      } else if (k === 'lists') {
        const s = UI.sheet({
          title: 'Watchlists',
          body: `<div class="group">${S.state.watchlists.map((w) => `<button class="gitem" data-id="${esc(w.id)}"><span class="gi-main"><span class="gi-t">${esc(w.name)}</span><span class="gi-s">${w.items.length} symbol${w.items.length === 1 ? '' : 's'}</span></span>${w.id === S.state.activeList ? U.icon('check') : ''}</button>`).join('')}</div><button class="btn secondary full mt" data-new>${U.icon('plus')} New list</button>`
        });
        s.body.addEventListener('click', async (ev) => {
          const b = ev.target.closest('[data-id]');
          if (b) { S.setActiveList(b.dataset.id); s.close(); this.render(this.el); return; }
          if (ev.target.closest('[data-new]')) {
            s.close();
            const r = await UI.prompt('New watchlist', [{ name: 'name', label: 'Name', placeholder: 'e.g. AI stocks', required: true }], 'Create');
            if (r && r.name) { S.addList(r.name.trim()); editing = false; this.render(this.el); }
          }
        });
      } else if (k === 'rename') {
        const r = await UI.prompt('Rename list', [{ name: 'name', label: 'Name', value: S.list().name, required: true }]);
        if (r && r.name) { S.renameList(S.list().id, r.name.trim()); this.render(this.el); }
      } else if (k === 'dellist') {
        if (await UI.confirm('Delete list?', `“${S.list().name}” will be removed. Symbols stay in your other lists.`, 'Delete', true)) { S.deleteList(S.list().id); editing = false; this.render(this.el); }
      }
    },
    refresh() { if (this.el && !editing) this.drawList(); }
  };
})();
