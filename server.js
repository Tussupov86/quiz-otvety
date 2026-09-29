// АЮ READY КВИЗ — ответы и команды. Простой сервер без зависимостей.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "state.json");
const INDEX = path.join(__dirname, "public", "index.html");

fs.mkdirSync(DATA_DIR, { recursive: true });

let state = { answers: { updatedAt: 0, data: null }, teams: { updatedAt: 0, data: null } };
try { state = { ...state, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }; } catch (e) {}

function persist() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE); // атомарная запись — файл не повредится
}

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/api/state") return send(res, 200, JSON.stringify(state));

  if (req.method === "POST" && url === "/api/save") {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try {
        const { section, updatedAt, data } = JSON.parse(raw);
        if (!["answers", "teams"].includes(section) || typeof updatedAt !== "number") return send(res, 400, '{"error":"bad request"}');
        // принимаем только более свежую версию — старая вкладка не затрёт новую
        if (updatedAt >= (state[section].updatedAt || 0)) {
          state[section] = { updatedAt, data };
          persist();
        }
        send(res, 200, JSON.stringify({ ok: true, updatedAt: state[section].updatedAt }));
      } catch (e) { send(res, 400, '{"error":"bad json"}'); }
    });
    return;
  }

  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    return fs.readFile(INDEX, (err, buf) => err ? send(res, 500, "error", "text/plain") : send(res, 200, buf, "text/html; charset=utf-8"));
  }
  if (url === "/health") return send(res, 200, "ok", "text/plain");
  send(res, 404, "Not found", "text/plain; charset=utf-8");
}).listen(PORT, () => console.log("Квиз запущен на порту " + PORT));
