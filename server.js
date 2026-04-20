const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_SIZE = 8 * 1024 * 1024;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");

const DEFAULT_CONTENT = {
  message:
    "Feliz aniversario, meu amor. Que o seu novo ciclo venha leve, divertido e cheio de coisas bonitas. Obrigado por deixar a vida mais carinhosa, mais engracada e muito mais especial.",
  imageDataUrl: "",
  updatedAt: new Date().toISOString()
};

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CONTENT_FILE)) {
    writeContent(DEFAULT_CONTENT);
  }
}

function readContent() {
  try {
    const raw = fs.readFileSync(CONTENT_FILE, "utf8");
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULT_CONTENT,
      ...parsed
    };
  } catch (error) {
    return writeContent(DEFAULT_CONTENT);
  }
}

function writeContent(content) {
  const nextContent = {
    ...DEFAULT_CONTENT,
    ...content,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(CONTENT_FILE, JSON.stringify(nextContent, null, 2), "utf8");
  return nextContent;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(message);
}

function getFilePath(urlPath) {
  const normalizedPath = path
    .normalize(urlPath)
    .replace(/^([/\\])+/, "")
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.resolve(PUBLIC_DIR, normalizedPath);

  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function serveFile(response, filePath) {
  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      sendText(response, 404, "Arquivo nao encontrado.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=300"
    });
    response.end(fileBuffer);
  });
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let aborted = false;
    const chunks = [];

    request.on("data", (chunk) => {
      if (aborted) {
        return;
      }

      size += chunk.length;

      if (size > MAX_BODY_SIZE) {
        aborted = true;
        reject(new Error("Payload muito grande."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      if (aborted) {
        return;
      }

      const raw = Buffer.concat(chunks).toString("utf8").trim();

      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON invalido."));
      }
    });

    request.on("error", (error) => {
      if (!aborted) {
        reject(error);
      }
    });
  });
}

function sanitizeContent(payload) {
  const message =
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : DEFAULT_CONTENT.message;
  const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "";

  if (message.length > 5000) {
    throw new Error("A mensagem ficou grande demais.");
  }

  if (
    imageDataUrl &&
    !/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(imageDataUrl)
  ) {
    throw new Error("Formato de imagem nao suportado.");
  }

  if (imageDataUrl.length > 7500000) {
    throw new Error("A imagem ficou grande demais.");
  }

  return {
    message,
    imageDataUrl
  };
}

function routeRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "GET" && pathname === "/api/content") {
    sendJson(response, 200, readContent());
    return;
  }

  if (request.method === "POST" && pathname === "/api/content") {
    parseRequestBody(request)
      .then((payload) => {
        const nextContent = writeContent(sanitizeContent(payload));
        sendJson(response, 200, nextContent);
      })
      .catch((error) => {
        sendJson(response, 400, { error: error.message });
      });
    return;
  }

  if (request.method !== "GET") {
    sendText(response, 405, "Metodo nao permitido.");
    return;
  }

  if (pathname === "/" || pathname === "/index.html" || pathname === "/site" || pathname === "/site/") {
    serveFile(response, path.join(PUBLIC_DIR, "index.html"));
    return;
  }

  if (
    pathname === "/admin" ||
    pathname === "/admin/" ||
    pathname === "/site/admin" ||
    pathname === "/site/admin/"
  ) {
    serveFile(response, path.join(PUBLIC_DIR, "admin.html"));
    return;
  }

  const filePath = getFilePath(pathname);

  if (!filePath) {
    sendText(response, 404, "Pagina nao encontrada.");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendText(response, 404, "Pagina nao encontrada.");
      return;
    }

    serveFile(response, filePath);
  });
}

ensureDataFile();

const server = http.createServer(routeRequest);

server.listen(PORT, HOST, () => {
  console.log(`Surpresa rodando em http://localhost:${PORT}`);
});
