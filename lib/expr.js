/* Auto-Move expression engine.
   A small JavaScript-subset interpreter for {{ … }} templates, shared by the server and the editor.
   No eval: literals, $json paths, operators, ternaries, array/object literals, arrow functions (x => x.a) and method calls on values. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Expr = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BLOCK = new Set(['constructor', '__proto__', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
  const OPS = ['...', '===', '!==', '**', '==', '!=', '<=', '>=', '=>', '&&', '||', '??', '?.'];
  // a "/" starts a regular expression unless it follows something that has a value
  const valueEnd = tok => tok && (tok.t === 'num' || tok.t === 'str' || tok.t === 'tpl' || tok.t === 're' || (tok.t === 'id' && !['typeof', 'void', 'return', 'new'].includes(tok.v)) || (tok.t === 'op' && (tok.v === ')' || tok.v === ']' || tok.v === '}')));
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  function tokenize(src) {
    const t = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i; while (j < src.length && (/[0-9.eE_]/.test(src[j]) || (/[+-]/.test(src[j]) && /[eE]/.test(src[j - 1]) && /[0-9]/.test(src[j + 1] || '')))) j++;
        t.push({ t: 'num', v: parseFloat(src.slice(i, j).replace(/_/g, '')) }); i = j; continue;
      }
      if (c === '`') { // template literal: `metin ${ifade} metin`
        const parts = []; let j = i + 1, s = '';
        while (j < src.length && src[j] !== '`') {
          if (src[j] === '\\') { j++; const e = src[j]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; j++; continue; }
          if (src[j] === '$' && src[j + 1] === '{') {
            let depth = 1, k = j + 2, q = null;
            while (k < src.length && depth) {
              const ch = src[k];
              if (q) { if (ch === '\\') k++; else if (ch === q) q = null; }
              else if (ch === '"' || ch === "'" || ch === '`') q = ch;
              else if (ch === '{') depth++;
              else if (ch === '}') depth--;
              k++;
            }
            if (depth) throw new Error('Kapanmamış ${');
            parts.push(s, src.slice(j + 2, k - 1)); s = ''; j = k; continue;
          }
          s += src[j]; j++;
        }
        if (j >= src.length) throw new Error('Kapanmamış metin');
        parts.push(s); t.push({ t: 'tpl', parts }); i = j + 1; continue;
      }
      if (c === '/' && !valueEnd(t[t.length - 1])) { // regular expression literal
        let j = i + 1, cls = false;
        while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; if (src[j] === '\n') break; j++; }
        if (j >= src.length || src[j] !== '/') throw new Error('Kapanmamış düzenli ifade');
        let f = j + 1; while (f < src.length && /[dgimsuy]/.test(src[f])) f++;
        t.push({ t: 're', src: src.slice(i + 1, j), flags: src.slice(j + 1, f) }); i = f; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, s = '';
        while (j < src.length && src[j] !== c) {
          if (src[j] === '\\') { j++; const e = src[j]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; } else s += src[j];
          j++;
        }
        if (j >= src.length) throw new Error('Kapanmamış metin');
        t.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      if (/[A-Za-z_$À-ɏ]/.test(c)) {
        let j = i; while (j < src.length && /[A-Za-z0-9_$À-ɏ]/.test(src[j])) j++;
        t.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
      }
      let m = OPS.find(o => src.startsWith(o, i));
      if (m === '?.' && /[0-9]/.test(src[i + 2] || '')) m = null;
      if (m) { t.push({ t: 'op', v: m }); i += m.length; continue; }
      if ('()[]{}.,?:!+-*/%<>'.includes(c)) { t.push({ t: 'op', v: c }); i++; continue; }
      throw new Error(`Beklenmeyen karakter: ${c}`);
    }
    t.push({ t: 'eof' });
    return t;
  }

  const LEVELS = [['??', '||'], ['&&'], ['==', '!=', '===', '!=='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
  const SPREAD = Symbol('spread');
  function parse(src) {
    const tk = tokenize(src); let p = 0;
    const is = v => tk[p].t === 'op' && tk[p].v === v;
    const expect = v => { if (!is(v)) throw new Error(`"${v}" bekleniyordu`); p++; };
    const list = end => { const out = []; if (!is(end)) { do { if (is(end)) break; if (is('...')) { p++; out.push({ k: 'spread', a: expr() }); } else out.push(expr()); } while (is(',') && ++p); } expect(end); return out; };
    // arrow functions with an expression body: x => …, (a, b) => …, () => …
    function expr() {
      if (tk[p].t === 'id' && tk[p + 1].t === 'op' && tk[p + 1].v === '=>') { const params = [tk[p].v]; p += 2; return { k: 'fn', params, body: expr() }; }
      if (is('(')) {
        let q = p + 1; const params = [];
        while (tk[q].t === 'id' && (tk[q + 1].v === ',' || tk[q + 1].v === ')')) { params.push(tk[q].v); q += tk[q + 1].v === ',' ? 2 : 1; if (tk[q].v === ')') break; }
        if (tk[q].t === 'op' && tk[q].v === ')' && tk[q + 1].t === 'op' && tk[q + 1].v === '=>') { p = q + 2; return { k: 'fn', params, body: expr() }; }
      }
      return ternary();
    }
    function ternary() {
      const c = bin(0);
      if (is('?')) { p++; const a = expr(); expect(':'); const b = expr(); return { k: 'cond', c, a, b }; }
      return c;
    }
    function bin(l) {
      if (l >= LEVELS.length) return power();
      let left = bin(l + 1);
      while (tk[p].t === 'op' && LEVELS[l].includes(tk[p].v)) { const op = tk[p++].v; left = { k: 'bin', op, left, right: bin(l + 1) }; }
      return left;
    }
    function power() { // right-associative: 2 ** 3 ** 2
      const base = unary();
      if (is('**')) { p++; return { k: 'bin', op: '**', left: base, right: power() }; }
      return base;
    }
    function unary() {
      if (is('!') || is('-') || is('+')) { const op = tk[p++].v; return { k: 'un', op, a: unary() }; }
      if (tk[p].t === 'id' && (tk[p].v === 'typeof' || tk[p].v === 'void') && tk[p + 1].t !== 'eof' && !(tk[p + 1].t === 'op' && /^[).,\]}:?]$/.test(tk[p + 1].v))) { const op = tk[p++].v; return { k: 'un', op, a: unary() }; }
      if (tk[p].t === 'id' && tk[p].v === 'new') {
        p++; let f = primary();
        while (is('.')) { p++; const id = tk[p++]; if (id.t !== 'id') throw new Error('Alan adı bekleniyordu'); f = { k: 'mem', o: f, p: { k: 'lit', v: id.v } }; }
        const args = is('(') ? (p++, list(')')) : [];
        return postfixFrom({ k: 'new', f, args });
      }
      return postfix();
    }
    function postfix() { return postfixFrom(primary()); }
    function postfixFrom(e) {
      for (;;) {
        if (is('?.') && tk[p + 1].t === 'op' && (tk[p + 1].v === '[' || tk[p + 1].v === '(')) {
          p += 2;
          if (tk[p - 1].v === '[') { const pr = ternary(); expect(']'); e = { k: 'mem', o: e, p: pr, opt: true }; }
          else e = { k: 'call', f: e, args: list(')'), opt: true };
        } else if (is('.') || is('?.')) {
          const opt = tk[p++].v === '?.'; const id = tk[p++];
          if (id.t !== 'id') throw new Error('Alan adı bekleniyordu');
          e = { k: 'mem', o: e, p: { k: 'lit', v: id.v }, opt };
        } else if (is('[')) { p++; const pr = ternary(); expect(']'); e = { k: 'mem', o: e, p: pr }; }
        else if (is('(')) { p++; e = { k: 'call', f: e, args: list(')') }; }
        else return e;
      }
    }
    function primary() {
      const t = tk[p++];
      if (t.t === 'num' || t.t === 'str') return { k: 'lit', v: t.v };
      if (t.t === 'tpl') return { k: 'tpl', parts: t.parts.map((x, i) => i % 2 ? parse(x) : x) };
      if (t.t === 're') { new RegExp(t.src, t.flags); return { k: 're', src: t.src, flags: t.flags }; }
      if (t.t === 'id') {
        const lits = { true: true, false: false, null: null, undefined: undefined };
        return t.v in lits ? { k: 'lit', v: lits[t.v] } : { k: 'id', v: t.v };
      }
      if (t.t === 'op' && t.v === '(') { const e = expr(); expect(')'); return e; }
      if (t.t === 'op' && t.v === '[') return { k: 'arr', items: list(']') };
      if (t.t === 'op' && t.v === '{') {
        const props = [];
        if (!is('}')) do {
          if (is('}')) break;
          if (is('...')) { p++; props.push([SPREAD, expr()]); continue; }
          const key = tk[p++]; if (key.t !== 'id' && key.t !== 'str' && key.t !== 'num') throw new Error('Nesne anahtarı bekleniyordu');
          if (key.t === 'id' && (is(',') || is('}'))) { props.push([key.v, { k: 'id', v: key.v }]); continue; } // { ad } kısaltması
          expect(':'); props.push([String(key.v), expr()]);
        } while (is(',') && ++p);
        expect('}'); return { k: 'obj', props };
      }
      throw new Error(t.t === 'eof' ? 'İfade eksik' : `Beklenmeyen: ${t.v}`);
    }
    const ast = expr();
    if (tk[p].t !== 'eof') throw new Error(`Fazla ifade: ${tk[p].v ?? ''}`);
    return ast;
  }

  // Values an expression must never get hold of: anything that turns a string into code.
  const FORBIDDEN = new Set([Function, Object.getPrototypeOf(async () => {}).constructor, Object.getPrototypeOf(function* () {}).constructor, Object.getPrototypeOf(async function* () {}).constructor]);
  const FN_PROTO = [Function.prototype.call, Function.prototype.apply, Function.prototype.bind];
  const guard = v => { if (typeof v === 'function' && FORBIDDEN.has(v)) throw new Error('İzin verilmiyor'); return v; };
  const SHORT = Symbol('short'); // a ?. met null/undefined: the rest of the chain is skipped
  const sub = (n, s) => n.k === 'mem' || n.k === 'call' ? chain(n, s) : ev(n, s);
  function chain(n, s) {
    if (n.k === 'mem') {
      const o = sub(n.o, s); if (o === SHORT) return SHORT;
      const k = ev(n.p, s);
      if (o == null) { if (n.opt) return SHORT; throw new Error(`"${k}" okunamıyor: değer boş`); }
      if (BLOCK.has(String(k))) throw new Error('İzin verilmeyen alan');
      return guard(o[k]);
    }
    let fn, self;
    if (n.f.k === 'mem') {
      self = sub(n.f.o, s); if (self === SHORT) return SHORT;
      const k = ev(n.f.p, s);
      if (self == null) { if (n.f.opt) return SHORT; throw new Error(`"${k}" çağrılamıyor: değer boş`); }
      if (BLOCK.has(String(k))) throw new Error('İzin verilmeyen alan');
      fn = self[k];
      if (fn == null && n.opt) return SHORT;
      if (typeof fn !== 'function') throw new Error(`${k} bir fonksiyon değil`);
    } else {
      fn = sub(n.f, s); if (fn === SHORT) return SHORT;
      if (fn == null && n.opt) return SHORT;
      if (typeof fn !== 'function') throw new Error('Fonksiyon değil');
    }
    guard(fn);
    if (FN_PROTO.includes(fn)) guard(self);
    return guard(fn.apply(self, args(n.args, s)));
  }
  const args = (list, s) => { const out = []; for (const a of list) { if (a.k === 'spread') { const v = ev(a.a, s); if (v == null || typeof v[Symbol.iterator] !== 'function') throw new Error('Yayılan değer bir liste değil'); out.push(...v); } else out.push(ev(a, s)); } return out; };
  function ev(n, s) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'fn': return (...args) => { const inner = Object.create(s); n.params.forEach((k, i) => { inner[k] = args[i]; }); return ev(n.body, inner); };
      case 'id': if (!(n.v in s)) throw new Error(`Tanımsız: ${n.v}`); return guard(s[n.v]);
      case 'arr': return args(n.items, s);
      case 'obj': {
        const o = {};
        for (const [k, v] of n.props) {
          if (k === SPREAD) { const x = ev(v, s); if (x != null && typeof x === 'object') for (const [a, b] of Object.entries(x)) if (!BLOCK.has(a)) o[a] = b; continue; }
          if (BLOCK.has(k)) throw new Error('İzin verilmeyen anahtar'); o[k] = ev(v, s);
        }
        return o;
      }
      case 'tpl': return n.parts.map((x, i) => { if (!(i % 2)) return x; const v = ev(x, s); return v == null ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v); }).join('');
      case 're': return new RegExp(n.src, n.flags);
      case 'new': {
        const f = ev(n.f, s);
        if (f !== SafeDate) throw new Error('"new" yalnızca Date ile kullanılabilir');
        const d = new Date(...args(n.args, s)); return d;
      }
      case 'cond': return ev(n.c, s) ? ev(n.a, s) : ev(n.b, s);
      case 'un': {
        if (n.op === 'typeof') { if (n.a.k === 'id' && !(n.a.v in s)) return 'undefined'; const a = ev(n.a, s); return a instanceof RegExp ? 'object' : typeof a; }
        const a = ev(n.a, s); return n.op === '!' ? !a : n.op === '-' ? -a : n.op === 'void' ? undefined : +a;
      }
      case 'bin': {
        if (n.op === '&&') { const l = ev(n.left, s); return l ? ev(n.right, s) : l; }
        if (n.op === '||') { const l = ev(n.left, s); return l ? l : ev(n.right, s); }
        if (n.op === '??') { const l = ev(n.left, s); return l ?? ev(n.right, s); }
        const l = ev(n.left, s), r = ev(n.right, s);
        switch (n.op) {
          case '+': return l + r; case '-': return l - r; case '*': return l * r; case '/': return l / r; case '%': return l % r; case '**': return l ** r;
          case '==': return l == r; case '!=': return l != r; case '===': return l === r; case '!==': return l !== r;
          case '<': return l < r; case '>': return l > r; case '<=': return l <= r; case '>=': return l >= r;
        }
        break;
      }
      case 'mem': case 'call': { const v = chain(n, s); return v === SHORT ? undefined : v; }
    }
    throw new Error('Bilinmeyen ifade');
  }

  const cache = new Map();
  const compile = src => { if (!cache.has(src)) { if (cache.size > 1000) cache.clear(); cache.set(src, parse(src)); } return cache.get(src); };
  function render(tpl, scope) {
    if (typeof tpl !== 'string' || !tpl.includes('{{')) return tpl;
    const m = tpl.match(/^\s*\{\{([\s\S]*?)\}\}\s*$/);
    if (m && !m[1].includes('{{')) { const v = ev(compile(m[1]), scope); return v instanceof Date ? (isNaN(v) ? null : v.toISOString()) : v instanceof RegExp ? String(v) : v; }
    return tpl.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
      const v = ev(compile(e), scope);
      return v == null ? '' : v instanceof Date ? (isNaN(v) ? '' : v.toISOString()) : typeof v === 'object' && !(v instanceof RegExp) ? JSON.stringify(v) : String(v);
    });
  }

  /* dates: YYYY MM DD HH mm ss tokens, local time */
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  function toDate(v) {
    if (v instanceof Date) return v;
    if (v == null || v === '') return new Date();
    const d = new Date(typeof v === 'number' ? v : String(v));
    if (isNaN(d)) throw new Error(`Geçersiz tarih: ${v}`);
    return d;
  }
  function formatDate(v, pattern = 'YYYY-MM-DD HH:mm:ss') {
    const d = toDate(v);
    const map = { YYYY: d.getFullYear(), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) };
    return String(pattern).replace(/YYYY|MM|DD|HH|mm|ss/g, t => map[t]);
  }
  const UNITS = { saniye: 1000, dakika: 60000, saat: 3600000, gun: 86400000, hafta: 604800000, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  function addTime(v, amount, unit = 'gun') {
    const d = toDate(v);
    if (unit === 'ay' || unit === 'M') { const r = new Date(d); r.setMonth(r.getMonth() + Number(amount)); return r.toISOString(); }
    if (unit === 'yil' || unit === 'y') { const r = new Date(d); r.setFullYear(r.getFullYear() + Number(amount)); return r.toISOString(); }
    if (!UNITS[unit]) throw new Error(`Bilinmeyen birim: ${unit}`);
    return new Date(d.getTime() + Number(amount) * UNITS[unit]).toISOString();
  }
  const dt = Object.freeze({ format: formatDate, add: addTime, now: () => new Date().toISOString(), parse: v => toDate(v).toISOString(), diff: (a, b, unit = 'gun') => (toDate(b) - toDate(a)) / (UNITS[unit] || 1) });

  // Only data helpers are exposed; no Reflect, no property descriptors, no prototypes.
  const SafeObject = Object.freeze({ keys: o => Object.keys(o), values: o => Object.values(o), entries: o => Object.entries(o), fromEntries: e => Object.fromEntries(e), assign: (t, ...src) => Object.assign(t, ...src.map(x => x == null ? x : Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(x))).filter(([k]) => !BLOCK.has(k))))) });
  const SafeArray = Object.freeze({ isArray: v => Array.isArray(v), from: (v, f) => f ? Array.from(v, f) : Array.from(v), of: (...a) => a });
  const SafeNumber = Object.freeze(Object.assign(v => Number(v), { isInteger: Number.isInteger, isFinite: Number.isFinite, isNaN: Number.isNaN, parseFloat, parseInt, MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER }));
  const SafeString = Object.freeze(Object.assign(v => String(v), { fromCharCode: String.fromCharCode }));
  const SafeJSON = Object.freeze({ parse: t => JSON.parse(t), stringify: (v, r, sp) => JSON.stringify(v, Array.isArray(r) ? r : null, sp) });
  // Date: "new Date(…)", Date.now(), Date.parse(…); Date() without new gives the date too
  const SafeDate = Object.freeze(Object.assign(function Date_(...a) { return new Date(...a); }, { now: () => Date.now(), parse: v => Date.parse(v), UTC: (...a) => Date.UTC(...a) }));
  const GLOBALS = { Date: SafeDate, Math, JSON: SafeJSON, Number: SafeNumber, String: SafeString, Boolean: v => Boolean(v), Array: SafeArray, Object: SafeObject, parseInt, parseFloat, isNaN, encodeURIComponent, decodeURIComponent };
  function makeScope({ item, index, items, nodeMap, vars, execution, workflow } = {}) {
    const s = Object.assign(Object.create(null), GLOBALS);
    s.$json = item?.json ?? {};
    s.$index = index ?? 0;
    s.$items = (items || []).map(i => i.json);
    s.$itemIndex = s.$index; s.$runIndex = 0;
    // n8n style: $input.first().json, $input.all(), $input.item.json
    const wrap = j => ({ json: j ?? {} });
    s.$input = { all: () => s.$items.map(wrap), first: () => wrap(s.$items[0]), last: () => wrap(s.$items[s.$items.length - 1]), item: wrap(s.$json), params: {} };
    s.$node = nodeMap || {};
    // n8n style: $('Node adı').item.json.x, .first(), .last(), .all()
    s.$ = name => {
      const nd = s.$node[name];
      if (!nd) throw new Error(`"${name}" node'unun çıktısı yok (node adı doğru mu, bu node'dan önce çalıştı mı?)`);
      const its = nd.items || [nd.json];
      const pick = its[Math.min(s.$index, its.length - 1)] ?? nd.json;
      return { json: nd.json, item: wrap(pick), first: () => wrap(its[0]), last: () => wrap(its[its.length - 1]), all: () => its.map(wrap), isExecuted: true };
    };
    s.$vars = vars || {};
    s.$execution = execution || { id: 'önizleme', mode: 'manuel' };
    s.$workflow = workflow || {};
    s.$now = new Date().toISOString();
    s.$today = formatDate(new Date(), 'YYYY-MM-DD');
    s.$dt = dt;
    return s;
  }

  return { render, parse, makeScope, formatDate, addTime, isObj };
});
