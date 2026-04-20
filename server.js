const http = require("http");
const fs = require("fs");
const path = require("path");

const { handleContentApi } = require("./lib/content-api");
const { handleBlobUploadApi } = require("./lib/upload-api");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

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

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (pathname === "/api/content") {
    await handleContentApi(request, response);
    return;
  }

  if (pathname === "/api/upload") {
    await handleBlobUploadApi(request, response);
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

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    console.error(error);
    sendText(response, 500, "Erro interno do servidor.");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Surpresa rodando em http://localhost:${PORT}`);
});
