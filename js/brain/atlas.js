/*
 * The emotional brain: structures, pathways, what happens in time, and what the science does and
 * does not support. Every claim here is tied to a source in SOURCES.
 *
 * Positions are MNI coordinates (mm; +x = subject's RIGHT, +y = front, +z = up), the standard
 * space of human neuroimaging, taken as typical centroids / peaks from the literature. They are
 * placed inside the scanned head by an approximate registration (see mniToModel): the MNI brain
 * scaled to fit this skull front-to-back and at the top. Good to a few millimetres for large
 * structures; schematic for the tiny brainstem nuclei, which are drawn larger than life so they
 * can be seen and clicked.
 */

// ------------------------------------------------------------------------------ placement
// Anterior commissure (MNI origin) in scan units and the scan-units-per-MNI-mm scale. Fitted to
// this head: frontal pole ~12 mm behind the forehead skin, occipital pole ~15 mm inside the back
// of the head, vertex ~10 mm under the crown. The face-derived scale (0.01875 / mm) would leave a
// 33 mm gap at the back: this scan's head is larger than the MNI average.
const AC = [0, 2.18, 0.455];
const S = 0.0205;

/** MNI (mm) -> scan model coordinates. `midX` is the face midline (faceBasis frame origin). */
export function mniToModel([x, y, z], midX = -0.11) {
  return [midX - x * S, AC[1] + z * S, AC[2] + y * S];
}
export const MM_TO_MODEL = S;

// ------------------------------------------------------------------------------ systems
export const SYSTEMS = {
  limbic: { ro: 'Limbic / subcortical', color: '#c77dff' },
  cortex: { ro: 'Cortex prefrontal și cingular', color: '#6fa8ff' },
  reward: { ro: 'Recompensă (dopamină)', color: '#ffd166' },
  brainstem: { ro: 'Trunchi cerebral', color: '#62f0c8' },
  sensory: { ro: 'Percepție (fețe, simțuri)', color: '#9ff3ff' },
  motor: { ro: 'Motor (expresia facială)', color: '#ff7a6b' },
};

// ------------------------------------------------------------------------------ sources
export const SOURCES = {
  mendez2016: { t: 'Méndez-Bértolo et al. (2016). A fast pathway for fear in human amygdala. Nature Neuroscience 19, 1041–1049.', url: 'https://www.nature.com/articles/nn.4324' },
  dimberg2000: { t: 'Dimberg, Thunberg & Elmehed (2000). Unconscious facial reactions to emotional facial expressions. Psychological Science 11, 86–89.', url: 'https://journals.sagepub.com/doi/abs/10.1111/1467-9280.00221' },
  barrett2019: { t: 'Barrett, Adolphs, Marsella, Martinez & Pollak (2019). Emotional expressions reconsidered. Psychological Science in the Public Interest 20(1), 1–68.', url: 'https://journals.sagepub.com/doi/full/10.1177/1529100619832930' },
  lindquist2012: { t: 'Lindquist, Wager, Kober, Bliss-Moreau & Barrett (2012). The brain basis of emotion: a meta-analytic review. Behavioral and Brain Sciences 35(3), 121–143.', url: 'https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/brain-basis-of-emotion-a-metaanalytic-review/80F95F093305C76BA2C66BBA48D4BC8A' },
  kragel2016: { t: 'Kragel & LaBar (2016). Decoding the nature of emotion in the brain. Trends in Cognitive Sciences 20(6), 444–455.', url: 'https://pubmed.ncbi.nlm.nih.gov/27133227/' },
  hopf1992: { t: 'Hopf, Müller-Forell & Hopf (1992). Localization of emotional and volitional facial paresis. Neurology 42(10), 1918–1923.', url: 'https://www.neurology.org/doi/10.1212/WNL.42.10.1918' },
  morecraft2001: { t: 'Morecraft, Louie, Herrick & Stilwell-Morecraft (2001). Cortical innervation of the facial nucleus in the non-human primate. Brain 124, 176–208.', url: 'https://academic.oup.com/brain/article/124/1/176/286402' },
  gothard2014: { t: 'Gothard (2014). The amygdalo-motor pathways and the control of facial expressions. Frontiers in Neuroscience 8, 43.', url: 'https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2014.00043/full' },
  ledoux2016: { t: 'LeDoux & Pine (2016). Using neuroscience to help understand fear and anxiety: a two-system framework. American Journal of Psychiatry 173, 1083–1093.', url: 'https://pubmed.ncbi.nlm.nih.gov/27609244/' },
  feinstein2011: { t: 'Feinstein, Adolphs, Damasio & Tranel (2011). The human amygdala and the induction and experience of fear. Current Biology 21, 34–38.', url: 'https://www.cell.com/current-biology/fulltext/S0960-9822(10)01508-3' },
  berridge2009: { t: 'Berridge, Robinson & Aldridge (2009). Dissecting components of reward: “liking”, “wanting”, and learning. Current Opinion in Pharmacology 9, 65–73.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2756052/' },
  mayberg1999: { t: 'Mayberg et al. (1999). Reciprocal limbic-cortical function and negative mood: converging PET findings in depression and normal sadness. American Journal of Psychiatry 156, 675–682.', url: 'https://psychiatryonline.org/doi/10.1176/ajp.156.5.675' },
  panksepp: { t: 'Panksepp (1998, 2012). Affective Neuroscience; The Archaeology of Mind — seven primary emotional systems (SEEKING, RAGE, FEAR, LUST, CARE, PANIC/GRIEF, PLAY).', url: 'https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2018.01025/full' },
  bylsma2019: { t: 'Bylsma, Gračanin & Vingerhoets (2019). The neurobiology of human crying. Clinical Autonomic Research 29, 63–73.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6201288/' },
  schmidt2006: { t: 'Schmidt, Ambadar, Cohn & Reed (2006). Movement differences between deliberate and spontaneous facial expressions: zygomaticus major action in smiling. Journal of Nonverbal Behavior 30, 37–52.', url: 'https://link.springer.com/article/10.1007/s10919-005-0003-x' },
  craig2009: { t: 'Craig (2009). How do you feel — now? The anterior insula and human awareness. Nature Reviews Neuroscience 10, 59–70.', url: 'https://www.nature.com/articles/nrn2555' },
  calder2000: { t: 'Calder, Keane, Manes, Antoun & Young (2000). Impaired recognition and experience of disgust following brain injury. Nature Neuroscience 3, 1077–1078.', url: 'https://www.researchgate.net/publication/232794275_Impaired_recognition_and_experience_of_disgust_following_brain_injury' },
  straube2010: { t: 'Straube et al. (2010). No impairment of recognition and experience of disgust in a patient with a right-hemispheric lesion of the insula and basal ganglia. Neuropsychologia 48(6), 1735–1741.', url: 'https://pubmed.ncbi.nlm.nih.gov/20188112/' },
  dickerson2004: { t: 'Dickerson & Kemeny (2004). Acute stressors and cortisol responses: a theoretical integration and synthesis of laboratory research. Psychological Bulletin 130, 355–391.', url: 'https://www.semanticscholar.org/paper/Acute-stressors-and-cortisol-responses:-a-and-of-Dickerson-Kemeny/06c34ed878f059ce891417855190fcb86d3a0dac' },
  bentin1996: { t: 'Bentin, Allison, Puce, Perez & McCarthy (1996). Electrophysiological studies of face perception in humans (componenta N170). Journal of Cognitive Neuroscience 8, 551–565.', url: 'https://doi.org/10.1162/jocn.1996.8.6.551' },
  ochsner2005: { t: 'Ochsner & Gross (2005). The cognitive control of emotion. Trends in Cognitive Sciences 9, 242–249.', url: 'https://doi.org/10.1016/j.tics.2005.03.010' },
  brainstemAtlas: { t: 'Levinson et al. (2023). A structural connectivity atlas of limbic brainstem nuclei (LC, NTS, PAG, VTA, rafeul dorsal, în spațiul MNI). Frontiers in Neuroimaging 1, 1009399.', url: 'https://www.frontiersin.org/journals/neuroimaging/articles/10.3389/fnimg.2022.1009399/full' },
};

// ------------------------------------------------------------------------------ structures
// mni: centroid (one hemisphere for paired structures, x > 0 = right); r: half-sizes in mm
// (x, y, z) for the drawn ellipsoid; pair: mirrored to both hemispheres.
const st = (id, ro, en, system, mni, r, pair, what, evidence, cite, extra = {}) =>
  ({ id, ro, en, system, mni, r, pair, what, evidence, cite, ...extra });

export const STRUCTURES = [
  st('amygdala', 'Amigdala', 'Amygdala', 'limbic', [23, -5, -18], [9, 10, 8], true,
    'Evaluează rapid ce contează pentru tine — mai ales amenințări, dar și recompense și fețe. Declanșează reacțiile corpului (inimă, pupile, încremenire) prin hipotalamus și trunchiul cerebral.',
    'Răspunde la fețe speriate la doar 74 ms, pe o cale subcorticală rapidă, doar la contururi (frecvențe spațiale joase). Pacienta S.M., fără amigdale, nu simte frică — dar simte celelalte emoții.',
    ['mendez2016', 'feinstein2011'], { myth: 'Nu e „centrul fricii”: e un detector de relevanță; fără ea frica dispare, dar celelalte emoții rămân.' }),
  st('hippocampus', 'Hipocamp', 'Hippocampus', 'limbic', [29, -22, -12], [8, 20, 8], true,
    'Contextul și memoria: îți spune unde și când — de ce aceeași situație sperie într-un loc și nu în altul.',
    'Lucrează în pereche cu amigdala: amigdala marchează ce e important, hipocampul leagă de context.', ['lindquist2012']),
  st('hypothalamus', 'Hipotalamus', 'Hypothalamus', 'limbic', [0, -5, -10], [6, 6, 6], false,
    'Transformă emoția în corp: sistemul nervos autonom (puls, transpirație, roșeață, paloare) și hormonii de stres (axa hipotalamus–hipofiză–suprarenală).',
    'Cortizolul — produsul final al axei — atinge vârful la 20–40 de minute după un stres acut: emoția ține mult după ce expresia a dispărut.', ['dickerson2004']),
  st('pituitary', 'Hipofiză', 'Pituitary', 'limbic', [0, 2, -34], [5, 4, 4], false,
    'Glanda care primește comanda hipotalamusului și pornește eliberarea de cortizol în suprarenale.', 'Veriga din mijloc a axei stresului.', ['dickerson2004']),
  st('thalamus', 'Talamus', 'Thalamus', 'sensory', [11, -18, 7], [9, 15, 10], true,
    'Stație de releu pentru simțuri. Pulvinarul (partea lui posterioară) face parte din calea rapidă spre amigdală.',
    'Calea rapidă: coliculul superior → pulvinar → amigdală, independentă de cortexul vizual.', ['mendez2016']),
  st('colliculus', 'Coliculul superior', 'Superior colliculus', 'sensory', [5, -30, -5], [3.5, 3.5, 3.5], true,
    'Veche structură vizuală a mezencefalului: vede mișcarea și contururile grosiere, foarte repede.', 'Prima verigă a căii subcorticale spre amigdală.', ['mendez2016']),
  st('v1', 'Cortex vizual', 'Visual cortex', 'sensory', [12, -88, 4], [10, 8, 12], true,
    'Analiza detaliată a imaginii — calea „lentă”, dar precisă, spre recunoașterea feței și a expresiei.', 'Răspunsurile de frică apar aici mai târziu decât în amigdală.', ['mendez2016']),
  st('ffa', 'Girusul fusiform (fețe)', 'Fusiform face area', 'sensory', [40, -54, -18], [6, 12, 6], true,
    'Recunoaște că ceva e o față și a cui e.', 'Semnalul electric specific fețelor (N170) apare la ~170 ms.', ['bentin1996']),
  st('psts', 'Sulcul temporal superior', 'Posterior STS', 'sensory', [50, -46, 10], [6, 14, 8], true,
    'Citește ce se mișcă pe față: privirea, gura, expresia — informația socială schimbătoare.', 'Complementar girusului fusiform: identitate acolo, expresie și privire aici.', ['kragel2016']),
  st('insula', 'Insula anterioară', 'Anterior insula', 'cortex', [37, 14, 0], [6, 12, 12], true,
    'Simte starea corpului din interior (interocepție) și o transformă în sentiment: „nodul în gât”, greața, inima care bate.',
    'Activitatea ei corelează cu toate sentimentele trăite, nu doar cu dezgustul. Un pacient cu leziune stângă (NK) nu mai recunoștea dezgustul; unul cu leziune dreaptă, da.',
    ['craig2009', 'calder2000', 'straube2010'], { myth: 'Nu e „centrul dezgustului”: e baza tuturor sentimentelor corporale; efectul asupra dezgustului pare lateralizat.' }),
  st('dacc', 'Cortexul cingular anterior (dorsal)', 'Dorsal ACC', 'cortex', [0, 22, 34], [6, 14, 8], false,
    'Semnalează conflictul și durerea (inclusiv cea socială), reglează reacția autonomă; împreună cu insula formează „rețeaua de relevanță”.',
    'Face parte din rețelele distribuite găsite în toate categoriile de emoții.', ['lindquist2012']),
  st('sgacc', 'Cingularul subgenual (aria 25)', 'Subgenual ACC (BA25)', 'cortex', [0, 24, -8], [5, 7, 6], false,
    'Legat de tristețe și de dispoziția negativă; controlează reacțiile autonome și hormonale.',
    'Tristețea indusă crește activitatea aici și o scade în prefrontalul dorsolateral drept; stimularea profundă a acestei zone ameliorează depresia severă.', ['mayberg1999']),
  st('vmpfc', 'Cortexul prefrontal ventromedial', 'vmPFC / medial OFC', 'cortex', [0, 46, -12], [10, 10, 8], false,
    'Dă valoare lucrurilor și reglează amigdala: stinge frica învățată, pune emoția în contextul scopurilor tale.', 'Parte a buclei de reglare prefrontal–amigdală.', ['ochsner2005']),
  st('ofc', 'Cortexul orbitofrontal lateral', 'Lateral OFC', 'cortex', [30, 36, -16], [9, 10, 5], true,
    'Evaluează recompense și pedepse, se actualizează când ceva nu mai e plăcut.', 'Integrează valoarea cu informația din simțuri.', ['berridge2009']),
  st('dlpfc', 'Cortexul prefrontal dorsolateral', 'dlPFC', 'cortex', [42, 32, 30], [8, 14, 12], true,
    'Controlul cognitiv al emoției: reinterpretarea („nu e chiar așa de grav”), menținerea scopului.', 'Reinterpretarea cognitivă recrutează prefrontalul lateral și reduce activitatea amigdalei.', ['ochsner2005', 'mayberg1999']),
  st('vlpfc', 'Cortexul prefrontal ventrolateral', 'vlPFC / IFG', 'cortex', [48, 30, 2], [7, 10, 10], true,
    'Inhibă și selectează răspunsuri — inclusiv ascunderea unei expresii.', 'Implicat în reglarea emoțiilor și etichetarea lor verbală.', ['ochsner2005']),
  st('nacc', 'Nucleul accumbens', 'Nucleus accumbens', 'reward', [10, 11, -8], [5, 6, 5], true,
    '„Vreau”: motivația de a obține ceva (dopamină). Câteva puncte mici din el („hotspoturi hedonice”, opioide) fac „îmi place”.',
    'Dorința (wanting) și plăcerea (liking) sunt sisteme separate: dopamina crește dorința, nu plăcerea.', ['berridge2009']),
  st('vta', 'Aria tegmentală ventrală', 'VTA', 'reward', [0, -16, -13], [5, 4, 4], false,
    'Sursa dopaminei pentru accumbens și prefrontal: semnalează recompense neașteptate și împinge spre ele.', 'Calea mezolimbică VTA → accumbens.', ['berridge2009', 'brainstemAtlas']),
  st('pag', 'Substanța cenușie periapeductală', 'PAG', 'brainstem', [0, -30, -10], [4, 5, 6], false,
    'Execută comportamentele de supraviețuire: încremenire, fugă, atac, vocalizări; modulează durerea (opioide).',
    'Ținta principală a amigdalei pentru răspunsurile defensive; parte din sistemele emoționale subcorticale descrise la toate mamiferele.', ['panksepp', 'ledoux2016']),
  st('lc', 'Locus coeruleus', 'Locus coeruleus', 'brainstem', [5, -37, -27], [2.5, 5, 4], true,
    'Sursa noradrenalinei: trezirea, vigilența, pupilele dilatate.', 'Nucleu mic din punte, desenat mai mare ca să se vadă.', ['brainstemAtlas']),
  st('raphe', 'Nucleul rafeului dorsal', 'Dorsal raphe', 'brainstem', [0, -27, -17], [3, 5, 4], false,
    'Sursa serotoninei: dispoziție, răbdare, controlul impulsurilor.', 'Proiectează spre aproape tot creierul.', ['brainstemAtlas']),
  st('facialN', 'Nucleul nervului facial (VII)', 'Facial motor nucleus', 'motor', [12, -38, -40], [4, 4, 4], true,
    'Ultima oprire în creier: de aici pornesc fibrele nervului VII spre toți mușchii mimici. Primește comenzi și pe calea voluntară, și pe cea emoțională.',
    'Partea pentru fața de sus primește fibre din cortexul motor al ambelor emisfere și din cortexul cingular motor; cea pentru fața de jos, mai ales din emisfera opusă.', ['morecraft2001'], { inModel: 'nucleus' }),
  st('ssn', 'Nucleul salivator superior (lacrimal)', 'Superior salivatory nucleus', 'brainstem', [9, -36, -34], [2.5, 2.5, 2.5], true,
    'Comanda lacrimilor: fibre parasimpatice care merg împreună cu nervul facial spre glanda lacrimală.',
    'Primește intrări din cortexul frontal, ganglionii bazali, talamus și hipotalamus — de aceea plângem de emoție, nu doar din reflex.', ['bylsma2019']),
  st('m1face', 'Cortexul motor (aria feței)', 'M1 face area', 'motor', [54, -8, 32], [6, 8, 10], true,
    'Calea VOLUNTARĂ a expresiei: zâmbetul „la comandă”, prin tractul piramidal.',
    'O leziune aici paralizează mișcarea voluntară a feței, dar un zâmbet spontan la o glumă rămâne posibil — și invers pentru leziunile căii emoționale.', ['hopf1992', 'morecraft2001'], { inModel: 'cortex' }),
  st('cma', 'Aria motorie cingulară', 'Cingulate motor areas (M3/M4)', 'motor', [6, 12, 42], [5, 10, 6], true,
    'Calea EMOȚIONALĂ a expresiei: legată de sistemul limbic, trimite comenzi spre nucleul facial, mai ales pentru fața de sus.',
    'Cortexul cingular motor rostral (M3) proiectează bilateral spre partea nucleului facial care controlează fruntea și pleoapele.', ['morecraft2001', 'gothard2014']),
];

// ------------------------------------------------------------------------------ pathways
// from/to: structure ids; side: 'same' draws the right-hemisphere version (and its mirror);
// kind groups the colour and meaning.
export const PATHWAYS = [
  { id: 'fast1', from: 'colliculus', to: 'thalamus', kind: 'fast', ro: 'Calea rapidă: colicul → pulvinar', cite: ['mendez2016'] },
  { id: 'fast2', from: 'thalamus', to: 'amygdala', kind: 'fast', ro: 'Calea rapidă: pulvinar → amigdală (~74 ms)', cite: ['mendez2016'] },
  { id: 'slow1', from: 'thalamus', to: 'v1', kind: 'sense', ro: 'Talamus → cortex vizual', cite: [] },
  { id: 'slow2', from: 'v1', to: 'ffa', kind: 'sense', ro: 'Cortex vizual → fusiform (fața)', cite: ['bentin1996'] },
  { id: 'slow3', from: 'v1', to: 'psts', kind: 'sense', ro: 'Cortex vizual → STS (expresia)', cite: [] },
  { id: 'slow4', from: 'ffa', to: 'amygdala', kind: 'sense', ro: 'Fusiform → amigdală (calea lentă, detaliată)', cite: [] },
  { id: 'hypo', from: 'amygdala', to: 'hypothalamus', kind: 'body', ro: 'Amigdală → hipotalamus (corp, hormoni)', cite: [] },
  { id: 'hpa', from: 'hypothalamus', to: 'pituitary', kind: 'body', ro: 'Hipotalamus → hipofiză (axa cortizolului)', cite: ['dickerson2004'] },
  { id: 'pag', from: 'amygdala', to: 'pag', kind: 'body', ro: 'Amigdală → PAG (încremenire, fugă)', cite: ['ledoux2016'] },
  { id: 'lc', from: 'amygdala', to: 'lc', kind: 'body', ro: 'Amigdală → locus coeruleus (noradrenalină)', cite: [] },
  { id: 'hippo', from: 'hippocampus', to: 'amygdala', kind: 'limbic', ro: 'Hipocamp ↔ amigdală (context, memorie)', cite: [] },
  { id: 'reg1', from: 'vmpfc', to: 'amygdala', kind: 'regulate', ro: 'Prefrontal ventromedial → amigdală (reglare)', cite: ['ochsner2005'] },
  { id: 'reg2', from: 'dlpfc', to: 'vmpfc', kind: 'regulate', ro: 'Prefrontal dorsolateral → ventromedial (reinterpretare)', cite: ['ochsner2005'] },
  { id: 'sal', from: 'insula', to: 'dacc', kind: 'limbic', ro: 'Insulă ↔ cingular (rețeaua de relevanță)', cite: ['craig2009'] },
  { id: 'insamy', from: 'amygdala', to: 'insula', kind: 'limbic', ro: 'Amigdală ↔ insulă', cite: [] },
  { id: 'sad1', from: 'sgacc', to: 'hypothalamus', kind: 'body', ro: 'Cingular subgenual → hipotalamus', cite: ['mayberg1999'] },
  { id: 'meso', from: 'vta', to: 'nacc', kind: 'reward', ro: 'VTA → accumbens (dopamină: „vreau”)', cite: ['berridge2009'] },
  { id: 'mesoc', from: 'vta', to: 'vmpfc', kind: 'reward', ro: 'VTA → prefrontal (dopamină)', cite: [] },
  { id: 'ofcacc', from: 'ofc', to: 'nacc', kind: 'reward', ro: 'Orbitofrontal → accumbens (valoare)', cite: [] },
  { id: 'emo1', from: 'amygdala', to: 'cma', kind: 'emotional', ro: 'Amigdală → aria motorie cingulară', cite: ['gothard2014'] },
  { id: 'emo2', from: 'cma', to: 'facialN', kind: 'emotional', ro: 'Calea EMOȚIONALĂ → nucleul facial', cite: ['morecraft2001', 'hopf1992'] },
  { id: 'vol', from: 'm1face', to: 'facialN', kind: 'voluntary', ro: 'Calea VOLUNTARĂ (piramidală) → nucleul facial', cite: ['hopf1992'] },
  { id: 'pfcm1', from: 'dlpfc', to: 'm1face', kind: 'voluntary', ro: 'Decizie → cortex motor', cite: [] },
  { id: 'tears', from: 'hypothalamus', to: 'ssn', kind: 'body', ro: 'Hipotalamus → nucleul lacrimal', cite: ['bylsma2019'] },
];

export const PATH_KINDS = {
  fast: { ro: 'Cale rapidă subcorticală', color: '#ff5d73' },
  sense: { ro: 'Percepție', color: '#9ff3ff' },
  body: { ro: 'Spre corp (autonom, hormoni)', color: '#62f0c8' },
  limbic: { ro: 'Rețele limbice', color: '#c77dff' },
  regulate: { ro: 'Reglare prefrontală', color: '#6fa8ff' },
  reward: { ro: 'Dopamină / recompensă', color: '#ffd166' },
  emotional: { ro: 'Expresie: calea emoțională', color: '#ff7a6b' },
  voluntary: { ro: 'Expresie: calea voluntară', color: '#ffa45c' },
};

// ------------------------------------------------------------------------------ scenarios
// Each step: when (as published or as a clearly labelled estimate), what lights up, what it means.
// `face` at a step shows that expression on the head (preset key or FACS recipe).
export const SCENARIOS = [
  {
    id: 'fear', ro: 'Frică: vezi o față speriată', face: 'fear',
    steps: [
      { t: '0 ms', on: [], paths: [], title: 'Imaginea atinge retina', text: 'Totul începe cu lumina: încă nu știi nimic despre ce vezi.' },
      { t: '~40–60 ms', est: true, on: ['colliculus', 'thalamus'], paths: ['fast1'], title: 'Calea rapidă pornește', text: 'Coliculul superior și pulvinarul prind contururile grosiere — ocolind cortexul vizual.', cite: ['mendez2016'] },
      { t: '74 ms', on: ['amygdala', 'thalamus'], paths: ['fast2'], title: 'Amigdala reacționează', text: 'Înainte ca fața să fie recunoscută conștient. Doar la fețe speriate, nu la cele neutre sau fericite, și doar la informația de contur.', cite: ['mendez2016'] },
      { t: '~170 ms', on: ['v1', 'ffa', 'psts'], paths: ['slow1', 'slow2', 'slow3', 'slow4'], title: 'Calea lentă: „e o față, și e speriată”', text: 'Cortexul vizual, girusul fusiform și STS analizează detaliat fața și expresia (componenta N170).', cite: ['bentin1996'] },
      { t: '100–300 ms', est: true, on: ['amygdala', 'hypothalamus', 'pag', 'lc'], paths: ['hypo', 'pag', 'lc'], title: 'Corpul se pregătește', text: 'Amigdala activează hipotalamusul, PAG și locus coeruleus: pulsul crește, pupilele se dilată, apare tendința de încremenire. Aceste circuite controlează reacția — nu sentimentul.', cite: ['ledoux2016'] },
      { t: '300–400 ms', on: ['cma', 'facialN', 'amygdala'], paths: ['emo1', 'emo2'], title: 'Fața reacționează', text: 'Mușchii feței răspund în 300–400 ms, chiar dacă imaginea n-a fost văzută conștient — pe calea emoțională, nu pe cea voluntară.', cite: ['dimberg2000', 'hopf1992'], showFace: true },
      { t: 'după ~0,5 s', est: true, on: ['insula', 'dacc', 'vmpfc', 'dlpfc'], paths: ['sal', 'insamy'], title: 'Sentimentul de frică', text: 'Trăirea conștientă apare din circuitele corticale (memorie de lucru, interocepție), separate de cele care au pornit reacția.', cite: ['ledoux2016', 'craig2009'] },
      { t: 'secunde', on: ['dlpfc', 'vmpfc', 'amygdala'], paths: ['reg2', 'reg1'], title: 'Reglarea', text: '„E doar o poză.” Prefrontalul reinterpretează și reduce activitatea amigdalei.', cite: ['ochsner2005'] },
      { t: '20–40 min', on: ['hypothalamus', 'pituitary'], paths: ['hpa'], title: 'Cortizolul atinge vârful', text: 'Expresia a dispărut demult; axa stresului încă lucrează.', cite: ['dickerson2004'] },
    ],
  },
  {
    id: 'sad', ro: 'Tristețe: o pierdere', face: 'grief',
    steps: [
      { t: '0', on: ['v1', 'psts'], paths: [], title: 'Afli o veste proastă', text: 'Tristețea nu pornește de obicei dintr-un stimul brut, ci din ce înseamnă el pentru tine.' },
      { t: 'sute de ms – secunde', est: true, on: ['hippocampus', 'vmpfc', 'dlpfc', 'amygdala'], paths: ['hippo'], title: 'Semnificația', text: 'Memoria și evaluarea prefrontală decid ce ai pierdut. Nicio regiune nu e „centrul tristeții”: sunt rețele distribuite, comune multor emoții.', cite: ['lindquist2012', 'kragel2016'] },
      { t: 'secunde', on: ['sgacc', 'dlpfc'], paths: ['sad1'], title: 'Cingularul subgenual crește', text: 'Tristețea indusă crește activitatea în aria 25 și o scade în prefrontalul dorsolateral drept.', cite: ['mayberg1999'] },
      { t: 'secunde', on: ['insula', 'dacc', 'pag'], paths: ['sal'], title: 'Durerea se simte în corp', text: 'Insula transformă starea corpului în sentiment („nod în gât”); PAG și opioidele endogene țin de durerea separării (sistemul PANIC/GRIEF).', cite: ['craig2009', 'panksepp'] },
      { t: 'secunde', on: ['cma', 'facialN'], paths: ['emo1', 'emo2'], title: 'Fața: sprâncene oblice, colțuri în jos', text: 'Calea emoțională duce semnalul la nucleul facial — fruntea (AU1) primește comandă din ambele emisfere.', cite: ['morecraft2001'], showFace: true },
      { t: 'secunde', on: ['hypothalamus', 'ssn'], paths: ['tears'], title: 'Lacrimile', text: 'Nucleul salivator superior trimite fibre parasimpatice, pe traseul nervului facial, spre glanda lacrimală. Intrări din frontal, talamus și hipotalamus explică plânsul emoțional.', cite: ['bylsma2019'] },
    ],
  },
  {
    id: 'joy', ro: 'Bucurie: o recompensă', face: 'joy',
    steps: [
      { t: '0', on: ['v1'], paths: [], title: 'Ceva bun se întâmplă', text: 'Un mesaj, un prieten, o reușită.' },
      { t: '~100 ms+', est: true, on: ['ofc', 'amygdala'], paths: [], title: 'Evaluarea valorii', text: 'Orbitofrontalul și amigdala marchează că e ceva bun — amigdala nu e doar pentru pericol.', cite: ['berridge2009'] },
      { t: 'sute de ms', est: true, on: ['vta', 'nacc', 'vmpfc'], paths: ['meso', 'mesoc', 'ofcacc'], title: 'Dopamina: „vreau”', text: 'VTA eliberează dopamină în accumbens — motivația. Plăcerea propriu-zisă vine din hotspoturi opioide mici, nu din dopamină.', cite: ['berridge2009'] },
      { t: 'sute de ms', on: ['cma', 'facialN'], paths: ['emo1', 'emo2'], title: 'Zâmbetul autentic', text: 'Pe calea emoțională: colțurile gurii (AU12) și, involuntar, mușchiul din jurul ochilor (AU6) — semnul zâmbetului Duchenne.', cite: ['hopf1992', 'gothard2014'], showFace: true },
    ],
  },
  {
    id: 'posed', ro: 'Zâmbet la comandă', face: '12C',
    steps: [
      { t: '0', on: ['dlpfc', 'vlpfc'], paths: [], title: 'Decizi să zâmbești', text: 'Pentru o poză, din politețe.' },
      { t: 'sute de ms', on: ['dlpfc', 'm1face'], paths: ['pfcm1'], title: 'Cortexul motor', text: 'Aria feței din cortexul motor primar trimite comanda pe tractul piramidal.', cite: ['hopf1992'] },
      { t: 'sute de ms', on: ['m1face', 'facialN'], paths: ['vol'], title: 'Calea voluntară → nucleul facial', text: 'Alt drum decât zâmbetul emoțional: leziunile uneia o lasă intactă pe cealaltă.', cite: ['hopf1992', 'morecraft2001'], showFace: true },
      { t: 'dinamica', on: ['facialN'], paths: [], title: 'Cum se trădează', text: 'Zâmbetele deliberate au debut și retragere mai rapide și amplitudine mai mare. Contrar unei idei răspândite, nu sunt mai asimetrice.', cite: ['schmidt2006'] },
    ],
  },
];

// ------------------------------------------------------------------------------ theories and myths
export const THEORIES = [
  { ro: 'Emoții de bază', who: 'Ekman; Panksepp', text: 'Câteva emoții universale, cu circuite proprii. Panksepp descrie 7 sisteme subcorticale comune mamiferelor: SEEKING, RAGE, FEAR, LUST, CARE, PANIC/GRIEF, PLAY.', cite: ['panksepp'] },
  { ro: 'Emoții construite', who: 'Barrett; Lindquist', text: 'Creierul construiește emoțiile din ingrediente generale — senzații corporale, concepte, context. O meta-analiză a studiilor de imagistică nu a găsit regiuni dedicate fiecărei emoții, ci rețele comune.', cite: ['lindquist2012'] },
  { ro: 'Două sisteme', who: 'LeDoux & Pine', text: 'Circuitele care produc reacția (amigdală, trunchi cerebral) sunt diferite de cele care produc sentimentul conștient (cortex). „Frica” trăită nu e același lucru cu reacția defensivă.', cite: ['ledoux2016'] },
  { ro: 'Tipare distribuite', who: 'Kragel & LaBar', text: 'Emoțiile pot fi totuși decodate din tipare de activitate răspândite prin tot creierul — nici „un centru”, nici „nicio diferență”.', cite: ['kragel2016'] },
];

export const MYTHS = [
  { myth: 'Există un „sistem limbic” care face emoțiile.', fact: 'Emoțiile folosesc rețele larg distribuite, cortex inclus; aceleași regiuni lucrează și în memorie, atenție, percepție.', cite: ['lindquist2012'] },
  { myth: 'Amigdala este centrul fricii.', fact: 'Detectează ce e relevant, inclusiv recompense. Fără ea, frica dispare — dar celelalte emoții rămân.', cite: ['feinstein2011'] },
  { myth: 'Insula este centrul dezgustului.', fact: 'Stă la baza tuturor sentimentelor corporale; deficitul de dezgust după leziuni pare să depindă de emisferă.', cite: ['craig2009', 'straube2010'] },
  { myth: 'Emoția se citește sigur de pe față.', fact: 'Aceeași mișcare facială poate însemna emoții diferite în contexte și culturi diferite; oamenii nu arată mereu ce simt.', cite: ['barrett2019'] },
  { myth: 'Zâmbetele false sunt mai asimetrice.', fact: 'Măsurătorile arată că diferă prin viteză și amplitudine, nu prin asimetrie.', cite: ['schmidt2006'] },
  { myth: 'Dopamina este molecula plăcerii.', fact: 'Dopamina produce dorința („vreau”); plăcerea („îmi place”) vine din sisteme opioide și endocanabinoide mici.', cite: ['berridge2009'] },
];

export const CHEMICALS = [
  { ro: 'Dopamină', from: 'VTA', text: 'Motivație, dorință, învățarea din recompense.', cite: ['berridge2009'] },
  { ro: 'Opioide endogene', from: 'hotspoturi, PAG', text: 'Plăcere („îmi place”), durerea separării, analgezie.', cite: ['berridge2009', 'panksepp'] },
  { ro: 'Noradrenalină', from: 'locus coeruleus', text: 'Vigilență, trezire, pupile dilatate.', cite: ['brainstemAtlas'] },
  { ro: 'Serotonină', from: 'rafeul dorsal', text: 'Dispoziție, răbdare, controlul impulsurilor.', cite: ['brainstemAtlas'] },
  { ro: 'Cortizol', from: 'axa hipotalamus–hipofiză–suprarenale', text: 'Hormonul stresului; vârf la 20–40 min după stres.', cite: ['dickerson2004'] },
];

// What this means for the face model — the bridge back to the rest of the app.
export const IMPLICATIONS = [
  { ro: 'Două căi spre față', text: 'Expresia spontană și cea voluntară folosesc circuite diferite. Modelul ar trebui să știe dacă o expresie e „trăită” sau „jucată”: zâmbetul spontan implică AU6, cel deliberat pornește și se retrage mai repede, cu amplitudine mai mare.', ability: 'dynamics', cite: ['hopf1992', 'schmidt2006'] },
  { ro: 'Timpii reali', text: 'Fața reacționează la 300–400 ms după stimul, amigdala la ~74 ms, sentimentul conștient mai târziu, cortizolul după 20–40 min. O expresie are debut, vârf și retragere — nu e o poză.', ability: 'dynamics', cite: ['dimberg2000', 'mendez2016', 'dickerson2004'] },
  { ro: 'Corpul, nu doar mușchii', text: 'Hipotalamusul și trunchiul cerebral produc pupilele dilatate, roșeața, paloarea, transpirația și lacrimile — exact abilitățile care lipsesc încă modelului (vezi Harta emoțiilor).', ability: 'tears', cite: ['bylsma2019'] },
  { ro: 'Fruntea e controlată bilateral', text: 'Partea nucleului facial pentru fruntea și pleoapele primește fibre din ambele emisfere; fața de jos mai ales din cea opusă. Rețeaua neuromotorie din primul tab folosește deja această regulă.', ability: null, cite: ['morecraft2001'] },
  { ro: 'Reglarea poate ascunde', text: 'Prefrontalul poate reduce sau masca o emoție. Un parametru „mască” (reducerea expresiei, cu scurgeri scurte) ar face modelul mai realist în situații sociale.', ability: 'dynamics', cite: ['ochsner2005'] },
  { ro: 'Contextul contează', text: 'Fața singură nu spune sigur emoția. Datele de antrenare au nevoie de context, de dimensiuni (valență, activare) și de mai mulți adnotatori — cum propune schema din Harta emoțiilor.', ability: 'context', cite: ['barrett2019', 'lindquist2012'] },
];
