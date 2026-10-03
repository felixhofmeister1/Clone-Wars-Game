/* Question view: renders any question (R&W passage + choices, math MC or
   grid-in) with Bluebook-style controls: mark for review, answer
   eliminator, split panes, answer preview, and explanations. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util, h = U.h, F = SAT.fig;

  const blanks = (s) => String(s || '').replace(/_{4,}/g, '<span class="blank" aria-label="blank"></span>');

  function passageHTML(q) {
    let out = '';
    if (q.intro) out += '<p class="intro">' + q.intro + '</p>';
    if (q.p1) out += '<div class="xtext"><h4>Text 1</h4><p>' + blanks(q.p1) + '</p><h4>Text 2</h4><p>' + blanks(q.p2) + '</p></div>';
    if (q.table) out += F.table(q.table);
    if (q.graph) out += '<div class="graph-wrap">' + (q.graph.type === 'line' ? F.lines(q.graph) : F.bars(q.graph)) + '</div>';
    if (q.notes) out += '<p>While researching a topic, a student has taken the following notes:</p><ul class="notes">' + q.notes.map((n) => '<li>' + n + '</li>').join('') + '</ul>';
    if (q.passage) out += q.poem ? '<p class="poem">' + blanks(q.passage) + '</p>' : q.passage.split(/\n\n/).map((p) => '<p>' + blanks(p) + '</p>').join('');
    return out;
  }

  const SPR_DIRECTIONS = '<h3>Student-produced response directions</h3><ul class="spr-dir">' +
    '<li>If you find <b>more than one correct answer</b>, enter only one answer.</li>' +
    '<li>You can enter up to 5 characters for a <b>positive</b> answer and up to 6 characters (including the negative sign) for a <b>negative</b> answer.</li>' +
    '<li>If your answer is a <b>fraction</b> that doesn’t fit in the provided space, enter the decimal equivalent.</li>' +
    '<li>If your answer is a <b>decimal</b> that doesn’t fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>' +
    '<li>If your answer is a <b>mixed number</b> (such as 3½), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>' +
    '<li>Don’t enter <b>symbols</b> such as a percent sign, comma, or dollar sign.</li></ul>' +
    '<table class="spr-ex"><thead><tr><th>Answer</th><th>Acceptable ways to enter answer</th><th>Unacceptable</th></tr></thead><tbody>' +
    '<tr><td>3.5</td><td>3.5<br>3.50<br>7/2</td><td>31/2<br>3 1/2</td></tr>' +
    '<tr><td>2/3</td><td>2/3<br>.6666<br>.6667<br>0.666<br>0.667</td><td>0.66<br>.66<br>0.67<br>.67</td></tr>' +
    '<tr><td>−1/3</td><td>−1/3<br>−.3333<br>−0.333</td><td>−.33<br>−0.33</td></tr></tbody></table>';

  function sprPreview(val) {
    const p = SAT.mathgen.parseSpr(val);
    if (!val) return '';
    if (!p) return '<span class="bad-input">Not a valid entry</span>';
    if (p.frac) { const [a, b] = val.replace('-', '').split('/'); return U.tex((val[0] === '-' ? '-' : '') + '\\frac{' + a + '}{' + b + '}'); }
    return U.tex(val);
  }

  function correctAnswerText(q) {
    if (q.type === 'spr') return q.answerShow || String(q.answer);
    return U.letter(q.answer);
  }

  function explanationHTML(q, userAns) {
    const correct = SAT.tests.isCorrect(q, userAns);
    const answered = userAns != null && userAns !== '';
    let html = '<div class="exp-head ' + (correct ? 'ok' : answered ? 'bad' : 'skip') + '">' +
      U.icon(correct ? 'check' : answered ? 'x' : 'info') +
      '<span>' + (correct ? 'Correct!' : answered ? 'Not quite.' : 'Not answered.') + '</span>' +
      '<span class="exp-ans">Correct answer: <b>' + U.esc(correctAnswerText(q)) + '</b>' +
      (answered ? ' · Your answer: <b>' + U.esc(q.type === 'spr' ? userAns : U.letter(userAns)) + '</b>' : '') + '</span></div>';
    if (q.section === 'rw') {
      html += '<p><b>Choice ' + U.letter(q.answer) + ' is the best answer.</b> ' + q.explanation + '</p>';
      const wrongs = q.choices.map((_, i) => (i !== q.answer && q.why[i] ? '<li><b>Choice ' + U.letter(i) + '</b> is incorrect. ' + q.why[i] + '</li>' : '')).join('');
      if (wrongs) html += '<ul class="why-wrong">' + wrongs + '</ul>';
    } else {
      html += (q.type === 'mc' ? '<p><b>Choice ' + U.letter(q.answer) + ' is correct.</b></p>' : '') + q.explanation;
    }
    const sk = SAT.skills.byId[q.skill];
    if (sk) html += '<p class="exp-skill">' + U.icon('bulb') + ' Skill: <a href="#/learn/' + sk.id + '">' + sk.name + '</a> · ' + SAT.skills.diffs[q.diff] + '</p>';
    return html;
  }

  /* render(container, q, opts) -> controller
     opts: { number, mode: 'test'|'practice'|'review', state: {answer, flag, elim:[], hl},
             onChange(state), eliminator: bool, reveal: bool, userAnswer } */
  function render(container, q, opts) {
    opts = opts || {};
    const st = Object.assign({ answer: null, flag: false, elim: [] }, opts.state || {});
    const isMath = q.section === 'math';
    const split = !isMath || q.type === 'spr';
    container.innerHTML = '';
    const root = h('div.qv' + (split ? '.qv-split' : '.qv-single') + (isMath ? '.qv-math' : '.qv-rw'));
    let left = null, passageEl = null;

    if (split) {
      left = h('section.qv-pane.qv-left', h('div.qv-scroll'));
      if (isMath) left.firstChild.innerHTML = '<div class="spr-directions">' + SPR_DIRECTIONS + '</div>';
      else {
        passageEl = h('div.passage.reading', { html: st.hl || passageHTML(q) });
        left.firstChild.appendChild(passageEl);
      }
      root.appendChild(left);
      const divider = h('div.qv-divider', { role: 'separator', 'aria-orientation': 'vertical', title: 'Drag to resize' }, h('span'));
      root.appendChild(divider);
      dragDivider(divider, root);
    }

    const right = h('section.qv-pane.qv-right');
    const scroll = h('div.qv-scroll');
    right.appendChild(scroll);
    root.appendChild(right);

    /* header bar */
    const flagBtn = h('button.flag-btn' + (st.flag ? '.on' : ''), { type: 'button', 'aria-pressed': String(!!st.flag), html: U.icon('flag') + '<span>' + (st.flag ? 'Marked for Review' : 'Mark for Review') + '</span>' });
    const abcBtn = h('button.abc-btn' + (opts.eliminator ? '.on' : ''), { type: 'button', title: 'Answer eliminator', 'aria-pressed': String(!!opts.eliminator), html: '<s>ABC</s>' });
    const bar = h('div.qv-bar', h('span.qnum', String(opts.number || '')), opts.mode === 'review' ? null : flagBtn, h('span.spacer'),
      q.type === 'mc' && opts.mode !== 'review' ? abcBtn : null);
    scroll.appendChild(bar);
    flagBtn.addEventListener('click', () => {
      st.flag = !st.flag;
      flagBtn.classList.toggle('on', st.flag);
      flagBtn.setAttribute('aria-pressed', String(st.flag));
      flagBtn.querySelector('span').textContent = st.flag ? 'Marked for Review' : 'Mark for Review';
      emit();
    });

    /* stem + figure */
    const stem = h('div.qv-stem.reading');
    if (isMath && q.figure) stem.appendChild(h('div.figure-wrap', { html: q.figure }));
    stem.appendChild(h('div', { html: blanks(q.stem) }));
    scroll.appendChild(stem);

    /* answer area */
    let choiceRows = [], sprInput = null;
    if (q.type === 'mc') {
      const list = h('div.choices' + (opts.eliminator ? '.elim-on' : ''), { role: 'radiogroup', 'aria-label': 'Answer choices' });
      q.choices.forEach((c, i) => {
        const btn = h('button.choice', { type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { i: String(i) } },
          h('span.choice-letter', U.letter(i)), h('span.choice-text', { html: c }));
        const strike = h('button.strike-btn', { type: 'button', title: 'Eliminate choice ' + U.letter(i), 'aria-label': 'Eliminate choice ' + U.letter(i), html: '<s>' + U.letter(i) + '</s>' });
        const row = h('div.choice-row', btn, strike);
        btn.addEventListener('click', () => {
          if (opts.reveal || opts.mode === 'review' || opts.locked) return;
          st.answer = i;
          st.elim = (st.elim || []).filter((x) => x !== i);
          paint(); emit();
        });
        strike.addEventListener('click', () => {
          const set = new Set(st.elim || []);
          if (set.has(i)) set.delete(i); else { set.add(i); if (st.answer === i) st.answer = null; }
          st.elim = Array.from(set); paint(); emit();
        });
        list.appendChild(row); choiceRows.push(row);
      });
      scroll.appendChild(list);
      abcBtn.addEventListener('click', () => {
        opts.eliminator = !opts.eliminator;
        abcBtn.classList.toggle('on', opts.eliminator);
        list.classList.toggle('elim-on', opts.eliminator);
        if (opts.onEliminator) opts.onEliminator(opts.eliminator);
      });
    } else {
      sprInput = h('input.spr-input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Your answer', maxlength: '6', value: st.answer || '' });
      const prev = h('div.spr-preview');
      const wrap = h('div.spr', h('label', sprInput), h('div.spr-prev-row', h('span.muted', 'Answer Preview: '), prev));
      const upd = () => {
        let v = sprInput.value.replace(/[^0-9./-]/g, '').replace(/(?!^)-/g, '');
        const lim = v.startsWith('-') ? 6 : 5;
        if (v.length > lim) v = v.slice(0, lim);
        if (v !== sprInput.value) sprInput.value = v;
        st.answer = v || null;
        prev.innerHTML = sprPreview(v);
        emit();
      };
      sprInput.addEventListener('input', upd);
      if (opts.reveal || opts.mode === 'review' || opts.locked) sprInput.disabled = true;
      prev.innerHTML = sprPreview(st.answer || '');
      scroll.appendChild(wrap);
    }

    const exp = h('div.qv-explain' + (opts.reveal ? '' : '.hidden'));
    scroll.appendChild(exp);

    function paint() {
      choiceRows.forEach((row, i) => {
        const b = row.querySelector('.choice');
        const sel = st.answer === i;
        b.classList.toggle('selected', sel);
        b.setAttribute('aria-checked', String(sel));
        row.classList.toggle('struck', (st.elim || []).includes(i));
        if (opts.reveal) {
          row.classList.toggle('is-correct', i === q.answer);
          row.classList.toggle('is-wrong', sel && i !== q.answer);
        }
      });
      if (sprInput && opts.reveal) {
        sprInput.classList.toggle('is-correct', SAT.tests.isCorrect(q, st.answer));
        sprInput.classList.toggle('is-wrong', st.answer != null && !SAT.tests.isCorrect(q, st.answer));
      }
    }
    function emit() { if (opts.onChange) opts.onChange(Object.assign({}, st, { hl: passageEl ? passageEl.innerHTML : st.hl })); }

    function reveal() {
      opts.reveal = true;
      if (sprInput) sprInput.disabled = true;
      exp.innerHTML = explanationHTML(q, st.answer);
      exp.classList.remove('hidden');
      U.renderMath(exp);
      paint();
    }

    container.appendChild(root);
    paint();
    if (opts.reveal) reveal();
    U.renderMath(root);
    if (passageEl && SAT.annotate && opts.mode !== 'review') SAT.annotate.attach(passageEl, () => emit());
    if (SAT.dict && SAT.dict.attachLookup) SAT.dict.attachLookup(root);

    return {
      el: root, passageEl, state: st, reveal,
      focusInput() { if (sprInput) sprInput.focus(); },
      isAnswered: () => st.answer != null && st.answer !== '',
    };
  }

  /* One set of window listeners serves every divider (views re-render often). */
  let activeDrag = null;
  const onMove = (e) => { if (activeDrag) activeDrag(e); };
  const onStop = () => { if (activeDrag) { activeDrag = null; document.body.classList.remove('resizing'); } };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onStop);
  window.addEventListener('touchend', onStop);
  function dragDivider(div, root) {
    const saved = SAT.store.get('split', null);
    if (saved) root.style.setProperty('--split', saved + '%');
    const move = (e) => {
      const r = root.getBoundingClientRect(), x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const pct = U.clamp((x / r.width) * 100, 25, 75);
      root.style.setProperty('--split', pct + '%');
      SAT.store.set('split', Math.round(pct));
    };
    div.addEventListener('mousedown', (e) => { activeDrag = move; e.preventDefault(); document.body.classList.add('resizing'); });
    div.addEventListener('touchstart', () => { activeDrag = move; }, { passive: true });
  }

  SAT.qview = { render, passageHTML, explanationHTML, correctAnswerText };
})();
