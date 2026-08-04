// Tiny DOM helpers + reusable Garmin-style components. Browser-only.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---- components ----
export function card(children, cls = '') {
  return el('div', { class: `card ${cls}`.trim() }, ...(Array.isArray(children) ? children : [children]));
}

export function statTile(label, value, unit = '', color = 'accent') {
  return card([
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, el('span', { class: color }, String(value)), unit ? el('span', { class: 'stat-unit' }, unit) : null),
  ]);
}

// SVG donut ring. pct 0..100.
export function ring(pct, { size = 96, stroke = 8, color = '#00a9e0', value = '', label = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct == null ? 0 : pct));
  const off = c * (1 - p / 100);
  return fromHTML(`
    <div class="ring-center">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#2c2c2e" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
          transform="rotate(-90 ${size / 2} ${size / 2})"/>
        ${value ? `<text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="#fff" font-size="${Math.round(size * 0.24)}" font-weight="800">${value}</text>` : ''}
      </svg>
      ${label ? `<div class="stat-label" style="margin-top:6px">${label}</div>` : ''}
    </div>`);
}

// Simple bar chart from a numeric series.
export function bars(series, { max } = {}) {
  const top = max || Math.max(1, ...series.map((s) => s.value ?? s));
  const wrap = el('div', { class: 'bars' });
  for (const s of series) {
    const v = s.value ?? s;
    const h = Math.round((v / top) * 100);
    wrap.appendChild(el('div', { class: `bar ${v === 0 ? 'zero' : ''}`.trim(), style: { height: `${Math.max(2, h)}%` }, title: String(v) }));
  }
  return wrap;
}

// Sparkline path from points [{x,y}] normalised; here we pass raw values.
export function sparkline(values, { color = '#00d4aa', height = 56 } = {}) {
  if (!values.length) return el('div', { class: 'empty' }, 'No data');
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = height - ((v - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return fromHTML(`<svg class="spark" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`);
}

// ---- formatting ----
export function fmtMins(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
}

// Compact hours for big-number stat tiles (avoids "26h 46m" wrapping).
export function fmtHours(min) {
  if (!min) return '0h';
  return (min / 60).toFixed(1).replace(/\.0$/, '') + 'h';
}

export function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

// ---- icons (24x24 line icons) ----
export const ICONS = {
  today: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
  training: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 100-2 1 1 0 000 2zM12 17.5l-3-5 4-3 3 3h3"/></svg>',
  school: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 015.5 4H19v16H5.5A1.5 1.5 0 014 18.5z"/><path d="M8 4v16M4 12h4"/></svg>',
  chat: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 01-11.5 7.2L4 20l0.9-5.3A8 8 0 1121 12z"/></svg>',
  me: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0116 0"/></svg>',
  camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  settings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.4 14H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010 4.6V4a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0020.6 10H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>',
  food: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v7a3 3 0 003 3v6M4 8h6M7 4v10M13 4c-1 2-1 4 0 6 .8 1.6 3 1.6 3 0V4"/><path d="M16 12v8"/></svg>',
  chevron: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
};
