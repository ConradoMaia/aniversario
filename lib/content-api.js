const { parseRequestBody, sendJson, sendText } = require("./http");
const { readContent, sanitizeContent, writeContent } = require("./content-store");

async function handleContentApi(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, await readContent());
    return;
  }

  if (request.method === "POST") {
    try {
      const payload = await parseRequestBody(request);
      const nextContent = await writeContent(sanitizeContent(payload));
      sendJson(response, 200, nextContent);
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Nao foi possivel salvar." });
    }
    return;
  }

  sendText(response, 405, "Metodo nao permitido.");
}

module.exports = {
  handleContentApi
};
