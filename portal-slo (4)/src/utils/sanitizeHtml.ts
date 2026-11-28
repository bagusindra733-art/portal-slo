/**
 * Pembersih HTML sederhana untuk isi editor teks (Dengan Hormat, Catatan, Cara Pembayaran).
 * Hanya tag pemformatan umum yang dipertahankan; script, atribut event, gambar, dan tautan dibuang.
 */
const ALLOWED = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'DIV', 'SPAN',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
  'BLOCKQUOTE', 'SUB', 'SUP', 'FONT',
]);
const DROP = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE',
  'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'IMG', 'VIDEO', 'AUDIO',
]);
const STYLE_OK = new Set([
  'text-align', 'margin-left', 'padding-left', 'text-indent', 'font-size', 'font-weight',
  'font-style', 'text-decoration', 'list-style-type',
]);

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      if (i < 0) return '';
      const prop = d.slice(0, i).trim().toLowerCase();
      const val = d.slice(i + 1).trim();
      if (!STYLE_OK.has(prop) || !/^[\w\s.,%#-]*$/.test(val)) return '';
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join('; ');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return escapeText(html);
  const src = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const out = document.implementation.createHTMLDocument('').body;

  const walk = (from: Node, to: Node) => {
    from.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        to.appendChild(out.ownerDocument.createTextNode(n.textContent ?? ''));
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as Element;
      const tag = el.tagName.toUpperCase();
      if (DROP.has(tag)) return;
      if (!ALLOWED.has(tag)) {
        walk(el, to); // buang tag-nya, pertahankan isinya
        return;
      }
      const copy = out.ownerDocument.createElement(tag.toLowerCase());
      const style = cleanStyle(el.getAttribute('style') ?? '');
      if (style) copy.setAttribute('style', style);
      if (tag === 'FONT') {
        const size = el.getAttribute('size');
        if (size && /^[1-7]$/.test(size)) copy.setAttribute('size', size);
      }
      if (tag === 'OL') {
        const type = el.getAttribute('type');
        if (type && /^[1aAiI]$/.test(type)) copy.setAttribute('type', type);
      }
      if (tag === 'TD' || tag === 'TH') {
        for (const a of ['colspan', 'rowspan']) {
          const v = el.getAttribute(a);
          if (v && /^\d{1,2}$/.test(v)) copy.setAttribute(a, v);
        }
      }
      walk(el, copy);
      to.appendChild(copy);
    });
  };
  walk(src, out);
  return out.innerHTML;
}

/** Teks polos dari HTML (untuk hitung kata / cek kosong). */
export function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
}
