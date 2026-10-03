/* Highlights & notes for reading passages (like Bluebook's annotation tool).
   Select text to highlight it in a color, underline it, or attach a note.
   Tap an existing highlight to change or remove it. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h;
  const COLORS = ['yellow', 'blue', 'pink'];

  function wrapRange(range, cls, root) {
    const nodes = [];
    const walker = document.createTreeWalker(range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (range.intersectsNode(n) && n.nodeValue.trim() && root.contains(n) && !n.parentNode.closest('svg, .katex, mark.hl') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const id = U.uid();
    nodes.forEach((n) => {
      let start = 0, end = n.nodeValue.length;
      if (n === range.startContainer) start = range.startOffset;
      if (n === range.endContainer) end = range.endOffset;
      if (start >= end) return;
      let target = n;
      if (end < target.nodeValue.length) target.splitText(end);
      if (start > 0) target = target.splitText(start);
      const mark = document.createElement('mark');
      mark.className = 'hl ' + cls; mark.dataset.hid = id;
      target.parentNode.insertBefore(mark, target); mark.appendChild(target);
    });
    return id;
  }
  function marksOf(root, id) { return U.$$('mark.hl[data-hid="' + id + '"]', root); }
  function unwrap(m) { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); }

  function toolbar(root, anchorRect, opts, onChange) {
    const bar = h('div.hl-bar.card', { role: 'toolbar', 'aria-label': 'Highlight tools' });
    COLORS.forEach((c) => {
      const b = h('button.hl-sw.hl-' + c + (opts.current === c ? '.on' : ''), { title: 'Highlight ' + c, 'aria-label': 'Highlight ' + c });
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => { opts.apply('hl-' + c); close(); });
      bar.appendChild(b);
    });
    const u = h('button.icon-btn', { title: 'Underline', html: '<u style="font-weight:700">U</u>' });
    u.addEventListener('mousedown', (e) => e.preventDefault());
    u.addEventListener('click', () => { opts.apply('hl-underline'); close(); });
    const note = h('button.icon-btn', { title: 'Add note', html: U.icon('note') });
    note.addEventListener('mousedown', (e) => e.preventDefault());
    note.addEventListener('click', () => { const id = opts.apply(null, true); close(); editNote(root, id, onChange); });
    bar.appendChild(u); bar.appendChild(note);
    if (opts.remove) {
      const del = h('button.icon-btn', { title: 'Remove highlight', html: U.icon('trash') });
      del.addEventListener('click', () => { opts.remove(); close(); });
      bar.appendChild(del);
    }
    document.body.appendChild(bar);
    const bw = bar.offsetWidth;
    bar.style.left = U.clamp(anchorRect.left + anchorRect.width / 2 - bw / 2, 8, window.innerWidth - bw - 8) + 'px';
    bar.style.top = Math.max(8, anchorRect.top - bar.offsetHeight - 8) + 'px';
    const onDoc = (e) => { if (!bar.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    function close() { bar.remove(); document.removeEventListener('mousedown', onDoc); }
    return close;
  }

  function editNote(root, id, onChange) {
    const marks = marksOf(root, id);
    if (!marks.length) return;
    const cur = marks[0].dataset.note || '';
    const ta = h('textarea.input', { rows: 4, placeholder: 'Your note…' });
    ta.value = cur;
    U.modal({
      title: 'Note', body: h('div', h('p.muted.small', '“' + marks.map((m) => m.textContent).join('').slice(0, 140) + '”'), ta),
      actions: [
        { label: 'Delete note', value: 'del' },
        { label: 'Save', primary: true, value: 'save' },
      ],
    }).done.then((v) => {
      if (v === 'save') marks.forEach((m) => { m.dataset.note = ta.value; m.classList.toggle('has-note', !!ta.value.trim()); m.title = ta.value; });
      if (v === 'del') marks.forEach((m) => { delete m.dataset.note; m.classList.remove('has-note'); m.removeAttribute('title'); });
      onChange();
    });
  }

  function attach(root, onChange) {
    const change = () => onChange && onChange();
    const onUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer) || !String(sel).trim()) return;
        const rect = range.getBoundingClientRect();
        toolbar(root, rect, {
          apply: (cls, forNote) => {
            const id = wrapRange(range, cls || 'hl-yellow', root);
            sel.removeAllRanges(); change();
            return id;
          },
        }, change);
      }, 10);
    };
    root.addEventListener('mouseup', onUp);
    root.addEventListener('touchend', onUp);
    root.addEventListener('click', (e) => {
      const m = e.target.closest('mark.hl');
      if (!m || String(window.getSelection()).trim()) return;
      const id = m.dataset.hid, rect = m.getBoundingClientRect();
      const current = (m.className.match(/hl-(yellow|blue|pink)/) || [])[1];
      toolbar(root, rect, {
        current,
        apply: (cls, forNote) => { if (cls) marksOf(root, id).forEach((x) => { x.className = x.className.replace(/hl-(yellow|blue|pink|underline)/, cls); }); change(); return id; },
        remove: () => { marksOf(root, id).forEach(unwrap); change(); },
      }, change);
    });
  }

  SAT.annotate = { attach, notesIn: (root) => U.$$('mark.hl.has-note', root).map((m) => ({ text: m.textContent, note: m.dataset.note })) };
})();
