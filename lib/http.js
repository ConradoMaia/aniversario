const DEFAULT_MAX_BODY_SIZE = 2 * 1024 * 1024;

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function sendText(response, statusCode, message) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(message);
}

function parseRequestBody(request, maxBodySize = DEFAULT_MAX_BODY_SIZE) {
  if (request.body !== undefined && request.body !== null) {
    if (typeof request.body === "string") {
      return parseJsonString(request.body);
    }

    if (Buffer.isBuffer(request.body)) {
      return parseJsonString(request.body.toString("utf8"));
    }

    if (typeof request.body === "object") {
      return Promise.resolve(request.body);
    }
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    let aborted = false;
    const chunks = [];

    request.on("data", (chunk) => {
      if (aborted) {
        return;
      }

      size += chunk.length;

      if (size > maxBodySize) {
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

      try {
        resolve(parseJsonString(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", (error) => {
      if (!aborted) {
        reject(error);
      }
    });
  });
}

function parseJsonString(raw) {
  const normalized = String(raw || "").trim();

  if (!normalized) {
    return Promise.resolve({});
  }

  try {
    return Promise.resolve(JSON.parse(normalized));
  } catch (error) {
    return Promise.reject(new Error("JSON invalido."));
  }
}

module.exports = {
  DEFAULT_MAX_BODY_SIZE,
  parseRequestBody,
  sendJson,
  sendText
};
