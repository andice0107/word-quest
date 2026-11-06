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
    merchantProb: 60, tradeSeconds: 60,
    fairyProb: 30,
    cardEvery: 5, cardSeconds: 30
  };
  function defaults() { return JSON.parse(JSON.stringify(DEF)); }
  function load() {
    var s = defaults();
    try { var t = JSON.parse(localStorage.getItem(KEY) || 'null'); if (t) Object.keys(DEF).forEach(function (k) { if (t[k] !== undefined) s[k] = t[k]; }); } catch (e) {}
    return clean(s);
  }
  function clamp(v, a, b, d) { v = Math.round(+v); if (!isFinite(v)) v = d; return Math.max(a, Math.min(b, v)); }
  function clean(s) {
    s.drawCount = clamp(s.drawCount, 0, 999, 0);
    if (['none', 'redraw', 'norepeat'].indexOf(s.repeat) < 0) s.repeat = 'redraw';
    s.qTimer = !!s.qTimer; s.qSeconds = clamp(s.qSeconds, 5, 600, 30);
    s.totalTimer = !!s.totalTimer; s.mode = s.mode === 'multi' ? 'multi' : 'solo';
    s.merchantProb = clamp(s.merchantProb, 0, 100, 60); s.tradeSeconds = clamp(s.tradeSeconds, 10, 600, 60);
    s.fairyProb = clamp(s.fairyProb, 0, 100, 30);
    s.cardEvery = clamp(s.cardEvery, 1, 99, 5); s.cardSeconds = clamp(s.cardSeconds, 5, 300, 30);
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(clean(s))); } catch (e) {} }

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function allKeys(C) { var out = []; C.rooms.forEach(function (r, i) { r.objects.forEach(function (o, j) { out.push(i + '-' + j); }); }); return out; }
  function total(C) { return allKeys(C).length; }
  function sortKeys(a) { return a.slice().sort(function (x, y) { var p = x.split('-'), q = y.split('-'); return (p[0] - q[0]) || (p[1] - q[1]); }); }
  /* 從題本抽題；used = 已抽過的題目（norepeat 模式用） */
  function draw(C, n, used) {
    var pool = allKeys(C);
    if (used && used.length) { var u = {}; used.forEach(function (k) { u[k] = 1; }); pool = pool.filter(function (k) { return !u[k]; }); }
    if (!n || n >= pool.length) return sortKeys(pool);
    return sortKeys(shuffle(pool).slice(0, n));
  }
  var UNLOCK = [0, 0, 0, 2, 2, 4];
  /* 依抽到的題目重新組成房間（保留原房間的故事、背景、機關） */
  function buildRooms(C, keys) {
    var map = {}; keys.forEach(function (k) { var p = k.split('-'); (map[p[0]] = map[p[0]] || []).push(+p[1]); });
    var out = [];
    C.rooms.forEach(function (r, i) {
      if (!map[i]) return;
      var objs = map[i].map(function (j, n) {
        var o = JSON.parse(JSON.stringify(r.objects[j])); o.key = i + '-' + j;
        o.unlock = keys.length === total(C) ? (o.unlock || 0) : Math.min(UNLOCK[n] != null ? UNLOCK[n] : 4, n);
        return o;
      });
      var room = JSON.parse(JSON.stringify(r)); room.objects = objs; room.origIndex = i;
      room.allClues = r.objects.map(function (o) { return { from: o.name, text: o.clue }; });
      out.push(room);
    });
    return out;
  }
  function usedKey(C) { return 'wordQuestUsed_' + (C.title || '') + '_' + total(C); }
  function loadUsed(C) { try { return JSON.parse(localStorage.getItem(usedKey(C)) || '[]'); } catch (e) { return []; } }
  function saveUsed(C, a) { try { localStorage.setItem(usedKey(C), JSON.stringify(a)); } catch (e) {} }
  function loadContent() {
    try {
      var saved = localStorage.getItem('wordQuestCustomContent');
      if (saved) { var c = JSON.parse(saved); if (c && c.rooms && c.rooms.length) { c.__custom = true; return c; } }
    } catch (e) {}
    return window.DEFAULT_CONTENT;
  }
  var REPEAT_NAMES = { none: '不接受另一趟挑戰', redraw: '從全部題目重新抽題', norepeat: '抽過的不再抽，全部抽完才是終極破關' };
  return { defaults: defaults, load: load, save: save, clean: clean, draw: draw, buildRooms: buildRooms, total: total, allKeys: allKeys,
    loadUsed: loadUsed, saveUsed: saveUsed, loadContent: loadContent, shuffle: shuffle, REPEAT_NAMES: REPEAT_NAMES };
})();
