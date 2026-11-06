/* 8 位元像素勇者產生器：依種子隨機組合髮型、職業帽、服裝、武器與配色 */
window.WQPixel = (function () {
  'use strict';
  var W = 16, H = 16;
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function put(g, x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; }
  function row(g, y, x1, x2, c) { for (var x = x1; x <= x2; x++) put(g, x, y, c); }
  function col(g, x, y1, y2, c) { for (var y = y1; y <= y2; y++) put(g, x, y, c); }

  var SKIN = ['#f9d7b5', '#f1c08f', '#d99a6c', '#a86b45'];
  var HAIR = ['#2b1d16', '#5a3420', '#8b5a2b', '#e0b04a', '#c0452f', '#f2f0ff', '#6b4bb8', '#3c6fd1', '#d45aa0', '#3aa36b'];
  var CLOTH = ['#d9534f', '#4a7bd4', '#3aa36b', '#8f6fe0', '#f28c28', '#e8c15a', '#2aa7a0', '#c2417b', '#5c6b7a', '#7a4b2a'];
  var CLASSES = ['騎士', '魔法師', '弓箭手', '盜賊', '王子公主', '冒險家'];

  function make(seed, gender) {
    var r = rng(seed || 1), g = [], y;
    for (y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(null); }
    var girl = gender === 'f';
    var P = { s: pick(r, SKIN), h: pick(r, HAIR), o: pick(r, CLOTH), p: pick(r, CLOTH), b: '#3a2a4a', e: '#1b1433', m: '#c0452f',
      c: pick(r, CLOTH), g: '#b9bfd0', y: '#ffd34d', w: '#e8ecf5', n: '#8b5a2b', j: pick(r, ['#7ee2ff', '#ff6bd5', '#7ee2a8', '#ffe066']), x: '#ffffff' };
    if (P.p === P.o) P.p = '#e8c15a';
    var cls = Math.floor(r() * CLASSES.length);
    // 頭
    row(g, 3, 5, 10, 's'); for (y = 4; y <= 7; y++) row(g, y, 4, 11, 's'); row(g, 8, 5, 10, 's');
    put(g, 6, 6, 'e'); put(g, 9, 6, 'e'); put(g, 6, 5, 'x'); put(g, 9, 5, 'x');
    put(g, 7, 8, 'm'); put(g, 8, 8, 'm');
    if (girl) { put(g, 5, 7, 'm'); put(g, 10, 7, 'm'); }
    // 身體
    row(g, 9, 4, 11, 'o'); row(g, 10, 4, 11, 'o'); row(g, 11, 4, 11, 'o');
    put(g, 3, 10, 's'); put(g, 12, 10, 's'); put(g, 3, 9, 'o'); put(g, 12, 9, 'o');
    row(g, 9, 7, 8, 'p'); row(g, 10, 7, 8, 'p'); row(g, 12, 4, 11, 'p');
    if (girl) { row(g, 12, 3, 12, 'o'); row(g, 13, 3, 12, 'o'); row(g, 12, 7, 8, 'p'); row(g, 14, 5, 6, 'b'); row(g, 14, 9, 10, 'b'); }
    else { row(g, 13, 4, 6, 'b'); row(g, 13, 9, 11, 'b'); row(g, 14, 4, 6, 'b'); row(g, 14, 9, 11, 'b'); }
    // 頭髮
    var hs = Math.floor(r() * 3);
    if (!girl) {
      row(g, 3, 4, 11, 'h'); row(g, 4, 4, 11, 'h'); put(g, 4, 5, 'h'); put(g, 11, 5, 'h');
      if (hs === 1) { put(g, 5, 2, 'h'); put(g, 7, 2, 'h'); put(g, 9, 2, 'h'); put(g, 10, 2, 'h'); }
      if (hs === 2) { row(g, 5, 4, 6, 'h'); row(g, 2, 6, 10, 'h'); }
      if (hs === 0) row(g, 2, 5, 10, 'h');
    } else {
      row(g, 2, 5, 10, 'h'); row(g, 3, 4, 11, 'h'); row(g, 4, 4, 11, 'h'); put(g, 4, 5, 'h'); put(g, 11, 5, 'h');
      if (hs === 0) { for (y = 5; y <= 10; y++) { put(g, 3, y, 'h'); put(g, 12, y, 'h'); } col(g, 4, 6, 8, 'h'); col(g, 11, 6, 8, 'h'); put(g, 3, 10, 's'); put(g, 12, 10, 's'); }
      if (hs === 1) { for (y = 4; y <= 8; y++) { put(g, 2, y, 'h'); put(g, 13, y, 'h'); } put(g, 3, 4, 'h'); put(g, 12, 4, 'h'); put(g, 3, 5, 'c'); put(g, 12, 5, 'c'); }
      if (hs === 2) { row(g, 0, 6, 9, 'h'); row(g, 1, 5, 10, 'h'); put(g, 7, 1, 'c'); put(g, 8, 1, 'c'); col(g, 4, 6, 8, 'h'); col(g, 11, 6, 8, 'h'); }
    }
    // 職業造型
    if (cls === 0) { // 騎士：頭盔 + 劍 + 盾
      row(g, 2, 5, 10, 'g'); row(g, 3, 4, 11, 'g'); put(g, 4, 4, 'g'); put(g, 11, 4, 'g'); put(g, 4, 5, 'g'); put(g, 11, 5, 'g'); put(g, 7, 1, 'c'); put(g, 8, 1, 'c'); put(g, 8, 0, 'c');
      col(g, 13, 4, 9, 'w'); row(g, 10, 12, 14, 'y'); put(g, 13, 11, 'n');
      col(g, 1, 9, 12, 'g'); col(g, 2, 9, 12, 'g'); put(g, 1, 10, 'y'); put(g, 2, 10, 'y'); put(g, 1, 11, 'c'); put(g, 2, 11, 'c');
    } else if (cls === 1) { // 魔法師：尖帽 + 法杖
      put(g, 8, 0, 'c'); row(g, 1, 7, 8, 'c'); row(g, 2, 6, 9, 'c'); row(g, 3, 3, 12, 'c'); put(g, 7, 2, 'y');
      col(g, 13, 5, 14, 'n'); row(g, 3, 12, 14, 'j'); row(g, 4, 12, 14, 'j');
    } else if (cls === 2) { // 弓箭手：頭巾 + 弓
      row(g, 3, 4, 11, 'c'); put(g, 12, 3, 'c'); put(g, 13, 4, 'c');
      col(g, 14, 6, 12, 'n'); put(g, 13, 5, 'n'); put(g, 13, 13, 'n'); col(g, 13, 6, 12, 'w');
    } else if (cls === 3) { // 盜賊：兜帽 + 匕首
      row(g, 2, 5, 10, 'c'); row(g, 3, 4, 11, 'c'); for (y = 4; y <= 8; y++) { put(g, 3, y, 'c'); put(g, 12, y, 'c'); } put(g, 4, 4, 'c'); put(g, 11, 4, 'c');
      col(g, 13, 8, 10, 'w'); put(g, 13, 11, 'n'); row(g, 12, 4, 11, 'n');
    } else if (cls === 4) { // 王子公主：皇冠 + 權杖
      put(g, 5, 1, 'y'); put(g, 7, 1, 'y'); put(g, 8, 1, 'y'); put(g, 10, 1, 'y'); row(g, 2, 5, 10, 'y'); put(g, 7, 2, 'j');
      col(g, 13, 6, 13, 'y'); row(g, 5, 12, 14, 'j'); put(g, 13, 4, 'j');
    } else { // 冒險家：頭帶 + 背包
      row(g, 4, 4, 11, 'c'); put(g, 3, 5, 'c'); put(g, 2, 6, 'c');
      col(g, 13, 9, 11, 'n'); col(g, 14, 9, 11, 'n'); put(g, 13, 8, 'y');
    }
    // 描邊
    var out = g.map(function (rw) { return rw.slice(); });
    for (y = 0; y < H; y++) for (var x2 = 0; x2 < W; x2++) {
      if (g[y][x2]) continue;
      var nb = (y > 0 && g[y - 1][x2]) || (y < H - 1 && g[y + 1][x2]) || (x2 > 0 && g[y][x2 - 1]) || (x2 < W - 1 && g[y][x2 + 1]);
      if (nb) out[y][x2] = 'k';
    }
    P.k = '#1b1433';
    return { grid: out, pal: P, cls: CLASSES[cls] };
  }
  var cache = {};
  function url(seed, gender) {
    var key = seed + gender; if (cache[key]) return cache[key];
    var m = make(seed, gender), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var cx = cv.getContext('2d');
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var c = m.grid[y][x]; if (c) { cx.fillStyle = m.pal[c]; cx.fillRect(x, y, 1, 1); } }
    return (cache[key] = cv.toDataURL());
  }
  function img(seed, gender, cls) { var i = document.createElement('img'); i.src = url(seed, gender); i.className = 'px' + (cls ? ' ' + cls : ''); i.alt = ''; i.draggable = false; return i; }
  function className(seed, gender) { return make(seed, gender).cls; }
  return { url: url, img: img, className: className };
})();
