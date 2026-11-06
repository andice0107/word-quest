/* 多人模式共用音效（Web Audio 合成） */
window.WQSfx = (function () {
  'use strict';
  var ac = null, master = null, files = {};
  function on() {
    if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); master = ac.createGain(); master.gain.value = .6; master.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
  }
  function tone(f, t, dur, vol, type, f2) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  function chime(f, t, vol, dur) { tone(f, t, dur, vol); tone(f * 2.01, t, dur * .6, vol * .4); }
  function whoosh(t, dur, vol, f1, f2) {
    var n = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ac.createBufferSource(); s.buffer = b; var fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = 1.2;
    fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  }
  function play(name) {
    if (!ac) return; var t = ac.currentTime;
    switch (name) {
      case 'tap': tone(720, t, .09, .25, 'sine', 380); break;
      case 'join': [880, 1174.7].forEach(function (f, k) { chime(f, t + k * .08, .15, .4); }); break;
      case 'open': whoosh(t, .4, .25, 500, 4000); chime(1568, t + .1, .12, .45); break;
      case 'correct': [1046.5, 1318.5, 1568, 2093].forEach(function (f, k) { chime(f, t + k * .075, .2, .75); }); break;
      case 'wrong': tone(330, t, .16, .3, 'triangle', 300); tone(247, t + .15, .28, .3, 'triangle', 215); break;
      case 'tick': tone(1500, t, .04, .12, 'square'); break;
      case 'coin': chime(1975, t, .18, .3); chime(2637, t + .08, .16, .5); break;
      case 'magic': whoosh(t, 1, .3, 300, 5000); [784, 988, 1175, 1568, 1976].forEach(function (f, k) { chime(f, t + .2 + k * .07, .14, .8); }); break;
      case 'bad': whoosh(t, .8, .35, 2000, 120); tone(196, t + .1, .6, .25, 'sawtooth', 98); break;
      case 'fairy': [1568, 2093, 2637, 3136, 2637, 3520].forEach(function (f, k) { chime(f, t + k * .1, .12, .9); }); break;
      case 'rune': [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach(function (f, k) { chime(f, t + k * .09, .18, 1.1); }); break;
      case 'fanfare': [523.25, 523.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5].forEach(function (f, k) { chime(f, t + k * .14, .2, .6); }); break;
      case 'gate': whoosh(t, 1.8, .4, 220, 70); [392, 493.88, 587.33, 783.99, 987.77].forEach(function (f, k) { chime(f, t + .5 + k * .12, .16, 1.6); }); break;
    }
  }
  function file(k, vol) {
    var a = files[k] || (files[k] = new Audio('audio/' + k + '.mp3'));
    try { a.currentTime = 0; a.volume = vol || .8; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  return { on: on, play: play, file: file };
})();
