/* 多人連線：透過免費公開 MQTT 中繼伺服器（不需帳號）。
   網址加上 ?local=1 時改用同一台電腦的分頁互傳（測試用）。 */
window.WQNet = (function () {
  'use strict';
  var BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  var PREFIX = 'wordquest-andice0107/';
  var LOCAL = /[?&]local=1/.test(location.search);
  function code() { var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 5; i++) s += A.charAt(Math.floor(Math.random() * A.length)); return s; }
  /* role: 'host' 收 up、發 down；'player' 收 down、發 up */
  function open(opt) {
    var room = opt.code, inT = PREFIX + room + (opt.role === 'host' ? '/up' : '/down'), outT = PREFIX + room + (opt.role === 'host' ? '/down' : '/up');
    var api = { send: function () {}, close: function () {}, broker: 0 }, status = opt.onStatus || function () {};
    function recv(txt) { var d; try { d = JSON.parse(txt); } catch (e) { return; } opt.onMessage(d); }
    if (LOCAL) {
      var bc = new BroadcastChannel('wq-' + room);
      bc.onmessage = function (e) { if (e.data.t === inT) recv(e.data.m); };
      api.send = function (d) { bc.postMessage({ t: outT, m: JSON.stringify(d) }); };
      api.close = function () { bc.close(); };
      setTimeout(function () { status('online'); }, 50);
      return api;
    }
    var idx = opt.broker != null ? opt.broker : 0, client = null, tried = 0, ok = false, queue = [];
    function connect() {
      status('connecting');
      client = mqtt.connect(BROKERS[idx], { clientId: 'wq_' + Math.random().toString(16).slice(2, 10), clean: true, connectTimeout: 8000, reconnectPeriod: 2000, keepalive: 30 });
      var timer = setTimeout(function () { if (!ok && opt.broker == null && tried < BROKERS.length - 1) { tried++; try { client.end(true); } catch (e) {} idx = (idx + 1) % BROKERS.length; connect(); } }, 9000);
      client.on('connect', function () {
        clearTimeout(timer); ok = true; api.broker = idx;
        client.subscribe(inT, { qos: 0 }, function () { status('online'); while (queue.length) api.send(queue.shift()); });
      });
      client.on('reconnect', function () { status('connecting'); });
      client.on('offline', function () { status('offline'); });
      client.on('error', function () { status('offline'); });
      client.on('message', function (t, m) { recv(m.toString()); });
    }
    api.send = function (d) { if (client && client.connected) client.publish(outT, JSON.stringify(d), { qos: 0 }); else if (queue.length < 50) queue.push(d); };
    api.close = function () { try { client.end(true); } catch (e) {} };
    connect();
    return api;
  }
  return { open: open, code: code, LOCAL: LOCAL };
})();
