const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign,
} = require('docx');

const D = __dirname;
const FONT = 'Times New Roman';
const SZ = 24; // 12 pt
const INDENT = 709; // 1.25 cm
const CM = 567;

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? SZ, bold: o.bold, italics: o.italics, superScript: o.sup, subScript: o.sub });

// A body paragraph: justified, first-line indent, optional bold run-in heading.
function para(parts, o = {}) {
  const children = (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? run(p, o) : p));
  return new Paragraph({
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    indent: o.noIndent ? undefined : { firstLine: INDENT },
    spacing: { line: 240, before: o.before ?? 0, after: o.after ?? 0 },
    keepNext: o.keepNext,
    children,
  });
}
const blank = () => new Paragraph({ spacing: { line: 240, before: 0, after: 0 }, children: [run('')] });
const head = (t) => run(t + ' ', { bold: true });

function figure(file, type, wCm, pxW, pxH, caption) {
  const w = Math.round(wCm * 37.8); // px at 96 dpi
  const h = Math.round(w * pxH / pxW);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 }, keepNext: true,
      children: [new ImageRun({ type, data: fs.readFileSync(path.join(D, file)), transformation: { width: w, height: h },
        altText: { title: caption, description: caption, name: file } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40, after: 80 }, children: [run(caption)] }),
  ];
}

// ---------------------------------------------------------------- results (from the training run)
const R = JSON.parse(fs.readFileSync('/Users/nicucociorva/Documents/neuronal network face/ml/textnet/results.json', 'utf8'));
const pc = (x) => (100 * x).toFixed(1);
const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };
function makeTable(cols, header, rows, align) {
  const cell = (text, i, o = {}) => new TableCell({
    borders, width: { size: cols[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: o.head ? { fill: 'E7E7E7', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 0, bottom: 0, left: 70, right: 70 },
    children: [new Paragraph({ alignment: align(i) ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { line: 240 },
      children: [run(text, { bold: o.head || o.bold, size: 20 })] })],
  });
  return new Table({
    width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: cols, alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, i, { head: true })) }),
      ...rows.map((r, k) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, i, { bold: k === rows.length - 1 && r[0].startsWith('Full') })) })),
    ],
  });
}
const F = R.full, L = R.lexicon_baseline, H = R.handset;
const t1 = makeTable([3000, 1660, 1660, 1660, 1664],
  ['Model', 'Seen forms', 'Unseen forms', 'Ambig. verbs', 'Natural texts'],
  [
    ['Lexicon (no context)', pc(L.seen), pc(L.unseen_forms), '–', pc(H.B_heldout.lexicon_acc)],
    ['Without clause memory', pc(R.no_pre.seen.clause_acc), pc(R.no_pre.unseen_forms.clause_acc), pc(R.no_pre.seen.ambiguous_verb_acc_lookahead), '–'],
    ['Without lookahead', pc(R.no_post.seen.clause_acc), pc(R.no_post.unseen_forms.clause_acc), pc(R.no_post.seen.ambiguous_verb_acc_lookahead), '–'],
    ['Without integrator', pc(R.no_integrator.seen.clause_acc), pc(R.no_integrator.unseen_forms.clause_acc), pc(R.no_integrator.seen.ambiguous_verb_acc_lookahead), '–'],
    ['Full network', pc(F.seen.clause_acc), pc(F.unseen_forms.clause_acc), pc(F.seen.ambiguous_verb_acc_lookahead), pc(H.B_heldout.net_acc)],
  ], (i) => i > 0);
const t2 = makeTable([1900, 1500, 1200, 1900, 1500, 1200],
  ['Expression', 'Read as', 'Score', 'Expression', 'Read as', 'Score'],
  [
    ['Neutral', 'neutral', '0.88', 'Fear', 'sadness *', '0.37'],
    ['Melancholy', 'sadness', '0.61', 'Disgust', 'anger *', '0.58'],
    ['Sadness', 'sadness', '0.59', 'Contempt', 'anger *', '0.41'],
    ['Grief', 'sadness', '0.58', 'Stage: listening', 'neutral', '0.52'],
    ['Joy', 'joy', '0.76', 'Stage: shock', 'surprise', '0.41'],
    ['Surprise', 'surprise', '0.55', 'Stage: disbelief', 'sadness', '0.55'],
    ['Anger', 'anger', '0.79', 'Stage: compassion', 'sadness', '0.61'],
  ], (i) => i % 3 === 2);
const kParams = Math.round(R.params / 1000);
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 40 }, keepNext: true, children: [run(t)] });

// ---------------------------------------------------------------- text
const it = (t) => run(t, { italics: true });
const sub = (t) => run(t, { italics: true, sub: true });
const formula = new Paragraph({
  alignment: AlignmentType.LEFT, spacing: { line: 240, before: 40, after: 40 },
  tabStops: [{ type: 'center', position: 4819 }, { type: 'right', position: 9638 }],
  children: [run('\t'), it('s'), sub('t'), run(' = (1 − '), it('g'), sub('t'), run(') '), it('s'), sub('t−1'), run(' + '), it('g'), sub('t'), run(' '), it('p'), sub('t'), run(','), run('\t(1)')],
});
const children = [
  para('UDC 004.8:004.032.26', { noIndent: true, align: AlignmentType.LEFT }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 240 },
    children: [run('FROM TEXT TO FACE: A NEURAL NETWORK FOR LIVE, CONTEXT-AWARE EMOTION TRAJECTORIES DRIVING AN ANATOMICALLY GROUNDED 3D AVATAR', { bold: true })] }),
  para('Cociorva N. (sal3ottage@gmail.com)', { noIndent: true, align: AlignmentType.RIGHT }),
  para([run('Technical University of Moldova, Moldova; Clon, Moldova', { italics: true })], { noIndent: true, align: AlignmentType.LEFT }),
  blank(),
  para(`Text-driven avatars usually show one emotion label per sentence as a fixed facial preset, so the face neither follows the words nor stays consistent in time. This paper presents an affect-stream neural network that reads Romanian text word by word, splits it into clauses, relates every word to the clauses before it and to the words that follow, and keeps an emotional state that changes gradually, computed while the text is still arriving. The state drives a photorealistic 3D head with 52 muscle shapes authored from facial anatomy and linked to brain and facial-nerve pathways. On 40 unseen hand-written sentences the network identified the emotion in ${pc(H.B_heldout.net_acc)} % of cases, against ${pc(H.B_heldout.lexicon_acc)} % for a lexicon, and an independent face analyser recognised 7 of 10 generated expressions.`, { italics: true }),
  blank(),
  para([head('Introduction.'), run('A virtual assistant or tutor is judged less by what it says than by how its face reacts while it listens. Emotion recognition from text is mature: word–emotion lexicons [3], transformers fine-tuned on GoEmotions [4] and multimodal language models that explain their answer [5]. All of them return one label for a finished sentence: they cannot say what a listener feels after the third word, and the larger ones need a server. On the face side, a fixed blendshape preset looks frozen, and learned 3D models such as EMOCA [6] reconstruct expressions from photographs but neither unfold a reaction in time nor tell which muscle moves and why. Yet a face is not a readout of a category [2]; it is believed for its timing and consistency. Missing is a small model that follows emotion through the text as it is heard, coupled to a face whose every movement is anatomically explained.')]),
  para([head('Aim and tasks.'), run('The aim of the work is a system that turns text, word by word, into a natural and consistent emotional reaction of a 3D avatar. The following tasks were solved: 1) to design and train a neural network that extracts a time-varying emotional state from text using the context before and after each word; 2) to build an anatomically grounded expression generator driven by that state, with timing and speech; 3) to evaluate both parts objectively.')]),
  para([head('Method and solution.'), run(`The architecture is shown in Fig. 1. Words are represented by hashed character 2–4-grams [11], which lets inflected forms (trist, tristă, triști) and text typed without diacritics share features. A GRU [10] with 64 units reads the words, and a small segmenter decides where a new clause begins; each finished clause is kept as a memory vector. Each word then combines its GRU state, attention over earlier clauses, the current clause and the next two words. From this it predicts a target emotion `), it('p'), sub('t'), run(' over eight classes and an impact gate '), it('g'), sub('t'), run(', and updates the state as')]),
  formula,
  para([run('so function words leave the state almost unchanged and the emotion cannot jump (1). As no Romanian corpus is annotated word by word, a generator composes '), run(`${(R.corpus.train / 1000).toFixed(0)},000 texts`), run(' from emotion adjectives, events and neutral clauses, and a rule-based appraisal teacher labels every word: negation, intensifiers, contrast (“dar”), the shock that precedes bad news and verbs whose meaning depends on their object (“am pierdut portofelul” versus “am pierdut kilogramele”). During training texts are cut at random words, so the model learns to give the last word a provisional reading and to revise it when the next words arrive.')], { noIndent: true }),
  ...figure('fig1_architecture.png', 'png', 14, 1639, 300, 'Fig. 1. System architecture'),
  para('The state is mapped onto 93 emotion nodes with recipes in the Facial Action Coding System [1], [7] and rendered in the 52-coefficient space of MediaPipe and ARKit [8]. The 52 shapes are not learned: each is a displacement field in millimetres, authored on the 478 landmarks of a scanned head after the anatomy of its action unit and transferred to 9,279 skin vertices. Inside the head (Fig. 2) a neuromotor model of 71 nodes, 91 pathways and 38 muscles links each expression to its origin, from the limbic structures through the motor cortex and the facial nucleus to the five branches of the facial nerve, including the bilateral control of the upper face and the separate voluntary and emotional pathways [9].'),
  ...figure('fig_inside.jpg', 'jpg', 10.5, 1936, 640, 'Fig. 2. Inside the avatar’s head: a) facial graph of 1,517 nodes and 4,792 links in three layers; b), c) neuromotor pathways active for sadness, from brain nodes to the facial nerve branches'),
  para('A timeline engine turns the trajectory into a scene: each word takes effect about 0.3 s after it is heard, and where the state moves a beat is placed whose expression is a mixture of emotion presets weighted by the state. Surprise followed by a negative emotion becomes a short freeze with a slight head shake, sadness turns into compassion, and the reply is spoken with visemes derived from the Romanian spelling. Brows, mouth and head move at their own rates (Fig. 3).'),
  ...figure('fig2_textnet_full.jpg', 'jpg', 10, 2100, 750, 'Fig. 3. a) State per word for “Am câștigat concursul, dar mi-a murit câinele” (dashed: predicted clause boundary); b) reaction generated from “A murit fratele”: listening, shock, sadness, compassion, reply'),
  para([head('Results.'), run(`The network was evaluated on 3,000 generated texts, on 1,500 texts containing word forms excluded from training, and on 40 natural sentences written by hand before the final training and not changed afterwards (Table 1). Clause boundaries are found with an F1 of ${pc(F.seen.segment_f1)} %.`)]),
  para(`The lexicon fails where context matters. The lookahead is the most useful part, raising ambiguous verbs from ${pc(F.seen.ambiguous_verb_acc_no_lookahead)} % for the provisional reading to ${pc(F.seen.ambiguous_verb_acc_lookahead)} %. The integrator helps on unseen forms and keeps the shown emotion changing ${F.seen.flips_per_word_model.toFixed(3)} times per word, close to the teacher’s ${F.seen.flips_per_word_teacher.toFixed(3)}. The clause memory adds only ${(100 * (F.unseen_forms.clause_acc - R.no_pre.unseen_forms.clause_acc)).toFixed(1)} points, because the integrator already carries the past.`),
  caption('Table 1 – Clause-level emotion accuracy, %, of the network and its ablations'),
  t1,
  para(`Read by MediaPipe, trained on real faces, the avatar showed neutral, joy, surprise, anger and all three depths of sadness correctly (7 of 10); fear was taken for sadness, disgust and contempt for anger, and every stage of the bad-news reaction was read as intended.`),
  para([head('Conclusions.'), run(`1) The affect-stream network follows emotion through the text as it arrives; context on both sides of each word handles negation, contrast and ambiguous verbs and gives ${pc(H.B_heldout.net_acc)} % on unseen natural sentences, against ${pc(H.B_heldout.lexicon_acc)} % for a lexicon. 2) The anatomically authored 52-muscle face with its neuromotor model and timeline turns this trajectory into an explainable reaction with synchronised Romanian speech. 3) An independent analyser recognised 7 of 10 expressions and all reaction stages. The main limit is the synthetic corpus; the next step is a human-annotated one. The work is carried out at Clon, founded by the author, Nicolae Cociorva, with the goal of rebuilding in software the brain circuits that let people feel and show emotion, so that avatars can both express and read emotions and hold a natural conversation.`)]),
  blank(),
  para([run('References', { bold: true })], { noIndent: true, align: AlignmentType.LEFT }),
];

const refs = [
  [run('[1] P. Ekman, W. V. Friesen, and J. C. Hager, '), run('Facial Action Coding System: The Manual', { italics: true }), run('. Salt Lake City, UT, USA: Research Nexus, 2002.')],
  [run('[2] L. F. Barrett, R. Adolphs, S. Marsella, A. M. Martinez, and S. D. Pollak, “Emotional expressions reconsidered: Challenges to inferring emotion from human facial movements,” '), run('Psychol. Sci. Public Interest', { italics: true }), run(', vol. 20, no. 1, pp. 1–68, 2019.')],
  [run('[3] S. M. Mohammad and P. D. Turney, “Crowdsourcing a word–emotion association lexicon,” '), run('Comput. Intell.', { italics: true }), run(', vol. 29, no. 3, pp. 436–465, 2013.')],
  [run('[4] D. Demszky, D. Movshovitz-Attias, J. Ko, A. Cowen, G. Nemade, and S. Ravi, “GoEmotions: A dataset of fine-grained emotions,” in '), run('Proc. 58th Annu. Meeting Assoc. Comput. Linguistics', { italics: true }), run(', 2020, pp. 4040–4054.')],
  [run('[5] Z. Cheng et al., “Emotion-LLaMA: Multimodal emotion recognition and reasoning with instruction tuning,” in '), run('Advances in Neural Information Processing Systems', { italics: true }), run(', vol. 37, 2024.')],
  [run('[6] R. Daněček, M. J. Black, and T. Bolkart, “EMOCA: Emotion driven monocular face capture and animation,” in '), run('Proc. IEEE/CVF Conf. Comput. Vis. Pattern Recognit.', { italics: true }), run(', 2022, pp. 20311–20322.')],
  [run('[7] S. Du, Y. Tao, and A. M. Martinez, “Compound facial expressions of emotion,” '), run('Proc. Natl. Acad. Sci. USA', { italics: true }), run(', vol. 111, no. 15, pp. E1454–E1462, 2014.')],
  [run('[8] Y. Kartynnik, A. Ablavatski, I. Grishchenko, and M. Grundmann, “Real-time facial surface geometry from monocular video on mobile GPUs,” arXiv:1907.06724, 2019.')],
  [run('[9] H. C. Hopf, W. Müller-Forell, and N. J. Hopf, “Localization of emotional and volitional facial paresis,” '), run('Neurology', { italics: true }), run(', vol. 42, no. 10, pp. 1918–1923, 1992.')],
];
refs.push(
  [run('[10] K. Cho et al., “Learning phrase representations using RNN encoder–decoder for statistical machine translation,” in '), run('Proc. EMNLP', { italics: true }), run(', 2014, pp. 1724–1734.')],
  [run('[11] P. Bojanowski, E. Grave, A. Joulin, and T. Mikolov, “Enriching word vectors with subword information,” '), run('Trans. Assoc. Comput. Linguistics', { italics: true }), run(', vol. 5, pp. 135–146, 2017.')],
);
for (const r of refs) children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 240 }, children: r }));

const doc = new Document({
  creator: 'Cociorva N.',
  title: 'From text to face',
  styles: { default: { document: { run: { font: FONT, size: SZ } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 2 * CM, bottom: 2 * CM, left: 2 * CM, right: 2 * CM } } },
    children,
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(D, 'Cociorva_ITIA_2026.docx'), b); console.log('written'); });
