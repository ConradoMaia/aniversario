const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const CONTENT_BLOB_PATH = "aniversario/content.json";
const MAX_IMAGE_COUNT = 8;
const MAX_IMAGE_DATA_LENGTH = 7_500_000;
const MAX_TOTAL_IMAGE_DATA_LENGTH = 45_000_000;
const MAX_REMOTE_IMAGE_URL_LENGTH = 4000;

const DEFAULT_MESSAGE =
  "Feliz aniversario, meu amor. Que o seu novo ciclo venha leve, divertido e cheio de coisas bonitas. Obrigado por deixar a vida mais carinhosa, mais engracada e muito mais especial.";

const DEFAULT_CONTENT = {
  message: DEFAULT_MESSAGE,
  imageUrls: [],
  updatedAt: new Date().toISOString()
};

function getStorageMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "blob";
  }

  if (process.env.VERCEL) {
    return "unconfigured";
  }

  return "local";
}

function ensureLocalDataFile() {
  if (getStorageMode() !== "local") {
    return;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CONTENT_FILE)) {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2), "utf8");
  }
}

function normalizeImageUrls(content) {
  if (Array.isArray(content?.imageUrls)) {
    return content.imageUrls.filter((item) => typeof item === "string" && item.trim());
  }

  if (Array.isArray(content?.imageDataUrls)) {
    return content.imageDataUrls.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof content?.imageDataUrl === "string" && content.imageDataUrl.trim()) {
    return [content.imageDataUrl.trim()];
  }

  return [];
}

function normalizeContent(content) {
  return {
    message:
      typeof content?.message === "string" && content.message.trim() ? content.message.trim() : DEFAULT_MESSAGE,
    imageUrls: normalizeImageUrls(content),
    updatedAt:
      typeof content?.updatedAt === "string" && content.updatedAt.trim()
        ? content.updatedAt
        : DEFAULT_CONTENT.updatedAt
  };
}

function withRuntimeFields(content) {
  return {
    ...normalizeContent(content),
    storageMode: getStorageMode()
  };
}

function validateImageUrl(imageUrl) {
  if (imageUrl.startsWith("data:image/")) {
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(imageUrl)) {
      throw new Error("Formato de imagem nao suportado.");
    }

    if (imageUrl.length > MAX_IMAGE_DATA_LENGTH) {
      throw new Error("Uma das imagens ficou grande demais.");
    }

    return;
  }

  if (imageUrl.length > MAX_REMOTE_IMAGE_URL_LENGTH) {
    throw new Error("Uma das URLs de imagem ficou grande demais.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch (error) {
    throw new Error("Uma das imagens nao tem uma URL valida.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("As imagens remotas precisam usar HTTPS.");
  }
}

function sanitizeContent(payload) {
  const message =
    typeof payload?.message === "string" && payload.message.trim() ? payload.message.trim() : DEFAULT_MESSAGE;
  const imageUrls = normalizeImageUrls(payload);

  if (message.length > 5000) {
    throw new Error("A mensagem ficou grande demais.");
  }

  if (imageUrls.length > MAX_IMAGE_COUNT) {
    throw new Error(`Voce pode salvar no maximo ${MAX_IMAGE_COUNT} fotos.`);
  }

  let totalDataLength = 0;

  imageUrls.forEach((imageUrl) => {
    validateImageUrl(imageUrl);

    if (imageUrl.startsWith("data:image/")) {
      totalDataLength += imageUrl.length;
    }
  });

  if (totalDataLength > MAX_TOTAL_IMAGE_DATA_LENGTH) {
    throw new Error("O conjunto de fotos ficou grande demais.");
  }

  return {
    message,
    imageUrls
  };
}

function isManagedBlobUrl(imageUrl) {
  try {
    const parsedUrl = new URL(imageUrl);
    return parsedUrl.protocol === "https:" && parsedUrl.hostname.includes(".blob.vercel-storage.com");
  } catch (error) {
    return false;
  }
}

async function getBlobSdk() {
  return require("@vercel/blob");
}

async function readBlobText(pathname, access) {
  const { get } = await getBlobSdk();
  const blob = await get(pathname, { access });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return null;
  }

  return new Response(blob.stream).text();
}

async function readBlobContent() {
  try {
    const raw = await readBlobText(CONTENT_BLOB_PATH, "private");

    if (!raw) {
      return withRuntimeFields(DEFAULT_CONTENT);
    }

    return withRuntimeFields(JSON.parse(raw));
  } catch (error) {
    return withRuntimeFields(DEFAULT_CONTENT);
  }
}

async function writeBlobContent(content) {
  const { del, put } = await getBlobSdk();
  const previousContent = await readBlobContent();
  const nextContent = {
    ...normalizeContent(content),
    updatedAt: new Date().toISOString()
  };

  await put(CONTENT_BLOB_PATH, JSON.stringify(nextContent, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });

  const nextImageSet = new Set(nextContent.imageUrls);
  const removedImages = previousContent.imageUrls.filter(
    (imageUrl) => isManagedBlobUrl(imageUrl) && !nextImageSet.has(imageUrl)
  );

  if (removedImages.length) {
    await del(removedImages);
  }

  return withRuntimeFields(nextContent);
}

async function readLocalContent() {
  ensureLocalDataFile();

  try {
    const raw = await fs.promises.readFile(CONTENT_FILE, "utf8");
    return withRuntimeFields(JSON.parse(raw));
  } catch (error) {
    return writeLocalContent(DEFAULT_CONTENT);
  }
}

async function writeLocalContent(content) {
  ensureLocalDataFile();

  const nextContent = {
    ...normalizeContent(content),
    updatedAt: new Date().toISOString()
  };

  await fs.promises.writeFile(CONTENT_FILE, JSON.stringify(nextContent, null, 2), "utf8");
  return withRuntimeFields(nextContent);
}

async function readContent() {
  const storageMode = getStorageMode();

  if (storageMode === "blob") {
    return readBlobContent();
  }

  if (storageMode === "local") {
    return readLocalContent();
  }

  return withRuntimeFields(DEFAULT_CONTENT);
}

async function writeContent(content) {
  const storageMode = getStorageMode();

  if (storageMode === "blob") {
    return writeBlobContent(content);
  }

  if (storageMode === "local") {
    return writeLocalContent(content);
  }

  throw new Error("Configure BLOB_READ_WRITE_TOKEN na Vercel para salvar texto e fotos.");
}

ensureLocalDataFile();

module.exports = {
  CONTENT_BLOB_PATH,
  DEFAULT_CONTENT,
  MAX_IMAGE_COUNT,
  getStorageMode,
  normalizeContent,
  normalizeImageUrls,
  readContent,
  sanitizeContent,
  writeContent
};
