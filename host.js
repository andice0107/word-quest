/* 多人闖關：教師大螢幕（主持端，所有計分都在這台電腦計算） */
(function () {
  'use strict';
  var C = WQSettings.loadContent(), SET = WQSettings.load(), ALLQ = WQSettings.total(C), TYPE = C.typeNames || {};
  var MAX = 30, CODE = WQNet.code();
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(c, x, fn, id) { var b = el('button', c, x); b.type = 'button'; if (id) b.id = id; b.addEventListener('click', function () { WQSfx.on(); WQSfx.play('tap'); fn(); }); return b; }
  function img(n) { return 'img/' + n + '.webp'; }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function px(p, cls) { return WQPixel.img(p.seed, p.gender, cls); }
  document.querySelectorAll('.motes').forEach(function (m) { for (var i = 0; i < 16; i++) { var d = el('div', 'mote'); d.style.left = Math.random() * 100 + '%'; d.style.animationDuration = 9 + Math.random() * 12 + 's'; d.style.animationDelay = -Math.random() * 20 + 's'; d.style.setProperty('--sway', (Math.random() * 80 - 40) + 'px'); m.appendChild(d); } });
  function setBg(n) { $('h-bg').style.backgroundImage = 'url("' + img(n) + '")'; }
  setBg('title');

  /* ---------- 狀態 ---------- */
  var G = { phase: 'lobby', players: {}, joinN: 0, seq: [], rooms: [], qi: -1, paused: false, elapsed: 0, timer: null,
    log: [], fairyPicked: [], used: [], adventure: 1, ultimate: false, merchant: null, turn: null, fairy: null, effect: null, chest: null, queue: [], fxN: 0 };
  function list() { return Object.keys(G.players).map(function (k) { return G.players[k]; }).sort(function (a, b) { return a.joined - b.joined; }); }
  function online(p) { return Date.now() - p.lastSeen < 20000; }
  function ranked() { return WQCards.ranked(list()); }
  function rankOf(p) { return ranked().indexOf(p) + 1; }

  function newAdventure() {
    var used = SET.repeat === 'norepeat' ? G.used : [];
    if (used.length >= ALLQ) { used = G.used = []; }
    var keys = WQSettings.draw(C, SET.drawCount, used);
    G.rooms = WQSettings.buildRooms(C, keys); G.seq = [];
    G.rooms.forEach(function (r, ri) { r.objects.forEach(function (o, j) { G.seq.push({ ri: ri, j: j, o: o, key: o.key }); }); });
    G.keys = keys; G.qi = -1; G.log = []; G.fairyPicked = []; G.elapsed = 0; G.ultimate = false;
    list().forEach(function (p) { p.score = 0; p.cards = []; p.correct = 0; p.wrong = 0; p.streak = 0; p.best = 0; p.next = {}; p.cur = null; p.delta = 0; p.room = {}; });
  }
  newAdventure();

  /* ---------- 連線 ---------- */
  var net = WQNet.open({ code: CODE, role: 'host', onMessage: onUp, onStatus: function (s) {
    var n = $('h-net'); n.textContent = s === 'online' ? '🟢 連線正常' : (s === 'connecting' ? '🟡 連線中…' : '🔴 連線中斷，自動重試中'); n.classList.toggle('warn', s !== 'online');
    if (s === 'online' && G.phase === 'lobby') render();
  } });
  function joinUrl() {
    var base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    return base + 'play.html' + (WQNet.LOCAL ? '?local=1' : '') + '#r=' + CODE + '&b=' + net.broker;
  }
  var pushT = null;
  function push() { if (pushT) return; pushT = setTimeout(function () { pushT = null; net.send(snapshot()); }, 120); }
  function fx(pid, kind, text, extra) { var m = { t: 'fx', to: pid, kind: kind, text: text, id: ++G.fxN }; if (extra) m.extra = extra; net.send(m); }

  function snapshot() {
    var it = G.seq[G.qi], q = null, ps = list(), rk = ranked();
    if (it && (G.phase === 'question' || G.phase === 'reveal')) {
      var Q = it.o.q;
      q = { prompt: Q.prompt, options: Q.options, speaker: Q.speaker || it.o.name, type: TYPE[Q.type] || Q.type || '', hint1: Q.hint1, hint2: Q.hint2,
        answer: G.phase === 'reveal' ? Q.answer : -1, explain: G.phase === 'reveal' ? Q.explain : '', word: G.phase === 'reveal' ? it.o.word : '', clue: G.phase === 'reveal' ? it.o.clue : '' };
    }
    var rit = G.phase === 'room' ? G.seq[G.qi + 1] : it, room = rit ? G.rooms[rit.ri] : (G.rooms[0] || {});
    return { t: 'state', code: CODE, ph: G.phase, paused: G.paused, adv: G.adventure, qi: G.qi, qn: G.seq.length, elapsed: G.elapsed, tt: SET.totalTimer,
      timer: G.timer ? { k: G.timer.kind, r: G.timer.remain, tot: G.timer.total } : null,
      room: { name: room.name || '', intro: room.intro || '', n: rit ? rit.ri + 1 : 1 }, q: q, story: G.phase === 'story' ? G.storyStep || 0 : 0,
      untilCards: SET.cardEvery - ((G.qi + 1) % SET.cardEvery), cardEvery: SET.cardEvery, maxP: MAX,
      players: ps.map(function (p) {
        return { pid: p.pid, name: p.name, g: p.gender, seed: p.seed, score: p.score, rank: rk.indexOf(p) + 1, cards: p.cards, next: Object.keys(p.next || {}),
          cur: p.cur ? { t: p.cur.tries, d: p.cur.done, c: p.cur.correct, pts: p.cur.pts, b: p.cur.bonus, sp: p.cur.sp, rm: p.cur.removed, sk: p.cur.skip, fz: p.cur.frozen, sc: p.cur.second } : null,
          delta: p.delta || 0, rd: p.rankDelta || 0, correct: p.correct, wrong: p.wrong, streak: p.streak, on: online(p) };
      }),
      merchant: G.merchant ? { stock: G.merchant.stock, done: Object.keys(G.merchant.done) } : null,
      turn: G.turn ? { order: G.turn.order, idx: G.turn.idx } : null,
      effect: G.effect, fairy: G.fairy && G.fairy.shown ? G.fairy : null, ultimate: G.ultimate,
      settings: { qTimer: SET.qTimer, qSeconds: SET.qSeconds, repeat: SET.repeat } };
  }

  function onUp(d) {
    if (!d || !d.pid) return;
    var p = G.players[d.pid];
    if (d.t === 'hello') {
      if (!p) {
        if (list().length >= MAX) return fx(d.pid, 'full', '這場冒險已經有 ' + MAX + ' 位勇者，人數滿了。');
        var nm = String(d.name || '勇者').trim().slice(0, 10) || '勇者';
        p = G.players[d.pid] = { pid: d.pid, name: nm, gender: d.gender === 'f' ? 'f' : 'm', seed: (Math.random() * 2147483647) | 0, joined: ++G.joinN,
          score: 0, cards: [], correct: 0, wrong: 0, streak: 0, best: 0, next: {}, cur: null, delta: 0, room: {}, lastSeen: Date.now() };
        if (G.phase === 'question') p.cur = freshCur(p);
        WQSfx.play('join');
        if (G.phase === 'lobby') render(); else liveUpdate();
      }
      p.lastSeen = Date.now(); push(); return;
    }
    if (!p) return fx(d.pid, 'gone', '請重新加入冒險。');
    p.lastSeen = Date.now();
    if (d.t === 'ping') return;
    if (G.paused && d.t !== 'leave') return fx(p.pid, 'info', '老師暫停中，請稍等一下。');
    if (d.t === 'ans') answer(p, +d.k, +d.qi);
    else if (d.t === 'buy') buy(p, d.card);
    else if (d.t === 'tradeDone') { if (G.merchant) { G.merchant.done[p.pid] = 1; G.merchant.feed.push(p.name + ' 完成交易'); renderMerchantFeed(); push(); checkMerchantDone(); } }
    else if (d.t === 'use') useCard(p, d.card, d.target);
    else if (d.t === 'pass') { if (G.turn && G.turn.order[G.turn.idx] === p.pid && !G.effect) { G.effect = { n: ++G.fxN, by: p.pid, pass: true, title: '', lines: [p.name + ' 選擇不使用魔法卡。'] }; startTimer('effect', 1800); renderCards(); push(); } }
  }

  /* ---------- 計時（暫停時全部停止） ---------- */
  function startTimer(kind, ms) { G.timer = { kind: kind, remain: ms, total: ms }; }
  var last = performance.now(), lastSec = -1;
  setInterval(function () {
    var now = performance.now(), dt = now - last; last = now;
    if (G.paused) return;
    if (['lobby', 'end', 'gate'].indexOf(G.phase) < 0) G.elapsed += dt;
    if (G.phase === 'question' && G.q) G.q.ms += dt;
    if (G.timer) {
      G.timer.remain -= dt;
      if (G.timer.remain <= 0) { var k = G.timer.kind; G.timer = null; timeout(k); }
    }
    var sec = Math.floor(G.elapsed / 1000) + (G.timer ? Math.ceil(G.timer.remain / 1000) * 1000 : 0);
    if (sec !== lastSec) { lastSec = sec; liveUpdate(); push(); if (G.timer && G.timer.kind === 'q' && G.timer.remain < 5500) WQSfx.play('tick'); }
  }, 100);
  function timeout(k) {
    if (k === 'q') reveal();
    else if (k === 'merchant') endMerchant();
    else if (k === 'turn') { var p = G.players[G.turn.order[G.turn.idx]]; G.effect = { n: ++G.fxN, by: p ? p.pid : '', pass: true, title: '', lines: [(p ? p.name : '勇者') + ' 時間到，這回合沒有使用魔法卡。'] }; startTimer('effect', 1800); renderCards(); push(); }
    else if (k === 'effect') nextTurn();
    else if (k === 'reveal-auto') { }
  }
  $('h-pause').addEventListener('click', function () {
    WQSfx.on(); G.paused = !G.paused; $('h-pause').textContent = G.paused ? '▶ 繼續' : '⏸ 暫停'; $('h-pause').classList.toggle('on', G.paused);
    $('pause-veil').classList.toggle('hidden', !G.paused); push();
  });

  /* ---------- 頂端資訊 ---------- */
  function liveUpdate() {
    var it = G.seq[G.qi], mid = $('h-mid'); mid.innerHTML = '';
    $('h-left').textContent = G.phase === 'lobby' ? '多人闖關・勇者集合' : ('第 ' + G.adventure + ' 段冒險' + (it ? '・第 ' + (G.qi + 1) + ' / ' + G.seq.length + ' 關・' + G.rooms[it.ri].short : ''));
    if (SET.totalTimer && G.phase !== 'lobby') mid.appendChild(el('span', 'pill', '⏱ 總時間 ' + fmt(G.elapsed)));
    if (G.timer && G.timer.kind !== 'effect') { var lowT = G.timer.remain < 5500; mid.appendChild(el('span', 'pill' + (lowT ? ' low' : ''), '⏳ ' + Math.ceil(G.timer.remain / 1000) + ' 秒')); }
    mid.appendChild(el('span', 'pill', '🧙 ' + list().filter(online).length + ' / ' + list().length + ' 位勇者'));
    var ring = $('ring'); if (ring && G.timer && G.timer.kind === 'q') {
      var f = Math.max(0, G.timer.remain / G.timer.total); ring.querySelector('circle.f').setAttribute('stroke-dashoffset', String(339.3 * (1 - f)));
      ring.querySelector('.t').textContent = Math.ceil(G.timer.remain / 1000); ring.classList.toggle('low', G.timer.remain < 5500);
    }
    var st = $('strip'); if (st) updateStrip(st);
    var tt = $('turn-time'); if (tt && G.timer && G.timer.kind === 'turn') tt.textContent = '剩 ' + Math.ceil(G.timer.remain / 1000) + ' 秒';
    var mt = $('m-time'); if (mt && G.timer && G.timer.kind === 'merchant') mt.textContent = '交易時間剩 ' + Math.ceil(G.timer.remain / 1000) + ' 秒';
    if (G.phase === 'lobby') { var rc = $('roster-count'); if (rc) rc.textContent = list().length + ' / ' + MAX + ' 位勇者已加入'; }
  }

  /* ---------- 畫面 ---------- */
  function stage() { var s = $('stage'); s.innerHTML = ''; return s; }
  function render() { liveUpdate(); ({ lobby: renderLobby, story: renderStory, room: renderRoom, question: renderQuestion, reveal: renderReveal, chest: renderChest,
    merchant: renderMerchant, fairy: renderFairy, cards: renderCards, gate: renderGate, end: renderEnd })[G.phase](); }

  function renderLobby() {
    setBg('title'); var s = stage(), lb = el('div', 'lobby');
    var left = el('div', 'panel qr'); left.appendChild(el('div', 'h-title', '掃描加入冒險'));
    var box = el('div', 'qr-box');
    if (net.broker != null) { var q = qrcode(0, 'M'); q.addData(joinUrl()); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
    left.appendChild(box); left.appendChild(el('div', 'mute', '或打開下面的網址，輸入冒險代碼')); left.appendChild(el('div', 'code', CODE));
    var u = el('div', 'url', joinUrl().split('#')[0]); left.appendChild(u);
    var right = el('div', 'panel roster'); right.appendChild(el('div', 'h-title', C.titleMain ? C.titleMain + '：' + (C.titleSub || '') : (C.title || '')));
    right.appendChild(el('div', 'gold', '')).id = 'roster-count';
    var chips = el('div', 'set-chips');
    [('抽 ' + G.seq.length + ' 題'), SET.qTimer ? '每題 ' + SET.qSeconds + ' 秒' : '不限時', SET.totalTimer ? '記錄總時間' : '', '商人 ' + SET.merchantProb + '%・交易 ' + SET.tradeSeconds + ' 秒',
      '精靈 ' + SET.fairyProb + '%', '每 ' + SET.cardEvery + ' 關用一次魔法卡（每人 ' + SET.cardSeconds + ' 秒）', WQSettings.REPEAT_NAMES[SET.repeat]].forEach(function (t) { if (t) chips.appendChild(el('span', '', t)); });
    right.appendChild(chips);
    var grid = el('div', 'roster-grid'); grid.id = 'roster';
    list().forEach(function (p) {
      var h = el('div', 'hero' + (online(p) ? '' : ' off')); h.appendChild(px(p)); h.appendChild(el('div', 'nm', p.name)); h.appendChild(el('div', 'cl', WQPixel.className(p.seed, p.gender)));
      var k = btn('kick', '×', function () { if (confirm('要把「' + p.name + '」移出這場冒險嗎？')) { delete G.players[p.pid]; fx(p.pid, 'kicked', '你已被老師移出這場冒險。'); render(); push(); } }); k.title = '移出'; h.appendChild(k);
      grid.appendChild(h);
    });
    if (!list().length) grid.appendChild(el('div', 'mute', '等待勇者加入中……學生用平板或手機掃描左邊的 QR code，輸入暱稱、選擇性別就會出現在這裡。'));
    right.appendChild(grid);
    var act = el('div', 'lobby-actions');
    act.appendChild(btn('btn btn-gold', '開始冒險', function () { if (!list().length && !confirm('還沒有勇者加入，確定要開始嗎？')) return; G.phase = 'story'; G.storyStep = 0; render(); push(); }, 'h-start'));
    act.appendChild(btn('btn btn-violet', '回冒險篇章', function () { location.href = 'adventure.html'; }));
    right.appendChild(act);
    lb.appendChild(left); lb.appendChild(right); s.appendChild(lb); liveUpdate();
  }

  function renderStory() {
    setBg('title'); var s = stage(), st = C.story || {}, card = el('div', 'parchment');
    if (!G.storyStep) {
      (st.letter || []).forEach(function (line, i) { card.appendChild(el('p', i === 0 ? 'to' : '', line)); });
      if (st.signature) card.appendChild(el('p', 'sig', st.signature));
    } else {
      card.appendChild(el('p', 'slam', st.slam || ''));
      var row = el('div', 'story-cat'), im = el('img'); im.src = img('cat'); row.appendChild(im); row.appendChild(el('p', '', st.cat || '')); card.appendChild(row);
    }
    var w = el('div', 'scene'); w.appendChild(card);
    w.appendChild(btn('btn btn-gold', G.storyStep ? '開始冒險' : '推開大門', function () {
      if (!G.storyStep) { G.storyStep = 1; WQSfx.file('door', .9); setTimeout(function () { WQSfx.file('meow', .7); }, 1100); render(); }
      else gotoNext();
    }, 'h-next'));
    s.appendChild(w);
  }

  function renderRoom() {
    var it = G.seq[G.qi + 1], r = G.rooms[it.ri]; setBg(r.bg);
    var s = stage(), c = el('div', 'panel intro-card'); c.style.maxWidth = '760px';
    c.appendChild(el('div', '', '第 ' + (it.ri + 1) + ' 個房間')).id = 'ri-num';
    c.appendChild(el('h2', '', r.name)).id = 'ri-title';
    var p = el('p', '', r.intro); p.style.fontSize = '22px'; p.style.lineHeight = '1.8'; c.appendChild(p);
    c.appendChild(el('p', 'mute', '這個房間有 ' + r.objects.length + ' 道咒語'));
    c.appendChild(btn('btn btn-gold', '開始第 ' + (G.qi + 2) + ' 關', startQuestion, 'h-next'));
    s.appendChild(c); WQSfx.play('open');
  }

  /* ---------- 題目 ---------- */
  function freshCur(p) {
    var it = G.seq[G.qi], Q = it.o.q, n = p.next || {}, cur = { tries: [], done: false, correct: false, pts: 0, bonus: 0, sp: 0, ms: 0, removed: [], second: !!n.second, frozen: !!n.frozen, lucky: !!n.lucky, skip: !!n.skip, before: p.score };
    if (n.fifty) {
      var wrong = Q.options.map(function (_, k) { return k; }).filter(function (k) { return k !== Q.answer; });
      cur.removed = WQSettings.shuffle(wrong).slice(0, Q.options.length >= 4 ? 2 : 1);
    }
    if (n.skip) { cur.done = true; cur.correct = true; cur.pts = n.frozen ? 0 : 100; p.score += cur.pts; }
    p.next = {};
    return cur;
  }
  function startQuestion() {
    G.qi++; var it = G.seq[G.qi]; G.phase = 'question'; G.q = { ms: 0, order: [] };
    var rk = ranked(); list().forEach(function (p) { p.rankBefore = rk.indexOf(p) + 1; p.cur = freshCur(p); });
    if (SET.qTimer) startTimer('q', SET.qSeconds * 1000); else G.timer = null;
    setBg(G.rooms[it.ri].bg); render(); push(); WQSfx.play('open');
    checkAllDone();
  }
  function answer(p, k, qi) {
    if (G.phase !== 'question' || qi !== G.qi || !p.cur || p.cur.done) return;
    var Q = G.seq[G.qi].o.q, cur = p.cur;
    if (!(k >= 0 && k < Q.options.length) || cur.tries.indexOf(k) >= 0 || cur.removed.indexOf(k) >= 0) return;
    cur.ms = Math.round(G.q.ms);
    if (k === Q.answer) {
      var wrongN = Math.max(0, cur.tries.length - (cur.second ? 1 : 0));
      cur.correct = true; cur.done = true; cur.tries.push(k);
      cur.pts = cur.frozen ? 0 : ([100, 60, 30][wrongN] || 30) + (cur.lucky ? 50 : 0);
      if (!cur.frozen) { G.q.order.push(p.pid); cur.sp = G.q.order.length; cur.bonus = [30, 20, 10][cur.sp - 1] || 0; }
      p.score += cur.pts + cur.bonus;
      fx(p.pid, 'good', cur.frozen ? '答對了！可惜你被冰凍了，這題拿不到分數。' : ('答對了！+' + cur.pts + (cur.bonus ? '，你是第 ' + cur.sp + ' 位答對的勇者，速度加分 +' + cur.bonus : '')));
    } else {
      cur.tries.push(k);
      var eff = cur.tries.length - (cur.second ? 1 : 0), max = Q.options.length > 3 ? 3 : 2;
      if (eff >= max) { cur.done = true; fx(p.pid, 'bad', '這題的機會用完了，等老師公布答案吧。'); }
    }
    updateStrip($('strip')); push(); checkAllDone();
  }
  var doneT = null;
  function checkAllDone() {
    var act = list().filter(online); if (!act.length) return;
    if (act.every(function (p) { return p.cur && p.cur.done; })) { clearTimeout(doneT); doneT = setTimeout(function () { if (G.phase === 'question') reveal(); }, 1200); }
  }
  function updateStrip(st) {
    if (!st) return; var n = 0;
    st.querySelectorAll('.mini').forEach(function (m) { var p = G.players[m.dataset.pid]; var d = p && p.cur && p.cur.done; m.classList.toggle('done', !!d); if (d) n++; });
    var a = $('answered'); if (a) a.textContent = '已完成作答 ' + n + ' / ' + list().length;
  }
  function qHead(it) {
    var o = it.o, Q = o.q, h = el('div', 'qhead'), im = el('img'); im.src = img(o.sprite); if (o.tint) im.style.filter = 'hue-rotate(' + o.tint + 'deg) drop-shadow(0 4px 6px rgba(0,0,0,.6))';
    h.appendChild(im); var t = el('div'); t.appendChild(el('div', 'sp', Q.speaker || o.name)); t.appendChild(el('div', 'mute', '咒語挑戰・' + (TYPE[Q.type] || Q.type || ''))); h.appendChild(t); return h;
  }
  function renderQuestion() {
    var it = G.seq[G.qi], Q = it.o.q, s = stage(), L = el('div', 'qlayout'), c = el('div', 'panel qcard');
    c.appendChild(qHead(it)); c.appendChild(el('div', 'qprompt', Q.prompt));
    var os = el('div', 'hopts'); Q.options.forEach(function (t, k) { var o = el('div', 'hopt'); o.appendChild(el('span', 'k', String(k + 1))); o.appendChild(el('span', '', t)); os.appendChild(o); });
    c.appendChild(os); L.appendChild(c);
    var side = el('div', 'side panel');
    if (SET.qTimer) {
      var ring = el('div', 'ring'); ring.id = 'ring';
      ring.innerHTML = '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="rgba(20,14,40,.7)" stroke="rgba(232,193,90,.25)" stroke-width="10"/><circle class="f" cx="60" cy="60" r="54" fill="none" stroke="#e8c15a" stroke-width="10" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="0"/></svg><div class="t"></div>';
      side.appendChild(ring);
    }
    side.appendChild(el('div', 'answered', '')).id = 'answered';
    var st = el('div', 'strip'); st.id = 'strip';
    list().forEach(function (p) { var m = el('div', 'mini'); m.dataset.pid = p.pid; m.appendChild(px(p)); m.appendChild(el('span', '', p.name)); st.appendChild(m); });
    side.appendChild(st);
    side.appendChild(btn('btn btn-violet', '結束本題、公布答案', function () { reveal(); }, 'h-reveal'));
    L.appendChild(side); s.appendChild(L); updateStrip(st); liveUpdate();
  }

  function reveal() {
    if (G.phase !== 'question') return;
    clearTimeout(doneT); G.timer = null; var it = G.seq[G.qi], Q = it.o.q;
    var res = {};
    list().forEach(function (p) {
      var c = p.cur || freshCur(p); c.done = true;
      if (c.correct) { p.correct++; p.streak++; p.best = Math.max(p.best, p.streak); } else { p.wrong++; p.streak = 0; }
      var rs = p.room[it.ri] || (p.room[it.ri] = { c: 0, n: 0 }); rs.n++; if (c.correct) rs.c++;
      p.delta = p.score - c.before;
      res[p.pid] = { name: p.name, tries: c.tries.slice(), correct: c.correct, pts: c.pts, bonus: c.bonus, sp: c.sp, ms: c.ms, skip: c.skip, frozen: c.frozen };
    });
    var rk = ranked(); list().forEach(function (p) { p.rankDelta = (p.rankBefore || rk.length) - (rk.indexOf(p) + 1); });
    G.log.push({ qi: G.qi, room: G.rooms[it.ri].short, name: it.o.name, word: it.o.word, prompt: Q.prompt, options: Q.options, answer: Q.answer, res: res });
    G.phase = 'reveal'; render(); push(); WQSfx.play('correct');
  }
  function renderReveal() {
    var it = G.seq[G.qi], Q = it.o.q, s = stage(), L = el('div', 'qlayout'), c = el('div', 'panel qcard');
    c.appendChild(qHead(it)); c.appendChild(el('div', 'qprompt', Q.prompt));
    var cnt = Q.options.map(function () { return 0; }); list().forEach(function (p) { if (p.cur) p.cur.tries.forEach(function (k) { cnt[k]++; }); });
    var os = el('div', 'hopts'); Q.options.forEach(function (t, k) { var o = el('div', 'hopt' + (k === Q.answer ? ' correct' : ' dim')); o.appendChild(el('span', 'k', String(k + 1))); o.appendChild(el('span', '', t)); o.appendChild(el('span', 'cnt', cnt[k] + ' 人選')); os.appendChild(o); });
    c.appendChild(os);
    var ex = el('div', 'explain'); ex.appendChild(el('b', 'gold', '咒語「' + it.o.word + '」回到魔法書了！')); ex.appendChild(el('div', '', Q.explain || '')); if (it.o.clue) ex.appendChild(el('div', 'clue', '線索：' + it.o.clue)); c.appendChild(ex);
    L.appendChild(c);
    var m = el('div', 'panel merit'), ps = list(), ok = ps.filter(function (p) { return p.cur && p.cur.correct; });
    m.appendChild(el('h3', '', '勇者功績表'));
    m.appendChild(el('div', '', '答對率 ' + (ps.length ? Math.round(ok.length / ps.length * 100) : 0) + '%（' + ok.length + ' / ' + ps.length + ' 人）'));
    var rt = el('div', 'rate'), ri = el('i'); ri.style.width = (ps.length ? ok.length / ps.length * 100 : 0) + '%'; rt.appendChild(ri); m.appendChild(rt);
    var fast = G.q.order.map(function (id) { return G.players[id]; }).filter(Boolean).slice(0, 3);
    if (fast.length) {
      m.appendChild(el('div', 'gold', '⚡ 最快答對的勇者'));
      var f = el('div', 'fast'); fast.forEach(function (p, i) { var d = el('div', 'f'); d.appendChild(el('b', '', ['🥇', '🥈', '🥉'][i])); d.appendChild(px(p)); d.appendChild(el('span', '', p.name)); d.appendChild(el('b', '', '+' + p.cur.bonus)); f.appendChild(d); });
      m.appendChild(f);
    }
    var hot = ps.filter(function (p) { return p.streak >= 3; }).sort(function (a, b) { return b.streak - a.streak; })[0];
    if (hot) m.appendChild(el('div', '', '🔥 ' + hot.name + ' 連續答對 ' + hot.streak + ' 題！'));
    m.appendChild(board(10));
    var nx = el('div', 'next-row'); nx.appendChild(btn('btn btn-gold', G.qi < G.seq.length - 1 ? '繼續冒險' : '前往最後的大門', afterReveal, 'h-next')); m.appendChild(nx);
    L.appendChild(m); s.appendChild(L);
  }
  function board(n) {
    var b = el('div', 'board');
    ranked().slice(0, n).forEach(function (p, i) {
      var r = el('div', 'brow'); r.style.animationDelay = i * .05 + 's';
      r.appendChild(el('span', 'r', String(i + 1))); r.appendChild(px(p)); r.appendChild(el('span', '', p.name)); r.appendChild(el('span', 'sc', String(p.score)));
      var d = el('span', 'd ' + (p.delta > 0 ? 'up' : (p.delta < 0 ? 'down' : '')), (p.delta > 0 ? '+' : '') + (p.delta || 0) + (p.rankDelta > 0 ? ' ▲' + p.rankDelta : (p.rankDelta < 0 ? ' ▼' + (-p.rankDelta) : '')));
      r.appendChild(d); b.appendChild(r);
    });
    return b;
  }

  /* ---------- 關卡之間：寶箱 → 商人 → 精靈 → 魔法卡 ---------- */
  function afterReveal() {
    var last = G.qi >= G.seq.length - 1, it = G.seq[G.qi], nx = G.seq[G.qi + 1];
    G.queue = [];
    if (last) { G.queue.push('gate'); return gotoNext(); }
    if (nx.ri !== it.ri) G.queue.push('chest');
    var cheap = WQCards.cheapest();
    if (list().some(function (p) { return p.score >= cheap && p.cards.length < WQCards.HAND_MAX; }) && Math.random() * 100 < SET.merchantProb) G.queue.push('merchant');
    if ((G.qi + 1) % SET.cardEvery === 0) {
      if (list().length && Math.random() * 100 < SET.fairyProb) G.queue.push('fairy');
      G.queue.push('cards');
    }
    gotoNext();
  }
  function gotoNext() {
    G.timer = null; G.effect = null;
    var nxt = G.queue.shift();
    if (nxt === 'chest') return openChest();
    if (nxt === 'merchant') return openMerchant();
    if (nxt === 'fairy') return openFairy();
    if (nxt === 'cards') return openCards();
    if (nxt === 'gate') { G.phase = 'gate'; render(); push(); return; }
    var it = G.seq[G.qi], n = G.seq[G.qi + 1];
    if (!n) { G.phase = 'gate'; render(); push(); return; }
    if (!it || n.ri !== it.ri) { G.phase = 'room'; render(); push(); return; }
    startQuestion();
  }

  function openChest() {
    var it = G.seq[G.qi], r = G.rooms[it.ri], got = [];
    list().forEach(function (p) {
      var rs = p.room[it.ri]; if (!rs || rs.c < Math.ceil(rs.n / 2) || p.cards.length >= WQCards.HAND_MAX) return;
      var id = WQCards.randomCard(); p.cards.push(id); got.push(p); fx(p.pid, 'good', '通關寶箱：你得到一張「' + WQCards.get(id).name + '」！', { card: id });
    });
    G.chest = { rune: r.rune, room: r.name, got: got.map(function (p) { return p.pid; }) };
    G.phase = 'chest'; render(); push(); WQSfx.play('rune');
  }
  function renderChest() {
    var s = stage(), w = el('div', 'scene'), ch = G.chest;
    var rb = el('div', 'rune-big', ch.rune); w.appendChild(rb);
    w.appendChild(el('div', 'h-title', '「' + ch.room + '」破關！取得「' + ch.rune + '符文」'));
    var pz = G.rooms[G.seq[G.qi].ri].puzzle; if (pz && pz.success) w.appendChild(el('div', 'say', pz.success));
    w.appendChild(el('div', 'gold', ch.got.length ? '🎁 這個房間答對一半以上的勇者，打開了通關寶箱，各得到一張魔法卡：' : '這個房間沒有勇者答對一半以上，寶箱沒有打開……'));
    var f = el('div', 'roulette'); ch.got.forEach(function (id) { var p = G.players[id]; if (!p) return; var m = el('div', 'mini pick'); m.appendChild(px(p)); m.appendChild(el('span', '', p.name)); f.appendChild(m); }); w.appendChild(f);
    w.appendChild(btn('btn btn-gold', '繼續', gotoNext, 'h-next'));
    s.appendChild(w);
    setTimeout(function () { var r = rb.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + r.height / 2, 36); }, 400);
  }

  function openMerchant() {
    var max = Math.max.apply(null, list().map(function (p) { return p.score; }).concat([0]));
    G.merchant = { stock: WQCards.stock(max), done: {}, feed: [] }; G.phase = 'merchant'; startTimer('merchant', SET.tradeSeconds * 1000);
    render(); push(); WQSfx.play('magic');
  }
  function buy(p, id) {
    var M = G.merchant, c = WQCards.get(id);
    if (G.phase !== 'merchant' || !M || !c || M.stock.indexOf(id) < 0 || M.done[p.pid]) return;
    if (p.score < c.price) return fx(p.pid, 'bad', '分數不夠買「' + c.name + '」。');
    if (p.cards.length >= WQCards.HAND_MAX) return fx(p.pid, 'bad', '道具袋滿了（最多 ' + WQCards.HAND_MAX + ' 張）。');
    p.score -= c.price; p.cards.push(id); fx(p.pid, 'good', '買到了「' + c.name + '」！', { card: id });
    M.feed.push(p.name + ' 買了一張魔法卡 🛒'); renderMerchantFeed(); WQSfx.play('coin'); push();
  }
  function checkMerchantDone() {
    var act = list().filter(online), M = G.merchant;
    if (M && act.length && act.every(function (p) { return M.done[p.pid] || p.score < WQCards.cheapest() || p.cards.length >= WQCards.HAND_MAX; })) endMerchant();
  }
  function endMerchant() { if (G.phase !== 'merchant') return; G.merchant = null; G.timer = null; gotoNext(); }
  function renderMerchant() {
    var s = stage(), w = el('div', 'scene'), M = G.merchant;
    var npc = el('div', 'npc merchant'), im = el('img'); im.src = img('wizard'); npc.appendChild(im); w.appendChild(npc);
    w.appendChild(el('div', 'h-title', '神祕的魔法卡商人出現了！'));
    w.appendChild(el('div', 'say', '嘿嘿嘿……勇者們，用你們的分數來換魔法卡吧！在自己的裝置上挑選要買的卡片，時間有限喔！'));
    var cs = el('div', 'cards'); M.stock.forEach(function (id) { cs.appendChild(cardEl(id, true)); }); w.appendChild(cs);
    w.appendChild(el('div', 'pill', '')).id = 'm-time';
    var feed = el('div', 'feed'); feed.id = 'm-feed'; w.appendChild(feed);
    w.appendChild(btn('btn btn-violet', '商人離開（結束交易）', endMerchant, 'h-next'));
    s.appendChild(w); renderMerchantFeed(); liveUpdate();
  }
  function renderMerchantFeed() { var f = $('m-feed'); if (!f || !G.merchant) return; f.innerHTML = ''; G.merchant.feed.slice(-12).forEach(function (t) { f.appendChild(el('span', '', t)); }); }
  function cardEl(id, price) {
    var c = WQCards.get(id), d = el('div', 'mcard'); d.style.setProperty('--c', c.color);
    d.appendChild(el('div', 'ic', c.icon)); d.appendChild(el('div', 'nm', c.name)); d.appendChild(el('div', 'ds', c.desc));
    if (price) d.appendChild(el('div', 'pr', c.price + ' 分'));
    if (c.kind === 'passive') d.appendChild(el('span', 'tag', '自動生效'));
    return d;
  }

  function openFairy() {
    var ps = list(); if (!ps.length) return gotoNext();
    var p = WQCards.fairyPick(ps, G.fairyPicked); G.fairyPicked.push(p.pid);
    var before = p.score, res = WQCards.fairyFate(p, ps);
    G.fairy = { pid: p.pid, name: p.name, fate: res.fate, title: res.title, line: res.line, card: res.card || null, shown: false, before: before };
    G.phase = 'fairy'; render(); push(); WQSfx.play('fairy');
  }
  function renderFairy() {
    var s = stage(), w = el('div', 'scene'), F = G.fairy;
    w.appendChild(el('div', 'fairy', '🧚'));
    w.appendChild(el('div', 'h-title', '森林精靈飛進古堡了！'));
    var say = el('div', 'say', '嘻嘻，我要選一位勇者，給他改變命運的機會……'); w.appendChild(say);
    var rl = el('div', 'roulette'), minis = {};
    list().forEach(function (p) { var m = el('div', 'mini'); m.appendChild(px(p)); m.appendChild(el('span', '', p.name)); rl.appendChild(m); minis[p.pid] = m; });
    w.appendChild(rl);
    var fate = el('div', 'fate'); w.appendChild(fate);
    var nx = btn('btn btn-gold', '繼續', gotoNext, 'h-next'); nx.classList.add('hidden'); w.appendChild(nx);
    s.appendChild(w);
    var ids = Object.keys(minis), k = 0, steps = 18 + Math.floor(Math.random() * 6);
    if (F.shown) return finish();
    (function spin() {
      ids.forEach(function (id) { minis[id].classList.remove('hl'); }); minis[ids[k % ids.length]].classList.add('hl'); WQSfx.play('tick'); k++;
      if (k < steps) setTimeout(spin, 80 + k * 12); else finish();
    })();
    function finish() {
      ids.forEach(function (id) { minis[id].classList.remove('hl'); }); if (minis[F.pid]) minis[F.pid].classList.add('pick');
      say.textContent = '精靈選中了「' + F.name + '」！'; fate.textContent = F.title.replace('你', F.name + ' ');
      fate.appendChild(el('div', 'gold', F.line)); nx.classList.remove('hidden');
      if (!F.shown) { F.shown = true; push(); fx(F.pid, /half|lose/.test(F.fate) ? 'bad' : 'good', '🧚 精靈選中你了！' + F.title + ' ' + F.line, { fairy: F.fate }); WQSfx.play(/half|lose/.test(F.fate) ? 'bad' : 'fairy'); }
      var r = fate.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top, 30);
    }
  }

  function openCards() {
    var ps = list(), order = ranked().filter(function (p) { return online(p) && WQCards.usable(p, ps).length; }).map(function (p) { return p.pid; });
    if (!order.length) return gotoNext();
    G.turn = { order: order, idx: 0 }; G.effect = null; G.phase = 'cards'; startTimer('turn', SET.cardSeconds * 1000);
    render(); push(); WQSfx.play('magic');
  }
  function nextTurn() {
    G.effect = null; if (!G.turn) return gotoNext();
    G.turn.idx++;
    while (G.turn.idx < G.turn.order.length) { var p = G.players[G.turn.order[G.turn.idx]]; if (p && WQCards.usable(p, list()).length) break; G.turn.idx++; }
    if (G.turn.idx >= G.turn.order.length) { G.turn = null; return gotoNext(); }
    startTimer('turn', SET.cardSeconds * 1000); renderCards(); push();
  }
  function useCard(p, id, target) {
    if (G.phase !== 'cards' || !G.turn || G.turn.order[G.turn.idx] !== p.pid || G.effect) return;
    if (WQCards.usable(p, list()).indexOf(id) < 0) return fx(p.pid, 'bad', '這張卡現在不能使用。');
    var res = WQCards.apply(id, p, list(), target);
    G.effect = { n: ++G.fxN, by: p.pid, card: id, title: res.title, lines: res.lines, dice: res.dice || 0 };
    Object.keys(res.hit).forEach(function (pid) { fx(pid, /擋下|反彈|送給你|搶到/.test(res.hit[pid]) ? 'good' : 'bad', res.hit[pid]); });
    WQSfx.play(['storm', 'thunder', 'freeze', 'steal', 'swap1'].indexOf(id) >= 0 ? 'bad' : 'magic');
    startTimer('effect', 4500); renderCards(); push();
  }
  function renderCards() {
    if (G.phase !== 'cards') return;
    var s = stage(), w = el('div', 'scene'), T = G.turn, cp = T && G.players[T.order[T.idx]];
    w.appendChild(el('div', 'h-title', '✨ 魔法卡時刻 ✨'));
    var od = el('div', 'order');
    T.order.forEach(function (id, i) { var p = G.players[id]; if (!p) return; var o = el('div', 'o' + (i === T.idx ? ' cur' : (i < T.idx ? ' past' : ''))); o.appendChild(px(p)); o.appendChild(el('span', '', (i + 1) + '. ' + p.name)); od.appendChild(o); });
    w.appendChild(od);
    if (G.effect && !G.effect.pass) {
      var e = el('div', 'effect'), by = G.players[G.effect.by];
      e.appendChild(el('div', 'gold', (by ? by.name : '') + ' 發動了魔法卡！'));
      e.appendChild(cardEl(G.effect.card));
      if (G.effect.dice) e.appendChild(el('div', 'dice', ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][G.effect.dice - 1]));
      var ln = el('div', 'lines'); G.effect.lines.forEach(function (l) { ln.appendChild(el('div', '', l)); }); e.appendChild(ln);
      w.appendChild(e);
      setTimeout(function () { var r = e.getBoundingClientRect(); sparks(r.left + r.width / 2, r.top + 120, 40); }, 300);
    } else if (G.effect) {
      w.appendChild(el('div', 'say', G.effect.lines[0]));
    } else if (cp) {
      var cur = el('div', 'p-me'); cur.appendChild(px(cp)); w.appendChild(cur);
      w.appendChild(el('div', 'say', '現在輪到第 ' + (rankOf(cp)) + ' 名的「' + cp.name + '」選擇魔法卡……（其他勇者看不到他要用哪一張）'));
      w.appendChild(el('div', 'pill', '')).id = 'turn-time';
      w.appendChild(btn('btn btn-violet', '跳過這位勇者', function () { G.timer = null; timeout('turn'); }, 'h-skip'));
    }
    var b = board(8); b.style.width = 'min(560px,100%)'; w.appendChild(b);
    s.appendChild(w); liveUpdate();
  }

  /* ---------- 最後的大門與結算 ---------- */
  function renderGate() {
    setBg('gate'); var s = stage(), w = el('div', 'panel'), G2 = C.gate || {}; w.style.textAlign = 'center'; w.style.maxWidth = '900px';
    w.appendChild(el('div', 'h-title', '最後的大門')); w.appendChild(el('p', '', G2.intro || ''));
    var sl = el('div', 'gate-slots'); sl.style.gridTemplateColumns = 'repeat(' + Math.min(G.rooms.length, 6) + ',1fr)';
    var holes = G.rooms.map(function (r) { var d = el('div', 'gslot'); d.appendChild(el('div', 'hole')); d.appendChild(el('span', '', r.short)); sl.appendChild(d); return d; });
    w.appendChild(sl); s.appendChild(w);
    G.rooms.forEach(function (r, i) { setTimeout(function () { holes[i].classList.add('filled'); holes[i].querySelector('.hole').textContent = r.rune; WQSfx.play('tap'); var b = holes[i].getBoundingClientRect(); sparks(b.left + b.width / 2, b.top + 30, 12); }, 600 + i * 500); });
    setTimeout(function () {
      WQSfx.play('gate'); setTimeout(function () { WQSfx.file('door', .6); }, 900);
      var m = el('p', 'gold', G2.success || ''); m.style.fontWeight = '700'; w.appendChild(m);
      setTimeout(finishAdventure, 3200);
    }, 900 + G.rooms.length * 500);
  }
  function finishAdventure() {
    if (G.phase !== 'gate') return;
    if (SET.repeat === 'norepeat') { G.keys.forEach(function (k) { if (G.used.indexOf(k) < 0) G.used.push(k); }); G.ultimate = G.used.length >= ALLQ; }
    G.phase = 'end'; render(); push(); WQSfx.play('fanfare'); confetti();
  }
  function podium(top, mini) {
    var pd = el('div', 'podium' + (mini ? ' mini-pod' : ''));
    [1, 0, 2].forEach(function (i) {
      var p = top[i]; if (!p) return;
      var d = el('div', 'pod p' + (i + 1)); if (i === 0) d.appendChild(el('div', 'crown', '👑'));
      d.appendChild(px(p)); d.appendChild(el('div', 'nm', p.name)); d.appendChild(el('div', 'sc', p.score + ' 分'));
      d.appendChild(el('div', 'blk', String(i + 1))); pd.appendChild(d);
    });
    return pd;
  }
  function renderEnd() {
    setBg('gate'); var s = stage(), w = el('div', 'scene'), rk = ranked();
    w.appendChild(el('div', 'h-title', G.ultimate ? '🏆 終極破關！所有咒語都找回來了！' : (C.endTitle || '闖關成功！')));
    w.appendChild(podium(rk.slice(0, 3)));
    var info = el('div', 'set-chips');
    if (SET.totalTimer) info.appendChild(el('span', '', '過關總時間 ' + fmt(G.elapsed)));
    info.appendChild(el('span', '', '共 ' + G.seq.length + ' 關、' + list().length + ' 位勇者'));
    var allC = 0, allN = 0; list().forEach(function (p) { allC += p.correct; allN += p.correct + p.wrong; }); info.appendChild(el('span', '', '全體答對率 ' + (allN ? Math.round(allC / allN * 100) : 0) + '%'));
    w.appendChild(info);
    var t = el('table', 't'); t.style.maxWidth = '760px';
    t.innerHTML = '<thead><tr><th>名次</th><th></th><th>勇者</th><th>分數</th><th>答對</th><th>答錯</th><th>最多連續答對</th></tr></thead>';
    var tb = el('tbody'); rk.forEach(function (p, i) { var tr = el('tr'); [String(i + 1), '', p.name, String(p.score), String(p.correct), String(p.wrong), String(p.best)].forEach(function (v, j) { var td = el('td', '', v); if (j === 1) td.appendChild(px(p)); tr.appendChild(td); }); tb.appendChild(tr); });
    t.appendChild(tb); var tw = el('div', 'panel'); tw.style.maxHeight = '32vh'; tw.style.overflow = 'auto'; tw.appendChild(t); w.appendChild(tw);
    var act = el('div', 'lobby-actions');
    if (SET.repeat !== 'none') {
      w.appendChild(el('div', 'say', G.ultimate ? '所有題目都出現過了！要重新開始一段全新的冒險嗎？' : '勇者們，是否願意接受另一段冒險？' + (SET.repeat === 'norepeat' ? '（還有 ' + (ALLQ - G.used.length) + ' 題沒出現過）' : '')));
      act.appendChild(btn('btn btn-gold', '接受另一段冒險！', function () { if (G.ultimate) G.used = []; G.adventure++; newAdventure(); G.queue = []; gotoNext(); }, 'h-again'));
    }
    act.appendChild(btn('btn btn-violet', '📜 勇者闖關記錄', openLog));
    act.appendChild(btn('btn btn-violet', '回到首頁', function () { if (confirm('離開後這場多人冒險就會結束，確定嗎？')) location.href = 'index.html'; }));
    w.appendChild(act); s.appendChild(w);
  }
  function confetti() {
    var cols = ['#e8c15a', '#f28c28', '#8f6fe0', '#7ee2a8', '#ff8a80', '#6fc7ff'];
    for (var i = 0; i < 80; i++) { var c = el('div', 'confetti'); c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length]; c.style.animationDuration = 2.5 + Math.random() * 2.5 + 's'; c.style.animationDelay = Math.random() * 1.5 + 's'; c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px'); document.body.appendChild(c); setTimeout(c.remove.bind(c), 6500); }
  }
  function sparks(x, y, n) {
    for (var i = 0; i < n; i++) { var s = el('div', 'spark'), a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 120; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r + 'px'); $('fx').appendChild(s); setTimeout(s.remove.bind(s), 950); }
  }

  /* ---------- 勇者闖關記錄（只能看，不能改） ---------- */
  var logTab = 'sum', logQ = -1;
  function openLog() { $('h-log').classList.remove('hidden'); renderLog(); }
  $('h-logbtn').addEventListener('click', function () { WQSfx.on(); openLog(); });
  $('log-close').addEventListener('click', function () { $('h-log').classList.add('hidden'); });
  $('tab-sum').addEventListener('click', function () { logTab = 'sum'; renderLog(); });
  $('tab-q').addEventListener('click', function () { logTab = 'q'; renderLog(); });
  function renderLog() {
    $('tab-sum').classList.toggle('on', logTab === 'sum'); $('tab-q').classList.toggle('on', logTab === 'q');
    var b = $('log-body'); b.innerHTML = '';
    if (logTab === 'sum') {
      var t = el('table', 't'); t.innerHTML = '<thead><tr><th>名次</th><th></th><th>勇者</th><th>分數</th><th>答對</th><th>答錯</th><th>連續答對</th><th>魔法卡</th><th>連線</th></tr></thead>';
      var tb = el('tbody');
      ranked().forEach(function (p, i) {
        var tr = el('tr');
        [String(i + 1), '', p.name, String(p.score), String(p.correct), String(p.wrong), p.streak + '（最多 ' + p.best + '）', p.cards.map(function (id) { return WQCards.get(id).icon; }).join(' ') || '—', online(p) ? '🟢' : '⚪'].forEach(function (v, j) { var td = el('td', '', v); if (j === 1) td.appendChild(px(p)); tr.appendChild(td); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); b.appendChild(t);
      if (!list().length) b.appendChild(el('p', 'mute', '還沒有勇者加入。'));
      return;
    }
    if (!G.log.length) { b.appendChild(el('p', 'mute', '還沒有公布答案的題目。每一題公布答案後，就可以在這裡回顧每位勇者的作答。')); return; }
    if (logQ < 0 || logQ >= G.log.length) logQ = G.log.length - 1;
    var ql = el('div', 'qlist'); G.log.forEach(function (e, i) { var x = el('button', i === logQ ? 'on' : '', '第 ' + (e.qi + 1) + ' 關・' + e.word); x.type = 'button'; x.onclick = function () { logQ = i; renderLog(); }; ql.appendChild(x); }); b.appendChild(ql);
    var e = G.log[logQ];
    b.appendChild(el('p', '', e.room + '・' + e.name + '：' + e.prompt));
    b.appendChild(el('p', 'gold', '正確答案：' + (e.answer + 1) + '. ' + e.options[e.answer]));
    var t2 = el('table', 't'); t2.innerHTML = '<thead><tr><th>勇者</th><th>作答過程</th><th>結果</th><th>得分</th><th>速度加分</th><th>用時</th></tr></thead>';
    var tb2 = el('tbody');
    Object.keys(e.res).forEach(function (pid) {
      var r = e.res[pid], tr = el('tr'); tr.appendChild(el('td', '', r.name));
      var tt = el('td', 'tries');
      if (r.skip) tt.appendChild(el('span', 'y', '🌀 傳送門卡自動過關'));
      r.tries.forEach(function (k) { tt.appendChild(el('span', k === e.answer ? 'y' : '', (k + 1) + '. ' + e.options[k])); });
      if (!r.tries.length && !r.skip) tt.appendChild(el('span', '', '沒有作答'));
      tr.appendChild(tt);
      tr.appendChild(el('td', r.correct ? 'ok' : 'ng', r.correct ? '✔ 答對' + (r.frozen ? '（冰凍）' : '') : '✘ 未答對'));
      tr.appendChild(el('td', '', String(r.pts))); tr.appendChild(el('td', '', r.bonus ? '+' + r.bonus + '（第 ' + r.sp + ' 位）' : '—'));
      tr.appendChild(el('td', '', r.ms ? (r.ms / 1000).toFixed(1) + ' 秒' : '—'));
      tb2.appendChild(tr);
    });
    t2.appendChild(tb2); b.appendChild(t2);
  }

  window.addEventListener('beforeunload', function (e) { if (G.phase !== 'lobby' && G.phase !== 'end') { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('click', function () { WQSfx.on(); }, { once: true });
  window.__host = G; // 測試用
  render();
})();
