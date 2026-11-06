/* 語詞闖關遊戲 主程式 */
(function () {
  'use strict';

  /* ---------- 讀取題目內容 ---------- */
  var LS_KEY = 'wordQuestCustomContent';
  var hm = location.hash.match(/[#&]q=([A-Za-z0-9_-]+)/);
  if (hm && window.WQShare) {
    WQShare.decode(hm[1]).then(function (c) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (e) {}
      location.replace(location.pathname + location.search);
    }).catch(function () { alert('這個題目連結無法讀取，請向老師索取新的連結。'); location.replace(location.pathname); });
    return;
  }
  var C = WQSettings.loadContent();
  var ADV = /[?&]adv=1/.test(location.search);
  var SET = ADV ? WQSettings.load() : WQSettings.defaults();
  var ALLQ = WQSettings.total(C);
  var ROOMS, QCOUNT, TOTAL_STEPS, PICKS = [], ULTIMATE = false;
  /* 依冒險篇章設定抽題，組成這一趟冒險的房間 */
  function setupAdventure() {
    var used = SET.repeat === 'norepeat' ? WQSettings.loadUsed(C) : [];
    if (used.length >= ALLQ) { used = []; WQSettings.saveUsed(C, used); }
    PICKS = WQSettings.draw(C, SET.drawCount, used);
    ROOMS = WQSettings.buildRooms(C, PICKS);
    QCOUNT = PICKS.length; TOTAL_STEPS = QCOUNT + ROOMS.length + 1; ULTIMATE = false;
  }
  setupAdventure();
  var TYPE_NAMES = C.typeNames || {};
  var NUM = '一二三四五六七八九十';

  function img(name) { return 'img/' + name + '.webp'; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

  /* ---------- 音效（Web Audio 合成） ---------- */
  var ac = null, master = null;
  function audioOn() {
    if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); master = ac.createGain(); master.gain.value = .7; master.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(f, t, dur, vol, type, f2) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function chime(f, t, vol, dur) { tone(f, t, dur, vol); tone(f * 2.01, t, dur * .6, vol * .4); tone(f * 3.02, t, dur * .35, vol * .18); }
  function whoosh(t, dur, vol, f1, f2) {
    var n = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ac.createBufferSource(); s.buffer = b; var fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }
  var NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  function play(name, i) {
    if (!ac) return; var t = ac.currentTime;
    switch (name) {
      case 'tap': tone(720, t, .09, .25, 'sine', 380); break;
      case 'open': whoosh(t, .4, .25, 500, 4000); chime(1568, t + .1, .12, .45); chime(2093, t + .18, .1, .4); break;
      case 'correct': [1046.5, 1318.5, 1568, 2093].forEach(function (f, k) { chime(f, t + k * .075, .2, .75); }); break;
      case 'wrong': tone(330, t, .16, .3, 'triangle', 300); tone(247, t + .15, .28, .3, 'triangle', 215); break;
      case 'unlock': shuffle([1760, 2093, 2349, 2637, 3136]).forEach(function (f, k) { chime(f, t + k * .06, .1, .38); }); break;
      case 'dial': tone(1800, t, .03, .12); break;
      case 'note': chime(NOTES[Math.min(i || 0, 5)], t, .3, .45); break;
      case 'rune': [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (f, k) { chime(f, t + k * .09, .18, 1.1); }); break;
      case 'gate': whoosh(t, 1.8, .4, 220, 70); [392, 493.88, 587.33, 783.99, 987.77].forEach(function (f, k) { chime(f, t + .5 + k * .12, .16, 1.6); }); break;
    }
  }
  var SFX = { door: new Audio('audio/door.mp3'), meow: new Audio('audio/meow.mp3') };
  function sfx(k, vol) { var a = SFX[k]; if (!a) return; try { a.currentTime = 0; a.volume = vol || .8; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  var narration = C.__custom ? null : new Audio('audio/intro.mp3');

  /* ---------- 預先載入圖片 ---------- */
  (function () {
    var names = {}; names.title = 1; names.gate = 1; names.cat = 1; names.seal = 1;
    C.rooms.forEach(function (r) { names[r.bg] = 1; r.objects.forEach(function (o) { names[o.sprite] = 1; }); });
    Object.keys(names).forEach(function (n) { var i = new Image(); i.src = img(n); });
  })();

  /* ---------- 飄浮光點 ---------- */
  document.querySelectorAll('.motes').forEach(function (m) {
    for (var i = 0; i < 18; i++) {
      var d = el('div', 'mote');
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDuration = 9 + Math.random() * 12 + 's';
      d.style.animationDelay = -Math.random() * 20 + 's';
      d.style.setProperty('--sway', (Math.random() * 80 - 40) + 'px');
      var s = 3 + Math.random() * 6; d.style.width = d.style.height = s + 'px';
      m.appendChild(d);
    }
  });

  /* ---------- 狀態 ---------- */
  var S, onboarded = false;
  function reset() {
    S = { room: 0, solved: ROOMS.map(function () { return {}; }), seen: ROOMS.map(function () { return {}; }), wrongs: {},
      puzzleDone: ROOMS.map(function () { return false; }), puzzleWrong: ROOMS.map(function () { return 0; }),
      notes: ROOMS.map(function () { return []; }), runes: [], score: 0, shown: 0, steps: 0,
      firstTry: 0, needHint: 0, revealed: 0, review: [], gateMistakes: 0, start: Date.now(), unread: 0, inGate: false, ended: false, pending: [] };
    if (typeof updGrade === 'function') updGrade();
  }
  /* 總時間計時 */
  function fmt(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  setInterval(function () {
    var t = $('hud-time'); if (!t) return;
    t.classList.toggle('hidden', !SET.totalTimer);
    if (S && !S.ended) t.textContent = '⏱ ' + fmt((Date.now() - S.start) / 1000);
  }, 500);
  function show(id) { ['screen-start', 'screen-story', 'screen-play', 'screen-end'].forEach(function (s) { $(s).classList.toggle('active', s === id); }); }
  function overlay(id, on) { $(id).classList.toggle('hidden', !on); }

  /* ---------- 首頁 ---------- */
  $('start-bg').style.backgroundImage = 'url("' + img('title') + '")';
  $('story-bg').style.backgroundImage = 'url("' + img('title') + '")';
  $('end-bg').style.backgroundImage = 'url("' + img('gate') + '")';
  document.title = C.title || '語詞闖關遊戲';
  var tm = $('game-title'); tm.textContent = C.titleMain || C.title || '';
  if (C.titleSub) tm.appendChild(el('span', 'sub', C.titleSub));
  $('instructions').textContent = C.instruction || '';
  $('btn-start').textContent = C.startButton || '開始冒險';
  $('cat-img').src = img('cat'); $('end-cat').src = img('cat');
  if (C.__custom || ADV) {
    var tg = $('custom-tag'); tg.classList.remove('hidden');
    tg.textContent = (C.__custom ? '使用老師自訂題目' : '') + (ADV ? (C.__custom ? '・' : '') + '冒險篇章：抽 ' + QCOUNT + ' 題' + (SET.qTimer ? '・每題 ' + SET.qSeconds + ' 秒' : '') : '');
  }
  $('btn-speak').addEventListener('click', function () {
    if (narration) { try { narration.currentTime = 0; narration.play(); } catch (e) {} return; }
    if ('speechSynthesis' in window) { var u = new SpeechSynthesisUtterance(C.instruction || ''); u.lang = 'zh-TW'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  });
  $('btn-start').addEventListener('click', function () {
    audioOn(); play('tap'); if (narration) try { narration.pause(); } catch (e) {}
    setupAdventure(); reset(); storyStep = 0; renderStory(); show('screen-story');
  });

  /* ---------- 故事 ---------- */
  var storyStep = 0;
  function renderStory() {
    var card = $('story-card'), st = C.story || {}; card.innerHTML = '';
    if (storyStep === 0) {
      (st.letter || []).forEach(function (line, i) { card.appendChild(el('p', i === 0 ? 'to' : '', line)); });
      if (st.signature) card.appendChild(el('p', 'sig', st.signature));
      $('story-next').textContent = '推開大門';
    } else {
      card.appendChild(el('p', 'slam', st.slam || ''));
      var row = el('div', 'story-cat'), im = el('img'); im.src = img('cat'); im.alt = '黑貓';
      row.appendChild(im); row.appendChild(el('p', '', st.cat || '')); card.appendChild(row);
      $('story-next').textContent = '開始冒險';
    }
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  }
  $('story-next').addEventListener('click', function () {
    play('tap');
    if (storyStep === 0) { storyStep = 1; renderStory(); sfx('door', .9); restart($('screen-story'), 'shake'); setTimeout(function () { sfx('meow', .7); }, 1100); }
    else { show('screen-play'); enterRoom(0); }
  });

  /* ---------- HUD ---------- */
  function hud() {
    $('hud-room').textContent = S.inGate ? '最後的大門' : ('第' + (NUM.charAt(S.room) || (S.room + 1)) + '關　' + ROOMS[S.room].name);
    var n = 0; S.solved.forEach(function (o) { n += Object.keys(o).length; });
    $('hud-spells').textContent = '咒語 ' + n + ' / ' + QCOUNT;
    var rw = $('hud-runes'); rw.innerHTML = '';
    ROOMS.forEach(function (r) { rw.appendChild(el('div', 'rune-dot' + (S.runes.indexOf(r.rune) >= 0 ? ' on' : ''), r.rune.charAt(0))); });
    var mins = Math.round(Math.min(1, S.steps / TOTAL_STEPS) * 59);
    $('clock-text').textContent = '11:' + (mins < 10 ? '0' : '') + mins;
    $('hand-m').setAttribute('transform', 'rotate(' + mins * 6 + ' 20 20)');
    $('hand-h').setAttribute('transform', 'rotate(' + (330 + mins * .5) + ' 20 20)');
    var b = $('notes-badge'); b.textContent = S.unread; b.classList.toggle('hidden', !S.unread);
  }
  function step() { S.steps++; hud(); }
  var raf = null;
  function addScore(n) {
    S.score += n; restart($('score'), 'bump'); cancelAnimationFrame(raf);
    var last = performance.now();
    (function tick(now) {
      var dt = (now - last) / 1000; last = now; var diff = S.score - S.shown;
      var st = Math.max(1, Math.abs(diff) * Math.min(1, dt * 8));
      S.shown = Math.abs(diff) <= st ? S.score : S.shown + (diff > 0 ? st : -st);
      $('score').textContent = Math.round(S.shown);
      if (S.shown !== S.score) raf = requestAnimationFrame(tick);
    })(last);
  }

  /* ---------- 特效 ---------- */
  function floatText(t, x, y) { var f = el('div', 'float', t); f.style.left = x + 'px'; f.style.top = y + 'px'; $('fx').appendChild(f); setTimeout(function () { f.remove(); }, 1400); }
  function sparks(x, y, n) {
    for (var i = 0; i < n; i++) {
      var s = el('div', 'spark'), a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 100;
      s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r + 'px');
      $('fx').appendChild(s); setTimeout(s.remove.bind(s), 950);
    }
  }
  function center(node) { var r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  var bt = null;
  function say(t, ms) { var b = $('bubble'); b.textContent = t; b.classList.remove('hidden'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(bt); bt = setTimeout(function () { b.classList.add('hidden'); }, ms || 4500); }
  $('cat').addEventListener('click', function () {
    sfx('meow', .5);
    if (S.inGate) return say((C.gate && C.gate.hint) || '');
    var r = ROOMS[S.room], n = Object.keys(S.solved[S.room]).length;
    if (n >= r.objects.length && !S.puzzleDone[S.room]) say('喵！咒語都找回來了，快去點「' + r.puzzle.name + '」！線索都在線索本裡。');
    else say(r.catTip);
  });

  /* ---------- 房間 ---------- */
  function enterRoom(i) {
    S.room = i; S.inGate = false; var r = ROOMS[i];
    $('scene-bg').style.backgroundImage = 'url("' + img(r.bg) + '")';
    $('objects').classList.remove('hidden'); $('gate-panel').classList.add('hidden');
    renderObjects(true); hud();
    $('ri-num').textContent = '第 ' + (i + 1) + ' 關'; $('ri-title').textContent = r.name; $('ri-text').textContent = r.intro;
    overlay('room-intro', true);
  }
  $('ri-go').addEventListener('click', function () { play('open'); overlay('room-intro', false); say(ROOMS[S.room].catTip, 4800); });

  function sprite(name, tint) { var im = el('img'); im.src = img(name); im.alt = ''; im.draggable = false; if (tint) im.style.setProperty('--tint', tint + 'deg'); return im; }

  function renderObjects(first) {
    var r = ROOMS[S.room], box = $('objects'), n = Object.keys(S.solved[S.room]).length, newly = false;
    box.innerHTML = '';
    r.objects.forEach(function (o, j) {
      var locked = n < (o.unlock || 0), solved = !!S.solved[S.room][j];
      var b = el('button', 'obj'); b.type = 'button';
      var w = el('div', 'spr');
      if (!locked && !solved) w.appendChild(el('div', 'glow'));
      w.appendChild(sprite(o.sprite, o.tint));
      if (solved) w.appendChild(el('div', 'check', '咒'));
      b.appendChild(w); b.appendChild(el('span', 'lbl', locked ? '迷霧中…' : o.name));
      if (locked) { b.classList.add('locked'); b.disabled = true; }
      else if (solved) { b.classList.add('solved'); b.disabled = true; }
      else {
        if (!S.seen[S.room][j]) { S.seen[S.room][j] = 1; if (!first) { b.classList.add('revealing'); newly = true; } }
        b.addEventListener('click', function () { dropPointer(); play('open'); openQ(j); });
        if (!onboarded && S.room === 0 && j === 0) {
          var p = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); p.setAttribute('viewBox', '0 0 48 48'); p.setAttribute('class', 'pointer'); p.id = 'pointer';
          p.innerHTML = '<path d="M14 4 L14 34 L21 27 L26 40 L31 38 L26 25 L36 25 Z" fill="#f6f1ff" stroke="#1b1433" stroke-width="3" stroke-linejoin="round"/>';
          w.appendChild(p);
        }
      }
      box.appendChild(b);
    });
    var all = r.objects.length, sl = n < all, sd = S.puzzleDone[S.room];
    var s = el('button', 'obj seal'); s.type = 'button'; var sw = el('div', 'spr');
    if (!sl && !sd) sw.appendChild(el('div', 'glow'));
    sw.appendChild(sprite('seal'));
    if (sd) sw.appendChild(el('div', 'check', r.rune.charAt(0)));
    s.appendChild(sw); s.appendChild(el('span', 'lbl', sl ? r.puzzle.name + '（封印中）' : r.puzzle.name));
    if (sl) { s.classList.add('locked'); s.disabled = true; }
    else if (sd) { s.classList.add('solved'); s.disabled = true; }
    else {
      if (!S.seen[S.room].seal) { S.seen[S.room].seal = 1; if (!first) { s.classList.add('revealing'); newly = true; } }
      s.addEventListener('click', function () { play('open'); openPuzzle(); });
    }
    box.appendChild(s);
    if (newly) {
      setTimeout(function () { play('unlock'); }, 150);
      say(n >= all ? '喵！' + r.puzzle.name + '的封印解除了！翻開線索本，推理出答案吧。' : '迷霧散開了，出現新的物品！', n >= all ? 5000 : 2600);
    }
  }
  function dropPointer() { var p = $('pointer'); if (p) p.remove(); onboarded = true; }

  /* ---------- 題目視窗 ---------- */
  var cur = null;
  function head(spr, tint, speaker, type) {
    var im = $('m-img'); im.src = img(spr); im.style.filter = tint ? 'hue-rotate(' + tint + 'deg) drop-shadow(0 4px 6px rgba(0,0,0,.6))' : '';
    $('m-speaker').textContent = speaker; $('m-type').textContent = type;
  }
  function clearModal() { $('m-body').innerHTML = ''; var f = $('m-feedback'); f.className = 'hidden'; f.innerHTML = ''; $('m-continue').classList.add('hidden'); $('m-keyhint').textContent = ''; }
  function feedback(kind, title, body, clue) {
    var f = $('m-feedback'); f.className = kind; f.innerHTML = '';
    f.appendChild(el('span', 'fb-title', title)); if (body) f.appendChild(el('span', '', body));
    if (clue) f.appendChild(el('span', 'clue', '獲得線索：' + clue));
    f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
  }
  function openQ(j) {
    var r = ROOMS[S.room], o = r.objects[j], q = o.q, key = S.room + '-' + j;
    cur = { kind: 'q', j: j, key: key, done: false };
    clearModal(); head(o.sprite, o.tint, q.speaker || o.name, '咒語挑戰・' + (TYPE_NAMES[q.type] || q.type || ''));
    $('m-prompt').textContent = q.prompt;
    if (!WQSettings.isChoice(q)) { openFree(o, q, key); overlay('modal', true); $('modal-card').scrollTop = 0; startQTimer(); return; }
    if (q.input === 'tf') $('m-type').textContent = '咒語挑戰・是非題';
    var short = q.options.every(function (t) { return t.length <= 6; });
    var wrap = el('div', 'opts' + (short ? ' grid' : '')), w = S.wrongs[key] || [];
    q.options.forEach(function (t, k) {
      var b = el('button', 'opt'); b.type = 'button'; b.dataset.k = k;
      b.appendChild(el('span', 'k', String(k + 1))); b.appendChild(el('span', '', t));
      if (w.indexOf(k) >= 0) { b.classList.add('wrong'); b.disabled = true; }
      b.addEventListener('click', function () { answer(k, b); });
      wrap.appendChild(b);
    });
    $('m-body').appendChild(wrap);
    $('m-keyhint').textContent = '可按數字鍵 1 - ' + q.options.length + ' 作答';
    if (w.length === 1) feedback('hint', '提示', q.hint1); else if (w.length >= 2) feedback('hint', '更明確的提示', q.hint2);
    overlay('modal', true); $('modal-card').scrollTop = 0;
    startQTimer();
  }
  /* ---------- 打字、手寫作答（手寫板用同步出題工具的 ink.js） ---------- */
  function openFree(o, q, key) {
    var inp = WQSettings.inputOf(q), box = el('div', 'free'), w = S.wrongs[key] || [];
    $('m-type').textContent = '咒語挑戰・' + WQSettings.inputLabel(q);
    $('m-body').appendChild(box);
    var go = el('button', 'btn btn-gold', '送出答案'); go.type = 'button'; go.id = 'free-go';
    if (inp === 'draw') {
      var tip = el('div', 'mute', '用手指或觸控筆寫在格子裡，寫好按「送出答案」。'); box.appendChild(tip);
      var chooser = el('div', 'cell-count hidden'), wrap = el('div', 'cells-wrap'), cont = el('div'); wrap.appendChild(cont);
      box.appendChild(chooser); box.appendChild(wrap);
      WQSettings.loadInk().then(function (ink) {
        if (!cur || cur.key !== key) return;
        cur.ink = ink;
        function build(k) { cur.n = k; cur.cells = ink.buildCells(cont, k, { own: 's', grid: q.kind !== 'write', onChange: function () {} }); chooser.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', +b.dataset.n === k); }); }
        if (q.kind === 'word' && !q.cells) {
          chooser.classList.remove('hidden'); chooser.appendChild(el('span', '', '這個詞有幾個字？'));
          [2, 3, 4].forEach(function (k) { var b = el('button', '', k + ' 格'); b.type = 'button'; b.dataset.n = k; b.onclick = function () { if (!cur.done) build(k); }; chooser.appendChild(b); });
        }
        build(WQSettings.cellsOf(q, ink));
      }).catch(function () { box.appendChild(el('div', 'fb-title', '手寫板載入失敗，請確認網路連線後重新打開這一題。')); });
      go.onclick = function () {
        if (!cur || cur.done || !cur.cells) return;
        var v = { n: cur.n, c: cur.cells.map(function (c) { return { s: c.s }; }) };
        if (!cur.ink.hasInk(v)) return feedback('hint', '還沒寫答案', '先在格子裡寫好再送出喔。');
        judgeFree(o, q, v);
      };
    } else {
      var t = el(inp === 'fill' ? 'input' : 'textarea'); if (inp === 'fill') t.type = 'text';
      t.placeholder = inp === 'fill' ? '在這裡輸入答案' : '在這裡打字作答'; t.id = 'free-text'; box.appendChild(t);
      setTimeout(function () { try { t.focus(); } catch (e) {} }, 300);
      t.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && inp === 'fill') { e.preventDefault(); go.click(); } });
      go.onclick = function () {
        if (!cur || cur.done) return; var v = t.value.trim();
        if (!v) return feedback('hint', '還沒有答案', '先輸入答案再送出喔。');
        if (inp === 'fill') return fillAnswer(o, q, v, t, go);
        judgeFree(o, q, v);
      };
    }
    box.appendChild(go);
    if (w.length === 1) feedback('hint', '提示', q.hint1); else if (w.length >= 2) feedback('hint', '更明確的提示', q.hint2);
  }
  function fillAnswer(o, q, v, t, go) {
    var w = S.wrongs[cur.key] || (S.wrongs[cur.key] = []);
    if (WQSettings.fillMatch(q, v)) {
      cur.done = true; t.disabled = true; go.disabled = true;
      var pts = [100, 60, 30][w.length] || 30; if (w.length === 0) S.firstTry++; else S.needHint++; if (w.length >= 2) S.review.push(o.word);
      var c = center(go); floatText('+' + pts, c.x, c.y); sparks(c.x, c.y, 18); play('correct'); addScore(pts);
      feedback('good', '咒語啟動！「' + o.word + '」回到魔法書了。', q.explain, o.clue); return finishQ(o);
    }
    play('wrong'); w.push(v); restart($('modal-card'), 'shake-card'); t.select();
    if (w.length === 1) feedback('hint', '咒語沒有反應…提示', q.hint1);
    else if (w.length === 2) feedback('hint', '再想想，更明確的提示', q.hint2);
    else { cur.done = true; t.disabled = true; go.disabled = true; S.revealed++; S.review.push(o.word); feedback('reveal', '黑貓幫你解開了咒語：答案是「' + WQSettings.answerShow(q) + '」', q.explain, o.clue); finishQ(o); }
  }
  /* 手寫、打字題：送出後交給老師批改（不讓學生自己判斷），老師批改對了才加分 */
  function judgeFree(o, q, v, auto) {
    cur.done = true; stopQTimer();
    $('m-body').querySelectorAll('button, textarea, input').forEach(function (b) { b.disabled = true; });
    if (cur.cells) cur.cells.forEach(function (c) { c.setEnabled(false); });
    S.pending.push({ o: o, q: q, v: v, ink: cur.ink || null, mark: null });
    play('open'); updGrade();
    var ref = WQSettings.answerShow(q);
    feedback('hint', (auto ? '時間到，已自動交出你寫的答案。' : '') + '📝 答案已交給老師批改',
      (WQSettings.perCell(q) ? '老師會一個字一個字批改，每寫對一個字加 ' + WQSettings.CHAR_PTS + ' 分。' : '老師批改答對後，會再加 100 分。') + (ref ? '參考答案：' + ref + '。' : '') + (q.explain ? '　' + q.explain : ''), o.clue);
    finishQ(o);
  }

  /* 老師批改（長按才打開，避免學生自己按） */
  function ungraded() { return S.pending.filter(function (x) { return x.mark === null; }); }
  function updGrade() {
    var n = ungraded().length, b = $('btn-grade');
    b.classList.toggle('hidden', !n); $('grade-badge').textContent = n;
    var eb = $('end-grade'); if (eb) { eb.classList.toggle('hidden', !n); $('end-grade-n').textContent = n; }
  }
  function longPress(btn, fn) {
    var t = null;
    function stop() { clearTimeout(t); t = null; btn.classList.remove('pressing'); }
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); stop(); try { btn.setPointerCapture(e.pointerId); } catch (x) {} btn.classList.add('pressing'); t = setTimeout(function () { stop(); fn(); }, 1500); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () { if (!btn.classList.contains('pressing')) say('這是老師批改的按鈕，請老師長按 2 秒打開。', 3500); });
  }
  function openGrade() {
    play('open'); var ov = $('grade-ov'), list = $('grade-list'); list.innerHTML = '';
    S.pending.forEach(function (it, i) {
      var q = it.q, d = el('div', 'gitem' + (it.mark === true ? ' ok' : it.mark === false ? ' ng' : ''));
      d.appendChild(el('div', 'gq', (i + 1) + '. ' + WQSettings.inputLabel(q) + '：' + q.prompt));
      var ref = WQSettings.answerShow(q); if (ref) { var r = el('div', 'gref'); r.appendChild(el('b', '', '參考答案：')); r.appendChild(el('span', 'kai', ref)); d.appendChild(r); }
      if (typeof it.v === 'string') d.appendChild(el('div', 'gans', it.v));
      else if (it.ink) {
        var cv = el('canvas', 'ink-view'), g = it.ink.guideChars(q.kind, q.answerText), op = { grid: q.kind !== 'write', guides: g.length ? g : null };
        d.appendChild(cv); requestAnimationFrame(function () { it.ink.paintInkThumb(cv, it.v, op); });
        it.ink.ensureKai(g).then(function () { it.ink.paintInkThumb(cv, it.v, op); });
      }
      var bs = el('div', 'gbtns'), per = WQSettings.perCell(q) && typeof it.v !== 'string', n = per ? Math.max(1, it.v.n || 1) : 1;
      function done(mark) {
        it.mark = mark; var pts = WQSettings.freePts(q, mark, n); it.pts = pts;
        if (mark === true) S.firstTry++; else { S.revealed++; S.review.push(it.o.word); }
        if (pts) addScore(pts); play(pts ? 'correct' : 'wrong'); afterGrade();
      }
      if (it.mark === null && per) {
        it.cm = it.cm || [];
        var row = el('div', 'cell-marks');
        for (var ci = 0; ci < n; ci++) (function (ci) {
          var c = el('div', 'cm'); c.appendChild(el('span', 'cm-n', '第 ' + (ci + 1) + ' 字'));
          [[true, '✓'], [false, '✗']].forEach(function (pr) {
            var b = el('button', it.cm[ci] === pr[0] ? 'on' : '', pr[1]); b.type = 'button';
            b.onclick = function () { it.cm[ci] = pr[0]; var arr = []; for (var x = 0; x < n; x++) arr.push(it.cm[x]); var m = WQSettings.markFromCells(arr); if (m === undefined) openGrade(); else done(m); };
            c.appendChild(b);
          });
          row.appendChild(c);
        })(ci);
        bs.appendChild(row); bs.appendChild(el('span', 'mute', '一個字 ' + WQSettings.CHAR_PTS + ' 分，每個字都批改後計分'));
      } else if (it.mark === null) {
        var ok = el('button', 'btn btn-gold', '✔ 對'), ng = el('button', 'btn btn-violet', '✘ 錯'); ok.type = ng.type = 'button';
        ok.onclick = function () { done(true); };
        ng.onclick = function () { done(false); };
        bs.appendChild(ok); bs.appendChild(ng);
      } else bs.appendChild(el('span', 'gres', (it.mark === true ? '✔ 答對' : it.mark === false ? '✘ 答錯' : '◐ 部分答對') + (per ? '（對 ' + (it.cm || []).filter(function (x) { return x === true; }).length + ' / ' + n + ' 字）' : '') + (it.pts ? '　+' + it.pts : '')));
      d.appendChild(bs); list.appendChild(d);
    });
    if (!S.pending.length) list.appendChild(el('p', 'mute', '目前沒有要批改的答案。'));
    ov.classList.remove('hidden');
  }
  function afterGrade() { updGrade(); openGrade(); if (S.ended) endGame(true); }
  longPress($('btn-grade'), openGrade);
  $('grade-close').addEventListener('click', function () { play('tap'); $('grade-ov').classList.add('hidden'); });

  /* 每題作答時限 */
  var qt = null;
  function stopQTimer() { clearInterval(qt); qt = null; var b = $('m-timer'); if (b) b.remove(); $('m-close').classList.remove('hidden'); }
  function startQTimer() {
    stopQTimer();
    var o = cur && cur.kind === 'q' ? ROOMS[S.room].objects[cur.j] : null, secs = o ? WQSettings.forcedSeconds(o.q) : 0;
    if (!secs && !SET.qTimer) return; secs = secs || SET.qSeconds;
    var end = Date.now() + secs * 1000, bar = el('div', 'qtimer'), fill = el('i'), txt = el('span');
    bar.id = 'm-timer'; bar.appendChild(fill); bar.appendChild(txt); $('m-prompt').parentNode.insertBefore(bar, $('m-prompt'));
    $('m-close').classList.add('hidden');
    function tick() {
      var left = Math.max(0, end - Date.now()), sec = Math.ceil(left / 1000);
      fill.style.width = (left / (secs * 10)) + '%'; txt.textContent = '⏳ ' + sec + ' 秒';
      bar.classList.toggle('low', sec <= 5);
      if (left <= 0) { stopQTimer(); timeUp(); }
    }
    tick(); qt = setInterval(tick, 200);
  }
  function timeUp() {
    if (!cur || cur.kind !== 'q' || cur.done) return;
    var o = ROOMS[S.room].objects[cur.j], q = o.q, ch = WQSettings.isChoice(q);
    if (WQSettings.needsTeacher(q)) {
      var v = null;
      if (cur.cells && cur.ink) { v = { n: cur.n, c: cur.cells.map(function (c) { return { s: c.s }; }) }; if (!cur.ink.hasInk(v)) v = null; }
      else { var t = $('free-text'); if (t && t.value.trim()) v = t.value.trim(); }
      if (v) return judgeFree(o, q, v, true);
    }
    cur.done = true; S.revealed++; S.review.push(o.word); play('wrong');
    $('m-body').querySelectorAll('.opt').forEach(function (b) { b.disabled = true; if (+b.dataset.k === q.answer) b.classList.add('correct'); });
    $('m-body').querySelectorAll('button, textarea, input').forEach(function (b) { b.disabled = true; });
    if (cur.cells) cur.cells.forEach(function (c) { c.setEnabled(false); });
    feedback('reveal', '時間到！黑貓幫你解開了咒語：正確答案是「' + (ch ? q.options[q.answer] : WQSettings.answerShow(q)) + '」', q.explain, o.clue); finishQ(o);
  }
  function answer(k, btn) {
    if (!cur || cur.kind !== 'q' || cur.done) return;
    var o = ROOMS[S.room].objects[cur.j], q = o.q, w = S.wrongs[cur.key] || (S.wrongs[cur.key] = []);
    var btns = $('m-body').querySelectorAll('.opt');
    if (k === q.answer) {
      cur.done = true; btn.classList.add('correct');
      btns.forEach(function (b) { b.disabled = true; if (b !== btn) b.classList.add('spent'); });
      var pts = [100, 60, 30][w.length] || 30;
      if (w.length === 0) S.firstTry++; else S.needHint++;
      if (w.length >= 2) S.review.push(o.word);
      var c = center(btn); floatText('+' + pts, c.x, c.y); sparks(c.x, c.y, 18); play('correct'); addScore(pts);
      feedback('good', '咒語啟動！「' + o.word + '」回到魔法書了。', q.explain, o.clue); finishQ(o);
    } else {
      play('wrong'); w.push(k); btn.classList.add('wrong'); btn.disabled = true; restart($('modal-card'), 'shake-card');
      if (w.length === 1) feedback('hint', '咒語沒有反應…提示', q.hint1);
      else if (w.length === 2 && q.options.length > 3) feedback('hint', '再想想，更明確的提示', q.hint2);
      else {
        cur.done = true; S.revealed++; S.review.push(o.word);
        btns.forEach(function (b) { b.disabled = true; if (+b.dataset.k === q.answer) b.classList.add('correct'); });
        feedback('reveal', '黑貓幫你解開了咒語：正確答案是「' + q.options[q.answer] + '」', q.explain, o.clue); finishQ(o);
      }
    }
  }
  function finishQ(o) {
    stopQTimer(); if (cur) cur.pending = false;
    S.solved[S.room][cur.j] = true; S.notes[S.room].push({ from: o.name, text: o.clue }); S.unread++; step();
    $('m-continue').textContent = '繼續探索'; $('m-continue').classList.remove('hidden'); $('m-keyhint').textContent = '';
    setTimeout(function () { $('m-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
  }
  function closeModal() {
    if (qt || (cur && cur.pending)) return;
    play('tap'); var c = cur; overlay('modal', false); cur = null; codeKeys = null; stopQTimer();
    try { window.scrollTo(0, 0); for (var n = $('hud'); n; n = n.parentElement) n.scrollTop = 0; } catch (e) {}
    if (c && c.done) { renderObjects(false); if (c.kind === 'puzzle') showRune(); }
  }
  $('m-continue').addEventListener('click', closeModal);
  $('m-close').addEventListener('click', closeModal);

  /* ---------- 機關 ---------- */
  var codeKeys = null;
  function openPuzzle() {
    var p = ROOMS[S.room].puzzle; cur = { kind: 'puzzle', done: false };
    clearModal(); head('seal', 0, p.name, '最終機關'); $('m-prompt').textContent = p.prompt;
    var body = $('m-body');
    if (p.type === 'sequence') buildSeq(p, body); else if (p.type === 'code') buildCode(p, body); else buildChoose(p, body);
    var tools = el('div', 'puz-tools'), tg = el('button', 'btn-ghost', '查看線索本'), list = el('div', 'mini-clues hidden'); tg.type = 'button';
    S.notes[S.room].forEach(function (n) { list.appendChild(el('div', '', n.text)); });
    var rm = ROOMS[S.room]; if (rm.allClues && rm.allClues.length > rm.objects.length) {
      var have = {}; rm.objects.forEach(function (o) { have[o.clue] = 1; });
      rm.allClues.forEach(function (n) { if (!have[n.text]) list.appendChild(el('div', '', '古書殘頁：' + n.text)); });
    }
    tg.addEventListener('click', function () { play('tap'); list.classList.toggle('hidden'); tg.textContent = list.classList.contains('hidden') ? '查看線索本' : '收起線索'; });
    tools.appendChild(tg); body.appendChild(tools); body.appendChild(list);
    var pw = S.puzzleWrong[S.room]; if (pw === 1) feedback('hint', '提示', p.hint1); else if (pw >= 2) feedback('hint', '更明確的提示', p.hint2);
    overlay('modal', true); $('modal-card').scrollTop = 0;
  }
  function pWrong(p) {
    play('wrong'); var n = ++S.puzzleWrong[S.room];
    if (n === 1) feedback('hint', '機關沒有反應，提示', p.hint1); else if (n === 2) feedback('hint', '再試一次，更明確的提示', p.hint2);
    return n;
  }
  function pSolved(p, node, revealed) {
    cur.done = true; S.puzzleDone[S.room] = true; codeKeys = null;
    var pts = revealed ? 20 : ([100, 70, 40][S.puzzleWrong[S.room]] || 40), c = center(node);
    floatText('+' + pts, c.x, c.y); sparks(c.x, c.y, 26); addScore(pts); play('rune');
    if (revealed) feedback('reveal', '黑貓幫你推理出答案', p.explain + ' ' + p.success); else feedback('good', '機關解開了！', p.success);
    step(); $('m-continue').textContent = '取得符文'; $('m-continue').classList.remove('hidden');
    $('m-body').querySelectorAll('button').forEach(function (b) { if (!b.classList.contains('btn-ghost')) b.disabled = true; });
    setTimeout(function () { $('m-feedback').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
  }
  function buildSeq(p, body) {
    var picks = [], tiles = {}, row = el('div', 'puz-row'), track = el('div', 'seq-track');
    var slots = p.items.map(function () { var s = el('div', 'seq-slot'); track.appendChild(s); return s; });
    shuffle(p.items.map(function (_, i) { return i; })).forEach(function (idx) {
      var it = p.items[idx], t = el('button', 'tile'); t.type = 'button';
      t.style.background = 'radial-gradient(circle at 40% 35%,#fff,' + it.color + ' 65%)'; t.style.color = it.color;
      var lab = el('span', '', it.label); lab.style.color = '#1b1433'; t.appendChild(lab); t.appendChild(el('small', '', it.name));
      t.addEventListener('click', function () {
        if (cur.done || picks.indexOf(idx) >= 0 || picks.length >= p.items.length) return;
        picks.push(idx); play('note', picks.length - 1); t.classList.add('lit'); t.appendChild(el('span', 'ord', String(picks.length)));
        var s = slots[picks.length - 1]; s.textContent = it.label; s.style.background = it.color; s.style.borderStyle = 'solid';
        if (picks.length === p.items.length) setTimeout(check, 350);
      });
      tiles[idx] = t; row.appendChild(t);
    });
    function clear() {
      picks = []; Object.keys(tiles).forEach(function (k) { tiles[k].classList.remove('lit'); var o = tiles[k].querySelector('.ord'); if (o) o.remove(); });
      slots.forEach(function (s) { s.textContent = ''; s.style.background = ''; s.style.borderStyle = ''; });
    }
    function check() {
      if (picks.every(function (v, i) { return v === p.answer[i]; })) return pSolved(p, track);
      Object.keys(tiles).forEach(function (k) { restart(tiles[k], 'err'); });
      var n = pWrong(p);
      setTimeout(function () {
        clear();
        if (n >= 3) p.answer.forEach(function (idx, i) {
          setTimeout(function () {
            var t = tiles[idx], it = p.items[idx]; t.classList.add('lit'); t.appendChild(el('span', 'ord', String(i + 1)));
            slots[i].textContent = it.label; slots[i].style.background = it.color; slots[i].style.borderStyle = 'solid'; play('note', i);
            if (i === p.answer.length - 1) setTimeout(function () { pSolved(p, track, true); }, 400);
          }, i * 380);
        });
      }, 700);
    }
    body.appendChild(row); body.appendChild(track);
    var tools = el('div', 'puz-tools'), rb = el('button', 'btn-ghost', '重新排列'); rb.type = 'button';
    rb.addEventListener('click', function () { if (!cur.done) { play('tap'); clear(); } }); tools.appendChild(rb); body.appendChild(tools);
  }
  function buildCode(p, body) {
    var ans = String(p.answer), n = ans.length, vals = [], dvs = [], pos = 0;
    var wrap = el('div', 'code-wrap'), dials = el('div', 'dials');
    var up = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 15l7-7 7 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
    var dn = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 9l7 7 7-7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
    for (var i = 0; i < n; i++) (function (i) {
      vals.push(0); var d = el('div', 'dial'), u = el('button', 'dial-btn'), v = el('div', 'dv', '0'), w = el('button', 'dial-btn');
      u.type = w.type = 'button'; u.innerHTML = up; w.innerHTML = dn;
      u.addEventListener('click', function () { set(i, (vals[i] + 1) % 10); }); w.addEventListener('click', function () { set(i, (vals[i] + 9) % 10); });
      d.appendChild(u); d.appendChild(v); d.appendChild(w); dials.appendChild(d); dvs.push(v);
    })(i);
    function set(i, v) { if (cur.done) return; vals[i] = v; dvs[i].textContent = v; play('dial'); restart(dvs[i], 'roll'); }
    var go = el('button', 'btn btn-gold', '解鎖'); go.type = 'button';
    go.addEventListener('click', function () {
      if (cur.done) return;
      if (vals.join('') === ans) return pSolved(p, dials);
      restart(wrap, 'err');
      if (pWrong(p) >= 3) {
        ans.split('').forEach(function (ch, i) { setTimeout(function () { vals[i] = +ch; dvs[i].textContent = ch; play('dial'); restart(dvs[i], 'roll'); }, 300 + i * 300); });
        setTimeout(function () { pSolved(p, dials, true); }, 400 + n * 300);
      }
    });
    wrap.appendChild(dials); wrap.appendChild(go); body.appendChild(wrap);
    $('m-keyhint').textContent = '也可以直接用鍵盤輸入數字';
    codeKeys = function (e) { if (!/^[0-9]$/.test(e.key)) return false; set(pos, +e.key); pos = (pos + 1) % n; return true; };
  }
  function stairSvg(color, label) {
    return '<svg viewBox="0 0 80 70" aria-hidden="true"><path d="M6 64 H24 V50 H40 V36 H56 V22 H74 V64 Z" fill="' + color + '" stroke="#1b1433" stroke-width="3" stroke-linejoin="round"/>' +
      '<text x="58" y="16" font-size="18" text-anchor="middle" fill="' + color + '" stroke="#1b1433" stroke-width="1">' + label + '</text></svg>';
  }
  function buildChoose(p, body) {
    var grid = el('div', 'stairs');
    p.items.forEach(function (it, k) {
      var b = el('button', 'stair'); b.type = 'button'; b.innerHTML = stairSvg(it.color, it.label); b.appendChild(el('span', '', it.name));
      b.addEventListener('click', function () {
        if (cur.done) return;
        if (k === p.answer) { b.classList.add('correct'); return pSolved(p, b); }
        b.classList.add('wrong'); b.disabled = true;
        if (pWrong(p) >= 3) { grid.children[p.answer].classList.add('correct'); setTimeout(function () { pSolved(p, grid.children[p.answer], true); }, 500); }
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  /* ---------- 符文 ---------- */
  function showRune() {
    var r = ROOMS[S.room]; if (S.runes.indexOf(r.rune) < 0) S.runes.push(r.rune); hud();
    var rr = $('rg-rune'); rr.textContent = r.rune; rr.style.animation = 'none'; void rr.offsetWidth; rr.style.animation = '';
    $('rg-title').textContent = '取得「' + r.rune + '符文」！'; $('rg-text').textContent = r.puzzle.success;
    $('rg-go').textContent = S.room < ROOMS.length - 1 ? '前往下一個房間' : '前往最後的大門';
    overlay('rune-get', true); play('rune');
    setTimeout(function () { var c = center(rr); sparks(c.x, c.y, 32); }, 350);
  }
  $('rg-go').addEventListener('click', function () { play('tap'); overlay('rune-get', false); if (S.room < ROOMS.length - 1) enterRoom(S.room + 1); else enterGate(); });

  /* ---------- 大門 ---------- */
  function enterGate() {
    S.inGate = true; var G = C.gate || {};
    $('scene-bg').style.backgroundImage = 'url("' + img('gate') + '")';
    $('objects').classList.add('hidden');
    var g = $('gate-panel'); g.classList.remove('hidden'); g.innerHTML = '';
    g.appendChild(el('p', '', G.intro || '')); g.appendChild(el('p', '', G.prompt || ''));
    var sw = el('div', 'gate-slots'); sw.style.gridTemplateColumns = 'repeat(' + Math.min(ROOMS.length, 6) + ',1fr)';
    var slots = ROOMS.map(function (r) { var s = el('div', 'gslot'); s.appendChild(el('div', 'hole')); s.appendChild(el('span', '', r.short)); sw.appendChild(s); return s; });
    g.appendChild(sw); var fb = el('div', 'gate-fb'); g.appendChild(fb);
    var rw = el('div', 'gate-runes'), next = 0;
    function mark() { slots.forEach(function (s, i) { s.classList.toggle('next', i === next); }); }
    shuffle(ROOMS.map(function (r) { return r.rune; })).forEach(function (rn) {
      var b = el('button', 'grune', rn); b.type = 'button';
      b.addEventListener('click', function () {
        if (next >= ROOMS.length) return;
        if (rn === ROOMS[next].rune) {
          var s = slots[next]; s.classList.remove('next'); s.classList.add('filled'); s.querySelector('.hole').textContent = rn;
          play('note', next); var c = center(s); sparks(c.x, c.y, 12); b.remove(); next++; fb.textContent = ''; mark();
          if (next >= ROOMS.length) finishGate(g);
        } else {
          play('wrong'); S.gateMistakes++; restart(b, 'err');
          fb.textContent = '「' + rn + '符文」不是在' + ROOMS[next].short + '取得的。' + (G.hint || '');
        }
      });
      rw.appendChild(b);
    });
    g.appendChild(rw); mark(); hud(); say('喵！最後一步了，把符文放回大門吧！', 3500);
  }
  function finishGate(g) {
    var pts = Math.max(50, 100 - 10 * S.gateMistakes), c = center(g);
    floatText('+' + pts, c.x, c.y); sparks(c.x, c.y, 40); addScore(pts); step(); play('gate');
    setTimeout(function () { sfx('door', .6); }, 900);
    var m = el('p', '', (C.gate && C.gate.success) || ''); m.style.color = '#e8c15a'; m.style.fontWeight = '700'; g.appendChild(m);
    setTimeout(endGame, 3400);
  }

  /* ---------- 結局 ---------- */
  function endGame(again) {
    if (!again) S.endSec = Math.round((Date.now() - S.start) / 1000);
    var sec = S.endSec; S.ended = true;
    if (SET.repeat === 'norepeat') {
      var used = WQSettings.loadUsed(C); PICKS.forEach(function (k) { if (used.indexOf(k) < 0) used.push(k); }); WQSettings.saveUsed(C, used);
      ULTIMATE = used.length >= ALLQ;
    }
    $('end-title').textContent = ULTIMATE ? '終極破關！所有咒語都找回來了！' : (C.endTitle || '闖關成功！');
    var ag = $('btn-another'); ag.classList.toggle('hidden', !(ADV && SET.repeat !== 'none'));
    ag.textContent = ULTIMATE ? '重新開始全新的冒險' : '接受另一段冒險';
    if (SET.repeat === 'norepeat' && !ULTIMATE) ag.textContent += '（剩 ' + (ALLQ - WQSettings.loadUsed(C).length) + ' 題沒出現過）';
    $('final-score').textContent = S.score;
    var st = $('end-stats'); st.innerHTML = '';
    function stat(l, v) { var d = el('div', 'stat', l); d.appendChild(el('b', '', v)); st.appendChild(d); }
    stat('一次就答對', S.firstTry + ' / ' + QCOUNT); stat('看了提示才答對', String(S.needHint));
    stat('黑貓幫忙解開', String(S.revealed)); if (SET.totalTimer) stat('用時', Math.floor(sec / 60) + ' 分 ' + ('0' + sec % 60).slice(-2) + ' 秒');
    var best = 0; try { best = +localStorage.getItem('wordQuestBest_' + (C.title || '')) || 0; } catch (e) {}
    var rv = $('end-review');
    rv.textContent = S.review.length ? '可以再複習的語詞：' + S.review.join('、') : '太厲害了！每一道咒語都在提示內破解。';
    var line = el('div', '', best ? (S.score > best ? '新紀錄！比之前的最佳成績 ' + best + ' 分還高！' : '這台裝置的最佳成績：' + best + ' 分') : '這是第一次闖關成功！');
    rv.appendChild(line);
    try { if (S.score > best) localStorage.setItem('wordQuestBest_' + (C.title || ''), S.score); } catch (e) {}
    updGrade(); if (again) return;
    show('screen-end'); sparks(innerWidth / 2, innerHeight / 3, 50); play('rune');
  }
  longPress($('end-grade-btn'), openGrade);
  $('btn-restart').addEventListener('click', function () { audioOn(); play('tap'); setupAdventure(); reset(); S.shown = 0; $('score').textContent = '0'; show('screen-play'); enterRoom(0); });
  $('btn-another').addEventListener('click', function () {
    audioOn(); play('tap'); if (ULTIMATE) WQSettings.saveUsed(C, []);
    setupAdventure(); reset(); S.shown = 0; $('score').textContent = '0'; show('screen-play'); enterRoom(0);
  });

  /* ---------- 線索本 ---------- */
  function openNotes() {
    play('open'); S.unread = 0; hud();
    var list = $('notes-list'); list.innerHTML = ''; var any = false;
    ROOMS.forEach(function (r, i) {
      if (!S.inGate && i !== S.room) return;
      S.notes[i].forEach(function (n, k) {
        any = true; var d = el('div', 'note'); d.style.animationDelay = k * .05 + 's';
        d.appendChild(el('span', 'from', (S.inGate ? r.short + '・' : '') + n.from)); d.appendChild(el('span', '', n.text)); list.appendChild(d);
      });
    });
    if (!any) list.appendChild(el('div', 'note-empty', '還沒有線索。點擊房間裡發光的物品，答對咒語就能得到線索。'));
    var rw = $('notes-runes'); rw.innerHTML = '';
    ROOMS.forEach(function (r) { if (S.runes.indexOf(r.rune) >= 0) rw.appendChild(el('span', 'rune-chip', r.short + '：' + r.rune + '符文')); });
    overlay('notes', true);
  }
  $('btn-notes').addEventListener('click', openNotes);
  $('notes-close').addEventListener('click', function () { play('tap'); overlay('notes', false); });

  /* ---------- 鍵盤 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!$('notes').classList.contains('hidden')) return overlay('notes', false); if (!$('modal').classList.contains('hidden')) return closeModal(); }
    if ($('modal').classList.contains('hidden') || !cur || cur.done) return;
    if (cur.kind === 'q' && /^[1-9]$/.test(e.key)) { var b = $('m-body').querySelector('.opt[data-k="' + (+e.key - 1) + '"]'); if (b && !b.disabled) { b.click(); e.preventDefault(); } }
    else if (codeKeys && codeKeys(e)) e.preventDefault();
  });
  $('app').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  reset(); hud();
})();
