/* 題目分享連結：把題目壓縮成網址 #q=... */
window.WQShare = {
  b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  unb64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
  async encode(obj) {
    var data = new TextEncoder().encode(JSON.stringify(obj));
    var cs = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return this.b64(new Uint8Array(await new Response(cs).arrayBuffer()));
  },
  async decode(text) {
    var ds = new Blob([this.unb64(text)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(ds).text());
  }
};
