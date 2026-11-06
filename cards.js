/* 魔法卡道具庫與精靈命運 */
window.WQCards = (function () {
  'use strict';
  // kind: now 立即生效 / next 下一題生效 / passive 持有就自動生效 / target 需要指定對象
  var LIB = [
    { id: 'avg', name: '平均天秤卡', icon: '⚖️', price: 120, kind: 'now', color: '#4a7bd4', desc: '把自己的分數變成全體勇者的平均分數。' },
    { id: 'swap1', name: '王座交換卡', icon: '👑', price: 400, kind: 'now', color: '#e8c15a', desc: '和第一名的勇者互換分數。' },
    { id: 'storm', name: '魔法風暴卡', icon: '🌪️', price: 450, kind: 'now', color: '#6b4bb8', desc: '除了自己以外，所有勇者的分數減一半。' },
    { id: 'boost', name: '能量藥水卡', icon: '🧪', price: 250, kind: 'now', color: '#3aa36b', desc: '自己的分數增加 50%。' },
    { id: 'double', name: '雙倍魔法卡', icon: '✨', price: 500, kind: 'now', color: '#f28c28', desc: '自己的分數增加一倍。' },
    { id: 'skip', name: '傳送門卡', icon: '🌀', price: 150, kind: 'next', color: '#2aa7a0', desc: '下一關自動過關，直接拿到 100 分。' },
    { id: 'steal', name: '盜賊之手卡', icon: '🖐️', price: 200, kind: 'now', color: '#7a4b2a', desc: '隨機指定一位勇者，搶走他的一張魔法卡。' },
    { id: 'shield', name: '守護盾卡', icon: '🛡️', price: 150, kind: 'passive', color: '#5c6b7a', desc: '帶在身上就會自動擋下一次別人的攻擊魔法。' },
    { id: 'mirror', name: '反射魔鏡卡', icon: '🪞', price: 250, kind: 'passive', color: '#8f6fe0', desc: '帶在身上，下一次被攻擊時把魔法反彈給施法者。' },
    { id: 'fifty', name: '消除魔眼卡', icon: '👁️', price: 80, kind: 'next', color: '#c2417b', desc: '下一題先幫你刪掉錯誤的選項。' },
    { id: 'second', name: '復活羽毛卡', icon: '🪶', price: 100, kind: 'next', color: '#f2a0c0', desc: '下一題答錯第一次不扣分，還能拿滿分。' },
    { id: 'freeze', name: '冰凍咒語卡', icon: '❄️', price: 200, kind: 'target', color: '#6fc7ff', desc: '指定一位勇者，他下一題答對也拿不到分數。' },
    { id: 'dice', name: '命運骰子卡', icon: '🎲', price: 100, kind: 'now', color: '#d9534f', desc: '擲骰子，點數 × 30 分加給自己。' },
    { id: 'bless', name: '祝福分享卡', icon: '🎁', price: 80, kind: 'now', color: '#ff9f6b', desc: '分數最低的勇者加 100 分，自己也加 60 分。' },
    { id: 'thunder', name: '雷擊卡', icon: '⚡', price: 180, kind: 'target', color: '#ffd34d', desc: '指定一位勇者，扣掉他 100 分。' },
    { id: 'lucky', name: '幸運四葉草卡', icon: '🍀', price: 120, kind: 'next', color: '#7ee2a8', desc: '下一題答對時，額外再加 50 分。' }
  ];
  var BY = {}; LIB.forEach(function (c) { BY[c.id] = c; });
  var HAND_MAX = 6;
  function get(id) { return BY[id]; }
  function cheapest() { return Math.min.apply(null, LIB.map(function (c) { return c.price; })); }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function weighted(list) { var t = 0; list.forEach(function (x) { t += x[1]; }); var r = Math.random() * t; for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r <= 0) return list[i][0]; } return list[list.length - 1][0]; }
  function randomCard() { // 寶箱掉落：便宜的卡比較常出現
    return weighted(LIB.map(function (c) { return [c.id, 100 / Math.sqrt(c.price)]; }));
  }
  function stock(maxScore) {
    var ids = LIB.map(function (c) { return c.id; }), out = [];
    while (out.length < 5) { var id = rnd(ids); if (out.indexOf(id) < 0) out.push(id); }
    if (!out.some(function (id) { return BY[id].price <= maxScore; })) {
      var ok = LIB.filter(function (c) { return c.price <= maxScore; });
      if (ok.length) out[4] = rnd(ok).id;
    }
    return out;
  }
  function usable(p, players) {
    return (p.cards || []).filter(function (id) {
      var c = BY[id]; if (!c || c.kind === 'passive') return false;
      if (id === 'swap1') { var top = ranked(players)[0]; return top && top.pid !== p.pid && top.score > p.score; }
      if (id === 'steal') return players.some(function (q) { return q.pid !== p.pid && q.cards.length; });
      if (c.kind === 'target' || id === 'storm') return players.some(function (q) { return q.pid !== p.pid; });
      return true;
    }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  }
  function ranked(players) { return players.slice().sort(function (a, b) { return b.score - a.score || a.joined - b.joined; }); }
  function takeCard(p, id) { var i = p.cards.indexOf(id); if (i >= 0) { p.cards.splice(i, 1); return true; } return false; }
  /* 被攻擊時的防禦：守護盾擋下，反射魔鏡反彈 */
  function defend(t) { if (takeCard(t, 'mirror')) return 'mirror'; if (takeCard(t, 'shield')) return 'shield'; return null; }

  /* 使用卡片：回傳 {title, lines[], hit: {pid: 訊息}} */
  function apply(id, p, players, target) {
    var c = BY[id], others = players.filter(function (q) { return q.pid !== p.pid; }), lines = [], hit = {};
    function name(q) { return q.name; }
    takeCard(p, id);
    switch (id) {
      case 'avg': {
        var sum = 0; players.forEach(function (q) { sum += q.score; }); var avg = Math.round(sum / players.length);
        lines.push(name(p) + ' 的分數從 ' + p.score + ' 變成平均分數 ' + avg + ' 分。'); p.score = avg; break;
      }
      case 'swap1': {
        var top = ranked(players)[0];
        if (!top || top.pid === p.pid) { lines.push('魔法失效了，' + name(p) + ' 已經是第一名。'); break; }
        var d = defend(top);
        if (d) { lines.push(name(top) + ' 的' + (d === 'mirror' ? '反射魔鏡' : '守護盾') + '擋下了王座交換！'); hit[top.pid] = '你的' + (d === 'mirror' ? '反射魔鏡' : '守護盾') + '擋下了王座交換卡！'; break; }
        lines.push(name(p) + '（' + p.score + '）和第一名 ' + name(top) + '（' + top.score + '）互換了分數！');
        var t = p.score; p.score = top.score; top.score = t; hit[top.pid] = name(p) + ' 用王座交換卡和你互換了分數！'; break;
      }
      case 'storm': {
        var reflected = false, blocked = [];
        others.forEach(function (q) {
          var d = defend(q);
          if (d === 'shield') { blocked.push(name(q)); hit[q.pid] = '守護盾擋下了魔法風暴！'; return; }
          if (d === 'mirror') { reflected = true; blocked.push(name(q)); hit[q.pid] = '反射魔鏡把魔法風暴反彈回去了！'; return; }
          q.score = Math.floor(q.score / 2); hit[q.pid] = name(p) + ' 召喚魔法風暴，你的分數減一半！';
        });
        lines.push('魔法風暴席捲古堡，其他勇者的分數都減一半！');
        if (blocked.length) lines.push(blocked.join('、') + ' 擋下了風暴。');
        if (reflected) { p.score = Math.floor(p.score / 2); lines.push('反射魔鏡把風暴反彈，' + name(p) + ' 的分數也減一半！'); }
        break;
      }
      case 'boost': { var b = Math.round(p.score * .5); p.score += b; lines.push(name(p) + ' 喝下能量藥水，分數增加 ' + b + ' 分！'); break; }
      case 'double': { lines.push(name(p) + ' 施放雙倍魔法，分數從 ' + p.score + ' 變成 ' + p.score * 2 + '！'); p.score *= 2; break; }
      case 'skip': case 'fifty': case 'second': case 'lucky':
        p.next = p.next || {}; p.next[id] = true; lines.push(name(p) + ' 準備好了「' + c.name + '」，下一題就會生效。'); break;
      case 'steal': {
        var pool = others.filter(function (q) { return q.cards.length; });
        if (!pool.length) { lines.push('沒有人身上有魔法卡，盜賊之手撲空了。'); break; }
        var v = rnd(pool), d2 = defend(v);
        if (d2 === 'shield') { lines.push('盜賊之手伸向 ' + name(v) + '，被守護盾擋下了！'); hit[v.pid] = '守護盾擋下了盜賊之手！'; break; }
        if (d2 === 'mirror' && p.cards.length) { var back = rnd(p.cards); takeCard(p, back); v.cards.push(back); lines.push('反射魔鏡反彈！' + name(v) + ' 反而搶走了 ' + name(p) + ' 的「' + BY[back].name + '」！'); hit[v.pid] = '反射魔鏡讓你搶到了「' + BY[back].name + '」！'; break; }
        if (d2 === 'mirror') { lines.push('反射魔鏡擋下了盜賊之手！'); hit[v.pid] = '反射魔鏡擋下了盜賊之手！'; break; }
        var got = rnd(v.cards); takeCard(v, got); if (p.cards.length < HAND_MAX) p.cards.push(got);
        lines.push(name(p) + ' 從 ' + name(v) + ' 身上搶走了一張「' + BY[got].name + '」！'); hit[v.pid] = name(p) + ' 搶走了你的「' + BY[got].name + '」！'; break;
      }
      case 'freeze': case 'thunder': {
        var tg = players.filter(function (q) { return q.pid === target && q.pid !== p.pid; })[0] || rnd(others);
        if (!tg) { lines.push('沒有可以指定的勇者。'); break; }
        var d3 = defend(tg), victim = tg, word = id === 'freeze' ? '冰凍咒語' : '雷擊';
        if (d3 === 'shield') { lines.push(name(tg) + ' 的守護盾擋下了' + word + '！'); hit[tg.pid] = '守護盾擋下了' + word + '！'; break; }
        if (d3 === 'mirror') { victim = p; lines.push(name(tg) + ' 的反射魔鏡把' + word + '反彈給 ' + name(p) + '！'); hit[tg.pid] = '反射魔鏡反彈了' + word + '！'; }
        if (id === 'freeze') { victim.next = victim.next || {}; victim.next.frozen = true; lines.push(name(victim) + ' 被冰凍了，下一題答對也拿不到分數！'); }
        else { var loss = Math.min(100, victim.score); victim.score -= loss; lines.push('轟隆！' + name(victim) + ' 被雷打中，扣 ' + loss + ' 分！'); }
        if (victim !== p) hit[victim.pid] = name(p) + ' 對你使用了「' + c.name + '」！';
        break;
      }
      case 'dice': { var n = 1 + Math.floor(Math.random() * 6); p.score += n * 30; lines.push(name(p) + ' 擲出了 ' + n + ' 點，加 ' + n * 30 + ' 分！'); return { title: c.name, lines: lines, hit: hit, dice: n }; }
      case 'bless': {
        var low = ranked(others).pop();
        if (low) { low.score += 100; hit[low.pid] = name(p) + ' 送給你祝福，加 100 分！'; lines.push(name(low) + ' 收到祝福加 100 分，'); }
        p.score += 60; lines.push(name(p) + ' 也加 60 分。'); break;
      }
    }
    return { title: c.name, lines: lines, hit: hit };
  }

  /* 精靈：挑選對象（排名中下的勇者機率較高，同一趟冒險不重複） */
  function fairyPick(players, picked) {
    var r = ranked(players), cand = r.filter(function (p) { return picked.indexOf(p.pid) < 0; });
    if (!cand.length) { picked.length = 0; cand = r; }
    var n = r.length;
    return weighted(cand.map(function (p) { var i = r.indexOf(p); return [p, 1 + 3 * (n > 1 ? i / (n - 1) : 0)]; }));
  }
  var FATES = {
    gift2: '精靈送你目前分數的 2 倍！', gift1: '精靈送你目前分數的 1 倍！', card: '精靈送你一張魔法卡！',
    half: '精靈的考驗：扣掉目前分數的一半…', lose: '精靈的考驗：拿走你一張魔法卡…', swap: '精靈讓你和指定排名的勇者互換分數！'
  };
  function fairyFate(p, players) {
    var r = ranked(players), i = r.indexOf(p), low = i >= r.length / 2;
    var w = low ? [['gift2', 30], ['gift1', 30], ['card', 22], ['swap', 12], ['half', 3], ['lose', 3]]
      : [['gift1', 8], ['card', 24], ['half', 26], ['lose', 22], ['swap', 20]];
    if (!p.cards.length) w = w.filter(function (x) { return x[0] !== 'lose'; });
    if (r.length < 2) w = w.filter(function (x) { return x[0] !== 'swap'; });
    var f = weighted(w), res = { fate: f, title: FATES[f], line: '' };
    if (f === 'gift2') { var g2 = Math.max(100, p.score * 2); p.score += g2; res.line = p.name + ' 獲得 ' + g2 + ' 分！'; }
    if (f === 'gift1') { var g1 = Math.max(60, p.score); p.score += g1; res.line = p.name + ' 獲得 ' + g1 + ' 分！'; }
    if (f === 'card') { var id = randomCard(); if (p.cards.length < HAND_MAX) p.cards.push(id); res.card = id; res.line = p.name + ' 獲得「' + BY[id].name + '」！'; }
    if (f === 'half') { var h = Math.floor(p.score / 2); p.score -= h; res.line = p.name + ' 被扣了 ' + h + ' 分。'; }
    if (f === 'lose') { var lc = rnd(p.cards); takeCard(p, lc); res.card = lc; res.line = p.name + ' 失去了「' + BY[lc].name + '」。'; }
    if (f === 'swap') {
      var opts = r.filter(function (q) { return q !== p; }), pref = opts.filter(function (q) { return low ? r.indexOf(q) < i : r.indexOf(q) > i; });
      var tg = rnd(pref.length ? pref : opts), rank = r.indexOf(tg) + 1, t = p.score;
      p.score = tg.score; tg.score = t; res.target = tg.pid;
      res.line = '精靈指定第 ' + rank + ' 名的 ' + tg.name + '，和 ' + p.name + ' 互換分數！';
    }
    return res;
  }
  return { LIB: LIB, get: get, cheapest: cheapest, stock: stock, usable: usable, apply: apply, ranked: ranked, randomCard: randomCard,
    fairyPick: fairyPick, fairyFate: fairyFate, HAND_MAX: HAND_MAX };
})();
