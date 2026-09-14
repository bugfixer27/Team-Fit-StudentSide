// Motion engine: constellation canvas, cursor spotlight, scroll reveals,
// count-ups, 3D card tilt, and the pinned horizontal event gallery.
// Everything is rAF-driven and degrades gracefully under prefers-reduced-motion.

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ constellation */
export function constellation(canvas) {
  const ctx = canvas.getContext('2d');
  const PALETTE = { A: '#c2334f', B: '#f2c94c', C: '#e8cfa6', none: '#8b8380' };
  let W = 0, H = 0, dpr = 1;
  let pts = [];
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  let targetCount = 70, colors = null, running = true, scrollY = 0;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(color) {
    return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 1.2 + Math.random() * 1.6, c: color, a: 0, ta: 1, phase: Math.random() * Math.PI * 2 };
  }
  function sync() {
    // Grow / shrink to targetCount and recolor when the roster arrives.
    while (pts.length < targetCount) pts.push(spawn(colors ? colors[pts.length % colors.length] : PALETTE.none));
    while (pts.length > targetCount) pts.pop();
    if (colors) pts.forEach((p, i) => { p.c = colors[i % colors.length]; });
  }
  function frame(t) {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    mouse.x = lerp(mouse.x, mouse.tx, 0.08); mouse.y = lerp(mouse.y, mouse.ty, 0.08);
    const drift = scrollY * 0.00015;
    for (const p of pts) {
      p.x += p.vx + Math.sin(t * 0.0004 + p.phase) * 0.08;
      p.y += p.vy - drift;
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
      // gentle repulsion from the cursor
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160) { const f = (1 - Math.sqrt(d2) / 160) * 0.6; p.x += dx / Math.sqrt(d2 + 1) * f; p.y += dy / Math.sqrt(d2 + 1) * f; }
      p.a = lerp(p.a, p.ta, 0.03);
    }
    // links
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j];
        const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > 130 * 130) continue;
        const k = (1 - Math.sqrt(d2) / 130) * 0.22 * Math.min(a.a, b.a);
        ctx.strokeStyle = a.c === b.c ? a.c : '#b9b0a8';
        ctx.globalAlpha = k;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    // points
    for (const p of pts) {
      ctx.globalAlpha = 0.85 * p.a;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.18 * p.a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize(); sync();
  window.addEventListener('resize', () => { resize(); }, { passive: true });
  window.addEventListener('pointermove', e => { mouse.tx = e.clientX; mouse.ty = e.clientY; }, { passive: true });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(frame); });
  if (!reduced) requestAnimationFrame(frame); else { pts.forEach(p => p.a = 1); frame(0); running = false; }

  return {
    /** One particle per person, tinted by team. */
    setPeople(people) {
      colors = people.length ? people.map(p => PALETTE[p.team || 'none']) : null;
      targetCount = clamp(people.length * 2, 60, 160);
      sync();
      pts.forEach(p => { p.a = 0; p.ta = 1; });
    }
  };
}

/* ------------------------------------------------------------------ spotlight */
export function spotlight(el) {
  if (reduced) return;
  let tx = innerWidth / 2, ty = innerHeight * 0.3, x = tx, y = ty;
  window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  (function tick() { x = lerp(x, tx, 0.1); y = lerp(y, ty, 0.1); el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px'); requestAnimationFrame(tick); })();
}

/* ------------------------------------------------------------------ reveals */
const io = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
export function observe(el, i) {
  if (i != null) el.style.setProperty('--i', i);
  io.observe(el);
}
export function observeAll(root = document) { root.querySelectorAll('.reveal').forEach(el => observe(el, el.dataset.i)); }

/* ------------------------------------------------------------------ count-up */
export function countUp(el, to, ms = 1600) {
  const from = Number(el.textContent) || 0;
  if (reduced) { el.textContent = to; return; }
  const t0 = performance.now();
  (function tick(now) {
    const p = clamp((now - t0) / ms, 0, 1);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(lerp(from, to, e));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ------------------------------------------------------------------ 3D tilt (delegated) */
export function tilt(root, selector) {
  if (reduced || !window.matchMedia('(hover: hover)').matches) return;
  root.addEventListener('pointermove', e => {
    const card = e.target.closest(selector); if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
    card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
    card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  }, { passive: true });
  root.addEventListener('pointerleave', e => { /* handled per-card below */ }, true);
  root.addEventListener('pointerout', e => {
    const card = e.target.closest(selector); if (!card || card.contains(e.relatedTarget)) return;
    card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
  });
}

/* ------------------------------------------------------------------ pinned horizontal gallery */
export function horizontalGallery(section, track, railFill) {
  const mq = window.matchMedia('(max-width: 820px)');
  let max = 0, target = 0, cur = 0, active = false, raf = 0;
  const cards = () => [...track.children];

  function layout() {
    if (mq.matches) { active = false; section.style.height = ''; track.style.transform = ''; cards().forEach(c => { c.style.removeProperty('--ty'); c.style.removeProperty('--ryy'); c.style.removeProperty('--s'); }); return; }
    active = true;
    max = Math.max(0, track.scrollWidth - window.innerWidth);
    // The section is tall enough that scrolling through it drives the track across the screen.
    section.style.height = (window.innerHeight + max * 1.15) + 'px';
    onScroll();
  }
  function progress() {
    const top = section.offsetTop, span = section.offsetHeight - window.innerHeight;
    return span <= 0 ? 0 : clamp((window.scrollY - top) / span, 0, 1);
  }
  function onScroll() { if (!active) return; target = progress() * max; if (!raf) raf = requestAnimationFrame(tick); }
  function tick() {
    raf = 0;
    cur = reduced ? target : lerp(cur, target, 0.14);
    if (Math.abs(cur - target) < 0.3) cur = target;
    track.style.transform = `translate3d(${-cur}px,0,0)`;
    if (railFill) railFill.style.transform = `scaleX(${max ? cur / max : 0})`;
    // Parallax per card: distance from viewport centre → lift, tilt, scale.
    const mid = window.innerWidth / 2;
    for (const c of cards()) {
      const r = c.getBoundingClientRect();
      const d = clamp((r.left + r.width / 2 - mid) / window.innerWidth, -1, 1);
      c.style.setProperty('--ty', (Math.abs(d) * 34).toFixed(1) + 'px');
      c.style.setProperty('--ryy', (d * -9).toFixed(2) + 'deg');
      c.style.setProperty('--s', (1 - Math.abs(d) * 0.06).toFixed(3));
    }
    if (cur !== target) raf = requestAnimationFrame(tick);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  mq.addEventListener('change', layout);
  layout();
  return {
    layout,
    /** Scroll the page so that card `i` sits centred in the gallery. */
    scrollToCard(i) {
      const c = cards()[i]; if (!c) return;
      if (!active) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const x = clamp(c.offsetLeft - (window.innerWidth - c.offsetWidth) / 2, 0, max);
      const span = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: section.offsetTop + (max ? x / max : 0) * span, behavior: 'smooth' });
    }
  };
}

/* ------------------------------------------------------------------ nav: progress + active section */
export function navigation(nav, progressEl, links) {
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  function update() {
    const y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    progressEl.style.transform = `scaleX(${h ? y / h : 0})`;
    nav.classList.toggle('is-solid', y > 40);
    let cur = null;
    for (const s of sections) if (y + window.innerHeight * 0.4 >= s.offsetTop) cur = s;
    links.forEach(a => a.classList.toggle('is-active', cur && a.getAttribute('href') === '#' + cur.id));
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
}

/* ------------------------------------------------------------------ text splitting */
export function splitWord(el, word) {
  el.textContent = '';
  [...word].forEach((ch, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; s.style.setProperty('--i', i + (el.dataset.offset ? Number(el.dataset.offset) : 0)); el.appendChild(s); });
}
