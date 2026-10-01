import * as THREE from './vendor/three.module.min.js';

document.documentElement.classList.add('js');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

let scene3d = null;

/* ═════════════ UI: theme, menu, sound ═════════════ */
const root = document.documentElement;
const themeListeners = [];
$('#themeBtn').addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);

  themeListeners.forEach(f => f(next));
  sfx.blip(next === 'dark' ? 330 : 520);
});

const burger = $('#burger'), navLinks = $('#navLinks');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', open);
});
$$('#navLinks a').forEach(a => a.addEventListener('click', () => { navLinks.classList.remove('is-open'); burger.setAttribute('aria-expanded', false); }));

const sfx = (() => {
  let ctx = null, on = false;
  const btn = $('#soundBtn');
  btn.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', on);
    btn.setAttribute('aria-label', on ? 'Turn sound effects off' : 'Turn sound effects on');
    if (on) { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); blip(660); }
  });
  function blip(freq = 440, dur = .12, type = 'sine', vol = .06) {
    if (!on || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
  }
  function chord() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, .18, 'triangle', .045), i * 70)); }
  function step() { blip(180 + Math.random() * 40, .05, 'square', .012); }
  return { blip, chord, step };
})();

/* ═════════════ Stations + scroll → t ═════════════ */
const stations = $$('.station');
const N = stations.length;
const rail = $('#railList');
stations.forEach((s, i) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#'; a.textContent = s.dataset.label;
  a.addEventListener('click', e => { e.preventDefault(); scrollToStation(i); });
  li.appendChild(a); rail.appendChild(li);
});
const railLinks = $$('#railList a');
const navMap = { about: 1, experience: 2, skills: 6, projects: 7, contact: 8 };

function scrollToStation(i) {
  const s = stations[i];
  const y = s.offsetTop + s.offsetHeight / 2 - innerHeight / 2;
  scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach(a => {
  const id = a.getAttribute('href').slice(1);
  if (id in navMap) a.addEventListener('click', e => { e.preventDefault(); scrollToStation(navMap[id]); });
  if (id === 'top') a.addEventListener('click', e => { e.preventDefault(); scrollToStation(0); });
});
$('#replay').addEventListener('click', () => scrollToStation(0));

let anchors = [];
function measure() {
  const maxFocus = document.documentElement.scrollHeight - innerHeight / 2;
  const minFocus = innerHeight / 2;
  anchors = stations.map(s => clamp(s.offsetTop + s.offsetHeight / 2, minFocus, maxFocus));
  for (let i = 1; i < anchors.length; i++) if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
}
function scrollT() {
  const f = scrollY + innerHeight / 2;
  if (f <= anchors[0]) return 0;
  for (let i = 0; i < N - 1; i++) {
    if (f <= anchors[i + 1]) {
      const k = (f - anchors[i]) / (anchors[i + 1] - anchors[i]);
      // ease so the avatar lingers at each station
      const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      return (i + lerp(k, e, .55)) / (N - 1);
    }
  }
  return 1;
}
addEventListener('resize', measure);
addEventListener('load', measure);
new ResizeObserver(measure).observe(document.querySelector('main'));
measure();

// reveal + counters
const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    $$('[data-count]', en.target).forEach(countUp);
  });
}, { threshold: .18 });
stations.forEach(s => io.observe(s));
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const end = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
  const t0 = performance.now(), d = reduced ? 1 : 1200;
  const tick = now => {
    const k = clamp((now - t0) / d, 0, 1), e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + Math.round(end * e) + suf;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ═════════════ Speech bubble ═════════════ */
const bubble = $('#bubble');
if (matchMedia('(pointer: coarse)').matches && $('#tapWord')) $('#tapWord').textContent = 'tap';
let bubbleTimer = 0;
// phones: no automatic lines while scrolling (the bubble would cover the panels); taps still talk
const isPhone = () => innerWidth <= 860;
let sayY = 0;
addEventListener('scroll', () => {
  if (isPhone() && Math.abs(scrollY - sayY) > 40) { bubble.classList.remove('is-on'); clearTimeout(bubbleTimer); }
}, { passive: true });
function say(text, ms = 3800) {
  bubble.textContent = text; sayY = scrollY;
  bubble.classList.add('is-on');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('is-on'), ms);
}
const stationLines = [
  "Hi, I'm Ishaan. Scroll and I'll walk you down my pipeline.",
  'Computer science at DTU, then analytics at USC Marshall.',
  'Now: a BigQuery warehouse, eLockBox and an AI voice agent.',
  'Paytm: 100M+ transactions a month ran through systems I helped build.',
  'Back at USC, teaching SQL and Tableau to 70+ grad students.',
  'Bahrain. 15+ Power BI dashboards in three months.',
  "Go ahead and query my skills. The console's real.",
  'All of these are running in production right now.',
  "End of the pipeline. Let's talk.",
];
const clickLines = [
  'Yes, the tie is real. Those squares are the data packets.',
  'Fun fact: Claude Code took a 5-day build down to under a day.',
  'Ask me about window functions. Seriously.',
  'SELECT * FROM coffee WHERE hour < 9;',
  'My ETL never sleeps. I occasionally do.',
  "I'm hand-built from about 40 shapes. No AI-generated avatars here.",
  'Click the projects below. Some of them have a demo.',
];
let clickIdx = 0;

/* ═════════════ Skills console ═════════════ */
const SK = {
  languages:     { label: 'languages',      c: '#22B8D6', items: ['Python', 'SQL (joins, window functions, CTEs)', 'Java', 'JavaScript', 'TypeScript', 'Scala', 'PowerShell'] },
  data_cloud:    { label: 'data_cloud',     c: '#7B5CE0', items: ['Google BigQuery', 'Google Cloud Platform', 'AWS DynamoDB', 'AWS S3', 'AWS Redshift', 'MongoDB', 'Databricks', 'Snowflake', 'Kafka', 'PySpark', 'Pandas', 'NumPy', 'Jenkins', 'Kubernetes'] },
  ai_ds:         { label: 'ai_data_science', c: '#E2449A', items: ['Machine Learning', 'NLP / LLMs', 'Generative AI', 'Prompt Engineering', 'PyTorch', 'TensorFlow', 'Scikit-learn', 'Predictive Modeling', 'Deep Learning', 'RAG Pipelines', 'MLOps'] },
  ai_automation: { label: 'ai_automation',  c: '#F08A4B', items: ['Claude Code', 'GenAI-driven development', 'Agent orchestration', 'Twilio', 'ElevenLabs', 'n8n', 'Google Apps Script'] },
  fullstack:     { label: 'full_stack',     c: '#2FBF71', items: ['Next.js', 'React', 'TypeScript', 'REST APIs', 'S3-compatible storage'] },
  bi:            { label: 'bi_analytics',   c: '#E8C02E', items: ['Tableau', 'Power BI', 'Excel (VBA, Power Query, Pivots)', 'Hypothesis testing', 't-tests & chi-squared', 'A/B testing', 'KPI design'] },
  tools:         { label: 'tools_product',  c: '#9AA7BB', items: ['Salesforce', 'Apricot CRM', 'QuickBooks', 'JIRA', 'Confluence', 'Git', 'Agile / Scrum', 'Stakeholder alignment'] },
};
const synonyms = { cloud: ['data_cloud'], data: ['data_cloud'], ai: ['ai_ds', 'ai_automation'], ml: ['ai_ds'], automation: ['ai_automation'], web: ['fullstack'], frontend: ['fullstack'], bi: ['bi'], analytics: ['bi'], stats: ['bi'], code: ['languages'], lang: ['languages'], tools: ['tools'], product: ['tools'] };
const tabs = $('#consoleTabs'), cIn = $('#consoleInput'), cOut = $('#consoleOut'), cFoot = $('#consoleFoot');
const tabKeys = ['all', ...Object.keys(SK)];
tabKeys.forEach((k, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.role = 'tab'; b.textContent = k === 'all' ? '*' : SK[k].label;
  b.setAttribute('aria-selected', i === 0);
  b.addEventListener('click', () => { selectTab(k); typeQuery(k === 'all' ? "category = '*'" : `category = '${SK[k].label}'`); });
  tabs.appendChild(b);
});
function selectTab(k) { $$('button', tabs).forEach((b, i) => b.setAttribute('aria-selected', tabKeys[i] === k)); }
let typing = 0;
function typeQuery(q) {
  cancelAnimationFrame(typing);
  if (reduced) { cIn.value = q; return runQuery(q); }
  let i = 0, last = 0;
  const step = now => {
    if (now - last > 22) { i++; cIn.value = q.slice(0, i); last = now; }
    if (i < q.length) typing = requestAnimationFrame(step); else runQuery(q);
  };
  typing = requestAnimationFrame(step);
}
function runQuery(q) {
  const t0 = performance.now();
  const raw = q.trim().toLowerCase().replace(/;$/, '');
  let rows = [];
  const all = Object.entries(SK).flatMap(([k, v]) => v.items.map(n => ({ n, k })));
  const m = raw.match(/category\s*=\s*'?([\w*]+)'?/);
  if (!raw || (m && m[1] === '*') || raw === '*' || raw === 'all') rows = all;
  else if (m) {
    const key = Object.keys(SK).find(k => SK[k].label === m[1] || k === m[1]);
    rows = key ? all.filter(r => r.k === key) : [];
  } else {
    const term = raw.replace(/^(skill\s+)?(like|=|ilike)\s*/, '').replace(/['"%]/g, '').trim();
    const cats = new Set(synonyms[term] || []);
    rows = all.filter(r => cats.has(r.k) || r.n.toLowerCase().includes(term) || SK[r.k].label.includes(term));
  }
  const seen = new Set();
  rows = rows.filter(r => !seen.has(r.n) && seen.add(r.n));
  cOut.innerHTML = '';
  if (!rows.length) {
    cOut.innerHTML = `<span class="console__empty">0 rows. Not on the stack yet, but I learn fast. Try <b>python</b>, <b>cloud</b> or <b>ai</b>.</span>`;
  } else {
    rows.forEach((r, i) => {
      const s = document.createElement('span');
      s.className = 'row'; s.style.setProperty('--c', SK[r.k].c); s.style.animationDelay = (reduced ? 0 : i * 18) + 'ms';
      s.innerHTML = `<b>●</b>${r.n}`;
      cOut.appendChild(s);
    });
  }
  const ms = (performance.now() - t0 + 8 + Math.random() * 20).toFixed(0);
  cFoot.innerHTML = `<span>${rows.length} row${rows.length === 1 ? '' : 's'} returned in 0.0${ms.padStart(2, '0')}s</span><span>bytes billed: 0 B</span>`;
  sfx.blip(880, .08, 'triangle', .03);
  scene3d && scene3d.pulse();
}
$('#consoleForm').addEventListener('submit', e => { e.preventDefault(); selectTab(null); runQuery(cIn.value); });
runQuery("category = '*'");
cIn.value = '';

/* ═════════════ Project modal ═════════════ */
const PROJ = {
  elockbox: { id: 'svc-01 · live', name: 'eLockBox', body: 'A full-stack secure document platform for at-risk youth. Users store sensitive personal documents (IDs, birth certificates, housing paperwork) and share them safely with case managers and housing aid providers.', bullets: ['Designed, built and shipped independently', 'Next.js + React + TypeScript front end', 'S3-compatible object storage for documents', 'Built around privacy and controlled sharing'], tags: ['Next.js', 'React', 'TypeScript', 'S3'] },
  voice: { id: 'svc-02 · live', name: 'AI Voice Agent', body: 'An autonomous voice agent that handles inbound and outbound calls without a person on the line. It started as a vague automation need and became a scoped production feature.', bullets: ['Telephony through Twilio', 'Natural voice through ElevenLabs', 'Call logic orchestrated in n8n', 'Runs unattended in production'], tags: ['Twilio', 'ElevenLabs', 'n8n', 'Agents'] },
  warehouse: { id: 'svc-03 · building', name: 'BigQuery Warehouse', body: 'A Google BigQuery warehouse on GCP that consolidates CRM and program data from Salesforce and Apricot CRM into one queryable model, replacing manual spreadsheet reporting.', bullets: ['SQL ETL syncing ~20,000 contacts and ~2,000 accounts', 'Multi-stage validation for production data integrity', "The organization's first KPI dashboards", 'Sole technical owner across 5 production systems'], tags: ['BigQuery', 'GCP', 'SQL', 'Salesforce'] },
  payroll: { id: 'svc-04 · live', name: 'Payroll Autopilot', body: 'Automated financial and payroll reporting, from timecard extraction to payroll-sheet generation.', bullets: ['About 90% less manual processing time', 'QuickBooks + Google Apps Script', 'PowerShell and n8n for the glue', 'Replaced recurring manual spreadsheet work'], tags: ['QuickBooks', 'Apps Script', 'PowerShell', 'n8n'] },
};
const modal = $('#modal'), modalBody = $('#modalBody');
$$('.proj').forEach(b => b.addEventListener('click', () => {
  const p = PROJ[b.dataset.proj];
  modalBody.innerHTML = `<span class="proj__id">${p.id}</span><h3>${p.name}</h3><p>${p.body}</p><ul>${p.bullets.map(x => `<li>${x}</li>`).join('')}</ul><ul class="tags">${p.tags.map(x => `<li>${x}</li>`).join('')}</ul>`;
  modal.showModal();
  sfx.blip(600, .1, 'triangle', .04);
  scene3d && scene3d.wave();
}));
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

/* ═════════════ HUD ═════════════ */
const hudStage = $('#hudStage'), hudRows = $('#hudRows'), hudLat = $('#hudLat'), railFill = $('#railFill');
let rows = 0, lastStation = -1;
const navAs = $$('.nav__links a');
function updateChrome(t, dt) {
  const idx = Math.round(t * (N - 1));
  railFill.style.height = (t * 100).toFixed(2) + '%';
  if (idx !== lastStation) {
    railLinks.forEach((a, i) => { a.classList.toggle('is-active', i === idx); a.classList.toggle('is-past', i < idx); });
    hudStage.textContent = stations[idx].dataset.stage;
    const navIdx = idx >= 7 ? idx - 4 : idx >= 6 ? 2 : idx >= 2 ? 1 : idx >= 1 ? 0 : -1;
    navAs.forEach((a, i) => a.classList.toggle('is-active', i === navIdx));
    if (lastStation !== -1) { if (!isPhone()) say(stationLines[idx]); sfx.chord(); }
    lastStation = idx;
  }
  rows += dt * (2400 + t * 42000);
  hudRows.textContent = Math.floor(rows).toLocaleString('en-US');
  if (Math.random() < .05) hudLat.textContent = (8 + Math.round(Math.random() * 9)) + 'ms';
}

/* ═════════════ 3D scene ═════════════ */
try { scene3d = buildScene(); } catch (err) { console.warn('WebGL unavailable', err); root.classList.add('no-webgl'); }

function hideLoader() { $('#loader').classList.add('is-done'); }
if (!scene3d) hideLoader();
setTimeout(() => {
  hideLoader();
  if (lastStation <= 0) say(stationLines[0], 5000);
}, 900);

function buildScene() {
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const isMobile = () => innerWidth <= 860;
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 220);
  scene.fog = new THREE.Fog(0x000000, 14, 60);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 10, 8);
  const rim = new THREE.DirectionalLight(0x88ccff, 1.2);
  rim.position.set(-8, 4, -6);
  scene.add(hemi, key, rim);

  const TIE = [0xE2449A, 0x22B8D6, 0xE8C02E, 0x7B5CE0, 0xF2F2F2];

  /* ── Curve through the stations ── */
  const SP = []; // station points
  for (let i = 0; i < N; i++) {
    SP.push(new THREE.Vector3(Math.sin(i * 1.1) * 3.2, Math.sin(i * .9) * 1.2 - i * .4, -i * 20));
  }
  const pts = [SP[0].clone().add(new THREE.Vector3(-1, 0, 20)), ...SP, SP[N - 1].clone().add(new THREE.Vector3(1, 0, -20))];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const uOf = i => (i + 1) / (pts.length - 1); // param of station i
  const R = .55; // pipe radius

  // precomputed frames
  const S = 1400, FP = [], FT = [], FR = [], FU = [];
  const worldUp = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= S; i++) {
    const u = i / S;
    const p = curve.getPoint(u), t = curve.getTangent(u).normalize();
    const r = new THREE.Vector3().crossVectors(t, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(r, t).normalize();
    FP.push(p); FT.push(t); FR.push(r); FU.push(up);
  }
  const _v = new THREE.Vector3();
  function frame(u, out) {
    const f = clamp(u, 0, 1) * S, i = Math.floor(f), k = f - i, j = Math.min(S, i + 1);
    out.p.lerpVectors(FP[i], FP[j], k); out.t.lerpVectors(FT[i], FT[j], k).normalize();
    out.r.lerpVectors(FR[i], FR[j], k).normalize(); out.u.lerpVectors(FU[i], FU[j], k).normalize();
    return out;
  }
  const mkF = () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3() });

  /* ── Pipe ── */
  const pipeMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: .2, roughness: .15, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 900, R, 28, false), pipeMat);
  scene.add(pipe);
  const coreMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .35 });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 600, .045, 6, false), coreMat));

  // joints
  const length = curve.getLength();
  const jointCount = Math.floor(length / 3);
  const jointGeo = new THREE.TorusGeometry(R + .02, .028, 6, 36);
  const jointMat = new THREE.MeshStandardMaterial({ roughness: .4, metalness: .6 });
  const joints = new THREE.InstancedMesh(jointGeo, jointMat, jointCount);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), zAxis = new THREE.Vector3(0, 0, 1);
  const F = mkF();
  for (let i = 0; i < jointCount; i++) {
    const tt = curve.getUtoTmapping(i / jointCount);
    frame(tt, F);
    q.setFromUnitVectors(zAxis, F.t);
    let near = false; for (let k = 0; k < N; k++) if (Math.abs(tt - uOf(k)) < .016) near = true;
    sc.setScalar(near ? 0 : 1);
    m4.compose(F.p, q, sc); joints.setMatrixAt(i, m4);
  }
  scene.add(joints);

  /* ── Data packets ── */
  const PK = isMobile() ? 140 : 260;
  const pkGeo = new THREE.BoxGeometry(.11, .11, .11);
  const pkMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const packets = new THREE.InstancedMesh(pkGeo, pkMat, PK);
  const pkData = [];
  const col = new THREE.Color();
  for (let i = 0; i < PK; i++) {
    pkData.push({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.random() * (R - .18), sp: .006 + Math.random() * .01, spin: Math.random() * 6 });
    packets.setColorAt(i, col.setHex(TIE[i % TIE.length]));
  }
  scene.add(packets);
  let pulseT = 0;

  /* ── Gates + labels at stations ── */
  const gateMats = [];
  const labels = [];
  const stationGroups = [];
  const labelText = ['00 · SOURCE', '01 · DTU → USC', '02 · LIVING ADVANTAGE', '03 · PAYTM', '04 · USC · TA', '05 · ALMOAYYED', '06 · SKILLS MODEL', '07 · PRODUCTION', '08 · OUTPUT'];
  for (let i = 0; i < N; i++) {
    frame(uOf(i), F);
    const gm = new THREE.MeshBasicMaterial({ color: TIE[i % 4], toneMapped: false, transparent: true, opacity: .9 });
    gateMats.push(gm);
    const gate = new THREE.Mesh(new THREE.TorusGeometry(2.5, .035, 8, 96), gm);
    const GF = frame(uOf(i) - .012, mkF());
    gate.position.copy(GF.p); gate.quaternion.setFromUnitVectors(zAxis, GF.t);
    scene.add(gate);

    const g = new THREE.Group();
    g.position.copy(F.p).addScaledVector(F.r, -3.1).addScaledVector(F.u, .2);
    g.lookAt(_v.copy(g.position).add(F.r)); // face the camera side
    scene.add(g); stationGroups.push(g);

    const spr = makeLabel(labelText[i]);
    spr.position.copy(F.p).addScaledVector(F.u, 2.85).addScaledVector(F.r, -3.4);
    scene.add(spr); labels.push(spr);
  }

  function makeLabel(text) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const fs = 44; x.font = `600 ${fs}px "JetBrains Mono", monospace`;
    const w = Math.ceil(x.measureText(text).width) + 56, h = 84;
    c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true });
    const s = new THREE.Sprite(mat);
    s.scale.set(w / h * .3, .3, 1);
    s.userData = { c, x, text, tex, fs };
    return s;
  }
  function paintLabel(s, fg, bg, border) {
    const { c, x, text, tex, fs } = s.userData;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = bg; x.strokeStyle = border; x.lineWidth = 3;
    const r = 18; x.beginPath(); x.roundRect(2, 2, c.width - 4, c.height - 4, r); x.fill(); x.stroke();
    x.font = `600 ${fs}px "JetBrains Mono", monospace`; x.fillStyle = fg; x.textBaseline = 'middle';
    x.fillText(text, 28, c.height / 2 + 2);
    tex.needsUpdate = true;
  }

  /* ── Station props ── */
  const std = (c, e = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: .45, metalness: .1, ...o });
  const animated = [];
  // 0 source: data lake rings
  {
    const g = stationGroups[0];
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.9 + k * .45, .025, 6, 64), new THREE.MeshBasicMaterial({ color: TIE[k + 1], toneMapped: false, transparent: true, opacity: .8 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -.5; ring.scale.setScalar(.6); g.add(ring);
      animated.push(tm => { const s = .6 + ((tm * .4 + k / 3) % 1) * .4; ring.scale.set(s, s, s); ring.material.opacity = .9 * (1 - ((tm * .4 + k / 3) % 1)); });
    }
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 1), std(0x22B8D6, .9, { flatShading: true }));
    orb.position.y = .5; g.add(orb);
    animated.push(tm => { orb.rotation.y = tm * .6; orb.rotation.x = tm * .3; orb.position.y = .5 + Math.sin(tm * 1.4) * .12; });
  }
  // 1 education: stacked books + diploma
  {
    const g = stationGroups[1];
    const cols = [0x7B5CE0, 0x9A2B2B, 0x22B8D6];
    cols.forEach((c, k) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1 - k * .1, .22, .8), std(c, .15));
      b.position.set(0, -.4 + k * .23, 0); b.rotation.y = k * .25; g.add(b);
    });
    const dip = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1, 16), std(0xF4EBDD, .1));
    dip.rotation.z = Math.PI / 2; dip.position.set(0, .55, 0); g.add(dip);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(.1, .025, 6, 16), std(0x9A2B2B, .2));
    ribbon.rotation.y = Math.PI / 2; ribbon.position.copy(dip.position); g.add(ribbon);
    animated.push(tm => { dip.position.y = .6 + Math.sin(tm * 1.5) * .1; ribbon.position.y = dip.position.y; dip.rotation.x = tm * .5; });
  }
  // 2 paytm: transaction bar towers
  {
    const g = stationGroups[3];
    const bars = [];
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(.22, 1, .22), std(k % 2 ? 0x22B8D6 : 0x1E5FAE, .45));
      b.position.set(-.9 + k * .3, -.6, 0); g.add(b); bars.push(b);
    }
    animated.push(tm => bars.forEach((b, k) => { const h = .4 + (Math.sin(tm * 1.6 + k * .9) * .5 + .5) * 1.6; b.scale.y = h; b.position.y = -.65 + h / 2; }));
  }
  // 3 almoayyed: floating dashboard panels
  {
    const g = stationGroups[5];
    for (let k = 0; k < 3; k++) {
      const tex = dashTexture(k);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
      p.position.set((k - 1) * 1.15, .1 + (k === 1 ? .35 : 0), k === 1 ? .2 : 0); p.rotation.y = (1 - k) * .35; g.add(p);
      animated.push(tm => { p.position.y = .1 + (k === 1 ? .35 : 0) + Math.sin(tm * 1.2 + k) * .08; });
    }
  }
  // 4 USC: grad cap + chalkboard
  {
    const g = stationGroups[4];
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.05), new THREE.MeshBasicMaterial({ map: boardTexture(), side: THREE.DoubleSide }));
    board.position.set(.2, .15, -.1); g.add(board);
    const capG = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(.8, .05, .8), std(0x99001B, .15));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.27, .3, .25, 20), std(0x99001B, .15));
    base.position.y = -.14; top.rotation.y = Math.PI / 4;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .35, 6), std(0xFFC72C, .5));
    tassel.position.set(.3, -.16, .3);
    capG.add(top, base, tassel); capG.position.set(-1.25, .9, .3); g.add(capG);
    animated.push(tm => { capG.rotation.y = tm * .8; capG.position.y = .9 + Math.sin(tm * 1.3) * .1; });
  }
  // 5 Living Advantage: database stack + lockbox + phone w/ sound rings
  {
    const g = stationGroups[2];
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .26, 32), std(0x4285F4, .35 + k * .1));
      d.position.set(-1.1, -.45 + k * .32, 0); g.add(d);
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(.7, .55, .55), std(0x2FBF71, .25, { metalness: .5 }));
    box.position.set(0, -.35, .1); g.add(box);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(.06, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    hole.position.set(0, -.33, .38); g.add(hole);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(.72, .1, .57), std(0x27A862, .25, { metalness: .5 }));
    lid.position.set(0, -.03, .1); g.add(lid);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(.32, .6, .05), std(0x222630, .1));
    phone.position.set(1.1, .2, 0); g.add(phone);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(.26, .5), new THREE.MeshBasicMaterial({ color: 0xF08A4B, toneMapped: false }));
    scr.position.set(1.1, .2, .03); g.add(scr);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .018, 6, 40, Math.PI * .7), new THREE.MeshBasicMaterial({ color: 0xF08A4B, transparent: true, toneMapped: false }));
      ring.position.set(1.1, .2, 0); ring.rotation.z = -Math.PI * .35; g.add(ring);
      animated.push(tm => { const f = (tm * .7 + k / 3) % 1; const s = 1 + f * 1.6; ring.scale.set(s, s, s); ring.material.opacity = 1 - f; });
    }
    animated.push(tm => { lid.rotation.x = -Math.max(0, Math.sin(tm * .8)) * .5; lid.position.z = .1 - Math.max(0, Math.sin(tm * .8)) * .08; });
  }
  // 6 skills: neural net
  {
    const g = stationGroups[6];
    const layers = [3, 5, 4, 2], nodes = [];
    const nodeGeo = new THREE.SphereGeometry(.09, 14, 10);
    layers.forEach((n, li) => {
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(nodeGeo, std(TIE[(li + k) % 4], .8));
        m.position.set((li - 1.5) * .75, (k - (n - 1) / 2) * .38 + .2, 0);
        g.add(m); nodes.push({ m, li });
      }
    });
    const linePts = [];
    nodes.forEach(a => nodes.forEach(b => { if (b.li === a.li + 1) linePts.push(a.m.position, b.m.position); }));
    const lg = new THREE.BufferGeometry().setFromPoints(linePts);
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ transparent: true, opacity: .35 }));
    g.add(lines); g.userData.lines = lines;
    animated.push(tm => nodes.forEach(({ m, li }, k) => { const s = 1 + Math.max(0, Math.sin(tm * 3 - li * 1.2 + k * .3)) * .6 + pulseT * .8; m.scale.setScalar(s); }));
  }
  // 7 projects: server racks
  {
    const g = stationGroups[7];
    const leds = [];
    for (let k = 0; k < 3; k++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.6, .5), std(0x23262F, .05, { metalness: .6, roughness: .3 }));
      rack.position.set((k - 1) * .75, .05, 0); g.add(rack);
      for (let j = 0; j < 6; j++) {
        const led = new THREE.Mesh(new THREE.PlaneGeometry(.08, .04), new THREE.MeshBasicMaterial({ color: TIE[(j + k) % 4], toneMapped: false, transparent: true }));
        led.position.set((k - 1) * .75 + .17, -.6 + j * .24, .26); g.add(led); leds.push(led);
        const slot = new THREE.Mesh(new THREE.PlaneGeometry(.36, .03), new THREE.MeshBasicMaterial({ color: 0x3A3F4E }));
        slot.position.set((k - 1) * .75 - .06, -.6 + j * .24, .26); g.add(slot);
      }
    }
    animated.push(tm => leds.forEach((l, k) => { l.material.opacity = (Math.sin(tm * (3 + k % 5) + k * 1.7) > -.2) ? 1 : .15; }));
  }
  // 8 output: portal + envelope
  {
    const g = stationGroups[8];
    const portal = new THREE.Mesh(new THREE.TorusGeometry(1, .07, 12, 80), new THREE.MeshBasicMaterial({ color: 0xE2449A, toneMapped: false }));
    const portal2 = new THREE.Mesh(new THREE.TorusGeometry(.78, .03, 8, 80), new THREE.MeshBasicMaterial({ color: 0x22B8D6, toneMapped: false }));
    portal.position.y = portal2.position.y = .3;
    g.add(portal, portal2);
    const env = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(.8, .52, .04), std(0xF7EDE3, .15));
    const flap = new THREE.Mesh(new THREE.ConeGeometry(.42, .3, 4, 1), std(0xE6CCB5, .1));
    flap.rotation.set(Math.PI / 2, Math.PI / 4, 0); flap.scale.set(1.35, 1, .1); flap.position.set(0, .08, .04);
    env.add(body, flap); env.position.y = .3; g.add(env);
    animated.push(tm => { portal.rotation.z = tm * .5; portal2.rotation.z = -tm * .8; env.rotation.y = Math.sin(tm) * .5; env.position.y = .3 + Math.sin(tm * 1.6) * .08; });
  }

  function dashTexture(k) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 214; const x = c.getContext('2d');
    x.fillStyle = '#151824'; x.beginPath(); x.roundRect(0, 0, 320, 214, 18); x.fill();
    x.fillStyle = '#F2C811'; x.fillRect(18, 18, 60, 10);
    x.fillStyle = '#5D6680'; x.fillRect(86, 18, 90, 10);
    if (k === 0) { for (let i = 0; i < 8; i++) { const h = 30 + ((i * 37) % 110); x.fillStyle = i % 2 ? '#22B8D6' : '#F2C811'; x.fillRect(22 + i * 35, 190 - h, 24, h); } }
    if (k === 1) { x.strokeStyle = '#E2449A'; x.lineWidth = 6; x.beginPath(); [0, 40, 25, 70, 55, 100, 85, 120].forEach((v, i) => i ? x.lineTo(22 + i * 40, 185 - v) : x.moveTo(22, 185 - v)); x.stroke(); }
    if (k === 2) { const cx = 160, cy = 118, r = 64; [[0, 1.4, '#22B8D6'], [1.4, 3.6, '#7B5CE0'], [3.6, 5.1, '#F2C811'], [5.1, 6.283, '#E2449A']].forEach(([a, b, cl]) => { x.fillStyle = cl; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a, b); x.fill(); }); x.fillStyle = '#151824'; x.beginPath(); x.arc(cx, cy, 34, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function boardTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 284; const x = c.getContext('2d');
    x.fillStyle = '#7A4B2A'; x.fillRect(0, 0, 512, 284);
    x.fillStyle = '#1F3B2E'; x.fillRect(12, 12, 488, 260);
    x.fillStyle = '#E8F0E8'; x.font = '500 26px "JetBrains Mono", monospace';
    ['SELECT student,', '  AVG(score) OVER (', '    PARTITION BY cohort)', 'FROM ppde_613;'].forEach((l, i) => x.fillText(l, 34, 64 + i * 46));
    x.fillStyle = '#FFC72C'; x.fillText('✓ 70+ students', 300, 250);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ── Dust ── */
  const DUST = isMobile() ? 300 : 700;
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const u = Math.random(); frame(u, F);
    dp[i * 3] = F.p.x + (Math.random() - .5) * 30; dp[i * 3 + 1] = F.p.y + (Math.random() - .3) * 14; dp[i * 3 + 2] = F.p.z + (Math.random() - .5) * 20;
  }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dustMat = new THREE.PointsMaterial({ size: .06, transparent: true, opacity: .6, depthWrite: false });
  const dust = new THREE.Points(dg, dustMat);
  scene.add(dust);

  // floor grid
  const grid = new THREE.GridHelper(400, 160);
  grid.position.set(0, -9, -70);
  grid.material.transparent = true; grid.material.opacity = .18; grid.material.depthWrite = false;
  scene.add(grid);

  /* ── The avatar ── */
  const avatar = buildAvatar();
  scene.add(avatar.root);

  // blob shadow
  const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 64;
  const sx = sc2.getContext('2d'), grd = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = grd; sx.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc2), transparent: true, depthWrite: false }));
  scene.add(shadow);

  function buildAvatar() {
    const SKIN = 0xC48E6B, SKIN_D = 0xAA7656, HAIR = 0x16110E, SUIT = 0x22408C, SUIT_D = 0x1A3170, SHIRT = 0xF4F4F2, SHOE = 0x1B1B1F;
    const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, metalness: 0, ...o });
    const skin = m(SKIN, { roughness: .55 }), skinD = m(SKIN_D), hair = m(HAIR, { roughness: .8 }), suit = m(SUIT, { roughness: .7 }), suitD = m(SUIT_D, { roughness: .7 }), shirt = m(SHIRT), shoe = m(SHOE, { roughness: .4 });
    const root = new THREE.Group();     // positioned on the pipe
    const body = new THREE.Group();     // turns / bobs
    root.add(body);

    // legs
    const legGeo = new THREE.CapsuleGeometry(.1, .34, 6, 12);
    const mkLeg = sx => {
      const pivot = new THREE.Group(); pivot.position.set(sx * .12, .56, 0);
      const leg = new THREE.Mesh(legGeo, suitD); leg.position.y = -.25; pivot.add(leg);
      const sh = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .14, 4, 10), shoe); sh.rotation.x = Math.PI / 2; sh.position.set(0, -.5, .06); pivot.add(sh);
      body.add(pivot); return pivot;
    };
    const legL = mkLeg(-1), legR = mkLeg(1);

    // torso (jacket)
    const torso = new THREE.Group(); torso.position.y = .62; body.add(torso);
    const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(.27, .32, 8, 20), suit);
    jacket.scale.set(1, 1, .72); jacket.position.y = .28; torso.add(jacket);
    // shirt V
    const vShape = new THREE.Shape(); vShape.moveTo(-.11, .2); vShape.lineTo(.11, .2); vShape.lineTo(0, -.12); vShape.closePath();
    const shirtV = new THREE.Mesh(new THREE.ShapeGeometry(vShape), shirt); shirtV.position.set(0, .4, .196); torso.add(shirtV);
    // collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .07, 16, 1, true), shirt); collar.position.set(0, .61, .01); torso.add(collar);
    // tie with packet pattern
    const tieTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 192; const x = c.getContext('2d');
      x.fillStyle = '#1B2350'; x.fillRect(0, 0, 64, 192);
      const cs = ['#E2449A', '#22B8D6', '#E8C02E', '#7B5CE0', '#F2F2F2', '#2FBF71'];
      for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 4; xx++) { x.fillStyle = cs[(xx * 3 + yy * 5) % cs.length]; x.save(); x.translate(8 + xx * 16, 8 + yy * 16); x.rotate(-.35); x.fillRect(-4, -4, 8, 8); x.restore(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const tShape = new THREE.Shape(); tShape.moveTo(-.035, .2); tShape.lineTo(.035, .2); tShape.lineTo(.055, -.12); tShape.lineTo(0, -.18); tShape.lineTo(-.055, -.12); tShape.closePath();
    const tieGeo = new THREE.ShapeGeometry(tShape);
    // remap uvs for the shape
    const uv = tieGeo.attributes.uv, pos = tieGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + .06) / .12, (pos.getY(i) + .18) / .38);
    const tie = new THREE.Mesh(tieGeo, new THREE.MeshStandardMaterial({ map: tieTex, roughness: .5 }));
    tie.position.set(0, .39, .2); torso.add(tie);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1B2350 })); knot.scale.set(1.2, 1, .6); knot.position.set(0, .6, .2); torso.add(knot);
    // lapels
    const lap = sx => { const l = new THREE.Mesh(new THREE.BoxGeometry(.07, .3, .02), suitD); l.position.set(sx * .1, .44, .2); l.rotation.z = sx * -.38; torso.add(l); return l; };
    lap(-1); lap(1);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), m(0x222222, { metalness: .8, roughness: .3 })); pin.position.set(-.16, .48, .2); torso.add(pin);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(.11, .012, .01), suitD); pocket.position.set(-.15, .3, .2); torso.add(pocket);

    // arms
    const armGeo = new THREE.CapsuleGeometry(.075, .32, 6, 12);
    const mkArm = sx => {
      const pivot = new THREE.Group(); pivot.position.set(sx * .33, .55, 0); torso.add(pivot);
      const arm = new THREE.Mesh(armGeo, suit); arm.position.y = -.2; pivot.add(arm);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .03, 12), shirt); cuff.position.y = -.42; pivot.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), skin); hand.position.y = -.48; pivot.add(hand);
      pivot.rotation.z = sx * .08; return pivot;
    };
    const armL = mkArm(-1), armR = mkArm(1);

    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.075, .085, .12, 14), skin); neck.position.y = .66; torso.add(neck);
    const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.3, 40, 32), skin); skull.scale.set(.92, 1.04, .95); head.add(skull);
    // stubble beard
    const beard = new THREE.Mesh(new THREE.SphereGeometry(.305, 32, 24, Math.PI * .1, Math.PI * .8, Math.PI * .56, Math.PI * .3),
      new THREE.MeshStandardMaterial({ color: 0x3A2618, transparent: true, opacity: .26, roughness: 1, depthWrite: false }));
    beard.scale.set(.92, 1.04, .95); head.add(beard);
    // ears
    [-1, 1].forEach(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 12, 10), skin); e.scale.set(.5, 1, .8); e.position.set(sx * .275, 0, 0); head.add(e); });
    // hair: cap + quiff
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.318, 36, 24, 0, Math.PI * 2, 0, Math.PI * .4), hair);
    hairCap.scale.set(.96, 1.05, .99); hairCap.position.set(0, .035, -.02); hairCap.rotation.x = -.22; head.add(hairCap);
    const back = new THREE.Mesh(new THREE.SphereGeometry(.302, 28, 20, Math.PI * 1.1, Math.PI * .8, Math.PI * .2, Math.PI * .45), hair);
    back.scale.set(.95, 1.04, .98); head.add(back);
    // voluminous top, swept up at the front
    for (let k = 0; k < 9; k++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), hair);
      const a = (k / 8 - .5) * 1.9;
      const front = Math.cos(a);
      tuft.position.set(Math.sin(a) * .19, .27 + front * .05, .02 + front * .14);
      tuft.scale.set(1.05, .8 + front * .25, 1.1); tuft.rotation.x = -.4; head.add(tuft);
    }
    for (let k = 0; k < 5; k++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 10), hair);
      const a = (k / 4 - .5) * 1.6;
      tuft.position.set(Math.sin(a) * .17, .3, -.08 + Math.cos(a) * .03);
      tuft.scale.set(1.1, .7, 1.2); head.add(tuft);
    }
    // sideburns
    [-1, 1].forEach(sx => { const s = new THREE.Mesh(new THREE.BoxGeometry(.03, .12, .06), hair); s.position.set(sx * .265, .04, .04); head.add(s); });
    // brows
    const brows = [-1, 1].map(sx => { const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .025, .02), hair); b.position.set(sx * .095, .1, .27); b.rotation.z = sx * -.08; head.add(b); return b; });
    // eyes
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: .3 });
    const eyeD = new THREE.MeshStandardMaterial({ color: 0x1A120D, roughness: .2 });
    const eyes = [-1, 1].map(sx => {
      const g = new THREE.Group(); g.position.set(sx * .095, .035, .262); head.add(g);
      const w = new THREE.Mesh(new THREE.SphereGeometry(.04, 14, 10), eyeW); w.scale.set(1.2, .75, .45); g.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 10), eyeD); p.position.z = .012; p.scale.set(1, 1, .5); g.add(p);
      return g;
    });
    // nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.045, 14, 10), skinD); nose.scale.set(.9, .8, .9); nose.position.set(0, -.04, .29); head.add(nose);
    // smile (teeth + lips)
    const smile = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0xFAFAF5, roughness: .3 }));
    smile.rotation.z = Math.PI; smile.scale.set(1, .55, .6); smile.position.set(0, -.115, .272); head.add(smile);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.083, .012, 6, 24, Math.PI), m(0x7A3E30)); lip.rotation.z = Math.PI; lip.scale.set(1, .62, .6); lip.position.set(0, -.118, .27); head.add(lip);
    // glasses (rectangular metal frames)
    const metal = new THREE.MeshStandardMaterial({ color: 0xC9CDD4, metalness: .9, roughness: .25 });
    const frame = (() => {
      const s = new THREE.Shape(); const w = .085, h = .06, r = .015;
      s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
      const hole = new THREE.Path(); const iw = w - .012, ih = h - .012;
      hole.moveTo(-iw, -ih); hole.lineTo(iw, -ih); hole.lineTo(iw, ih); hole.lineTo(-iw, ih); hole.closePath();
      s.holes.push(hole);
      return new THREE.ExtrudeGeometry(s, { depth: .008, bevelEnabled: false, curveSegments: 4 });
    })();
    const glasses = new THREE.Group(); glasses.position.set(0, .035, .3); head.add(glasses);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xDDEEFF, transparent: true, opacity: .14, roughness: .05, metalness: .2 });
    [-1, 1].forEach(sx => {
      const f = new THREE.Mesh(frame, metal); f.position.x = sx * .1; glasses.add(f);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(.15, .1), lensMat); lens.position.set(sx * .1, 0, .004); glasses.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.008, .008, .3), metal); arm.position.set(sx * .185, .03, -.15); arm.rotation.y = sx * -.12; glasses.add(arm);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(.04, .008, .008), metal); bridge.position.set(0, .04, .004); glasses.add(bridge);

    root.traverse(o => { if (o.isMesh) o.userData.avatar = true; });
    const S = .82; root.scale.setScalar(S);
    return { root, body, head, torso, legL, legR, armL, armR, eyes, brows };
  }

  /* ── Theme colors ── */
  function applyTheme() {
    const dark = root.getAttribute('data-theme') === 'dark';
    const css = getComputedStyle(root);
    const bg = new THREE.Color(css.getPropertyValue('--color-bg').trim());
    scene.background = bg; scene.fog.color.copy(bg);
    pipeMat.color.setHex(dark ? 0x5FD0E6 : 0x8C6A50); pipeMat.opacity = dark ? .13 : .2;
    pipeMat.emissive.setHex(dark ? 0x0B3A48 : 0x000000);
    coreMat.color.setHex(dark ? 0x5FD0E6 : 0x6B4E3A);
    jointMat.color.setHex(dark ? 0x3D4A6B : 0x6B4E3A);
    dustMat.color.setHex(dark ? 0x9AB4D6 : 0x8C6A50); dustMat.opacity = dark ? .55 : .45;
    grid.material.color = new THREE.Color(dark ? 0x2D3348 : 0xB89678);
    hemi.color.setHex(dark ? 0xBFD4FF : 0xFFF4E8); hemi.groundColor.setHex(dark ? 0x1A1D29 : 0x8C6A50);
    hemi.intensity = dark ? 1.1 : 1.5;
    key.intensity = dark ? 2.0 : 2.4;
    rim.color.setHex(dark ? 0x5FD0E6 : 0xFFC9A0);
    stationGroups[6].userData.lines.material.color.setHex(dark ? 0x9AB4D6 : 0x5C4A3A);
    labels.forEach(s => paintLabel(s, dark ? '#E2E8F0' : '#2C2420', dark ? 'rgba(23,25,35,.88)' : 'rgba(247,237,227,.92)', dark ? '#343B55' : '#CDAE93'));
  }
  themeListeners.push(applyTheme);
  applyTheme();
  document.fonts && document.fonts.ready.then(applyTheme);

  /* ── Sizing ── */
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w > 860) camera.setViewOffset(w, h, -w * .19, 0, w, h);
    else camera.setViewOffset(w, h, w * .16, h * .25, w, h);
    camera.fov = w > 860 ? 38 : 48;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  /* ── Interaction ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9);
  let mouseX = 0, mouseY = 0, hover = false;
  addEventListener('pointermove', e => {
    mouseX = e.clientX / innerWidth * 2 - 1; mouseY = -(e.clientY / innerHeight * 2 - 1);
    ndc.set(mouseX, mouseY);
  }, { passive: true });
  let waveT = 0;
  canvas.addEventListener('click', e => {
    // raycast at the tap point itself (touch screens have no hover state)
    const p = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1));
    ray.setFromCamera(p, camera);
    let hit = ray.intersectObject(avatar.root, true).length > 0;
    if (!hit) { // forgiving radius around the avatar for fingers
      const c = new THREE.Vector3().setFromMatrixPosition(avatar.torso.matrixWorld).project(camera);
      const dx = (c.x - p.x) * innerWidth / 2, dy = (c.y - p.y) * innerHeight / 2;
      hit = Math.hypot(dx, dy) < (innerWidth <= 860 ? 70 : 40);
    }
    if (hit) { wave(); say(clickLines[clickIdx++ % clickLines.length], 3600); }
  });
  function wave() { waveT = 1.8; sfx.blip(740, .14, 'triangle', .05); }
  function pulse() { pulseT = 1; }

  /* ── Loop ── */
  const clock = new THREE.Clock();
  let tCur = scrollT(), tVel = 0, parX = 0, parY = 0, phase = 0, yaw = 0, facing = 1, lastStep = 0, blinkT = 2;
  const AF = mkF(), CF = mkF(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), mtx = new THREE.Matrix4();
  let first = true, running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); loop(); } });

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), .1), tm = clock.elapsedTime;
    const target = scrollT();
    const prev = tCur;
    tCur = reduced ? target : damp(tCur, target, 7, dt);
    const dT = tCur - prev;
    tVel = damp(tVel, dT / Math.max(dt, 1e-4), 8, dt);
    const speed = Math.abs(tVel);
    const walking = clamp(speed * 14, 0, 1);
    if (Math.abs(tVel) > .004) facing = Math.sign(tVel);

    // map t → curve param (station i at uOf(i))
    const sIdx = tCur * (N - 1);
    const u = lerp(uOf(0), uOf(N - 1), sIdx / (N - 1));
    frame(u, AF);

    // avatar on top of pipe
    const A = avatar;
    A.root.position.copy(AF.p).addScaledVector(AF.u, R - .02);
    mtx.makeBasis(AF.r.clone().negate(), AF.u, AF.t.clone()); // local +z = tangent
    A.root.quaternion.setFromRotationMatrix(mtx);
    const yawTarget = facing > 0 ? 0 : Math.PI;
    // when idle, turn 3/4 toward the camera so the face is visible
    const idleYaw = (1 - walking) * .9;
    yaw = damp(yaw, yawTarget + (facing > 0 ? -idleYaw : idleYaw), 6, dt);
    A.body.rotation.y = yaw;

    phase += dt * (4 + speed * 60) * walking;
    const sw = Math.sin(phase) * .7 * walking;
    A.legL.rotation.x = sw; A.legR.rotation.x = -sw;
    A.armL.rotation.x = -sw * .8; A.armR.rotation.x = sw * .8;
    A.body.position.y = Math.abs(Math.cos(phase)) * .05 * walking + (reduced ? 0 : Math.sin(tm * 2) * .006);
    A.torso.scale.y = 1 + Math.sin(tm * 2) * .008;
    if (walking > .3 && Math.cos(phase) * Math.cos(phase - dt * 6) < 0 && tm - lastStep > .18) { sfx.step(); lastStep = tm; }

    // wave
    if (waveT > 0) {
      waveT -= dt;
      const k = clamp(waveT / 1.8, 0, 1), up = Math.sin(Math.min(1, (1 - k) * 4) * Math.PI / 2) * Math.min(1, k * 4);
      A.armR.rotation.z = .08 + up * 2.6; A.armR.rotation.x = Math.sin(tm * 14) * .25 * up;
      A.armL.rotation.z = -.08;
    } else { A.armR.rotation.z = damp(A.armR.rotation.z, .08, 8, dt); A.armL.rotation.z = -.08; }

    // head tracks the pointer when idle
    A.head.rotation.y = damp(A.head.rotation.y, (1 - walking) * mouseX * .45 * (facing > 0 ? 1 : -1), 5, dt);
    A.head.rotation.x = damp(A.head.rotation.x, -mouseY * .2 * (1 - walking), 5, dt);
    A.head.rotation.z = Math.sin(phase * .5) * .04 * walking;

    // blink
    blinkT -= dt;
    const blink = blinkT < .12 ? .1 : 1;
    if (blinkT < 0) blinkT = 2 + Math.random() * 3;
    A.eyes.forEach(e => e.scale.y = blink);

    shadow.position.copy(AF.p).addScaledVector(AF.u, R + .005);
    shadow.quaternion.setFromUnitVectors(zAxis, AF.u);

    // camera: side-on, a little ahead, looking back at the avatar
    frame(u, CF);
    const mob = innerWidth <= 860;
    const dist = mob ? 9 : 7.6;
    camPos.copy(CF.p).addScaledVector(CF.r, dist).addScaledVector(CF.u, 2.3 + (mob ? .3 : 0)).addScaledVector(CF.t, 2.4);
    // camera is locked to the same t as the avatar, so pipe, avatar and panels move together;
    // only the small pointer parallax is smoothed
    parX = damp(parX, mouseX * .35, 4, dt); parY = damp(parY, mouseY * .2, 4, dt);
    camPos.x += parX; camPos.y += parY;
    const lookAt = _v.copy(CF.p).addScaledVector(CF.u, 1.35).addScaledVector(CF.t, -.4);
    camera.position.copy(camPos);
    camera.lookAt(lookAt);

    // packets
    pulseT = Math.max(0, pulseT - dt * 1.5);
    for (let i = 0; i < PK; i++) {
      const d = pkData[i];
      if (!reduced) d.u = (d.u + d.sp * dt * (1 + pulseT * 3)) % 1;
      frame(d.u, F);
      _v.copy(F.p).addScaledVector(F.r, Math.cos(d.a) * d.r).addScaledVector(F.u, Math.sin(d.a) * d.r);
      tmpQ.setFromAxisAngle(F.t, tm * 2 + d.spin);
      m4.compose(_v, tmpQ, sc.setScalar(1 + pulseT * .6));
      packets.setMatrixAt(i, m4);
    }
    sc.set(1, 1, 1);
    packets.instanceMatrix.needsUpdate = true;

    // props + gates
    if (!reduced) animated.forEach(f => f(tm));
    const active = Math.round(sIdx);
    gateMats.forEach((g, i) => g.opacity = i === active ? 1 : .35);
    labels.forEach((s, i) => s.material.opacity = 1 - clamp(Math.abs(sIdx - i) - .6, 0, 1) * .75);
    dust.rotation.y = Math.sin(tm * .05) * .02;

    // hover
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(A.root, true);
    hover = hits.length > 0;
    canvas.classList.toggle('is-hover', hover);

    renderer.render(scene, camera);

    // bubble follows head
    _v.setFromMatrixPosition(A.head.matrixWorld).addScaledVector(AF.u, .45);
    _v.project(camera);
    const bx = (_v.x * .5 + .5) * innerWidth, by = (-_v.y * .5 + .5) * innerHeight;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let tx, ty;
    if (mob) {
      // phones: sit beside the head, never under the nav bar
      tx = Math.min(bx + 34, innerWidth - bw - 10);
      ty = clamp(by - bh * .2, 70, innerHeight - bh - 10);
    } else {
      tx = Math.min(bx + 26, innerWidth - bw - 12);
      ty = Math.max(70, by - bh);
    }
    bubble.style.transform = `translate(${Math.round(Math.max(10, tx))}px, ${Math.round(ty)}px)`;

    updateChrome(tCur, dt);
  }
  loop();
  return { wave, pulse };
}
