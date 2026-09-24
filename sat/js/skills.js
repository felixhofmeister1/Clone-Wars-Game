/* Digital SAT content taxonomy: sections -> domains -> skills (subdomains).
   Weights and question counts follow the College Board's published test specs. */
(function () {
  'use strict';
  const SAT = window.SAT;

  const sections = {
    rw: { id: 'rw', name: 'Reading and Writing', short: 'R&W', modules: 2, perModule: 27, minutes: 32, icon: 'book' },
    math: { id: 'math', name: 'Math', short: 'Math', modules: 2, perModule: 22, minutes: 35, icon: 'sigma' },
  };

  const domains = [
    { id: 'ii', section: 'rw', name: 'Information and Ideas', weight: '≈26% · 12–14 questions', color: 1,
      desc: 'Comprehend, analyze, and use information from texts, tables, and graphs.',
      skills: ['cid', 'coet', 'coeq', 'inf'] },
    { id: 'cs', section: 'rw', name: 'Craft and Structure', weight: '≈28% · 13–15 questions', color: 2,
      desc: 'Use vocabulary in context, analyze how texts are built, and connect ideas across two texts.',
      skills: ['wic', 'tsp', 'ctc'] },
    { id: 'eoi', section: 'rw', name: 'Expression of Ideas', weight: '≈20% · 8–12 questions', color: 3,
      desc: 'Revise texts to meet a rhetorical goal and connect ideas with logical transitions.',
      skills: ['rsy', 'trn'] },
    { id: 'sec', section: 'rw', name: 'Standard English Conventions', weight: '≈26% · 11–15 questions', color: 4,
      desc: 'Edit text to follow the conventions of sentence structure, usage, and punctuation.',
      skills: ['bnd', 'fss'] },
    { id: 'alg', section: 'math', name: 'Algebra', weight: '≈35% · 13–15 questions', color: 1,
      desc: 'Analyze, solve, and create linear equations, inequalities, functions, and systems.',
      skills: ['lin1', 'linf', 'lin2', 'sys', 'ineq'] },
    { id: 'adv', section: 'math', name: 'Advanced Math', weight: '≈35% · 13–15 questions', color: 2,
      desc: 'Work with quadratic, exponential, polynomial, rational, and radical equations and functions.',
      skills: ['nlf', 'nle', 'eqv'] },
    { id: 'psda', section: 'math', name: 'Problem-Solving and Data Analysis', weight: '≈15% · 5–7 questions', color: 3,
      desc: 'Apply ratios, rates, percentages, probability, and statistics to real situations.',
      skills: ['rat', 'pct', 'one', 'two', 'prob', 'smp', 'stc'] },
    { id: 'geo', section: 'math', name: 'Geometry and Trigonometry', weight: '≈15% · 5–7 questions', color: 4,
      desc: 'Solve problems about area, volume, angles, triangles, right-triangle trigonometry, and circles.',
      skills: ['av', 'lat', 'rtt', 'cir'] },
  ];

  const S = (id, domain, name, desc) => ({ id, domain, name, desc });
  const list = [
    S('cid', 'ii', 'Central Ideas and Details', 'Determine the main idea of a text and locate key supporting details.'),
    S('coet', 'ii', 'Command of Evidence: Textual', 'Pick the quotation or finding that best supports, illustrates, or weakens a claim.'),
    S('coeq', 'ii', 'Command of Evidence: Quantitative', 'Use data from a table or graph to complete or support a claim.'),
    S('inf', 'ii', 'Inferences', 'Draw the most reasonable conclusion that logically completes a text.'),
    S('wic', 'cs', 'Words in Context', 'Choose the most logical and precise word, or the meaning of a word as used.'),
    S('tsp', 'cs', 'Text Structure and Purpose', 'Identify the purpose of a text or the function of a sentence within it.'),
    S('ctc', 'cs', 'Cross-Text Connections', 'Compare two texts on a related topic and predict how one author would respond to the other.'),
    S('rsy', 'eoi', 'Rhetorical Synthesis', 'Use a student’s notes to write a sentence that accomplishes a specific goal.'),
    S('trn', 'eoi', 'Transitions', 'Choose the transition word or phrase that shows the logical relationship between ideas.'),
    S('bnd', 'sec', 'Boundaries', 'Punctuate and join clauses and phrases correctly: commas, semicolons, colons, dashes.'),
    S('fss', 'sec', 'Form, Structure, and Sense', 'Subject-verb and pronoun agreement, verb tense, plurals and possessives, modifiers.'),

    S('lin1', 'alg', 'Linear equations in one variable', 'Solve linear equations and interpret them in context.'),
    S('linf', 'alg', 'Linear functions', 'Evaluate, build, and interpret linear functions and their graphs.'),
    S('lin2', 'alg', 'Linear equations in two variables', 'Work with slope, intercepts, and lines in the xy-plane.'),
    S('sys', 'alg', 'Systems of two linear equations', 'Solve systems and reason about zero, one, or infinitely many solutions.'),
    S('ineq', 'alg', 'Linear inequalities', 'Solve and interpret inequalities in one or two variables.'),
    S('nlf', 'adv', 'Nonlinear functions', 'Quadratic and exponential functions: vertices, zeros, growth, and transformations.'),
    S('nle', 'adv', 'Nonlinear equations and systems', 'Solve quadratics, radical and rational equations, and line–curve systems.'),
    S('eqv', 'adv', 'Equivalent expressions', 'Expand, factor, and rewrite polynomial, rational, and exponent expressions.'),
    S('rat', 'psda', 'Ratios, rates, and units', 'Proportional reasoning, unit rates, and unit conversions.'),
    S('pct', 'psda', 'Percentages', 'Percent of a quantity, percent change, and successive percentages.'),
    S('one', 'psda', 'One-variable data', 'Mean, median, range, standard deviation, and data distributions.'),
    S('two', 'psda', 'Two-variable data', 'Scatterplots, lines of best fit, and linear vs. exponential models.'),
    S('prob', 'psda', 'Probability', 'Probability and conditional probability, often from two-way tables.'),
    S('smp', 'psda', 'Sample statistics and margin of error', 'Estimate population values from samples and interpret margins of error.'),
    S('stc', 'psda', 'Evaluating statistical claims', 'Decide which conclusions studies and experiments actually support.'),
    S('av', 'geo', 'Area and volume', 'Area, perimeter, surface area, and volume, including scaling.'),
    S('lat', 'geo', 'Lines, angles, and triangles', 'Angle relationships, parallel lines, and similar and congruent triangles.'),
    S('rtt', 'geo', 'Right triangles and trigonometry', 'Pythagorean theorem, special right triangles, sine, cosine, tangent, radians.'),
    S('cir', 'geo', 'Circles', 'Arc length, sector area, central angles, and circle equations.'),
  ];

  const byId = {};
  list.forEach((s) => {
    const d = domains.find((x) => x.id === s.domain);
    s.section = d.section; s.domainName = d.name;
    byId[s.id] = s;
  });
  const domainById = {};
  domains.forEach((d) => (domainById[d.id] = d));

  SAT.skills = {
    sections, domains, list, byId, domainById,
    diffs: { E: 'Easy', M: 'Medium', H: 'Hard' },
    ofSection: (sec) => list.filter((s) => s.section === sec),
    domainsOf: (sec) => domains.filter((d) => d.section === sec),
  };
})();
