const { handleUpload } = require("@vercel/blob/client");
const { parseRequestBody, sendJson, sendText } = require("./http");
const { getStorageMode } = require("./content-store");

const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_PATHNAME = /^aniversario\/photos\/[a-z0-9][a-z0-9._-]*$/i;

async function handleBlobUploadApi(request, response) {
  if (request.method !== "POST") {
    sendText(response, 405, "Metodo nao permitido.");
    return;
  }

  if (getStorageMode() !== "blob") {
    sendJson(response, 400, {
      error: "Upload direto indisponivel. Configure BLOB_READ_WRITE_TOKEN para usar a Vercel Blob."
    });
    return;
  }

  try {
    const body = await parseRequestBody(request, 256 * 1024);
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!ALLOWED_PATHNAME.test(pathname)) {
          throw new Error("Caminho de upload invalido.");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false
        };
      }
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Falha ao preparar o upload." });
  }
}

module.exports = {
  handleBlobUploadApi
};
