/* 多人闖關：學生裝置 */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(c, x, fn) { var b = el('button', c, x); b.type = 'button'; b.addEventListener('click', function () { WQSfx.on(); fn(b); }); return b; }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  $('p-bg').style.backgroundImage = 'url("img/title.webp")';
  document.querySelectorAll('.motes').forEach(function (m) { for (var i = 0; i < 10; i++) { var d = el('div', 'mote'); d.style.left = Math.random() * 100 + '%'; d.style.animationDuration = 9 + Math.random() * 12 + 's'; d.style.animationDelay = -Math.random() * 20 + 's'; d.style.setProperty('--sway', (Math.random() * 80 - 40) + 'px'); m.appendChild(d); } });

  var hp = {}; location.hash.replace(/^#/, '').split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) hp[a[0]] = decodeURIComponent(a[1] || ''); });
  var KEY = 'wordQuestPlayer', saved = null, store = null;
  try { store = WQNet.LOCAL ? sessionStorage : localStorage; saved = JSON.parse(store.getItem(KEY) || 'null'); } catch (e) {}
  var code = (hp.r || '').toUpperCase(), broker = hp.b != null && hp.b !== '' ? +hp.b : (saved && saved.code === code ? saved.b : 0);
  var me = { pid: null, name: '', gender: 'm' }, net = null, S = null, recvAt = 0, joined = false, sig = '', mine = null;

  /* ---------- 加入 ---------- */
  function joinForm(msg) {
    var m = $('p-main'); m.innerHTML = '';
    var c = el('div', 'p-card'); c.appendChild(el('h2', '', '加入多人闖關'));
    if (msg) c.appendChild(el('p', 'gold', msg));
    var f = el('div', 'join');
    /* 掃 QR code 或用分享連結進來，都要自己輸入大螢幕上的冒險代碼，避免別人亂連線 */
    var ci = el('input'); ci.placeholder = '冒險代碼（看老師的大螢幕）'; ci.value = ''; ci.maxLength = 5; ci.autocapitalize = 'characters'; ci.autocomplete = 'off'; ci.id = 'j-code';
    f.appendChild(ci);
    f.appendChild(el('div', '', '選擇勇者的性別，系統會送你一位有名字的 8 位元像素勇者。'));
    var g = el('div', 'g'), gm = btn('on', '👦 男生', function () { me.gender = 'm'; gm.classList.add('on'); gf.classList.remove('on'); }), gf = btn('', '👧 女生', function () { me.gender = 'f'; gf.classList.add('on'); gm.classList.remove('on'); });
    gm.id = 'j-m'; gf.id = 'j-f';
    if (saved && saved.gender === 'f') { me.gender = 'f'; gf.classList.add('on'); gm.classList.remove('on'); }
    g.appendChild(gm); g.appendChild(gf); f.appendChild(g);
    f.appendChild(btn('btn btn-gold', '加入冒險', function () {
      var cd = ci.value.trim().toUpperCase();
      if (cd.length < 4) return toast('請輸入老師大螢幕上的冒險代碼。', 'bad');
      code = cd;
      try { history.replaceState(null, '', location.pathname + location.search + '#r=' + code + '&b=' + broker); } catch (e) {} me.pid = (saved && saved.code === cd && saved.pid) || ('p' + Math.random().toString(36).slice(2, 10));
      save(); connect();
    })).id = 'j-go';
    c.appendChild(f); m.appendChild(c);
  }
  function save() { try { store.setItem(KEY, JSON.stringify({ code: code, pid: me.pid, gender: me.gender, b: broker })); } catch (e) {} }
  function connect() {
    if (net) net.close();
    msgCard('正在連線到老師的電腦……', '請稍等，連上後你的像素勇者就會出現。');
    clearTimeout(connect.t); var cc = code;
    connect.t = setTimeout(function () { if (!joined && code === cc) { if (net) net.close(); net = null; joinForm('找不到冒險代碼「' + cc + '」，請再看一次大螢幕上的代碼。'); } }, 12000);
    net = WQNet.open({ code: code, role: 'player', broker: broker, onMessage: onDown, onStatus: function (s) {
      if (s === 'online') hello(); var st = $('net-st'); if (st) st.textContent = s === 'online' ? '' : '連線中…';
    } });
  }
  function hello() { net.send({ t: 'hello', pid: me.pid, gender: me.gender }); }
  setInterval(function () { if (!net) return; if (!joined) hello(); else net.send({ t: 'ping', pid: me.pid }); }, 5000);
  function send(t, extra) { var d = { t: t, pid: me.pid }; Object.keys(extra || {}).forEach(function (k) { d[k] = extra[k]; }); net.send(d); }

  function onDown(d) {
    if (d.t === 'fx') { if (d.to !== me.pid) return; return onFx(d); }
    if (d.t !== 'state' || d.code !== code) return;
    S = d; recvAt = performance.now();
    mine = S.players.filter(function (p) { return p.pid === me.pid; })[0];
    if (!mine) { joined = false; hello(); if (!S.players.length || true) msgCard('正在加入冒險……', ''); return; }
    if (!joined) { joined = true; WQSfx.play('join'); }
    render(); sidBox();
  }
  var lastFx = 0;
  function onFx(d) {
    if (d.id && d.id <= lastFx) return; lastFx = d.id || lastFx;
    if (d.kind === 'full') { joined = false; net.close(); net = null; return joinForm(d.text); }
    if (d.kind === 'kicked') { joined = false; net.close(); net = null; try { store.removeItem(KEY); } catch (e) {} saved = null; return joinForm(d.text); }
    if (d.kind === 'gone') { hello(); return; }
    toast(d.text, d.kind === 'bad' ? 'bad' : (d.kind === 'good' ? 'good' : ''));
    WQSfx.play(d.kind === 'bad' ? 'wrong' : 'coin');
  }
  function toast(t, k) { var x = el('div', 'toast ' + (k || ''), t); document.body.appendChild(x); setTimeout(x.remove.bind(x), 4100); }
  function msgCard(t, p) { var m = $('p-main'); m.innerHTML = ''; var c = el('div', 'p-card'); c.appendChild(el('h2', '', t)); if (p) c.appendChild(el('p', '', p)); m.appendChild(c); sig = ''; }

  /* ---------- 學號：取得勇者後 30 秒內可以加上（固定 4 碼數字：年級＋班級＋座號） ---------- */
  var SB = null, sidSent = false;
  function sidBox() {
    var left = mine && !mine.sid && !sidSent ? mine.sidR - (performance.now() - recvAt) : 0;
    if (left <= 0) { if (SB) { SB.el.remove(); SB = null; } return; }
    if (!SB) {
      var b = el('div', 'sid-box'); b.appendChild(el('h3', '', '你的勇者名字是「' + mine.name + '」'));
      if (S && S.rs) b.appendChild(el('div', 'gold', '老師讀取了上次的存檔！輸入你的 4 碼學號，就能找回上次的勇者、分數和魔法卡。'));
      b.appendChild(el('div', 'mute', '請輸入你自己的 4 碼學號：年級＋班級＋座號。例如 4 年 5 班 6 號是 4506，6 年 2 班 17 號是 6217。不用想名字，輸入學號就好！'));
      var row = el('div', 'row'), inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.pattern = '[0-9]*'; inp.maxLength = 4; inp.placeholder = '4 碼學號'; inp.id = 'sid-in'; inp.autocomplete = 'off';
      inp.addEventListener('input', function () { var v = inp.value.replace(/[^0-9]/g, '').slice(0, 4); if (v !== inp.value) inp.value = v; });
      var ok = btn('btn btn-gold', '確定', function () {
        var v = inp.value.replace(/[^0-9]/g, '');
        if (v && v.length !== 4) { toast('學號要剛好 4 碼，例如 4506（4 年 5 班 6 號）', 'bad'); inp.focus(); return; }
        sidSent = true; send('sid', { v: v }); toast(v ? '已加上學號（' + v + '）' : '好的，就用「' + mine.name + '」這個名字！', 'good'); sidBox();
      }); ok.id = 'sid-go';
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok.click(); });
      row.appendChild(inp); row.appendChild(ok); b.appendChild(row);
      var cd = el('div', 'cd', ''); b.appendChild(cd); document.body.appendChild(b);
      SB = { el: b, cd: cd };
    }
    SB.cd.textContent = '⏳ 還有 ' + Math.ceil(left / 1000) + ' 秒，時間到就只顯示勇者名字';
  }

  /* ---------- 畫面 ---------- */
  function remain() { if (!S || !S.timer) return 0; return S.paused ? S.timer.r : S.timer.r - (performance.now() - recvAt); }
  function bar() {
    var b = $('p-bar'); b.classList.remove('hidden'); b.innerHTML = '';
    b.appendChild(WQPixel.img(mine.seed, mine.g));
    var w = el('div', 'who'); w.appendChild(el('b', '', mine.name)); if (mine.sid) w.appendChild(el('span', 'sid', '（' + mine.sid + '）')); w.appendChild(el('small', '', WQPixel.className(mine.seed, mine.g) + '・第 ' + mine.rank + ' 名 / ' + S.players.length + ' 人')); b.appendChild(w);
    var sc = el('div', '', String(mine.score)); sc.id = 'p-score'; sc.appendChild(el('small', '', '分數')); b.appendChild(sc);
    var st = el('span', 'mute', ''); st.id = 'net-st'; b.appendChild(st);
  }
  function info() {
    var f = $('p-info'); f.classList.remove('hidden'); f.innerHTML = '';
    function pill(t, c) { var p = el('span', 'pill' + (c ? ' ' + c : ''), t); f.appendChild(p); return p; }
    if (S.qi >= 0 || S.ph === 'room') pill('第 ' + Math.min(S.qn, S.qi + (S.ph === 'room' ? 2 : 1)) + ' / ' + S.qn + ' 關');
    if (S.timer && S.timer.k !== 'effect') { var r = remain(); pill('⏳ ' + Math.ceil(Math.max(0, r) / 1000) + ' 秒', r < 5500 ? 'low' : '').id = 'p-timer'; }
    if (S.tt && S.ph !== 'lobby') pill('⏱ ' + fmt(S.elapsed + (S.paused || S.ph === 'end' || S.ph === 'gate' ? 0 : performance.now() - recvAt))).id = 'p-total';
    if (S.ph === 'question') { var n = S.players.filter(function (p) { return p.cur && p.cur.d; }).length; pill('已作答 ' + n + ' / ' + S.players.length); }
    if (S.ph !== 'end' && S.ph !== 'lobby') pill('🔮 ' + (S.untilCards === S.cardEvery ? '這關結束後' : '再 ' + S.untilCards + ' 關') + '是魔法卡時刻');
    if (mine.streak >= 2) pill('🔥 連續答對 ' + mine.streak);
    var NX = { skip: '🌀 下一關自動過關', fifty: '👁️ 下一題消除選項', second: '🪶 下一題有復活羽毛', lucky: '🍀 下一題答對得分加倍', frozen: '❄️ 下一題被冰凍' };
    (mine.next || []).forEach(function (k) { if (NX[k]) pill(NX[k], k === 'frozen' ? 'warn' : ''); });
    if (mine.cards.indexOf('shield') >= 0) pill('🛡️ 守護盾保護中'); if (mine.cards.indexOf('mirror') >= 0) pill('🪞 反射魔鏡保護中');
  }
  function hand() {
    var h = $('p-hand'); h.classList.remove('hidden'); h.innerHTML = '';
    h.appendChild(el('span', 'lbl', '我的魔法卡 ' + mine.cards.length + '/' + WQCards.HAND_MAX));
    if (!mine.cards.length) h.appendChild(el('span', 'mute', '還沒有魔法卡：通關寶箱、商人、精靈都可能給你'));
    mine.cards.forEach(function (id) { var c = WQCards.get(id), x = btn('chip', '', function () { toast(c.icon + ' ' + c.name + '：' + c.desc + (c.kind === 'passive' ? '（帶在身上自動生效）' : '（魔法卡時刻使用）')); }); x.style.setProperty('--c', c.color); x.appendChild(el('span', 'ic', c.icon)); x.appendChild(el('span', '', c.name)); h.appendChild(x); });
  }
  function cardEl(id) {
    var c = WQCards.get(id), d = el('div', 'mcard'); d.style.setProperty('--c', c.color);
    d.appendChild(el('div', 'ic', c.icon)); d.appendChild(el('div', 'nm', c.name)); d.appendChild(el('div', 'ds', c.desc)); d.appendChild(el('div', 'pr', c.price + ' 分'));
    if (c.kind === 'passive') d.appendChild(el('span', 'tag', '自動生效'));
    return d;
  }
  function render() {
    $('p-pause').classList.toggle('hidden', !S.paused);
    bar(); info(); hand();
    var s = [S.ph, S.adv, S.qi, S.turn ? S.turn.idx : '', S.effect ? S.effect.n : '', S.fairy ? 1 : 0, S.q && S.q.answer, S.merchant ? 1 : 0, S.story, mine.sid].join('|');
    if (s !== sig) { sig = s; build(); } else update();
  }
  var V = {};
  function build() {
    var m = $('p-main'); m.innerHTML = ''; V = {};
    var c = el('div', 'p-card'); m.appendChild(c);
    switch (S.ph) {
      case 'lobby': {
        var me2 = el('div', 'p-me'); me2.appendChild(el('h2', '', mine.name)); if (mine.sid) me2.appendChild(el('div', 'sid', '（' + mine.sid + '）')); me2.appendChild(WQPixel.img(mine.seed, mine.g));
        me2.appendChild(el('p', '', '你是「' + WQPixel.className(mine.seed, mine.g) + '」！')); me2.appendChild(el('p', 'gold', '已經加入冒險，等待老師開始……'));
        V.cnt = el('p', 'mute', ''); me2.appendChild(V.cnt); c.appendChild(me2); break;
      }
      case 'story': c.appendChild(el('h2', '', S.story ? '古堡大門關上了！' : '一封神祕的信')); c.appendChild(el('p', '', '請抬頭看老師的大螢幕，一起聽冒險的開場故事。')); break;
      case 'room': c.appendChild(el('h2', '', '第 ' + S.room.n + ' 個房間：' + S.room.name)); c.appendChild(el('p', '', S.room.intro)); c.appendChild(el('p', 'gold', '準備好，題目馬上出現！')); break;
      case 'question': if (WQSettings.isChoice(S.q)) buildQuestion(c); else buildFree(c); break;
      case 'grade': c.appendChild(el('h2', '', '✍️ 老師正在批改……')); c.appendChild(el('p', '', '看大螢幕，等老師公布答案。')); showMine(c); break;
      case 'reveal': buildReveal(c); break;
      case 'chest': c.appendChild(el('h2', '', '房間破關！取得符文')); c.appendChild(el('p', '', '在這個房間答對一半以上的勇者，可以打開通關寶箱，得到一張魔法卡。')); break;
      case 'merchant': buildMerchant(c); break;
      case 'fairy': {
        c.appendChild(el('div', 'fairy', '🧚'));
        if (!S.fairy) { c.appendChild(el('h2', '', '森林精靈正在挑選勇者……')); c.appendChild(el('p', '', '看大螢幕！會是你嗎？')); }
        else { var mineF = S.fairy.pid === me.pid; c.appendChild(el('h2', '', mineF ? '精靈選中你了！' : '精靈選中了「' + S.fairy.name + '」')); c.appendChild(el('p', 'gold', S.fairy.line)); }
        break;
      }
      case 'cards': buildCards(c); break;
      case 'gate': c.appendChild(el('h2', '', '最後的大門')); c.appendChild(el('p', '', '所有符文都回到大門了，看大螢幕！')); break;
      case 'end': buildEnd(c); break;
    }
    update();
  }
  function update() {
    if (V.cnt) V.cnt.textContent = '目前有 ' + S.players.length + ' 位勇者';
    if (S.ph === 'question' && V.opts) updQuestion();
    if (S.ph === 'question' && V.freeSt) updFree();
    if (S.ph === 'merchant' && V.buys) updMerchant();
  }

  function frozenCard(c) {
    var f = el('div', 'fb bad frozen'); f.appendChild(el('b', '', '❄️ 你被冰凍了！')); f.appendChild(el('span', '', '這一題不能作答，等其他勇者做完或時間到。')); c.appendChild(f);
  }
  function buildQuestion(c) {
    var q = S.q, qi = S.qi; c.appendChild(el('div', 'mute', q.speaker + '・' + q.type));
    c.appendChild(el('div', 'p-prompt', q.prompt));
    if (mine.cur && mine.cur.fz) return frozenCard(c);
    var short = q.options.every(function (t) { return t.length <= 6; }), w = el('div', 'p-opts' + (short ? ' grid' : '')); V.opts = []; V.sel = null;
    q.options.forEach(function (t, k) {
      var b = btn('p-opt', '', function () { if (b.disabled) return; WQSfx.play('tap'); V.sel = k; updQuestion(); });
      b.appendChild(el('span', 'k', String(k + 1))); b.appendChild(el('span', '', t)); w.appendChild(b); V.opts.push(b);
    });
    c.appendChild(w);
    /* 先選答案，按「送出答案」才算；送出前可以改 */
    var go = btn('btn btn-gold p-send', '送出答案', function () {
      var auto = go.dataset.auto; go.dataset.auto = '';
      if (S.paused) return auto ? null : toast('老師暫停中，等一下再作答。');
      if (V.sel == null) return auto ? null : toast('先點一個答案，再按送出。');
      var k = V.sel; V.sel = null; WQSfx.play('tap'); send('ans', { k: k, qi: qi }); V.opts[k].disabled = true; updQuestion();
    }); go.id = 'opt-go'; V.go = go; c.appendChild(go);
    V.fb = el('div', 'fb hidden'); c.appendChild(V.fb);
    selfMask(c, w);
  }
  function updQuestion() {
    var cu = mine.cur || { t: [], rm: [] }, q = S.q;
    V.opts.forEach(function (b, k) {
      var tried = cu.t.indexOf(k) >= 0, gone = (cu.rm || []).indexOf(k) >= 0;
      b.classList.toggle('gone', gone); b.classList.toggle('wrong', tried && !(cu.c && k === cu.t[cu.t.length - 1]));
      b.classList.toggle('correct', !!(cu.c && tried && k === cu.t[cu.t.length - 1]));
      b.disabled = cu.d || tried || gone;
      b.classList.toggle('sel', V.sel === k && !b.disabled);
    });
    if (V.sel != null && V.opts[V.sel] && V.opts[V.sel].disabled) V.sel = null;
    if (V.go) { V.go.disabled = !!cu.d || V.sel == null; V.go.classList.toggle('hidden', !!cu.d); }
    var f = V.fb, eff = cu.t.length - (cu.sc ? 1 : 0); f.className = 'fb'; f.innerHTML = '';
    if (cu.sk) { f.classList.add('good'); f.appendChild(el('b', '', '🌀 傳送門卡生效！這關自動過關 +' + cu.pts)); }
    else if (cu.d && cu.c) { f.classList.add('good'); f.appendChild(el('b', '', cu.fz ? '答對了！但你被冰凍，這題沒有分數。' : '答對了！+' + cu.pts + (cu.b ? '　⚡ 第 ' + cu.sp + ' 位答對 +' + cu.b : ''))); f.appendChild(el('span', '', '等待其他勇者作答……')); }
    else if (cu.d) { f.classList.add('bad'); f.appendChild(el('b', '', '這題的機會用完了')); f.appendChild(el('span', '', '等老師公布答案吧。')); }
    else if (cu.t.length && eff <= 0) { f.classList.add('hint'); f.appendChild(el('b', '', '🪶 復活羽毛救了你！這次答錯不算，再試一次。')); }
    else if (eff === 1) { f.classList.add('hint'); f.appendChild(el('b', '', '咒語沒有反應…提示')); f.appendChild(el('span', '', q.hint1 || '')); }
    else if (eff >= 2) { f.classList.add('hint'); f.appendChild(el('b', '', '更明確的提示')); f.appendChild(el('span', '', q.hint2 || '')); }
    else if ((cu.rm || []).length) { f.classList.add('hint'); f.appendChild(el('b', '', '👁️ 消除魔眼幫你刪掉了錯誤的選項！')); }
    else f.className = 'fb hidden';
  }
  /* ---------- 打字、手寫題（手寫板用同步出題工具的 ink.js） ---------- */
  var lastSub = null;
  function buildFree(c) {
    var q = S.q, qi = S.qi, cu = mine.cur || {};
    c.appendChild(el('div', 'mute', q.speaker + '・' + q.label));
    c.appendChild(el('div', 'p-prompt', q.prompt));
    var box = el('div', 'free'); c.appendChild(box);
    if (cu.sk) { box.appendChild(el('div', 'fb good', '🌀 傳送門卡生效！這關自動過關 +' + (cu.pts || 0) + '。')); return; }
    if (cu.fz) return frozenCard(box);
    var go = btn('btn btn-gold', '送出答案', function () {
      var auto = go.dataset.auto; go.dataset.auto = '';
      if (S.paused) return toast('老師暫停中，等一下再送出。');
      var v;
      if (q.input === 'draw') { if (!V.cells) return; v = { n: V.n, c: V.cells.map(function (x) { return { s: x.s }; }) }; if (!V.ink.hasInk(v)) return auto ? null : toast('先在格子裡寫好答案再送出喔。'); }
      else { v = V.text.value.trim(); if (!v) return auto ? null : toast('先輸入答案再送出喔。'); }
      if (auto && lastSub && lastSub.qi === qi && lastSub.adv === S.adv && JSON.stringify(lastSub.v) === JSON.stringify(v)) return;
      lastSub = { qi: qi, v: v, adv: S.adv }; send('sub', { qi: qi, v: v }); WQSfx.play('tap');
      if (auto) toast('時間到，已自動送出你寫的答案。');
    }); go.id = 'free-go'; V.go = go;
    if (q.input === 'draw') {
      var chooser = el('div', 'cell-count hidden'), wrap = el('div', 'cells-wrap'), cont = el('div'); wrap.appendChild(cont);
      box.appendChild(chooser); box.appendChild(wrap);
      WQSettings.loadInk().then(function (ink) {
        if (S.qi !== qi || S.ph !== 'question') return;
        V.ink = ink;
        var cnt = el('b', 'cc-n', '');
        function build(k) {
          var old = (V.cells || []).map(function (c) { return c.s; });
          V.n = k; V.cells = ink.buildCells(cont, k, { own: 's', grid: q.kind !== 'write', onChange: function (i, kind) { if (kind !== 'live') draft(); } });
          old.forEach(function (s, i) { if (V.cells[i] && s && s.length) V.cells[i].setMine(s); }); // 增減格子時保留已寫的字
          cnt.textContent = k + ' 格'; draft();
        }
        if (q.kind === 'word') { /* 造詞：學生自己決定格子數，最少 2 格、最多 10 格，一格一字 */
          chooser.classList.remove('hidden'); chooser.appendChild(el('span', '', '需要幾個格子？'));
          chooser.appendChild(btn('', '－ 減少', function () { if (V.n > 2) build(V.n - 1); })); chooser.appendChild(cnt); chooser.appendChild(btn('', '＋ 增加', function () { if (V.n < 10) build(V.n + 1); }));
        }
        build(q.kind === 'word' ? Math.max(2, Math.min(10, +q.cells || +q.cellN || 2)) : Math.max(1, q.cellN || q.cells || 1));
        var used = ((mine.cur || {}).hu || []).slice(), hb = WQSettings.hintBar(q.ch ? { input: 'draw', kind: q.kind, charHints: q.ch } : q, V.n, used, function (i) { send('hint', { qi: qi, i: i }); WQSfx.play('tap'); });
        if (hb) box.insertBefore(hb, wrap.nextSibling);
      }).catch(function () { box.appendChild(el('div', 'fb bad', '手寫板載入失敗，請確認網路後重新整理。')); });
    } else {
      V.text = el(q.input === 'fill' ? 'input' : 'textarea'); if (q.input === 'fill') V.text.type = 'text';
      V.text.placeholder = '在這裡打字作答'; V.text.id = 'free-text'; box.appendChild(V.text);
      V.text.addEventListener('input', draft);
    }
    box.appendChild(go);
    V.freeSt = el('div', 'fb hidden'); box.appendChild(V.freeSt);
    selfMask(c, box);
    /* 寫字、打字時把草稿傳給老師的全班監控版（約每 1.2 秒一次） */
    function draft() {
      if (V.dT) return;
      V.dT = setTimeout(function () {
        V.dT = null; if (!S || S.ph !== 'question' || S.qi !== qi) return;
        var v = null;
        if (q.input === 'draw') { if (V.cells && V.ink) { v = { n: V.n, c: V.cells.map(function (x) { return { s: x.s }; }) }; if (!V.ink.hasInk(v)) v = null; } }
        else if (V.text) v = V.text.value.trim() || null;
        if (v) send('draft', { qi: qi, v: v });
      }, 1200);
    }
  }
  /* 學生自己遮住作答區（防偷看），點一下再打開繼續修改；每一題開始時解除 */
  function selfMask(c, area) {
    var wrap = el('div', 'self-wrap'); area.parentNode.insertBefore(wrap, area); wrap.appendChild(area);
    var cover = btn('self-cover', '', function () { toggle(); }); cover.appendChild(el('b', '', '🙈 答案已遮住')); cover.appendChild(el('span', '', '點這裡打開，繼續作答')); wrap.appendChild(cover);
    var b = btn('btn btn-violet self-btn', '🙈 遮住我的答案', function () { toggle(); }); b.id = 'self-mask'; c.appendChild(b);
    function toggle() { var on = !wrap.classList.contains('masked'); wrap.classList.toggle('masked', on); b.textContent = on ? '👀 打開我的答案' : '🙈 遮住我的答案'; }
  }
  function updFree() {
    var cu = mine.cur || {}; if (!V.freeSt) return;
    V.freeSt.className = cu.sb ? 'fb good' : 'fb hidden'; V.freeSt.textContent = cu.sb ? '✔ 已送出！時間結束前還可以修改，再按一次「送出答案」。' : '';
  }
  function showMine(c, q, guide) {
    if (!lastSub || lastSub.qi !== S.qi || lastSub.adv !== S.adv) { if (S.ph === 'grade') c.appendChild(el('p', 'mute', '你這題沒有送出答案。')); return; }
    var v = lastSub.v, q2 = q || S.q || {};
    var box = el('div', 'model'); box.appendChild(el('b', '', '你的答案：'));
    if (typeof v === 'string') box.appendChild(el('span', '', v));
    else {
      var cv = el('canvas', 'ink-view'); box.appendChild(cv);
      WQSettings.loadInk().then(function (ink) {
        var g = guide && q2.answerText ? ink.guideChars(q2.kind, q2.answerText) : [];
        var paint = function () { ink.paintInkThumb(cv, v, { grid: q2.kind !== 'write', guides: g.length ? g : null }); };
        requestAnimationFrame(paint); if (g.length) ink.ensureKai(g).then(paint);
      });
    }
    c.appendChild(box);
  }
  function buildReveal(c) {
    var cu = mine.cur || {}, q = S.q;
    if (!WQSettings.isChoice(q)) {
      c.appendChild(el('div', 'big-res', cu.c ? '✔ 老師批改：答對！' : (cu.cr ? '◐ 老師批改：答對 ' + cu.cr + ' / ' + cu.ct + ' 個字' : '✘ 這題沒答對')));
      if (cu.ct) c.appendChild(el('p', 'mute', '一個字 ' + WQSettings.CHAR_PTS + ' 分' + (cu.cm ? '：' + cu.cm.map(function (x, i) { return '第 ' + (i + 1) + ' 字' + (x ? '✓' : '✗') + (cu.hu && cu.hu[i] ? '💡' : ''); }).join('　') + (cu.hu && cu.hu.some(Boolean) ? '（💡 看了提示的字答對得 ' + WQSettings.HINT_PTS + ' 分）' : '') : '')));
      if (cu.pts || cu.b) c.appendChild(el('p', 'gold', '本題得分 +' + (cu.pts || 0) + (cu.b ? '，速度加分 +' + cu.b + '（第 ' + cu.sp + ' 位答對）' : '')));
      var md = el('div', 'model'); md.appendChild(el('b', '', '參考答案：')); md.appendChild(el('span', 'kai', String(q.answerText || '（老師判斷）').split(/[|｜]/).join(' 或 '))); c.appendChild(md);
      showMine(c, q, true);
      if (q.explain) c.appendChild(el('p', 'mute', q.explain));
      c.appendChild(el('p', '', '你現在是第 ' + mine.rank + ' 名，' + (mine.delta > 0 ? '這題 +' + mine.delta + ' 分' : '這題沒有加分')));
      WQSfx.play(cu.c ? 'correct' : 'wrong'); return;
    }
    c.appendChild(el('div', 'big-res', cu.c ? '✔ 答對了！' : '✘ 這題沒答對'));
    if (cu.c) c.appendChild(el('p', 'gold', '本題得分 +' + (cu.pts || 0) + (cu.b ? '，速度加分 +' + cu.b + '（第 ' + cu.sp + ' 位答對）' : '')));
    c.appendChild(el('p', '', '正確答案：' + (q.answer + 1) + '. ' + q.options[q.answer]));
    if (q.explain) c.appendChild(el('p', 'mute', q.explain));
    var r = el('p', '', '你現在是第 ' + mine.rank + ' 名，' + (mine.delta > 0 ? '這題 +' + mine.delta + ' 分' : '這題沒有加分'));
    if (mine.rd > 0) r.appendChild(el('span', 'up', '　▲ 上升 ' + mine.rd + ' 名')); if (mine.rd < 0) r.appendChild(el('span', 'down', '　▼ 下降 ' + (-mine.rd) + ' 名'));
    c.appendChild(r);
    var fast = S.players.filter(function (p) { return p.cur && p.cur.sp; }).sort(function (a, b) { return a.cur.sp - b.cur.sp; }).slice(0, 3);
    if (fast.length) c.appendChild(el('p', '', '⚡ 最快答對：' + fast.map(function (p, i) { return ['🥇', '🥈', '🥉'][i] + p.name; }).join('　')));
    WQSfx.play(cu.c ? 'correct' : 'wrong');
  }
  function buildMerchant(c) {
    c.appendChild(el('h2', '', '🧙 魔法卡商人'));
    c.appendChild(el('p', '', '用分數購買魔法卡！你的分數：' + mine.score + ' 分，道具袋最多 ' + WQCards.HAND_MAX + ' 張。'));
    var g = el('div', 'p-cards'); V.buys = [];
    S.merchant.stock.forEach(function (id) {
      var d = cardEl(id), b = btn('', '購買', function () { if (S.paused) return toast('老師暫停中。'); b.disabled = true; send('buy', { card: id }); setTimeout(function () { updMerchant(); }, 1500); });
      b.dataset.id = id; d.appendChild(b); V.buys.push(b); g.appendChild(d);
    });
    c.appendChild(g);
    V.done = btn('btn btn-violet', '完成交易', function () { send('tradeDone'); V.done.disabled = true; V.done.textContent = '已完成交易，等待其他勇者'; });
    V.done.style.marginTop = '12px'; c.appendChild(V.done);
  }
  function updMerchant() {
    var done = S.merchant && S.merchant.done.indexOf(me.pid) >= 0;
    V.buys.forEach(function (b) { var cd = WQCards.get(b.dataset.id); b.disabled = done || mine.score < cd.price || mine.cards.length >= WQCards.HAND_MAX; b.textContent = mine.score < cd.price ? '分數不夠' : '購買'; });
    if (done) { V.done.disabled = true; V.done.textContent = '已完成交易，等待其他勇者'; }
  }
  var pickCard = null, pickTarget = null;
  function buildCards(c) {
    var T = S.turn, cp = T && S.players.filter(function (p) { return p.pid === T.order[T.idx]; })[0];
    c.appendChild(el('h2', '', '✨ 魔法卡時刻'));
    if (S.effect) {
      if (S.effect.by === me.pid && !S.effect.pass) {
        var e = el('div', 'effect'); e.appendChild(cardEl(S.effect.card)); if (S.effect.dice) e.appendChild(el('div', 'dice', ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][S.effect.dice - 1]));
        var ln = el('div', ''); S.effect.lines.forEach(function (l) { ln.appendChild(el('p', 'gold', l)); }); e.appendChild(ln); c.appendChild(e); WQSfx.play('magic');
      } else c.appendChild(el('p', '', S.effect.pass ? S.effect.lines[0] : (cp ? cp.name : '有勇者') + ' 發動了魔法卡！看大螢幕。'));
      return;
    }
    if (!cp) return;
    if (cp.pid !== me.pid) {
      var pos = T.order.indexOf(me.pid);
      c.appendChild(el('p', '', '現在輪到「' + cp.name + '」選擇魔法卡。'));
      c.appendChild(el('p', 'mute', pos > T.idx ? '你排在第 ' + (pos + 1) + ' 位，再等 ' + (pos - T.idx) + ' 位就輪到你。' : (pos < 0 ? '你這次沒有可以使用的魔法卡。' : '你這回合已經結束了。')));
      return;
    }
    var usable = WQCards.usable(mine, S.players);
    pickCard = null; pickTarget = null;
    c.appendChild(el('p', 'gold', '輪到你了！選一張魔法卡發動，或選擇放棄。別人看不到你選了什麼。'));
    var g = el('div', 'p-cards'), tg = el('div', 'targets hidden'), go = btn('btn btn-gold', '發動魔法卡', function () {
      if (!pickCard) return toast('先選一張魔法卡。');
      if (WQCards.get(pickCard).kind === 'target' && !pickTarget) return toast('請選擇要對誰使用。');
      go.disabled = true; send('use', { card: pickCard, target: pickTarget });
    });
    usable.forEach(function (id) {
      var d = cardEl(id); d.addEventListener('click', function () {
        WQSfx.play('tap'); pickCard = id; g.querySelectorAll('.mcard').forEach(function (x) { x.classList.remove('sel'); }); d.classList.add('sel');
        tg.classList.toggle('hidden', WQCards.get(id).kind !== 'target'); pickTarget = null; tg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      });
      g.appendChild(d);
    });
    c.appendChild(g);
    tg.appendChild(el('div', '', '對誰使用？'));
    S.players.forEach(function (p) { if (p.pid === me.pid) return; var b = btn('', '', function () { pickTarget = p.pid; tg.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); b.appendChild(WQPixel.img(p.seed, p.g)); b.appendChild(el('span', '', p.name + '（' + p.score + '）')); tg.appendChild(b); });
    c.appendChild(tg);
    var row = el('div', 'next-row'); row.appendChild(go); row.appendChild(btn('btn btn-violet', '放棄這回合', function () { send('pass'); })); c.appendChild(row);
    WQSfx.play('magic'); if (navigator.vibrate) try { navigator.vibrate(200); } catch (e) {}
  }
  function buildEnd(c) {
    var rk = S.players.slice().sort(function (a, b) { return a.rank - b.rank; });
    c.appendChild(el('h2', '', S.ultimate ? '🏆 終極破關！' : (S.early ? '🚪 冒險結束！看看目前的名次' : '🎉 闖關成功！')));
    var pd = el('div', 'podium mini-pod');
    [1, 0, 2].forEach(function (i) { var p = rk[i]; if (!p) return; var d = el('div', 'pod p' + (i + 1)); d.appendChild(WQPixel.img(p.seed, p.g)); d.appendChild(el('div', 'nm', p.name)); d.appendChild(el('div', 'blk', String(i + 1))); pd.appendChild(d); });
    c.appendChild(pd);
    c.appendChild(el('div', 'big-res', '第 ' + mine.rank + ' 名'));
    c.appendChild(el('p', '', '最終分數 ' + mine.score + ' 分・答對 ' + mine.correct + ' 題・答錯 ' + mine.wrong + ' 題'));
    if (S.tt) c.appendChild(el('p', 'mute', '過關總時間 ' + fmt(S.elapsed)));
    if (S.settings.repeat !== 'none') c.appendChild(el('p', 'gold', '看大螢幕：老師可能會邀請大家接受另一段冒險！'));
    WQSfx.play('fanfare');
  }
  setInterval(function () {
    if (!S || !mine) return;
    sidBox();
    if (S.ph === 'question' && S.timer && S.timer.k === 'q' && !S.paused && V.go && !V.auto && remain() < 1500) { V.auto = true; V.go.dataset.auto = '1'; V.go.click(); }
    var t = $('p-timer'); if (t && S.timer) { var r = remain(); t.textContent = '⏳ ' + Math.ceil(Math.max(0, r) / 1000) + ' 秒'; t.classList.toggle('low', r < 5500); }
    var tt = $('p-total'); if (tt && !S.paused && S.ph !== 'end' && S.ph !== 'gate') tt.textContent = '⏱ ' + fmt(S.elapsed + performance.now() - recvAt);
  }, 250);
  document.addEventListener('click', function () { WQSfx.on(); }, { once: true });

  if (code && saved && saved.code === code && saved.pid) { me.pid = saved.pid; me.name = saved.name; me.gender = saved.gender; connect(); }
  else joinForm();
})();
