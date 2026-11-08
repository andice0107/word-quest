/* 冒險篇章：遊戲前參數設定、抽題、題目池（抽過不再抽） */
window.WQSettings = (function () {
  'use strict';
  var KEY = 'wordQuestSettings';
  var DEF = {
    drawCount: 0,          // 0 = 全部題目
    repeat: 'redraw',      // none 不再挑戰 / redraw 從全部題目重抽 / norepeat 抽過不再抽，抽完才是終極破關
    qTimer: false, qSeconds: 30,
    totalTimer: true,
    mode: 'solo',          // solo 單人 / multi 多人
    merchantProb: 30, tradeSeconds: 60,
    fairyProb: 30,
    cardEvery: 5, cardSeconds: 30
  };
  function defaults() { return JSON.parse(JSON.stringify(DEF)); }
  function load() {
    var s = defaults();
    try {
      var t = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (t) {
        Object.keys(DEF).forEach(function (k) { if (t[k] !== undefined) s[k] = t[k]; });
        if (!(t.v >= 2) && t.merchantProb !== undefined) s.merchantProb = Math.round(t.merchantProb / 2); // 2026-11：商人出現機率減半
      }
    } catch (e) {}
    return clean(s);
  }
  function clamp(v, a, b, d) { v = Math.round(+v); if (!isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); }
  function clean(s) {
    s.drawCount = clamp(s.drawCount, 0, 999, 0);
    if (['none', 'redraw', 'norepeat'].indexOf(s.repeat) < 0) s.repeat = 'redraw';
    s.qTimer = !!s.qTimer; s.qSeconds = clamp(s.qSeconds, 5, 600, 30);
    s.totalTimer = !!s.totalTimer; s.mode = s.mode === 'multi' ? 'multi' : 'solo';
    s.merchantProb = clamp(s.merchantProb, 0, 100, 30); s.tradeSeconds = clamp(s.tradeSeconds, 10, 600, 60);
    s.fairyProb = clamp(s.fairyProb, 0, 100, 30);
    s.cardEvery = clamp(s.cardEvery, 1, 99, 5); s.cardSeconds = clamp(s.cardSeconds, 5, 300, 30);
    return s;
  }
  function save(s) { try { var o = clean(s); o.v = 2; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function allKeys(C) { var out = []; C.rooms.forEach(function (r, i) { r.objects.forEach(function (o, j) { out.push(i + '-' + j); }); }); return out; }
  function total(C) { return allKeys(C).length; }
  function sortKeys(a) { return a.slice().sort(function (x, y) { var p = x.split('-'), q = y.split('-'); return (p[0] - q[0]) || (p[1] - q[1]); }); }
  /* 從題本抽題；used = 已抽過的題目（norepeat 模式用） */
  var MIN_DRAW = 18; // 每個房間至少 3 題
  /* 題庫可以很大（例如整份命題光碟）：每個房間畫面上最多 8 個物品，所以一次冒險最多 房間數×8 題；
     沒有指定題數（快速進入）時，預設每個房間 6 題（6 個房間＝36 題），題庫不到 36 題就全部用 */
  var ROOM_MAX = 8, ROOM_DEF = 6;
  function minDraw(C) { return Math.min(MIN_DRAW, total(C)); }
  function maxDraw(C) { return Math.min(total(C), C.rooms.length * ROOM_MAX); }
  function defDraw(C) { return Math.min(total(C), C.rooms.length * ROOM_DEF); }
  function draw(C, n, used) {
    var pool = allKeys(C);
    if (used && used.length) { var u = {}; used.forEach(function (k) { u[k] = 1; }); pool = pool.filter(function (k) { return !u[k]; }); }
    n = n ? Math.min(Math.max(n, minDraw(C)), maxDraw(C)) : defDraw(C);
    /* 每次都從整本題本隨機抽題（題目和房間不綁定，buildRooms 再隨機分到各房間） */
    pool = shuffle(pool);
    return !n || n >= pool.length ? pool : pool.slice(0, n);
  }
  /* 平均分配：每個房間的題數最多只差 1 題，不超過房間的物品數 */
  function spread(caps, n) {
    var q = caps.map(function () { return 0; }), order = shuffle(caps.map(function (_, i) { return i; })), left = n;
    while (left > 0) {
      var open = order.filter(function (i) { return q[i] < caps[i]; }); if (!open.length) break;
      var low = Math.min.apply(null, open.map(function (i) { return q[i]; }));
      open.filter(function (i) { return q[i] === low; }).some(function (i) { q[i]++; left--; return left <= 0; });
    }
    return q;
  }
  var UNLOCK = [0, 0, 0, 2, 2, 4];
  function copyObj(C, k) { var p = k.split('-'), o = JSON.parse(JSON.stringify(C.rooms[+p[0]].objects[+p[1]])); o.key = k; prepQ(o.q); return o; }
  /* 依抽到的題目組成房間。
     單人（預設）：題目隨機分到各房間（平均分配），放進房間裡隨機挑出的物品；物品、線索和機關留在原本的房間，所以機關一定解得開。
     mix（多人）：全部題目完全打亂，再依序分配到房間。 */
  function buildRooms(C, keys, opts) {
    var out = [];
    if (opts && opts.mix) {
      var ks = shuffle(keys), nr = Math.max(1, Math.min(C.rooms.length, Math.ceil(ks.length / ROOM_DEF))), at = 0;
      for (var ri = 0; ri < nr; ri++) {
        var cnt = Math.floor(ks.length / nr) + (ri < ks.length % nr ? 1 : 0);
        var room = JSON.parse(JSON.stringify(C.rooms[ri]));
        room.objects = ks.slice(at, at + cnt).map(function (k, n) { var o = copyObj(C, k); o.unlock = Math.min(UNLOCK[n] != null ? UNLOCK[n] : 4, n); return o; });
        room.origIndex = ri; at += cnt; out.push(room);
      }
      return out;
    }
    var qs = shuffle(keys), at = 0, cnt = spread(C.rooms.map(function (r) { return Math.min(ROOM_MAX, r.objects.length); }), qs.length);
    C.rooms.forEach(function (r, i) {
      if (!cnt[i]) return;
      var objs = shuffle(r.objects.map(function (_, j) { return j; })).slice(0, cnt[i]).map(function (j, n) {
        var src = copyObj(C, qs[at++]), o = JSON.parse(JSON.stringify(r.objects[j]));
        o.word = src.word; o.q = src.q; o.q.speaker = (r.objects[j].q && r.objects[j].q.speaker) || r.objects[j].name; o.key = src.key;
        o.unlock = Math.min(UNLOCK[n] != null ? UNLOCK[n] : 4, n);
        return o;
      });
      var room = JSON.parse(JSON.stringify(r)); room.objects = objs; room.origIndex = i;
      /* 沒抽到的物品的線索變成「古書殘頁」（題庫很大時只留不重複的前 8 條，免得線索本太長） */
      var seenC = {}; room.allClues = r.objects.filter(function (o) { if (!o.clue || seenC[o.clue]) return false; seenC[o.clue] = 1; return true; }).slice(0, ROOM_MAX).map(function (o) { return { from: o.name, text: o.clue }; });
      objs.forEach(function (o) { if (o.clue && !seenC[o.clue]) { seenC[o.clue] = 1; room.allClues.push({ from: o.name, text: o.clue }); } });
      out.push(room);
    });
    return out;
  }

  /* ---------- 作答方式（選擇／是非／填充／打字／手寫） ----------
     手寫田字格直接載入「師生同步出題」工具（live-class-quiz）的 ink.js，兩邊共用同一份程式。 */
  var LCQ = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin + '/andice0107/live-class-quiz/' : 'https://andice0107.github.io/live-class-quiz/';
  var INPUT_NAMES = { choice: '選擇題', tf: '是非題', fill: '填充', text: '打字作答', draw: '手寫' };
  var DRAW_KINDS = { hanzi: '寫國字', zhuyin: '寫注音', correction: '改錯字', word: '造詞', write: '手寫作答' };
  function inputOf(q) { return (q && q.input) || 'choice'; }
  function isChoice(q) { var i = inputOf(q); return i === 'choice' || i === 'tf'; }
  function inputLabel(q) { var i = inputOf(q); return i === 'draw' ? (DRAW_KINDS[q.kind] || '手寫') : INPUT_NAMES[i]; }
  /* 手寫、打字題強制作答時限（秒）：寫國字、寫注音 60；造詞、改錯字、手寫作答 100；造句等打字題 180。填充題照一般設定 */
  var FORCED = { hanzi: 60, zhuyin: 60, word: 100, correction: 100, write: 100 };
  function forcedSeconds(q) { var i = inputOf(q); if (i === 'draw') return FORCED[q.kind] || 100; if (i === 'text') return 180; return 0; }
  /* 田字格題以字計分：一字一格、一字 60 分；手寫作答（整塊手寫板）、打字題整題 100 分 */
  var CHAR_PTS = 60, WHOLE_PTS = 100;
  function perCell(q) { return inputOf(q) === 'draw' && q.kind !== 'write'; }
  /* 造句、打字作答：老師從 7 個級距點分數（50～200，每級 25 分） */
  var TEXT_LEVELS = [50, 75, 100, 125, 150, 175, 200], TEXT_MAX = 200;
  /* 寫國字題可按「部件提示」、改錯字題可按「部首意義」提示（每個字分開）：
     沒看提示答對一字 60 分，看了這個字的提示才答對只得 30 分 */
  var HINT_PTS = 30, HINT_NAMES = { hanzi: '部件提示', correction: '部首意義' };
  function hintName(q) { return (inputOf(q) === 'draw' && HINT_NAMES[q && q.kind]) || ''; }
  function charHints(q) {
    if (!hintName(q)) return [];
    var h = q.charHints; if (typeof h === 'string') h = h.split(/[；;]/);
    return (h || []).map(function (x) { return String(x == null ? '' : x).trim(); });
  }
  function hintBar(q, n, used, onUse) {
    var hs = charHints(q), name = hintName(q), any = false;
    var bar = document.createElement('div'); bar.className = 'hint-bar';
    for (var i = 0; i < n; i++) (function (i) {
      if (!hs[i]) return; any = true;
      var item = document.createElement('div'); item.className = 'hint-item';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hint-btn';
      var tx = document.createElement('div'); tx.className = 'hint-text hidden';
      function open() { b.classList.add('used'); b.textContent = '💡 第 ' + (i + 1) + ' 字的' + name + '（這個字答對得 ' + HINT_PTS + ' 分）'; tx.textContent = hs[i]; tx.classList.remove('hidden'); }
      b.textContent = '💡 第 ' + (i + 1) + ' 字的' + name;
      b.onclick = function () {
        if (used[i]) return;
        if (!b.classList.contains('ask')) { b.classList.add('ask'); b.textContent = '確定要看嗎？看了這個字答對只得 ' + HINT_PTS + ' 分（再按一次）'; return; }
        b.classList.remove('ask'); used[i] = true; open(); if (onUse) onUse(i);
      };
      if (used[i]) open();
      item.appendChild(b); item.appendChild(tx); bar.appendChild(item);
    })(i);
    return any ? bar : null;
  }
  function freePts(q, mark, n, tp, cm, h) {
    if (perCell(q) && h && h.some && h.some(Boolean) && (mark === true || typeof mark === 'number')) {
      n = Math.max(1, n || 1); var s = 0;
      for (var i = 0; i < n; i++) if (mark === true || (cm && cm[i] === true)) s += h[i] ? HINT_PTS : CHAR_PTS;
      return s;
    }
    if (perCell(q)) { n = Math.max(1, n || 1); return mark === true ? CHAR_PTS * n : (typeof mark === 'number' ? CHAR_PTS * Math.round(mark * n) : 0); }
    if (inputOf(q) === 'text') return mark === false ? 0 : (+tp || (mark === true ? TEXT_MAX : 0));
    return mark === true ? WHOLE_PTS : 0;
  }
  /* 這一題的滿分（傳送門卡自動過關就拿這個分數） */
  function maxPts(q, n) {
    if (perCell(q)) return CHAR_PTS * Math.max(1, n || cellCount(q));
    if (inputOf(q) === 'text') return TEXT_MAX;
    return WHOLE_PTS;
  }
  /* 每個字的對錯 → 整題標記：全對 true、全錯 false、部分對為比例；還有沒批改的字回傳 undefined */
  function markFromCells(cm, n) {
    n = n || (cm ? cm.length : 0); if (!cm || !n) return undefined;
    var r = 0; for (var i = 0; i < n; i++) { if (cm[i] !== true && cm[i] !== false) return undefined; if (cm[i]) r++; }
    return r === n ? true : (r === 0 ? false : r / n);
  }
  function needsTeacher(q) { var i = inputOf(q); return i === 'draw' || i === 'text'; }
  /* 系統給的勇者名字（短，不重複） */
  var HERO_A = ['星光', '閃電', '烈火', '冰霜', '疾風', '月影', '雷鳴', '翡翠', '黃金', '銀月', '彩虹', '晨曦', '暴風', '流星', '紫焰', '蒼藍', '旋風', '熾日', '雪花', '琥珀'];
  var HERO_M = ['騎士', '劍士', '獵人', '法師', '小龍', '巨熊', '戰士', '飛鷹', '遊俠', '獅王'];
  var HERO_F = ['公主', '魔女', '精靈', '女俠', '仙子', '弓手', '天使', '花仙', '小鳳', '女巫'];
  var CLS_NOUN = { m: { '騎士': '騎士', '魔法師': '法師', '弓箭手': '弓手', '盜賊': '盜賊', '王子公主': '王子', '冒險家': '遊俠' },
    f: { '騎士': '女騎士', '魔法師': '魔女', '弓箭手': '弓手', '盜賊': '女俠', '王子公主': '公主', '冒險家': '遊俠' } };
  function heroName(g, taken, cls) {
    var noun = cls && CLS_NOUN[g === 'f' ? 'f' : 'm'][cls], B = noun ? [noun] : (g === 'f' ? HERO_F : HERO_M), n;
    for (var t = 0; t < 300; t++) {
      if (t === 150) B = g === 'f' ? HERO_F : HERO_M;
      n = HERO_A[Math.floor(Math.random() * HERO_A.length)] + B[Math.floor(Math.random() * B.length)]; if (!taken[n]) return n;
    }
    return n + (Object.keys(taken).length + 1);
  }
  function prepQ(q) {
    var i = inputOf(q);
    if (i === 'tf') { q.options = ['⭕ 對', '❌ 不對']; q.answer = q.answer === 1 ? 1 : 0; return q; }
    if (i !== 'choice' || !q.options || q.options.length < 2) return q;
    var idx = shuffle(q.options.map(function (_, k) { return k; }));
    q.answer = idx.indexOf(q.answer); q.options = idx.map(function (k) { return q.options[k]; });
    return q;
  }
  function norm(s) { return String(s == null ? '' : s).replace(/[\s，。、,.!！?？「」]/g, '').toLowerCase(); }
  function fillMatch(q, v) { var a = String(q.answerText || '').split(/[|｜]/).map(norm).filter(Boolean); return !!norm(v) && a.indexOf(norm(v)) >= 0; }
  function answerShow(q) { return String(q.answerText || '').split(/[|｜]/).join(' 或 '); }
  var inkP = null;
  function loadInk() {
    if (!inkP) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LCQ + 'fonts/tw-kai/tw-kai.css'; document.head.appendChild(l);
      inkP = import(LCQ + 'js/ink.js');
    }
    return inkP;
  }
  /* 田字格數（和同步出題工具 ink.js 的 defaultCells 相同規則，給不能先看答案的學生端用） */
  function cellCount(q) {
    if (q.cells) return Math.max(1, Math.min(10, +q.cells));
    var a = String(q.answerText || ''), han = function (t) { return (t.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length; };
    if (q.kind === 'hanzi') return Math.max(1, Math.min(10, (a.split(/[|｜、,，]/)[0].match(/[\u3400-\u9fff\uf900-\ufaff]|[\u3105-\u312f˙ˊˇˋ]+/g) || []).length || 1));
    if (q.kind === 'zhuyin') return Math.max(1, Math.min(10, a.trim().split(/\s+/).filter(Boolean).length || 1));
    if (q.kind === 'correction') return Math.max(1, Math.min(10, han(a.split(/→|->|改成|＞|>/).pop()) || 1));
    if (q.kind === 'word') return 2;
    return 1;
  }
  function cellsOf(q, ink) {
    if (q.cells) return Math.max(1, Math.min(10, +q.cells));
    return ink.defaultCells({ type: q.kind || 'write', answer: q.answerText || '' });
  }
  function usedKey(C) { return 'wordQuestUsed_' + (C.title || '') + '_' + total(C); }
  function loadUsed(C) { try { return JSON.parse(localStorage.getItem(usedKey(C)) || '[]'); } catch (e) { return []; } }
  function saveUsed(C, a) { try { localStorage.setItem(usedKey(C), JSON.stringify(a)); } catch (e) {} }
  function loadContent() {
    try {
      var saved = localStorage.getItem('wordQuestCustomContent');
      if (saved) { var c = JSON.parse(saved); if (c && c.rooms && c.rooms.length) { c.__custom = true; return c; } }
    } catch (e) {}
    var d = null; try { d = localStorage.getItem('wordQuestDemo'); } catch (e) {}
    /* 沒有自訂題本時，可以選「國語題本」或「非學科示範題本」（預設） */
    if (d === 'guoyu' && window.DEMO_GUOYU) { window.DEMO_GUOYU.__demo = 'guoyu'; return window.DEMO_GUOYU; }
    if (window.DEFAULT_CONTENT) window.DEFAULT_CONTENT.__demo = 'fun';
    return window.DEFAULT_CONTENT;
  }
  /* 存檔／讀檔：記錄檔下載到這台電腦，下次再上傳接著玩 */
  function stamp() { var d = new Date(), z = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()); }
  function saveFile(data, base) {
    var name = prompt('記錄檔的名稱（可以改成班級名稱，例如：五年甲班）：', base + '_' + stamp());
    if (name === null) return false;
    name = String(name).trim().replace(/[\\/:*?"<>|]/g, '_') || ('存檔_' + stamp());
    data.app = 'word-quest-save'; data.v = 1; data.savedAt = new Date().toISOString(); data.name = name;
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = name + '.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
    return true;
  }
  function readSave(file, kind, cb) {
    var r = new FileReader();
    r.onload = function () {
      var d = null; try { d = JSON.parse(r.result); } catch (e) {}
      if (!d || d.app !== 'word-quest-save' || !d.state) return alert('這個檔案不是午夜12點的記錄檔，請重新選擇。');
      if (d.kind !== kind) return alert(kind === 'solo' ? '這是多人闖關的記錄檔，請到多人冒險的老師大螢幕，按「再續前緣」讀取。' : '這是單人模式的記錄檔，請到遊戲首頁按「再續前緣」讀取。');
      cb(d);
    };
    r.onerror = function () { alert('讀不到這個檔案，請再試一次。'); };
    r.readAsText(file);
  }
  var REPEAT_NAMES = { none: '不接受另一趟挑戰', redraw: '從全部題目重新抽題', norepeat: '抽過的不再抽，全部抽完才是終極破關' };
  return { defaults: defaults, load: load, save: save, clean: clean, draw: draw, minDraw: minDraw, maxDraw: maxDraw, defDraw: defDraw, ROOM_MAX: ROOM_MAX, saveFile: saveFile, readSave: readSave, buildRooms: buildRooms, total: total, allKeys: allKeys,
    loadUsed: loadUsed, saveUsed: saveUsed, loadContent: loadContent, shuffle: shuffle, REPEAT_NAMES: REPEAT_NAMES,
    LCQ: LCQ, inputOf: inputOf, isChoice: isChoice, inputLabel: inputLabel, fillMatch: fillMatch, answerShow: answerShow, loadInk: loadInk, cellsOf: cellsOf, cellCount: cellCount,
    DRAW_KINDS: DRAW_KINDS, INPUT_NAMES: INPUT_NAMES, forcedSeconds: forcedSeconds, perCell: perCell, freePts: freePts, maxPts: maxPts, TEXT_LEVELS: TEXT_LEVELS, TEXT_MAX: TEXT_MAX, markFromCells: markFromCells, CHAR_PTS: CHAR_PTS, HINT_PTS: HINT_PTS, hintName: hintName, charHints: charHints, hintBar: hintBar, needsTeacher: needsTeacher, heroName: heroName };
})();
