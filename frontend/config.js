// Alamat backend. Diatur otomatis:
//  - dibuka dari server backend sendiri (port 3000 / Render / Railway / domain sendiri) -> pakai alamat yang sama
//  - dibuka lokal / jaringan LAN -> http://<host>:3000
//  - frontend dipisah di hosting lain (Vercel, dll) atau dibungkus APK -> isi PRODUCTION_API dengan URL backend
// Kosongkan PRODUCTION_API kalau frontend dan backend satu server (kasus umum).
(function () {
  if (window.FOODCOURT_API_BASE) return;

  var PRODUCTION_API = ""; // contoh: "https://foodcourt-production.up.railway.app"
  var loc = window.location;
  var host = loc.hostname;

  var isPrivateHost =
    host === "localhost" || host === "127.0.0.1" ||
    /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (loc.protocol === "file:") {
    window.FOODCOURT_API_BASE = "http://localhost:3000";
  } else if (loc.port === "3000" || /(onrender\.com|railway\.app)$/.test(host)) {
    window.FOODCOURT_API_BASE = loc.origin;
  } else if (isPrivateHost) {
    window.FOODCOURT_API_BASE = "http://" + host + ":3000";
  } else {
    window.FOODCOURT_API_BASE = PRODUCTION_API || loc.origin;
  }
})();
