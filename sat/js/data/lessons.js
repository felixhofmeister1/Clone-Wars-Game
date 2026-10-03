/* Lessons for every skill: what it tests, what questions look like,
   strategy, rules and formulas, traps, and a worked example. */
(function () {
  'use strict';
  const R = String.raw;
  const L = ((window.SAT = window.SAT || {}).lessons = {});

  L._overview = R`<h2>How the Digital SAT works</h2>
<p>The SAT has two sections. <b>Reading and Writing</b> has 54 questions in two 32-minute modules; <b>Math</b> has 44 questions in two 35-minute modules. Each section is <b>adaptive by module</b>: your performance on Module 1 decides whether Module 2 is harder or easier. The harder Module 2 unlocks the top of the score range, so accuracy in Module 1 matters a lot.</p>
<p>Every Reading and Writing question has its own short passage (25\u2013150 words) and one question. Questions appear grouped by type in this order: Craft and Structure, Information and Ideas, Standard English Conventions, Expression of Ideas. Math questions get harder through each module; about a quarter are student-produced responses (grid-ins). A graphing calculator and reference sheet are always available in Math. There is <b>no penalty for guessing</b>, so answer everything.</p>`;

  /* ============================================================ R&W */
  L.wic = {
    what: 'Whether you can choose the word that best fits the logic and precision of a text, or explain what a word means in context. The right answer depends on the sentence around it, not on the word\u2019s most common meaning.',
    looks: '<p>A short text with a blank and the question <i>Which choice completes the text with the most logical and precise word or phrase?</i> Sometimes: <i>As used in the text, what does the word \u201cX\u201d most nearly mean?</i></p>',
    steps: ['Read the whole text and cover the choices.', 'Find the clue: a definition, example, contrast word (<i>but, although, however</i>), or cause-effect word (<i>because, so</i>).', 'Predict your own word for the blank before looking at the choices.', 'Pick the choice that matches your prediction in both <b>meaning</b> and <b>tone</b> (positive/negative, strong/mild).', 'Reread the sentence with your choice in it to confirm it fits exactly.'],
    rules: ['Contrast words (<i>although, yet, however, despite</i>) signal the blank means the opposite of a nearby idea.', 'Support words (<i>and, also, indeed, in fact</i>) signal the blank continues a nearby idea.', 'Examples after a colon or \u201csuch as\u201d often define the blank.', 'The SAT rewards <b>precision</b>: \u201cthorough\u201d is better than \u201cgood\u201d if the text lists many details.'],
    traps: ['A word that is related to the topic but doesn\u2019t fit the logic.', 'A familiar meaning of a word with several meanings (e.g., \u201cnovel\u201d as a book vs. \u201cnew\u201d).', 'The right direction but wrong strength (\u201cdisliked\u201d vs. \u201cloathed\u201d).'],
    example: '<p><i>Many early critics dismissed the novel as minor. Later scholars, however, argued that its structure was remarkably ______, anticipating techniques not common until decades later.</i></p><p>\u201cHowever\u201d contrasts with \u201cminor,\u201d and \u201canticipating techniques\u201d defines the blank. Predict: <b>ahead of its time</b>. \u201cInnovative\u201d matches; \u201cderivative\u201d and \u201cconventional\u201d are opposites.</p>',
  };
  L.tsp = {
    what: 'Whether you can identify the main purpose of a text, the overall structure of a text, or the function of one sentence within a text.',
    looks: '<p><i>Which choice best states the main purpose of the text?</i> \u00b7 <i>Which choice best describes the overall structure of the text?</i> \u00b7 <i>Which choice best describes the function of the underlined sentence in the text as a whole?</i></p>',
    steps: ['Summarize each sentence in a few words (\u201cclaim,\u201d \u201cexample,\u201d \u201ccounterpoint,\u201d \u201cconclusion\u201d).', 'For purpose questions, ask why the author wrote the whole text: to describe, explain, argue, compare, or challenge?', 'For function questions, compare the underlined sentence with the sentence right before it: does it support, contrast, give an example, or resolve a problem?', 'Choose the answer that describes <b>every</b> part accurately; one wrong word makes a choice wrong.'],
    rules: ['Verbs in the choices matter: <i>describe</i> is neutral; <i>argue</i> requires a position; <i>criticize</i> requires a negative judgment.', 'Structure answers must match the order of the text.', 'Signal words (<i>in fact, however, for example, as a result</i>) reveal a sentence\u2019s function.'],
    traps: ['A choice that is true of one sentence but not the whole text.', 'A choice that\u2019s too strong (\u201cproves,\u201d \u201crejects entirely\u201d).', 'A choice that describes a detail mentioned in passing as the main purpose.'],
    example: '<p><i>Many people assume the printing press quickly made books cheap. <u>In fact, for decades after the 1450s, most books remained costly.</u> Only gradually did books reach a broad public.</i></p><p>The underlined sentence begins with \u201cIn fact\u201d and contradicts the assumption in the previous sentence, so its function is <b>to challenge a common assumption</b>.</p>',
  };
  L.ctc = {
    what: 'Whether you can compare two short texts on the same topic: how one author would respond to the other, or what both would agree on.',
    looks: '<p>Text 1 and Text 2, then: <i>Based on the texts, how would the author of Text 2 most likely respond to the underlined claim in Text 1?</i> or <i>Based on the texts, both authors would most likely agree that\u2026</i></p>',
    steps: ['Read Text 1 and write its main claim in five words.', 'Read Text 2 and note its stance toward that claim: agree, disagree, or \u201cyes, but\u201d (partial agreement).', 'Look for the specific reason Text 2 gives.', 'Choose the answer that reflects Text 2\u2019s stance <b>and</b> its reason.'],
    rules: ['Most pairs are \u201cyes, but\u201d: Text 2 accepts part of Text 1 but adds a complication.', 'For \u201cboth agree\u201d questions, the answer must be supported by <b>both</b> texts.'],
    traps: ['Extreme answers (\u201creject entirely\u201d) when Text 2 only qualifies Text 1.', 'Answers that bring in ideas neither text mentions.', 'Answers that reverse which author said what.'],
    example: '<p>Text 1: tool use shows crows have ape-like general intelligence. Text 2: tool use alone is weak evidence, but crows\u2019 flexible problem solving is remarkable.</p><p>Text 2\u2019s stance is \u201cyes, but\u201d: crows may be very intelligent, but tool use isn\u2019t the reason. The right answer captures both halves.</p>',
  };
  L.cid = {
    what: 'Whether you can identify the main idea of a text (including poems and fiction) or locate a specific detail it states.',
    looks: '<p><i>Which choice best states the main idea of the text?</i> \u00b7 <i>According to the text, what is true about X?</i> \u00b7 <i>Based on the text, how does the character respond to\u2026?</i></p>',
    steps: ['Read for the big picture: what is the text mostly about, and what is said about it?', 'Main idea: state it in one sentence before looking at choices.', 'Detail questions: find the exact lines that answer the question; the right answer paraphrases them.', 'Eliminate choices that are too broad, too narrow, or not stated.'],
    rules: ['The main idea covers the <b>whole</b> text, often combining the first idea with the turn or conclusion.', 'In literature, focus on what the character feels or realizes, supported by specific words.'],
    traps: ['A true detail that isn\u2019t the main idea.', 'A choice that uses words from the text but changes their meaning.', 'Assumptions that go beyond the text (\u201cregrets,\u201d \u201cis relieved\u201d) without evidence.'],
    example: '<p>A poem contrasts an oak that \u201cdoes not hurry\u201d with a birch that \u201craces toward the light,\u201d ending: \u201cit is the birch that breaks.\u201d</p><p>Main idea: <b>slow, steady growth gives the oak strength the fast birch lacks</b>. \u201cStorms are dangerous to oaks\u201d reverses the poem.</p>',
  };
  L.coet = {
    what: 'Whether you can choose evidence that supports, illustrates, or weakens a claim: a quotation from a literary work or a hypothetical research finding.',
    looks: '<p><i>Which quotation from the poem most effectively illustrates the claim?</i> \u00b7 <i>Which finding, if true, would most directly support the researchers\u2019 hypothesis?</i> \u00b7 <i>\u2026most directly weaken\u2026?</i></p>',
    steps: ['Find the claim and break it into its parts (e.g., \u201cadmiration <b>and</b> unease\u201d).', 'For quotations, choose the one that shows <b>every</b> part of the claim.', 'For findings, restate the hypothesis as a prediction: \u201cIf this is true, we should see\u2026\u201d', 'Pick the finding that matches (support) or contradicts (weaken) that prediction most directly.'],
    rules: ['\u201cIf true\u201d means accept the finding as fact; judge only its logical relationship to the claim.', 'A strong weakening finding often shows the effect happening <b>without</b> the proposed cause.'],
    traps: ['A quotation on the right topic that shows only half of the claim.', 'A finding about the same subject that doesn\u2019t address the specific hypothesis.', 'A finding that supports when the question asks for one that weakens.'],
    example: '<p>Hypothesis: city songbirds sing at higher pitches than forest birds because higher songs are easier to hear over traffic.</p><p>Prediction: city birds\u2019 songs are higher. The finding \u201ccity great tits sang at higher minimum pitches than forest great tits\u201d directly supports it.</p>',
  };
  L.coeq = {
    what: 'Whether you can use data from a table or graph to complete or support a claim accurately.',
    looks: '<p>A table or graph plus a short text ending in a blank: <i>Which choice most effectively uses data from the graph to complete the text?</i></p>',
    steps: ['Read the text first and identify exactly what claim needs support.', 'Read the graphic\u2019s title, axis labels, units, and legend.', 'Check each choice against the data <b>and</b> against the claim; it must be accurate and relevant.', 'Eliminate choices that are true but don\u2019t address the claim.'],
    rules: ['Many choices are accurate readings of the data; only one supports the specific claim.', 'Claims with two parts (\u201cat first\u2026 but later\u2026\u201d) need data for both parts.'],
    traps: ['Misreading which series is which in a two-color graph.', 'A true statement about the wrong group or year.', 'Data that shows a change but not the comparison the claim requires.'],
    example: '<p>Claim: \u201cflashcards worked best at first, but spaced repetition became most effective over time.\u201d The right answer must show flashcards highest in week 1 <b>and</b> spaced repetition highest in week 4.</p>',
  };
  L.inf = {
    what: 'Whether you can draw the most logical conclusion from the information in a text.',
    looks: '<p>A text that ends with a blank: <i>Which choice most logically completes the text?</i></p>',
    steps: ['Identify the evidence the text gives, step by step.', 'Ask: what must be true, or is most reasonable, given only this information?', 'Predict the conclusion before looking at choices.', 'Choose the answer that follows directly, without adding outside assumptions.'],
    rules: ['The correct answer is usually modest: \u201cmay,\u201d \u201csuggests,\u201d \u201cdoes not establish.\u201d', 'Watch for confounding factors: if two groups differ in more than one way, a causal conclusion isn\u2019t justified.'],
    traps: ['Answers that go too far (\u201cproves,\u201d \u201calways\u201d).', 'Answers that repeat a fact from the text instead of concluding from it.', 'Answers that are true in the real world but unsupported by the text.'],
    example: '<p><i>Gardeners felt more connected to neighbors than non-gardeners, but gardeners had also lived there much longer. Therefore, the results ______</i></p><p>Because length of residence could explain the difference, the results <b>do not establish that gardening itself caused</b> the connection.</p>',
  };
  L.bnd = {
    what: 'Whether you can punctuate sentences correctly: joining clauses, setting off extra information, and introducing lists and explanations.',
    looks: '<p>A text with a blank and choices that differ only in punctuation: <i>Which choice completes the text so that it conforms to the conventions of Standard English?</i></p>',
    steps: ['Find the subject and verb on each side of the blank. Is each side an <b>independent clause</b> (could stand alone as a sentence)?', 'Two independent clauses need a period, a semicolon, a colon, or a comma + FANBOYS (for, and, nor, but, or, yet, so).', 'Extra (nonessential) information is set off by a <b>matching pair</b>: two commas, two dashes, or two parentheses.', 'Never separate a subject from its verb, or a verb from its object, with a single comma.'],
    rules: ['<b>Semicolon</b>: independent clause ; independent clause.', '<b>Colon</b>: independent clause : list, explanation, or example.', '<b>Comma splice</b> (two independent clauses joined by only a comma) is always wrong.', '<b>Transition words</b> between clauses (however, therefore, instead): <i>clause; however, clause</i>.', '<b>Essential</b> names and clauses get no commas: \u201cthe mathematician Hypatia.\u201d'],
    traps: ['A comma where a semicolon is needed (comma splice).', 'Mismatched pairs: an opening dash closed with a comma.', 'A comma between a subject and its verb.', 'A colon after words like \u201cincluding\u201d or \u201csuch as.\u201d'],
    example: '<p><i>Early films were rarely shown in complete ______ theaters hired pianists to accompany them.</i></p><p>Both sides are independent clauses, so use a semicolon, and follow the transition with a comma: <b>silence; instead,</b></p>',
  };
  L.fss = {
    what: 'Whether you can edit for grammar: subject-verb agreement, pronoun agreement, verb tense and form, plurals and possessives, and modifier placement.',
    looks: '<p>A text with a blank and choices that differ in verb form, pronoun, or word form: <i>Which choice completes the text so that it conforms to the conventions of Standard English?</i></p>',
    steps: ['Find what the blank connects to: its subject (for verbs) or antecedent (for pronouns).', 'Ignore phrases between the subject and verb (\u201cThe collection <s>of ancient coins</s> includes\u2026\u201d).', 'Match number (singular/plural) and time (tense) with the rest of the sentence.', 'For modifiers, make sure the introductory phrase describes the noun right after the comma.'],
    rules: ['<b>Each, every, either, neither</b> are singular.', 'Collective nouns (committee, team, collection) are usually singular: use <i>its</i>.', '<b>Its</b> = possessive; <b>it\u2019s</b> = it is. <b>Their</b> = possessive; <b>they\u2019re</b> = they are.', 'Plural possessive: <i>the swallows\u2019 nests</i>; plural (no ownership): <i>the swallows return</i>.', '\u201cSince [past time]\u201d \u2192 present perfect (<i>have used</i>); an earlier past action \u2192 past perfect (<i>had lost</i>).', 'Items in a list must be parallel (<i>to reduce, to improve, and to give</i>).'],
    traps: ['Matching the verb to the nearest noun instead of the true subject.', 'Inverted sentences, where the subject comes after the verb.', 'Dangling modifiers that describe the wrong noun.'],
    example: '<p><i>The study\u2019s most surprising finding\u2014that bumblebees could recognize shapes by touch\u2014______ that the insects form mental images.</i></p><p>The subject is \u201cfinding\u201d (singular); the dashes hold an interruption. Answer: <b>suggests</b>.</p>',
  };
  L.trn = {
    what: 'Whether you can choose the transition that shows the logical relationship between two ideas.',
    looks: '<p>A text with a blank at the start of a sentence: <i>Which choice completes the text with the most logical transition?</i></p>',
    steps: ['Cover the choices. Read the sentences before and after the blank.', 'Decide the relationship: <b>contrast</b>, <b>continuation/addition</b>, <b>example</b>, <b>cause/effect</b>, <b>sequence</b>, or <b>restatement</b>.', 'Pick the transition in that category; if two are in the same category, choose the more precise one.'],
    rules: ['Contrast: however, nevertheless, by contrast, instead, even so, in reality.', 'Addition: moreover, furthermore, in addition, likewise, similarly.', 'Example: for example, for instance, specifically.', 'Cause/effect: therefore, thus, as a result, consequently, accordingly.', 'Sequence/chain: subsequently, then, in turn, finally.', 'Restatement: in other words, that is, in short.'],
    traps: ['Choosing a transition because it \u201csounds academic.\u201d', 'Reversing cause and effect.', '\u201cFor example\u201d when the second sentence doesn\u2019t actually illustrate the first.'],
    example: '<p><i>Wolves reduced elk browsing, letting willows recover. ______ the willows fed beavers, whose dams reshaped streams.</i></p><p>This is a chain of effects, each causing the next: <b>In turn</b>.</p>',
  };
  L.rsy = {
    what: 'Whether you can use a student\u2019s notes to write a sentence that accomplishes a specific rhetorical goal.',
    looks: '<p>A bulleted list of notes, then: <i>The student wants to [goal]. Which choice most effectively uses relevant information from the notes to accomplish this goal?</i></p>',
    steps: ['<b>Read the goal first</b>; you often don\u2019t need to read all the notes carefully.', 'Underline the key verb and object of the goal: <i>emphasize a difference</i>, <i>introduce to an unfamiliar audience</i>, <i>present the results</i>.', 'Eliminate every choice that doesn\u2019t do that exact job, even if it\u2019s accurate.', 'Among what\u2019s left, pick the choice that does the whole job.'],
    rules: ['\u201cEmphasize a difference\u201d \u2192 needs both items and a contrast word (while, whereas, but).', '\u201cEmphasize a similarity\u201d \u2192 both, also, likewise.', '\u201cIntroduce to an unfamiliar audience\u201d \u2192 identify who or what it is (full name + description).', '\u201cAim of a study\u201d \u2192 what it sought to learn, not its results.', '\u201cGeneralization\u201d \u2192 about the whole group, not one example.'],
    traps: ['A true, well-written sentence that does a different job.', 'Half the goal: only one of two items being compared.', 'Results when the goal asks for methods (or vice versa).'],
    example: '<p>Goal: <i>contrast the two explanations for the dinosaurs\u2019 extinction.</i> The right answer uses \u201cWhile one explanation emphasizes an asteroid impact, the other emphasizes volcanic eruptions.\u201d A choice saying both may have contributed doesn\u2019t contrast them.</p>',
  };

  /* =========================================================== MATH */
  L.lin1 = {
    what: 'Solving linear equations in one variable, including equations with fractions, variables on both sides, and constants, and writing equations from word problems.',
    looks: R`<p>\(3x + 7 = 22\) \u00b7 \(\frac{3}{5}(x + 1) = 6\) \u00b7 \(8x + 36 = 52\), what is \(2x + 9\)? \u00b7 For what value of \(k\) does the equation have no solution?</p>`,
    steps: ['Distribute and combine like terms on each side.', 'Move variable terms to one side and constants to the other using inverse operations.', 'Divide by the coefficient.', 'Check by substituting back.', 'If asked for an expression (like \\(2x + 9\\)), look for a shortcut: the left side may be a multiple of it.'],
    rules: [R`\(ax + b = cx + d\) has <b>one solution</b> if \(a \ne c\).`, R`<b>No solution</b> if \(a = c\) and \(b \ne d\).`, R`<b>Infinitely many</b> solutions if \(a = c\) and \(b = d\).`, 'Multiply both sides by the reciprocal to clear a fractional coefficient.'],
    traps: ['Sign errors when moving terms.', 'Solving for x when the question asks for an expression.', 'Forgetting to distribute a negative sign.'],
    example: R`<p>\(k(x + 5) - 2x = 9x + 6\) has no solution. Find \(k\).</p><p>Expand: \((k - 2)x + 5k = 9x + 6\). No solution means equal x-coefficients and different constants: \(k - 2 = 9\), so \(k = 11\) (and \(55 \ne 6\) \u2713).</p>`,
  };
  L.linf = {
    what: 'Evaluating, building, and interpreting linear functions from equations, tables, graphs, and contexts.',
    looks: R`<p>\(f(x) = -5x + 12\), find \(f(4)\) \u00b7 a table of values \u00b7 a graph of a line \u00b7 \(C(h) = 18h + 45\): what does 18 mean?</p>`,
    steps: ['Slope = change in output \u00f7 change in input between any two points.', 'y-intercept = output when input is 0.', 'Write \\(f(x) = mx + b\\), then evaluate by substitution.', 'In context, the slope is a rate (per hour, per item) and the intercept is a starting or fixed amount.'],
    rules: [R`\(m = \frac{f(x_2) - f(x_1)}{x_2 - x_1}\)`, R`\(f(a) - f(b) = m(a - b)\) for any linear \(f\).`, R`\(g(x) = f(x - h) + k\) shifts the graph right \(h\) and up \(k\).`],
    traps: ['Confusing the rate with the starting amount.', 'Dividing the change in output by the wrong change in input when the table skips values.', 'Shifting in the wrong direction with \\(f(x - h)\\).'],
    example: R`<p>A candle is 23 cm tall after 8 hours and 20 cm after 10 hours. Rate: \(\frac{20 - 23}{10 - 8} = -1.5\) cm/h. Initial height: \(23 + 1.5(8) = 35\) cm.</p>`,
  };
  L.lin2 = {
    what: 'Working with lines in the xy-plane: slope, intercepts, points on a line, and parallel and perpendicular lines.',
    looks: R`<p>Slope of \(8x - 9y = -11\) \u00b7 line through two points \u00b7 perpendicular line through a point \u00b7 \(px + qy = T\) word problems.</p>`,
    steps: ['Rewrite in slope-intercept form \\(y = mx + b\\) when you need the slope.', 'Use two points to find the slope, then one point to find b.', 'For perpendicular lines use the negative reciprocal slope; for parallel lines use the same slope.', 'In standard-form word problems, substitute the known quantity and solve for the other.'],
    rules: [R`Slope of \(Ax + By = C\) is \(-\frac{A}{B}\); x-intercept \(\frac{C}{A}\); y-intercept \(\frac{C}{B}\).`, R`Perpendicular: \(m_1 m_2 = -1\).`, 'A point lies on a line if its coordinates satisfy the equation.'],
    traps: ['Forgetting the negative in \\(-\\frac{A}{B}\\).', 'Using the parallel slope for a perpendicular line.', 'Swapping x- and y-coordinates.'],
    example: R`<p>Line \(k\): \(y = \frac{1}{2}x + 6\). Line \(j\) is perpendicular to \(k\) through \((2, 1)\). Slope of \(j\) is \(-2\); \(1 = -2(2) + b\), so \(b = 5\).</p>`,
  };
  L.sys = {
    what: 'Solving systems of two linear equations and deciding whether a system has zero, one, or infinitely many solutions.',
    looks: R`<p>\(x + y = 3,\ x - y = 1\) \u00b7 ticket and mixture word problems \u00b7 find \(x + y\) directly \u00b7 no-solution constants.</p>`,
    steps: ['Choose substitution (a variable is already isolated) or elimination (coefficients line up).', 'If the question asks for a combination like \\(x + y\\), try adding or subtracting the equations first.', 'For word problems, define variables and write one equation for the count and one for the total value.', 'On the calculator, graph both lines and tap the intersection.'],
    rules: ['<b>One solution</b>: different slopes (lines intersect).', '<b>No solution</b>: same slope, different intercepts (parallel lines); coefficients proportional, constants not.', '<b>Infinitely many</b>: one equation is a multiple of the other (same line).'],
    traps: ['Solving for x when asked for y.', 'Setting coefficients equal instead of proportional for no-solution questions.', 'Mixing up which unknown each equation counts.'],
    example: R`<p>\(2x + 4y = 48,\ 4x + 2y = 48\). Add: \(6x + 6y = 96\), so \(x + y = 16\) \u2014 no need to find x and y separately.</p>`,
  };
  L.ineq = {
    what: 'Solving and interpreting linear inequalities in one or two variables, including word problems and systems of inequalities.',
    looks: R`<p>Solve \(2x + 6 \lt 24\) \u00b7 \u201cat most\u201d / \u201cat least\u201d word problems \u00b7 maximum number of items \u00b7 which point satisfies a system.</p>`,
    steps: ['Solve like an equation, but <b>flip the inequality sign</b> when multiplying or dividing by a negative.', 'Translate words: \u201cat most\u201d \u2192 \u2264, \u201cat least\u201d \u2192 \u2265, \u201cmore than\u201d \u2192 >, \u201cfewer than\u201d \u2192 <.', 'For \u201cmaximum number of items,\u201d solve and round <b>down</b> to a whole number.', 'To check a point in a system, substitute it into <b>every</b> inequality.'],
    rules: ['Strict inequalities (<, >) exclude the boundary; \u2264 and \u2265 include it.', 'In the xy-plane, y > mx + b is the region above the line.'],
    traps: ['Rounding up for a maximum.', 'Forgetting to flip the sign with negatives.', 'Checking a point in only one inequality.'],
    example: R`<p>$40 budget, $18 admission, $7 per ride: \(18 + 7n \le 40 \Rightarrow n \le 3.14\), so at most <b>3</b> rides.</p>`,
  };
  L.nlf = {
    what: 'Understanding quadratic and exponential functions: evaluating them, finding vertices and zeros, interpreting exponential growth and decay, and transformations.',
    looks: R`<p>\(f(x) = (x - 6)^2 + 5\) \u00b7 \(P(t) = 5000(1.04)^t\) \u00b7 doubles every 3 hours \u00b7 graph of a parabola \u00b7 \(g(x) = f(x + 4) - 2\).</p>`,
    steps: ['Vertex form \\(a(x - h)^2 + k\\) shows the vertex \\((h, k)\\) directly.', 'For standard form, the vertex x-coordinate is \\(-\\frac{b}{2a}\\).', 'Factored form \\(a(x - p)(x - q)\\) shows the zeros p and q.', 'Exponential \\(a(b)^{t/n}\\): a is the initial value, b the factor per period of length n.'],
    rules: [R`Growth by \(r\%\): factor \(1 + \frac{r}{100}\); decay by \(r\%\): factor \(1 - \frac{r}{100}\).`, R`Doubling every \(d\) units: \(a \cdot 2^{t/d}\); half-life \(d\): \(a\left(\frac{1}{2}\right)^{t/d}\).`, 'a > 0 opens up (minimum); a < 0 opens down (maximum).', R`\(f(x - h)\) shifts right \(h\); \(f(x) + k\) shifts up \(k\).`],
    traps: ['Reading the vertex of \\((x + 3)^2\\) as \\(x = 3\\) (it\u2019s \\(-3\\)).', 'Using the decay rate (0.2) instead of the remaining factor (0.8).', 'Multiplying the exponent instead of dividing (\\(2^{3t}\\) vs. \\(2^{t/3}\\)).'],
    example: R`<p>\(f(x) = a(b)^x\), \(f(0) = 2\), \(f(2) = 32\). Then \(a = 2\), \(2b^2 = 32\), \(b = 4\), so \(f(4) = 2(4)^4 = 512\).</p>`,
  };
  L.nle = {
    what: 'Solving quadratic, radical, and rational equations, and systems that combine a line with a curve.',
    looks: R`<p>\((x + 6)^2 = 81\) \u00b7 positive solution of \(x^2 + 8x - 9 = 0\) \u00b7 exactly one real solution \u00b7 \(\sqrt{x + 15} = x + 3\) \u00b7 sum of solutions.</p>`,
    steps: ['Try factoring first; otherwise use the quadratic formula or the calculator.', 'For line\u2013parabola systems, set the expressions equal and solve the quadratic.', 'After squaring both sides of a radical equation, <b>check every answer</b> for extraneous solutions.', 'For \u201chow many solutions,\u201d use the discriminant.'],
    rules: [R`Quadratic formula: \(x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}\).`, R`Discriminant \(b^2 - 4ac\): positive \u2192 2 real solutions, 0 \u2192 1, negative \u2192 0.`, R`Sum of solutions \(-\frac{b}{a}\); product \(\frac{c}{a}\).`, R`\(x^2 = k\) has solutions \(\pm\sqrt{k}\).`],
    traps: ['Forgetting the negative square root.', 'Keeping an extraneous solution of a radical equation.', 'Using b/a instead of \u2212b/a for the sum.'],
    example: R`<p>\(ax^2 + 24x + c = 0\) with \(a = 4\) has exactly one real solution: \(24^2 - 4(4)c = 0\), so \(c = 36\).</p>`,
  };
  L.eqv = {
    what: 'Rewriting expressions: adding, subtracting, and multiplying polynomials, factoring, exponent rules, rational expressions, and completing the square.',
    looks: R`<p>\((2x^2 + 9x + 4) - (4x^2 - 2x - 1)\) \u00b7 \((x + 7)(3x - 1)\) \u00b7 \(x^4 - 16\) \u00b7 \(\frac{1}{x - 6} + \frac{1}{x + 6}\) \u00b7 remainder theorem.</p>`,
    steps: ['Distribute negatives to every term before combining.', 'FOIL (first, outer, inner, last) for products of binomials.', 'Factor: look for a GCF, difference of squares, or a trinomial pattern.', 'Check equivalence quickly by plugging in a simple value like x = 2 into the original and each choice.'],
    rules: [R`\(a^2 - b^2 = (a + b)(a - b)\)`, R`\((a \pm b)^2 = a^2 \pm 2ab + b^2\)`, R`\(x^m x^n = x^{m+n}\), \((x^m)^n = x^{mn}\), \(x^{m/n} = \sqrt[n]{x^m}\)`, R`Remainder when \(p(x)\) is divided by \(x - c\) is \(p(c)\).`, R`\(x^2 + bx + c = \left(x + \frac{b}{2}\right)^2 + c - \frac{b^2}{4}\)`],
    traps: ['Distributing a negative to only the first term.', 'Adding exponents when you should multiply (or vice versa).', 'Adding fractions by adding numerators and denominators.'],
    example: R`<p>\(\frac{2x + 24}{x + 6} = 2 + \frac{k}{x + 6}\). Since \(2 = \frac{2x + 12}{x + 6}\), \(12 + k = 24\), so \(k = 12\).</p>`,
  };
  L.rat = {
    what: 'Proportional reasoning: unit rates, ratios, scale drawings, and unit conversions (including squared and cubed units).',
    looks: '<p>Rates (miles per hour, pages per minute) \u00b7 recipe ratios \u00b7 map scales \u00b7 converting feet per second to miles per hour \u00b7 density.</p>',
    steps: ['Write units on every number.', 'Find the unit rate (per 1) or set up a proportion.', 'For conversions, multiply by fractions equal to 1 so unwanted units cancel.', 'Check that the answer\u2019s size makes sense.'],
    rules: [R`\(\frac{a}{b} = \frac{c}{d} \Rightarrow ad = bc\)`, R`1 yd² = 9 ft² (square the factor); 1 yd³ = 27 ft³ (cube it).`, 'Density = mass \u00f7 volume. Rate \u00d7 time = amount.'],
    traps: ['Converting square units with the linear factor.', 'Setting up a proportion upside down.', 'Leaving the answer in the wrong unit (minutes vs. hours).'],
    example: R`<p>\(88 \frac{\text{ft}}{\text{s}} \times \frac{3600 \text{ s}}{1 \text{ hr}} \times \frac{1 \text{ mi}}{5280 \text{ ft}} = 60\) miles per hour.</p>`,
  };
  L.pct = {
    what: 'Percent of a quantity, percent change, reverse percents, and successive percent changes.',
    looks: '<p>What is 15% of 60? \u00b7 Increased from 60 to 72: percent increase? \u00b7 After a 20% discount the price is $64 \u00b7 A is 40% more than B\u2026</p>',
    steps: ['Convert percents to decimals and use multipliers: increase by r% \u2192 \u00d7(1 + r), decrease \u2192 \u00d7(1 \u2212 r).', 'For successive changes, multiply the multipliers.', 'For reverse percents, divide by the multiplier.', 'Percent change = change \u00f7 original \u00d7 100.'],
    rules: ['A 20% increase followed by a 20% decrease is a net 4% decrease (1.2 \u00d7 0.8 = 0.96).', 'p% of x = q% of y \u2192 0.0p\u00b7x = 0.0q\u00b7y.'],
    traps: ['Adding successive percents.', 'Dividing by the new value for percent change.', 'Undoing a discount by adding the same percent.'],
    example: R`<p>After a 10% discount the price is $72: \(0.9x = 72\), so \(x = 80\) (not \(72 \times 1.1 = 79.20\)).</p>`,
  };
  L.one = {
    what: 'Center, spread, and shape of data: mean, median, mode, range, standard deviation, and how outliers and transformations affect them.',
    looks: '<p>Mean or median of a list \u00b7 frequency tables and dot plots \u00b7 what happens when a value is removed \u00b7 comparing standard deviations.</p>',
    steps: ['Mean = sum \u00f7 count; median = middle value after ordering.', 'For frequency tables, find the position (n+1)/2 by counting through the frequencies.', 'Use totals: sum = mean \u00d7 count, useful when a value is added or removed.', 'Compare spread by how far values sit from the center.'],
    rules: ['Outliers pull the mean toward them; the median resists outliers.', 'Adding a constant to every value shifts the mean but not the standard deviation.', 'Multiplying every value by k multiplies both the mean and the standard deviation by k.', 'Combined mean = total sum \u00f7 total count (weight by group size).'],
    traps: ['Finding the median without ordering.', 'Averaging group means without weighting.', 'Thinking standard deviation changes when you shift all values.'],
    example: R`<p>The mean of 6 numbers is 40; after removing one, the mean of 5 is 41. Removed number: \(6(40) - 5(41) = 35\).</p>`,
  };
  L.two = {
    what: 'Scatterplots, lines of best fit, predictions, residuals, and choosing linear vs. exponential models.',
    looks: R`<p>A scatterplot with \(y = 5x + 60\) \u00b7 interpret the slope \u00b7 which equation best fits \u00b7 a table where y triples each step.</p>`,
    steps: ['For predictions, substitute into the line of best fit.', 'Slope = predicted change in y per 1-unit increase in x (in context).', 'Residual = actual \u2212 predicted.', 'Constant differences \u2192 linear; constant ratios \u2192 exponential.'],
    rules: ['Positive association: rises left to right; negative: falls.', 'A line of best fit gives predictions, not exact values for every point.'],
    traps: ['Reversing x and y in interpretations.', 'Computing predicted \u2212 actual for a residual.', 'Calling a doubling pattern linear.'],
    example: R`<p>Line: \(y = 5x + 60\). Point (7, 91): predicted \(95\), residual \(91 - 95 = -4\).</p>`,
  };
  L.prob = {
    what: 'Probability and conditional probability, especially from two-way tables.',
    looks: '<p>A bag of marbles \u00b7 a two-way table: \u201cIf a person who prefers X is selected, what is the probability that\u2026\u201d</p>',
    steps: ['Probability = favorable \u00f7 total.', 'For \u201cgiven that\u201d or \u201cIf a ___ is selected,\u201d shrink the total to that row or column.', 'For \u201cand,\u201d use one cell over the grand total.', 'For \u201cor,\u201d add the groups and subtract the overlap.'],
    rules: ['P(A | B) = (number in A and B) \u00f7 (number in B).', 'P(not A) = 1 \u2212 P(A).'],
    traps: ['Dividing by the grand total in a conditional question.', 'Using the row total when the condition is a column.'],
    example: '<p>Of 94 students who prefer in-person classes, 29 are in grade 11. P(grade 11 | in-person) = 29/94.</p>',
  };
  L.smp = {
    what: 'Using random samples to estimate population values, interpreting margins of error, and knowing which population results apply to.',
    looks: '<p>Estimate a population count from a sample \u00b7 \u201cestimate 14.2 with margin of error 2.5\u201d \u00b7 generalizing survey results.</p>',
    steps: ['Estimate = sample proportion \u00d7 population size.', 'Plausible interval = estimate \u00b1 margin of error.', 'Results generalize only to the population the random sample was drawn from.'],
    rules: ['Larger random samples \u2192 smaller margins of error.', 'A margin of error describes uncertainty about a population value (like a mean), not the range of individuals.'],
    traps: ['Claiming the true value equals the estimate exactly.', 'Generalizing to a larger population than was sampled.'],
    example: '<p>35 of 50 sampled employees bike to work; the company has 2,400 employees. Estimate: 0.7 \u00d7 2,400 = 1,680.</p>',
  };
  L.stc = {
    what: 'Deciding what conclusions observational studies and experiments support.',
    looks: '<p>A description of a study, then: <i>Which conclusion is best supported?</i></p>',
    steps: ['Was the sample <b>randomly selected</b>? If yes, you can generalize to that population.', 'Were treatments <b>randomly assigned</b>? If yes, you can conclude cause and effect.', 'No random assignment \u2192 association only. No random sampling \u2192 applies only to people like those studied.'],
    rules: ['Random sampling \u2192 generalization. Random assignment \u2192 causation.', 'Volunteer or self-selected samples may not represent anyone else.', 'Confounding variables weaken causal claims in observational studies.'],
    traps: ['Causal language (\u201ccauses,\u201d \u201cimproves\u201d) for an observational study.', 'Overly broad populations (\u201call people\u201d).'],
    example: '<p>Random sample of adults in Clearwater; no treatment assigned; coffee drinkers slept less. Supported: an <b>association</b> among <b>adults in Clearwater</b> \u2014 not causation, not everyone.</p>',
  };
  L.av = {
    what: 'Area, perimeter, surface area, and volume, including composite figures and scale factors.',
    looks: '<p>Rectangles, triangles, trapezoids \u00b7 prisms, cylinders, cones, spheres \u00b7 \u201cthe volume is k\u03c0\u201d \u00b7 \u201cif each edge is tripled\u2026\u201d</p>',
    steps: ['Identify the shape and write its formula (many are on the reference sheet).', 'Substitute carefully; keep \u03c0 symbolic if the answer is \u201ck\u03c0.\u201d', 'For composite figures, add or subtract simple pieces.', 'For scaling, lengths \u00d7k, areas \u00d7k\u00b2, volumes \u00d7k\u00b3.'],
    rules: [R`Cylinder \(V = \pi r^2h\); cone \(V = \frac{1}{3}\pi r^2h\); sphere \(V = \frac{4}{3}\pi r^3\).`, R`Trapezoid \(A = \frac{1}{2}(b_1 + b_2)h\).`, 'Cube: surface area 6s\u00b2, volume s\u00b3.'],
    traps: ['Using diameter instead of radius.', 'Scaling volume by k instead of k\u00b3.', 'Forgetting the \u00bd in triangle or trapezoid area.'],
    example: R`<p>A sphere has volume \(36\pi\): \(\frac{4}{3}\pi r^3 = 36\pi \Rightarrow r^3 = 27 \Rightarrow r = 3\).</p>`,
  };
  L.lat = {
    what: 'Angle relationships, parallel lines cut by transversals, triangle angle sums, isosceles triangles, and similar triangles.',
    looks: '<p>Parallel lines with a transversal \u00b7 triangle with two angles given \u00b7 linear pairs with algebraic expressions \u00b7 a segment parallel to a side of a triangle.</p>',
    steps: ['Mark every angle you know on the figure.', 'Use: linear pairs sum to 180\u00b0, vertical angles are equal, triangle angles sum to 180\u00b0.', 'With parallel lines, all acute angles are equal and all obtuse angles are equal.', 'For similar triangles, match corresponding vertices, then set up a proportion.'],
    rules: ['Exterior angle = sum of the two remote interior angles.', 'Isosceles: angles opposite equal sides are equal.', 'A line parallel to one side of a triangle creates a similar triangle.'],
    traps: ['Mismatching corresponding sides in a proportion.', 'Using the part (DB) instead of the whole side (AB).'],
    example: R`<p>\(DE \parallel BC\), \(AD = 2\), \(DB = 9\), \(DE = 9\): \(\frac{BC}{9} = \frac{11}{2}\), so \(BC = 49.5\).</p>`,
  };
  L.rtt = {
    what: 'The Pythagorean theorem, special right triangles, sine, cosine, tangent, complementary angles, and radians.',
    looks: R`<p>Find a missing side \u00b7 \(\sin A\) from a triangle \u00b7 \(\sin x^\circ = \cos 40^\circ\) \u00b7 30-60-90 triangles \u00b7 convert 150\u00b0 to radians.</p>`,
    steps: ['Label sides relative to the angle: opposite, adjacent, hypotenuse.', 'SOH-CAH-TOA: sin = opp/hyp, cos = adj/hyp, tan = opp/adj.', 'Know the Pythagorean triples: 3-4-5, 5-12-13, 8-15-17, 7-24-25 (and multiples).', 'Degrees \u2192 radians: multiply by \u03c0/180.'],
    rules: [R`\(a^2 + b^2 = c^2\)`, R`30-60-90: \(x : x\sqrt{3} : 2x\); 45-45-90: \(s : s : s\sqrt{2}\)`, R`\(\sin x^\circ = \cos(90^\circ - x^\circ)\)`, R`\(180^\circ = \pi\) radians`],
    traps: ['Using the adjacent side for sine.', 'Putting \u221a3 on the short leg.', 'Treating complementary as supplementary.'],
    example: R`<p>\(\sin\theta = \frac{5}{13}\): adjacent side \(= \sqrt{169 - 25} = 12\), so \(\tan\theta = \frac{5}{12}\).</p>`,
  };
  L.cir = {
    what: 'Circumference, area, arcs, sectors, radians, and equations of circles in the xy-plane.',
    looks: R`<p>Area and circumference \u00b7 arc length for a central angle \u00b7 \((x - 3)^2 + (y + 2)^2 = 25\) \u00b7 \(x^2 + y^2 + 6x - 4y = 12\).</p>`,
    steps: ['A central angle of \u03b8\u00b0 cuts off \u03b8/360 of the circle: arc = fraction \u00d7 circumference, sector = fraction \u00d7 area.', 'In radians, arc length s = r\u03b8.', 'For a general-form circle equation, complete the square in x and in y.', 'Center is (h, k) from (x \u2212 h)\u00b2 + (y \u2212 k)\u00b2 = r\u00b2; note the sign flip.'],
    rules: [R`\(C = 2\pi r\), \(A = \pi r^2\)`, R`Arc \(= \frac{\theta}{360}\cdot 2\pi r\); sector \(= \frac{\theta}{360}\cdot\pi r^2\)`, R`Circle: \((x - h)^2 + (y - k)^2 = r^2\)`],
    traps: ['Giving r\u00b2 when asked for r.', 'Sign errors on the center.', 'Mixing up arc length and sector area.'],
    example: R`<p>\(x^2 + y^2 + 6x - 4y = 12\): \((x + 3)^2 + (y - 2)^2 = 12 + 9 + 4 = 25\), so the radius is 5.</p>`,
  };
})();
