/* Line — ink engine: freehand capture, curve fit, mirrored profile editing,
   family generation, revolve preview, SVG export. Vanilla web components. */
(function () {
  'use strict';
  if (window.LineApp) return;

  // ---------- tiny deterministic noise ----------
  function rnd(seed) { const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function srnd(seed) { return rnd(seed) - 0.5; }

  // ---------- store / command bus ----------
  const LineApp = window.LineApp = {
    profiles: {}, subs: {}, cmdSubs: {}, meta: {},
    setProfile(id, p) { this.profiles[id] = p; (this.subs[id] || []).forEach(f => f(p)); },
    on(id, f) { (this.subs[id] = this.subs[id] || []).push(f); if (this.profiles[id]) f(this.profiles[id]); },
    command(id, cmd, arg) { (this.cmdSubs[id] || []).forEach(f => f(cmd, arg)); },
    onCommand(id, f) { (this.cmdSubs[id] = this.cmdSubs[id] || []).push(f); },
    setMeta(id, k, v) { (this.meta[id] = this.meta[id] || {})[k] = v; this.command(id, '_meta', { k, v }); },
    getMeta(id, k, d) { const m = this.meta[id]; return m && m[k] !== undefined ? m[k] : d; }
  };

  const INK = '#262219';

  // ---------- geometry ----------
  function catmull(cps, res) {
    res = res || 18;
    const out = [];
    if (cps.length < 2) return cps.slice();
    for (let i = 0; i < cps.length - 1; i++) {
      const p0 = cps[Math.max(i - 1, 0)], p1 = cps[i], p2 = cps[i + 1], p3 = cps[Math.min(i + 2, cps.length - 1)];
      for (let j = 0; j < res; j++) {
        const t = j / res, t2 = t * t, t3 = t2 * t;
        out.push({
          r: 0.5 * ((2 * p1.r) + (-p0.r + p2.r) * t + (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * t2 + (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push({ r: cps[cps.length - 1].r, y: cps[cps.length - 1].y });
    return out;
  }

  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    let dmax = 0, idx = 0;
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / len;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps) {
      const l = rdp(pts.slice(0, idx + 1), eps), r = rdp(pts.slice(idx), eps);
      return l.slice(0, -1).concat(r);
    }
    return [a, b];
  }

  function smoothRaw(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      let sx = 0, sy = 0, n = 0;
      for (let k = -2; k <= 2; k++) {
        const j = Math.min(pts.length - 1, Math.max(0, i + k));
        sx += pts[j].x; sy += pts[j].y; n++;
      }
      out.push({ x: sx / n, y: sy / n });
    }
    return out;
  }

  // fit raw canvas stroke -> normalized cps ({r: radius/height, y: 0..1})
  function fitStroke(raw, axisX) {
    if (raw.length < 4) return null;
    let pts = smoothRaw(raw);
    if (pts[0].y > pts[pts.length - 1].y) pts = pts.slice().reverse();
    const ys = pts.map(p => p.y);
    const top = Math.min.apply(null, ys), bot = Math.max.apply(null, ys);
    const H = bot - top; if (H < 20) return null;
    let eps = H * 0.012, cps = rdp(pts, eps), guard = 0;
    while (cps.length > 9 && guard++ < 12) { eps *= 1.4; cps = rdp(pts, eps); }
    const norm = cps.map(p => ({ r: Math.max(0.01, Math.abs(p.x - axisX) / H), y: (p.y - top) / H }));
    // enforce monotonic-ish y
    for (let i = 1; i < norm.length; i++) if (norm[i].y <= norm[i - 1].y) norm[i].y = norm[i - 1].y + 0.005;
    norm[0].y = 0; norm[norm.length - 1].y = Math.max(norm[norm.length - 1].y, 1);
    const s = norm[norm.length - 1].y;
    norm.forEach(p => p.y = p.y / s);
    return norm;
  }

  function maxR(cps) { return Math.max.apply(null, catmull(cps, 8).map(p => p.r)); }

  // feature-preserving aspect remap
  function remapProfile(cps, w, h, mode) {
    return cps.map(p => {
      let y = p.y;
      if (mode === 'neck' && h !== 1) {
        const keep = Math.min(0.3, 0.3 / h);
        y = p.y <= 0.3 ? p.y * (keep / 0.3) : keep + (p.y - 0.3) * ((1 - keep) / 0.7);
      } else if (mode === 'foot' && h !== 1) {
        const keep = Math.min(0.22, 0.22 / h);
        y = p.y >= 0.78 ? 1 - (1 - p.y) * (keep / 0.22) : (p.y) * ((1 - keep) / 0.78);
      } else if (mode === 'ends' && h !== 1) {
        const kt = Math.min(0.26, 0.26 / h), kb = Math.min(0.18, 0.18 / h);
        if (p.y <= 0.26) y = p.y * (kt / 0.26);
        else if (p.y >= 0.82) y = 1 - (1 - p.y) * (kb / 0.18);
        else y = kt + (p.y - 0.26) * ((1 - kt - kb) / 0.56);
      }
      let r = p.r * w / h;
      if (mode === 'weight') r = p.r * w / (h * Math.sqrt(h));
      return { r: r, y: y };
    });
  }

  // clay tones + filled silhouette for the still-life scene
  const TONES = ['#b5a28b', '#a28b70', '#c4b59d', '#93805f', '#ab967c', '#bfae94', '#8c7a64'];
  function shade(hex, amt) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amt));
    const b = Math.min(255, Math.max(0, (num & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function fillPot(ctx, rc, cx, topY, Hpx, tone, o) {
    o = o || {};
    const dense = catmull(rc, 22);
    const rb = Math.max.apply(null, dense.map(p => p.r)) * Hpx;
    ctx.save();
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillStyle = 'rgba(50,40,25,' + (o.shadow === undefined ? 0.14 : o.shadow) + ')';
    ctx.beginPath(); ctx.ellipse(cx, topY + Hpx + 3, rb * 0.92, Math.max(2, rb * 0.15), 0, 0, Math.PI * 2); ctx.fill();
    if (o.blur) ctx.filter = 'blur(' + o.blur + 'px)';
    ctx.beginPath();
    dense.forEach((p, i) => { const X = cx + p.r * Hpx, Y = topY + p.y * Hpx; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    for (let i = dense.length - 1; i >= 0; i--) ctx.lineTo(cx - dense[i].r * Hpx, topY + dense[i].y * Hpx);
    ctx.closePath();
    const gg = ctx.createLinearGradient(cx - rb, 0, cx + rb, 0);
    gg.addColorStop(0, shade(tone, -16)); gg.addColorStop(0.42, shade(tone, 12)); gg.addColorStop(1, shade(tone, -8));
    ctx.fillStyle = gg; ctx.fill();
    const rt = dense[0].r * Hpx;
    if (rt > 2) {
      ctx.strokeStyle = 'rgba(40,32,20,.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, topY, rt, Math.max(1.5, rt * 0.14), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- ink rendering ----------
  function drawInk(ctx, pts, o) {
    o = o || {};
    const w = o.w || 3, tex = o.tex === undefined ? 1 : o.tex, seed = o.seed || 7, alpha = o.alpha === undefined ? 1 : o.alpha;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = o.color || INK;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // main variable-width pass, segment by segment
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const j = i / (n - 1);
      const taper = Math.min(1, (i + 1) / 5, (n - i) / 5);
      const wob = 0.8 + 0.45 * Math.sin(Math.PI * j) * (0.6 + 0.4 * rnd(seed + Math.floor(j * 9)));
      ctx.globalAlpha = alpha * 0.92;
      ctx.lineWidth = Math.max(0.6, w * wob * (0.55 + 0.45 * taper) * (1 + srnd(seed + i * 3) * 0.18 * tex));
      const j1 = tex * 0.5, j2 = tex * 0.5;
      ctx.beginPath();
      ctx.moveTo(pts[i].x + srnd(seed + i * 7) * j1, pts[i].y + srnd(seed + i * 13) * j1);
      ctx.lineTo(pts[i + 1].x + srnd(seed + (i + 1) * 7) * j2, pts[i + 1].y + srnd(seed + (i + 1) * 13) * j2);
      ctx.stroke();
    }
    // bristle passes
    for (let pass = 1; pass <= Math.round(tex); pass++) {
      ctx.globalAlpha = alpha * 0.10;
      ctx.lineWidth = Math.max(0.5, w * 0.5);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = pts[i].x + srnd(seed + i * 5 + pass * 97) * tex * 2.2;
        const py = pts[i].y + srnd(seed + i * 11 + pass * 131) * tex * 2.2;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // draw a full pot outline (mirrored) into ctx. cx = axis x, topY, Hpx = height px.
  function drawPot(ctx, cps, cx, topY, Hpx, o) {
    o = o || {};
    const dense = catmull(cps, 22);
    const right = dense.map(p => ({ x: cx + p.r * Hpx, y: topY + p.y * Hpx }));
    const left = dense.map(p => ({ x: cx - p.r * Hpx, y: topY + p.y * Hpx }));
    const seed = o.seed || 7;
    drawInk(ctx, right, Object.assign({}, o, { seed: seed }));
    drawInk(ctx, left, Object.assign({}, o, { seed: seed + 41 }));
    // base
    const rb = dense[dense.length - 1].r * Hpx;
    if (rb > 2 && o.base !== false) {
      const by = topY + Hpx;
      drawInk(ctx, [{ x: cx - rb, y: by }, { x: cx - rb * 0.3, y: by + 0.8 }, { x: cx + rb * 0.4, y: by + 0.8 }, { x: cx + rb, y: by }], Object.assign({}, o, { seed: seed + 83, w: (o.w || 3) * 0.85 }));
    }
    // rim hint
    if (o.rim) {
      const rt = dense[0].r * Hpx;
      drawInk(ctx, [{ x: cx - rt, y: topY }, { x: cx - rt * 0.2, y: topY - 1.2 }, { x: cx + rt * 0.3, y: topY - 1 }, { x: cx + rt, y: topY }], Object.assign({}, o, { seed: seed + 29, w: (o.w || 3) * 0.6, alpha: (o.alpha || 1) * 0.8 }));
    }
  }

  // ---------- presets ----------
  const PRESETS = {
    bowl: [{ r: 0.62, y: 0 }, { r: 0.58, y: 0.28 }, { r: 0.44, y: 0.62 }, { r: 0.24, y: 0.88 }, { r: 0.18, y: 1 }],
    cup: [{ r: 0.36, y: 0 }, { r: 0.36, y: 0.35 }, { r: 0.34, y: 0.7 }, { r: 0.28, y: 0.92 }, { r: 0.26, y: 1 }],
    vase: [{ r: 0.16, y: 0 }, { r: 0.13, y: 0.14 }, { r: 0.30, y: 0.42 }, { r: 0.36, y: 0.66 }, { r: 0.28, y: 0.9 }, { r: 0.2, y: 1 }],
    bottle: [{ r: 0.09, y: 0 }, { r: 0.09, y: 0.2 }, { r: 0.26, y: 0.45 }, { r: 0.3, y: 0.72 }, { r: 0.27, y: 0.94 }, { r: 0.22, y: 1 }]
  };
  LineApp.PRESETS = PRESETS;

  // vessel sets: A = target aspect (width/height), s = height relative to the original
  const SETS = {
    classical: [{ label: 'plate', A: 4.2, s: 0.16 }, { label: 'bowl', A: 1.7, s: 0.5 }, { label: 'cup', A: 1.05, s: 0.42 }, { label: 'jar', A: 0.8, s: 0.72 }, { label: 'vase', A: 0.55, s: 1.05 }, { label: 'bottle', A: 0.4, s: 1.3 }],
    cafe: [{ label: 'espresso', A: 1.05, s: 0.32 }, { label: 'cappuccino', A: 1.45, s: 0.38 }, { label: 'mug', A: 0.82, s: 0.55 }, { label: 'glass', A: 0.5, s: 0.68 }, { label: 'pitcher', A: 0.62, s: 0.95 }, { label: 'carafe', A: 0.45, s: 1.15 }],
    ikebana: [{ label: 'tray', A: 5, s: 0.14 }, { label: 'basin', A: 2.4, s: 0.4 }, { label: 'moon', A: 0.95, s: 0.8 }, { label: 'bud', A: 0.32, s: 0.95 }, { label: 'cylinder', A: 0.48, s: 1 }]
  };
  function resolveVariants(set, mR) {
    if (!SETS[set]) return null;
    return [{ label: 'original', w: 1, h: 1 }].concat(SETS[set].map(v => ({ label: v.label, h: v.s, w: Math.max(0.08, v.A * v.s / (2 * mR)) })));
  }

  // ---------- shared canvas plumbing ----------
  function setupCanvas(el) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    el.style.position = el.style.position || 'relative';
    el.appendChild(c);
    const state = { c: c, ctx: c.getContext('2d'), w: 0, h: 0 };
    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return false;
      if (w === state.w && h === state.h) return true;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      state.w = w; state.h = h;
      c.width = Math.max(1, w * dpr); c.height = Math.max(1, h * dpr);
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (el._render) el._render();
      return true;
    };
    // immediate + retry until laid out; RO and window resize as ongoing fallbacks
    let tries = 0;
    const boot = () => { if (!size() && tries++ < 60) setTimeout(boot, tries < 10 ? 50 : 250); };
    requestAnimationFrame(boot);
    try { new ResizeObserver(size).observe(el); } catch (e) { }
    window.addEventListener('resize', size);
    return state;
  }

  // ================= <ink-canvas> =================
  class InkCanvas extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      this.style.display = 'block'; this.style.width = '100%'; this.style.height = '100%';
      this.style.touchAction = 'none';
      const id = this.dataset.optionId || this.getAttribute('option-id') || 'a';
      this.oid = id;
      this.tex = parseFloat(this.dataset.texture || this.getAttribute('texture') || '1');
      this.handleStyle = this.dataset.handles || this.getAttribute('handles') || 'dot';
      this.cv = setupCanvas(this);
      this.mode = 'empty'; this.raw = []; this.cps = null; this.undoStack = [];
      this.drag = null;
      this._render = this.render.bind(this);
      const preset = this.dataset.preset || this.getAttribute('preset');
      if (preset && PRESETS[preset]) { this.cps = PRESETS[preset].map(p => ({ r: p.r, y: p.y })); this.mode = 'refine'; }
      this.publish();

      LineApp.onCommand(id, (cmd, arg) => {
        if (cmd === 'clear') { this.snap(); this.cps = null; this.raw = []; this.mode = 'empty'; this.publish(); this.render(); }
        else if (cmd === 'template') { this.snap(); this.cps = PRESETS[arg].map(p => ({ r: p.r, y: p.y })); this.mode = 'refine'; this.publish(); this.render(); }
        else if (cmd === 'undo') { const s = this.undoStack.pop(); if (s !== undefined) { this.cps = s; this.mode = s ? 'refine' : 'empty'; this.publish(); this.render(); } }
        else if (cmd === 'texture') { this.tex = parseFloat(arg) || this.tex; this.render(); }
        else if (cmd === 'handles') { this.handleStyle = arg; this.render(); }
        else if (cmd === '_meta') this.render();
      });

      this.addEventListener('pointerdown', e => this.down(e));
      this.addEventListener('pointermove', e => this.move(e));
      this.addEventListener('pointerup', e => this.up(e));
      this.addEventListener('pointercancel', e => this.up(e));
      this.addEventListener('dblclick', e => this.dbl(e));
    }
    snap() { this.undoStack.push(this.cps ? this.cps.map(p => ({ r: p.r, y: p.y })) : null); if (this.undoStack.length > 40) this.undoStack.shift(); }
    publish() { if (this.cps) LineApp.setProfile(this.oid, { cps: this.cps.map(p => ({ r: p.r, y: p.y })) }); else LineApp.setProfile(this.oid, null); }
    layout() {
      const w = this.cv.w, h = this.cv.h;
      const mR = this.cps ? Math.max(0.35, maxR(this.cps)) : 0.5;
      const Hpx = Math.min(h * 0.68, (w * 0.42) / mR);
      return { cx: w / 2, topY: (h - Hpx) / 2, Hpx: Hpx, w: w, h: h };
    }
    toCanvas(p, L) { return { x: L.cx + p.r * L.Hpx, y: L.topY + p.y * L.Hpx }; }
    fromCanvas(x, y, L) { return { r: Math.max(0.005, Math.abs(x - L.cx) / L.Hpx), y: (y - L.topY) / L.Hpx }; }
    hitHandle(x, y, L) {
      if (!this.cps) return -1;
      for (let i = 0; i < this.cps.length; i++) {
        const q = this.toCanvas(this.cps[i], L);
        if (Math.hypot(q.x - x, q.y - y) < 16) return i;
      }
      return -1;
    }
    down(e) {
      e.preventDefault(); this.setPointerCapture(e.pointerId);
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top, L = this.layout();
      if (this.mode === 'refine') {
        const hi = this.hitHandle(x, y, L);
        if (hi >= 0) { this.snap(); this.drag = hi; return; }
        // insert on curve
        const dense = catmull(this.cps, 22).map(p => this.toCanvas(p, L));
        let best = 1e9, bi = -1;
        for (let i = 0; i < dense.length; i++) { const d = Math.hypot(dense[i].x - x, dense[i].y - y) < best ? Math.hypot(dense[i].x - x, dense[i].y - y) : best; if (d < best) { best = d; bi = i; } }
        if (best < 18) {
          this.snap();
          const np = this.fromCanvas(x, y, L);
          let ins = this.cps.length - 1;
          for (let i = 0; i < this.cps.length - 1; i++) if (np.y > this.cps[i].y && np.y <= this.cps[i + 1].y) { ins = i + 1; break; }
          this.cps.splice(ins, 0, np); this.drag = ins; this.publish(); this.render();
        }
        return;
      }
      this.mode = 'drawing'; this.raw = [{ x: x, y: y }]; this.render();
    }
    move(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top, L = this.layout();
      if (this.drag !== null && this.drag >= 0) {
        const p = this.fromCanvas(x, y, L);
        const i = this.drag, cps = this.cps;
        const lo = i > 0 ? cps[i - 1].y + 0.01 : -0.06;
        const hi = i < cps.length - 1 ? cps[i + 1].y - 0.01 : 1.06;
        cps[i] = { r: Math.min(1.4, p.r), y: Math.min(hi, Math.max(lo, p.y)) };
        if (i === 0 || i === cps.length - 1) this.renorm();
        this.publish(); this.render();
        return;
      }
      if (this.mode === 'drawing') {
        const last = this.raw[this.raw.length - 1];
        if (Math.hypot(x - last.x, y - last.y) > 2.5) { this.raw.push({ x: x, y: y }); this.render(); }
      }
    }
    renorm() {
      const cps = this.cps;
      const y0 = cps[0].y, y1 = cps[cps.length - 1].y, s = y1 - y0;
      if (s > 0.2) cps.forEach(p => p.y = (p.y - y0) / s);
    }
    up(e) {
      if (this.drag !== null) { this.drag = null; this.render(); return; }
      if (this.mode === 'drawing') {
        const L = this.layout();
        const fit = fitStroke(this.raw, L.cx);
        this.raw = [];
        if (fit) { this.snap(); this.cps = fit; this.mode = 'refine'; this.publish(); }
        else this.mode = this.cps ? 'refine' : 'empty';
        this.render();
      }
    }
    dbl(e) {
      if (!this.cps || this.cps.length <= 4) return;
      const rect = this.getBoundingClientRect();
      const hi = this.hitHandle(e.clientX - rect.left, e.clientY - rect.top, this.layout());
      if (hi > 0 && hi < this.cps.length - 1) { this.snap(); this.cps.splice(hi, 1); this.publish(); this.render(); }
    }
    render() {
      const ctx = this.cv.ctx, w = this.cv.w, h = this.cv.h;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      const L = this.layout();
      // axis
      ctx.save();
      ctx.strokeStyle = 'rgba(60,50,35,.28)'; ctx.lineWidth = 1; ctx.setLineDash([1, 7]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(L.cx, Math.max(14, L.topY - 46)); ctx.lineTo(L.cx, Math.min(h - 14, L.topY + L.Hpx + 46)); ctx.stroke();
      ctx.setLineDash([]);
      // cm ticks
      const cm = LineApp.getMeta(this.oid, 'height', 18);
      const px = L.Hpx / cm;
      if (this.cps && px > 7) {
        ctx.strokeStyle = 'rgba(60,50,35,.13)';
        for (let i = 0; i <= cm; i += (px > 16 ? 1 : 5)) {
          const yy = L.topY + L.Hpx - i * px;
          ctx.beginPath(); ctx.moveTo(L.cx - 5, yy); ctx.lineTo(L.cx + 5, yy); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(60,50,35,.45)';
        ctx.font = '10px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(cm + ' cm', L.cx + 10, L.topY + 4);
      }
      ctx.restore();
      if (this.mode === 'empty') {
        ctx.save();
        ctx.fillStyle = 'rgba(60,50,35,.5)';
        ctx.font = '400 14px "Shippori Mincho", serif'; ctx.textAlign = 'center';
        ctx.fillText('draw one side of your form, rim to foot', L.cx, h / 2 - 8);
        ctx.font = '11px "Zen Kaku Gothic New", sans-serif';
        ctx.fillStyle = 'rgba(60,50,35,.38)';
        ctx.fillText('the line will be mirrored across the axis', L.cx, h / 2 + 14);
        ctx.restore();
      }
      if (this.mode === 'drawing' && this.raw.length > 1) {
        drawInk(ctx, this.raw, { w: 3, tex: this.tex, seed: 5, alpha: 0.85 });
      }
      if (this.cps) {
        const dense = catmull(this.cps, 22);
        const right = dense.map(p => ({ x: L.cx + p.r * L.Hpx, y: L.topY + p.y * L.Hpx }));
        const left = dense.map(p => ({ x: L.cx - p.r * L.Hpx, y: L.topY + p.y * L.Hpx }));
        drawInk(ctx, left, { w: 3.2, tex: this.tex, seed: 51, alpha: 0.28 });
        drawInk(ctx, right, { w: 3.4, tex: this.tex, seed: 9, alpha: 1 });
        // handles
        ctx.save();
        for (let i = 0; i < this.cps.length; i++) {
          const q = this.toCanvas(this.cps[i], L);
          if (this.handleStyle === 'ring') {
            ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 7); ctx.strokeStyle = 'rgba(38,34,25,.75)'; ctx.lineWidth = 1.4; ctx.stroke();
            ctx.beginPath(); ctx.arc(q.x, q.y, 1.8, 0, 7); ctx.fillStyle = 'rgba(38,34,25,.8)'; ctx.fill();
          } else if (this.handleStyle === 'seal') {
            ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 7); ctx.fillStyle = 'rgba(180,67,46,.85)'; ctx.fill();
          } else {
            ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, 7); ctx.fillStyle = 'rgba(38,34,25,.82)'; ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }
  customElements.define('ink-canvas', InkCanvas);

  // ================= <family-board> =================
  const VARIANTS = [
    { label: 'slender', w: 0.68, h: 1.28 },
    { label: 'tall', w: 0.92, h: 1.5 },
    { label: 'original', w: 1, h: 1 },
    { label: 'wide', w: 1.45, h: 0.95 },
    { label: 'low', w: 1.2, h: 0.62 },
    { label: 'grand', w: 1.35, h: 1.45 },
    { label: 'mini', w: 0.72, h: 0.55 }
  ];
  const GRID = { rows: [1.35, 1, 0.65], cols: [0.72, 1, 1.35] };

  class FamilyBoard extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      this.style.display = 'block'; this.style.width = '100%'; this.style.height = '100%';
      this.oid = this.dataset.optionId || this.getAttribute('option-id') || 'a';
      this.layoutMode = this.dataset.layout || this.getAttribute('layout') || 'shelf';
      this.fixed = !!this.dataset.fixedLayout;
      this.tex = parseFloat(this.dataset.texture || this.getAttribute('texture') || '1');
      this.cv = setupCanvas(this);
      this.profile = null; this.sel = -1;
      this._render = this.render.bind(this);
      LineApp.on(this.oid, p => { this.profile = p; this.render(); });
      LineApp.onCommand(this.oid, (cmd, arg) => { if (cmd === '_meta') this.render(); else if (cmd === 'texture') { this.tex = parseFloat(arg) || this.tex; this.render(); } });
      this.addEventListener('pointerdown', e => {
        if (!this.hits) return;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        for (let i = 0; i < this.hits.length; i++) {
          const hb = this.hits[i];
          if (x > hb.x && x < hb.x + hb.w && y > hb.y && y < hb.y + hb.h) { this.sel = this.sel === i ? -1 : i; this.render(); return; }
        }
      });
    }
    render() {
      const ctx = this.cv.ctx, w = this.cv.w, h = this.cv.h;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      this.hits = [];
      if (!this.profile) {
        ctx.fillStyle = 'rgba(60,50,35,.42)'; ctx.font = '12px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('the family appears once a line is drawn', w / 2, h / 2);
        return;
      }
      const cps = this.profile.cps;
      const adapt = LineApp.getMeta(this.oid, 'adapt', 'uniform');
      const cm = LineApp.getMeta(this.oid, 'height', 18);
      const mR = Math.max(0.2, maxR(cps));
      const layout = this.fixed ? this.layoutMode : LineApp.getMeta(this.oid, 'layout', this.layoutMode);
      const setName = LineApp.getMeta(this.oid, 'set', 'studio');
      const vs = resolveVariants(setName, mR) || VARIANTS;
      if (layout === 'grid') this.renderGrid(ctx, w, h, cps, adapt, cm, mR, vs);
      else if (layout === 'overlap') this.renderOverlap(ctx, w, h, cps, adapt, cm, mR, vs);
      else if (layout === 'organic') this.renderOrganic(ctx, w, h, cps, adapt, cm, mR, vs);
      else if (layout === 'scene') this.renderScene(ctx, w, h, cps, adapt, cm, mR, vs);
      else this.renderShelf(ctx, w, h, cps, adapt, cm, mR, vs);
    }
    dims(cm, mR, v) { return (cm * v.h).toFixed(0) + ' × ' + (cm * mR * 2 * v.w).toFixed(0) + ' cm'; }
    renderShelf(ctx, w, h, cps, adapt, cm, mR, vs) {
      const maxH = Math.max.apply(null, vs.map(v => v.h));
      const unit = Math.min((h - 46) / maxH, w / (vs.reduce((s, v) => s + Math.max(0.3, mR * 2 * v.w), 0) * 1.15 + 0.5));
      const base = h - 26;
      let x = (w - vs.reduce((s, v) => s + Math.max(0.3, mR * 2 * v.w) * unit * 1.15, 0)) / 2;
      // shelf line
      drawInk(ctx, [{ x: 14, y: base + 6 }, { x: w * 0.4, y: base + 5 }, { x: w - 14, y: base + 7 }], { w: 1.6, tex: this.tex, seed: 3, alpha: 0.5 });
      vs.forEach((v, i) => {
        const rc = remapProfile(cps, v.w, v.h, adapt);
        const Hpx = unit * v.h;
        const wpx = Math.max(0.3, mR * 2 * v.w) * unit * 1.15;
        const cx = x + wpx / 2;
        drawPot(ctx, rc, cx, base - Hpx, Hpx, { w: 2.4, tex: this.tex, seed: 11 + i * 7, alpha: v.label === 'original' ? 1 : 0.88, rim: true });
        if (this.sel === i) {
          ctx.fillStyle = '#b4432e'; ctx.beginPath(); ctx.arc(cx, base + 15, 2.6, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(60,50,35,.7)'; ctx.font = '10px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(v.label + ' · ' + this.dims(cm, mR, v), cx, h - 4);
        }
        this.hits.push({ x: x, y: base - Hpx - 10, w: wpx, h: Hpx + 20 });
        x += wpx;
      });
    }
    renderGrid(ctx, w, h, cps, adapt, cm, mR, vs) {
      const n = vs.length, cols = n > 6 ? 4 : 3, rows = Math.ceil(n / cols);
      const pad = 10, cw = (w - pad * 2) / cols, ch = (h - pad * 2) / rows;
      const maxH = Math.max.apply(null, vs.map(v => v.h));
      vs.forEach((v, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const x0 = pad + c * cw, y0 = pad + r * ch;
        ctx.strokeStyle = 'rgba(60,50,35,.1)'; ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 3, y0 + 3, cw - 6, ch - 6);
        if (v.label === 'original') { ctx.fillStyle = 'rgba(180,67,46,.07)'; ctx.fillRect(x0 + 3, y0 + 3, cw - 6, ch - 6); }
        const availH = ch - 40, availW = cw - 26;
        let Hpx = availH * (v.h / maxH);
        const halfW = mR * v.w * (Hpx / v.h);
        if (halfW * 2 > availW) Hpx *= availW / (halfW * 2);
        const cx = x0 + cw / 2;
        drawPot(ctx, remapProfile(cps, v.w, v.h, adapt), cx, y0 + 10 + (availH - Hpx), Hpx, { w: 1.9, tex: this.tex, seed: 17 + i * 13, rim: true });
        ctx.fillStyle = 'rgba(60,50,35,.55)'; ctx.font = '9.5px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText((v.label ? v.label + ' · ' : '') + this.dims(cm, mR, v), cx, y0 + ch - 9);
        this.hits.push({ x: x0, y: y0, w: cw, h: ch });
      });
    }
    renderOverlap(ctx, w, h, cps, adapt, cm, mR, vs) {
      const ord = vs.slice().sort((a, b) => b.h - a.h);
      const maxH = Math.max.apply(null, ord.map(v => v.h));
      const widths = ord.map(v => Math.max(0.3, mR * 2 * v.w));
      const totalW = widths.reduce((s, x) => s + x, 0);
      const unit = Math.min((h - 76) / maxH, (w - 100) / (totalW * 0.74));
      const base = h - 40;
      let x = w / 2 - (totalW * 0.74 * unit) / 2 + widths[0] * unit * 0.37;
      ord.forEach((v, i) => {
        const cx = x + srnd(i * 9) * 10;
        x += widths[i] * unit * 0.74;
        const rc = remapProfile(cps, v.w, v.h, adapt);
        const Hpx = unit * v.h;
        drawPot(ctx, rc, cx, base - Hpx, Hpx, { w: 2.3, tex: this.tex, seed: 23 + i * 19, alpha: 0.5 + 0.5 * (i / Math.max(1, ord.length - 1)), rim: true });
        this.labelIfSel(ctx, i, v, cx, base, cm, mR, h);
        this.hits.push({ x: cx - mR * v.w * unit, y: base - Hpx, w: mR * 2 * v.w * unit, h: Hpx });
      });
      drawInk(ctx, [{ x: 24, y: base + 8 }, { x: w / 2, y: base + 6.5 }, { x: w - 24, y: base + 8.5 }], { w: 1.6, tex: this.tex, seed: 3, alpha: 0.45 });
    }
    labelIfSel(ctx, i, v, cx, base, cm, mR, h) {
      if (this.sel !== i) return;
      ctx.save();
      ctx.fillStyle = '#b4432e'; ctx.beginPath(); ctx.arc(cx, base + 16, 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(60,50,35,.72)'; ctx.font = '10px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText((v.label ? v.label + ' · ' : '') + this.dims(cm, mR, v), cx, Math.min(h - 4, base + 30));
      ctx.restore();
    }
    placeRows(vs) {
      const ord = vs.slice().sort((a, b) => b.h - a.h);
      const back = [], front = [];
      ord.forEach((v, i) => (i % 2 ? front : back).push(v));
      front.reverse();
      return { back: back, front: front };
    }
    renderOrganic(ctx, w, h, cps, adapt, cm, mR, vs) {
      const rows = this.placeRows(vs);
      const maxH = Math.max.apply(null, vs.map(v => v.h));
      const unit = Math.min(h * 0.5 / maxH, w / Math.max(3, mR * 2 * 6.2));
      const defs = [{ items: rows.back, base: h * 0.52, alpha: 0.42, s: 0.82 }, { items: rows.front, base: h * 0.94, alpha: 1, s: 1 }];
      let gi = 0;
      defs.forEach((row, ri) => {
        const n = row.items.length; if (!n) return;
        drawInk(ctx, [{ x: w * 0.08, y: row.base + 7 }, { x: w * 0.5, y: row.base + 5.5 }, { x: w * 0.92, y: row.base + 7.5 }], { w: 1.5, tex: this.tex, seed: 3 + ri, alpha: 0.3 + 0.2 * ri });
        row.items.forEach((v, i) => {
          const cx = w * 0.5 + (i - (n - 1) / 2) * (w / (n + 0.8)) + srnd(ri * 7 + i * 3) * 16;
          const rc = remapProfile(cps, v.w, v.h, adapt);
          const Hpx = unit * v.h * row.s;
          drawPot(ctx, rc, cx, row.base - Hpx, Hpx, { w: 2.2, tex: this.tex, seed: 31 + ri * 47 + i * 19, alpha: row.alpha, rim: true });
          this.labelIfSel(ctx, gi, v, cx, row.base, cm, mR, h);
          this.hits.push({ x: cx - mR * v.w * unit * row.s, y: row.base - Hpx, w: mR * 2 * v.w * unit * row.s, h: Hpx });
          gi++;
        });
      });
    }
    renderScene(ctx, w, h, cps, adapt, cm, mR, vs) {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#ece4d2'); sky.addColorStop(0.56, '#f3ecdd');
      sky.addColorStop(0.6, '#d6cbb4'); sky.addColorStop(1, '#c3b69c');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const rows = this.placeRows(vs);
      const maxH = Math.max.apply(null, vs.map(v => v.h));
      const unit = Math.min(h * 0.42 / maxH, w / Math.max(3, mR * 2 * 6.4));
      const defs = [{ items: rows.back, base: h * 0.7, s: 0.78, fog: true }, { items: rows.front, base: h * 0.9, s: 1, fog: false }];
      let gi = 0;
      defs.forEach((row, ri) => {
        const n = row.items.length; if (!n) return;
        row.items.forEach((v, i) => {
          const cx = w * 0.5 + (i - (n - 1) / 2) * (w / (n + 0.9)) + srnd(ri * 11 + i * 5) * 14;
          const rc = remapProfile(cps, v.w, v.h, adapt);
          const Hpx = unit * v.h * row.s;
          fillPot(ctx, rc, cx, row.base - Hpx, Hpx, TONES[(gi * 3 + ri) % TONES.length], { blur: row.fog ? 1.6 : 0, alpha: row.fog ? 0.8 : 1, shadow: row.fog ? 0.07 : 0.15 });
          this.labelIfSel(ctx, gi, v, cx, row.base, cm, mR, h);
          this.hits.push({ x: cx - mR * v.w * unit * row.s, y: row.base - Hpx, w: mR * 2 * v.w * unit * row.s, h: Hpx });
          gi++;
        });
        if (row.fog) {
          const fog = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.78);
          fog.addColorStop(0, 'rgba(238,231,216,0)'); fog.addColorStop(0.55, 'rgba(238,231,216,.55)'); fog.addColorStop(1, 'rgba(238,231,216,0)');
          ctx.fillStyle = fog; ctx.fillRect(0, h * 0.4, w, h * 0.38);
        }
      });
      ctx.fillStyle = 'rgba(60,50,35,.45)'; ctx.font = '10.5px "Zen Kaku Gothic New", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('still life — tap a vessel to read its size', w / 2, h - 12);
    }
  }
  customElements.define('family-board', FamilyBoard);

  // ================= <revolve-preview> =================
  class RevolvePreview extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      this.style.display = 'block'; this.style.width = '100%'; this.style.height = '100%';
      this.style.touchAction = 'none';
      this.oid = this.dataset.optionId || this.getAttribute('option-id') || 'a';
      this.cv = setupCanvas(this);
      this.profile = null; this.rot = 0.6; this.auto = true; this.visible = true;
      this._render = this.render.bind(this);
      LineApp.on(this.oid, p => { this.profile = p; });
      new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }).observe(this);
      this.addEventListener('pointerdown', e => { this.dragX = e.clientX; this.auto = false; this.setPointerCapture(e.pointerId); });
      this.addEventListener('pointermove', e => { if (this.dragX !== undefined && this.dragX !== null) { this.rot += (e.clientX - this.dragX) * 0.01; this.dragX = e.clientX; } });
      this.addEventListener('pointerup', () => { this.dragX = null; });
      const tick = () => { if (this.visible) { if (this.auto) this.rot += 0.004; this.render(); } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    render() {
      const ctx = this.cv.ctx, w = this.cv.w, h = this.cv.h;
      if (!w || !this.profile) { if (ctx && w) { ctx.clearRect(0, 0, w, h); } return; }
      ctx.clearRect(0, 0, w, h);
      const cps = this.profile.cps;
      const dense = catmull(cps, 10);
      const mR = Math.max(0.2, maxR(cps));
      const Hpx = Math.min(h * 0.7, (w * 0.42) / mR);
      const cx = w / 2, topY = (h - Hpx * 0.94) / 2;
      const tilt = 0.30;
      ctx.save();
      ctx.strokeStyle = INK; ctx.lineCap = 'round';
      // rings
      const nR = 8;
      for (let k = 0; k <= nR; k++) {
        const t = k / nR;
        // interp profile at y=t
        let r = dense[dense.length - 1].r;
        for (let i = 0; i < dense.length - 1; i++) if (t >= dense[i].y && t <= dense[i + 1].y) { const f = (t - dense[i].y) / Math.max(1e-6, dense[i + 1].y - dense[i].y); r = dense[i].r + f * (dense[i + 1].r - dense[i].r); break; }
        const rp = r * Hpx, yy = topY + t * Hpx * 0.94;
        ctx.globalAlpha = 0.4; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, yy, rp, rp * tilt, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // meridians
      for (let m = 0; m < 10; m++) {
        const phi = this.rot + m * Math.PI / 5;
        const s = Math.sin(phi), co = Math.cos(phi);
        ctx.globalAlpha = s > 0 ? 0.55 : 0.18; ctx.lineWidth = s > 0 ? 1.3 : 1;
        ctx.beginPath();
        dense.forEach((p, i) => {
          const x = cx + p.r * Hpx * co;
          const y = topY + p.y * Hpx * 0.94 + p.r * Hpx * s * tilt * 0; // ortho: rings carry depth
          const yv = topY + p.y * Hpx * 0.94 - p.r * Hpx * s * -tilt;
          if (i) ctx.lineTo(x, topY + p.y * Hpx * 0.94 + p.r * Hpx * s * tilt); else ctx.moveTo(x, topY + p.y * Hpx * 0.94 + p.r * Hpx * s * tilt);
        });
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  customElements.define('revolve-preview', RevolvePreview);

  // ---------- SVG export (real) ----------
  LineApp.exportSVG = function (id) {
    const p = this.profiles[id];
    if (!p) return false;
    const cm = this.getMeta(id, 'height', 18);
    const mm = cm * 10;
    const dense = catmull(p.cps, 24);
    const mR = maxR(p.cps);
    const W = mR * 2 * mm + 20, H = mm + 20, cx = W / 2, top = 10;
    let d = '';
    dense.forEach((pt, i) => { d += (i ? 'L' : 'M') + (cx + pt.r * mm).toFixed(2) + ' ' + (top + pt.y * mm).toFixed(2) + ' '; });
    for (let i = dense.length - 1; i >= 0; i--) d += 'L' + (cx - dense[i].r * mm).toFixed(2) + ' ' + (top + dense[i].y * mm).toFixed(2) + ' ';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W.toFixed(1) + 'mm" height="' + H.toFixed(1) + 'mm" viewBox="0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1) + '">' +
      '<title>Line — profile, height ' + cm + ' cm (units: mm)</title>' +
      '<path d="' + d + '" fill="none" stroke="#000" stroke-width="0.5"/>' +
      '<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + H + '" stroke="#999" stroke-width="0.2" stroke-dasharray="2 3"/></svg>';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = 'line-profile-' + cm + 'cm.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  };
})();
