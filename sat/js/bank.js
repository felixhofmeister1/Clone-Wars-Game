/* Reading & Writing bank: normalizes the authored data files (which list the
   correct choice first) into shuffled, render-ready question objects, and
   serves practice pools. Math questions come from SAT.mathgen. */
(function () {
  'use strict';
  const SAT = window.SAT, U = SAT.util;

  const STEMS = {
    WIC: 'Which choice completes the text with the most logical and precise word or phrase?',
    FUNC: 'Which choice best describes the function of the underlined sentence in the text as a whole?',
    PURP: 'Which choice best states the main purpose of the text?',
    STRUCT: 'Which choice best describes the overall structure of the text?',
    MAIN: 'Which choice best states the main idea of the text?',
    LOGIC: 'Which choice most logically completes the text?',
    CONV: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
    TRANS: 'Which choice completes the text with the most logical transition?',
    DATA_T: 'Which choice most effectively uses data from the table to complete the text?',
    DATA_G: 'Which choice most effectively uses data from the graph to complete the text?',
  };
  const stemOf = (q) => {
    if (!q) return '';
    if (STEMS[q]) return STEMS[q];
    if (q.startsWith('RS:')) return 'The student wants to ' + q.slice(3) + '. Which choice most effectively uses relevant information from the notes to accomplish this goal?';
    return q;
  };

  const items = {}, bySet = {};
  function normalize(raw, set, id) {
    const r = U.rng('rw|' + id);
    const order = r.shuffle([0, 1, 2, 3].slice(0, raw.c.length));
    const notes = [null].concat(raw.w || []);
    return {
      id, set, section: 'rw', skill: raw.s, diff: raw.d, type: 'mc',
      intro: raw.intro || '', passage: raw.p || '', p1: raw.p1 || '', p2: raw.p2 || '',
      notes: raw.n || null, table: raw.t || null, graph: raw.g || null, poem: !!raw.poem,
      stem: stemOf(raw.q),
      choices: order.map((i) => raw.c[i]),
      answer: order.indexOf(0),
      why: order.map((i) => notes[i] || null),
      explanation: raw.e || '',
    };
  }

  function load() {
    const counters = {};
    (SAT.rwData || []).forEach((pack) => {
      pack.items.forEach((raw, idx) => {
        let id;
        if (pack.set === 'p') {
          const k = raw.s; counters[k] = (counters[k] || 0) + 1;
          id = 'p-' + k + '-' + counters[k];
        } else {
          id = pack.set + '-' + (idx + 1);
        }
        const q = normalize(raw, pack.set, id);
        items[id] = q;
        (bySet[pack.set] = bySet[pack.set] || []).push(id);
      });
    });
  }

  SAT.bank = {
    STEMS,
    load,
    get: (id) => items[id],
    set: (name) => (bySet[name] || []).map((id) => items[id]),
    hasSet: (name) => !!(bySet[name] && bySet[name].length),
    count: () => Object.keys(items).length,
    /* Practice pool for a R&W skill and difficulty. Questions from full tests
       the student has already completed join the pool. */
    rwPool(skill, diff) {
      const done = new Set((SAT.store.get('history', []) || []).filter((h) => h.kind === 'full' || h.kind === 'section').map((h) => h.testId));
      return Object.values(items).filter((q) => q.skill === skill && (!diff || diff === 'X' || q.diff === diff) &&
        (q.set === 'p' || done.has(q.set.slice(0, 2))));
    },
    all: () => Object.values(items),
  };

  /* Resolve a stored question reference (R&W by id, math as a snapshot). */
  SAT.resolveQ = (ref) => (ref && ref.ref ? items[ref.ref] : ref);
  SAT.refQ = (q) => (q.section === 'rw' && items[q.id] ? { ref: q.id } : q);
})();
