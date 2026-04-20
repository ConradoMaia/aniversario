import { upload } from "https://esm.sh/@vercel/blob@2.3.3/client?bundle";

class SurpriseAdminPage {
  constructor() {
    this.form = document.getElementById("adminForm");
    this.messageInput = document.getElementById("messageInput");
    this.imageInput = document.getElementById("imageInput");
    this.saveButton = document.getElementById("saveButton");
    this.clearImageButton = document.getElementById("clearImageButton");
    this.statusText = document.getElementById("statusText");
    this.previewMessage = document.getElementById("previewMessage");
    this.previewMural = document.getElementById("previewMural");
    this.previewGallery = document.getElementById("previewGallery");
    this.heartsContainer = document.querySelector(".floating-hearts");

    this.maxImageCount = 8;
    this.imageUrls = [];
    this.storageMode = "local";
    this.isUploading = false;

    this.init();
  }

  async init() {
    this.spawnFloatingScene();
    this.bindEvents();
    await this.loadContent();
    this.updatePreview();
  }

  bindEvents() {
    this.form.addEventListener("submit", (event) => this.saveContent(event));
    this.messageInput.addEventListener("input", () => this.updatePreview());
    this.imageInput.addEventListener("change", (event) => this.handleImageSelection(event));
    this.clearImageButton.addEventListener("click", () => this.clearImages());
    this.previewGallery.addEventListener("click", (event) => this.handleGalleryClick(event));
  }

  spawnFloatingScene() {
    this.spawnFloatingGroup({
      count: 10,
      text: "\u2764",
      className: "float-heart",
      sizeMin: 18,
      sizeRange: 18,
      durationMin: 10,
      durationRange: 6,
      driftRange: 56,
      scaleX: 1,
      scaleY: 1
    });

    this.spawnFloatingGroup({
      count: 4,
      text: "\uD83C\uDF3B",
      className: "float-sunflower",
      sizeMin: 20,
      sizeRange: 16,
      durationMin: 11,
      durationRange: 5,
      driftRange: 48,
      scaleX: 1,
      scaleY: 1
    });

    this.spawnFloatingGroup({
      count: 2,
      text: "\uD83D\uDC15",
      className: "float-dachshund",
      sizeMin: 24,
      sizeRange: 12,
      durationMin: 12,
      durationRange: 4,
      driftRange: 38,
      scaleX: 1.4,
      scaleY: 1
    });
  }

  spawnFloatingGroup(config) {
    for (let index = 0; index < config.count; index += 1) {
      const item = document.createElement("span");
      item.className = `floating-item ${config.className}`;
      item.textContent = config.text;
      item.style.setProperty("--left", `${Math.random() * 100}%`);
      item.style.setProperty("--size", `${config.sizeMin + Math.random() * config.sizeRange}px`);
      item.style.setProperty("--duration", `${config.durationMin + Math.random() * config.durationRange}s`);
      item.style.setProperty("--delay", `${Math.random() * -12}s`);
      item.style.setProperty("--drift", `${-config.driftRange + Math.random() * config.driftRange * 2}px`);
      item.style.setProperty("--rotate-end", `${-16 + Math.random() * 32}deg`);
      item.style.setProperty("--scale-x", String(config.scaleX));
      item.style.setProperty("--scale-y", String(config.scaleY));
      this.heartsContainer.appendChild(item);
    }
  }

  normalizeImageUrls(content) {
    if (Array.isArray(content.imageUrls)) {
      return content.imageUrls.filter((item) => typeof item === "string" && item.trim());
    }

    if (Array.isArray(content.imageDataUrls)) {
      return content.imageDataUrls.filter((item) => typeof item === "string" && item.trim());
    }

    if (typeof content.imageDataUrl === "string" && content.imageDataUrl.trim()) {
      return [content.imageDataUrl.trim()];
    }

    return [];
  }

  async loadContent() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o conteudo atual.");
      }

      const content = await response.json();
      this.storageMode = content.storageMode || "local";
      this.messageInput.value = content.message || "";
      this.imageUrls = this.normalizeImageUrls(content);
      this.setStatus(this.getLoadedStatus(), this.storageMode === "unconfigured");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  getLoadedStatus() {
    if (this.storageMode === "blob") {
      return "Conteudo carregado. Upload direto da Vercel Blob ativo para fotos e mural.";
    }

    if (this.storageMode === "unconfigured") {
      return "Projeto aberto sem BLOB_READ_WRITE_TOKEN. O admin nao vai conseguir salvar na Vercel.";
    }

    return "Conteudo carregado. Modo local ativo para texto e fotos.";
  }

  async handleImageSelection(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    if (this.isUploading) {
      this.imageInput.value = "";
      return;
    }

    if (this.imageUrls.length + files.length > this.maxImageCount) {
      this.setStatus(`Voce pode manter no maximo ${this.maxImageCount} fotos no mural.`, true);
      this.imageInput.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > 12 * 1024 * 1024);

    if (oversizedFile) {
      this.setStatus(`A foto ${oversizedFile.name} passou de 12 MB.`, true);
      this.imageInput.value = "";
      return;
    }

    try {
      if (this.storageMode === "blob") {
        await this.uploadFilesToBlob(files);
      } else {
        const dataUrls = await Promise.all(files.map((file) => this.readFileAsDataUrl(file)));
        this.imageUrls = [...this.imageUrls, ...dataUrls];
        this.setStatus(`${files.length} foto(s) adicionada(s) ao preview. Falta salvar.`);
      }

      this.imageInput.value = "";
      this.updatePreview();
    } catch (error) {
      this.setStatus(error.message || "Nao foi possivel preparar uma das imagens.", true);
      this.imageInput.value = "";
    }
  }

  async uploadFilesToBlob(files) {
    this.isUploading = true;
    this.imageInput.disabled = true;
    this.saveButton.disabled = true;
    this.clearImageButton.disabled = true;

    try {
      const uploadedUrls = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        this.setStatus(`Enviando foto ${index + 1} de ${files.length} para a Vercel Blob...`);

        const result = await upload(this.createUploadPath(file), file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: file.size > 4 * 1024 * 1024,
          contentType: file.type || undefined
        });

        uploadedUrls.push(result.url);
      }

      this.imageUrls = [...this.imageUrls, ...uploadedUrls];
      this.setStatus(`${files.length} foto(s) enviada(s) para a Vercel Blob. Falta salvar o mural.`);
    } finally {
      this.isUploading = false;
      this.imageInput.disabled = false;
      this.saveButton.disabled = false;
      this.clearImageButton.disabled = false;
    }
  }

  createUploadPath(file) {
    const extension = this.getFileExtension(file.name, file.type);
    const safeBase = this.slugify(file.name.replace(/\.[a-z0-9]+$/i, "")) || "foto";
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const timestamp = Date.now();
    return `aniversario/photos/${timestamp}-${randomSuffix}-${safeBase}${extension}`;
  }

  getFileExtension(fileName, fileType) {
    const extensionMatch = fileName.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/i);

    if (extensionMatch) {
      return extensionMatch[0].replace(".jpeg", ".jpg");
    }

    if (fileType === "image/png") {
      return ".png";
    }

    if (fileType === "image/webp") {
      return ".webp";
    }

    if (fileType === "image/gif") {
      return ".gif";
    }

    return ".jpg";
  }

  slugify(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 42);
  }

  handleGalleryClick(event) {
    const button = event.target.closest("[data-remove-index]");

    if (!button) {
      return;
    }

    const index = Number(button.dataset.removeIndex);

    if (!Number.isInteger(index)) {
      return;
    }

    this.imageUrls = this.imageUrls.filter((_, cursor) => cursor !== index);
    this.updatePreview();
    this.setStatus("Foto removida do preview. Salve para aplicar.");
  }

  clearImages() {
    this.imageUrls = [];
    this.imageInput.value = "";
    this.updatePreview();
    this.setStatus("Todas as fotos foram removidas do preview. Salve para aplicar.");
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Falha ao ler imagem."));
      reader.readAsDataURL(file);
    });
  }

  async saveContent(event) {
    event.preventDefault();

    this.saveButton.disabled = true;
    this.saveButton.textContent = "Salvando...";
    this.setStatus("Salvando surpresa...");

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: this.messageInput.value,
          imageUrls: this.imageUrls
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel salvar.");
      }

      this.storageMode = payload.storageMode || this.storageMode;
      this.messageInput.value = payload.message || "";
      this.imageUrls = this.normalizeImageUrls(payload);
      this.updatePreview();
      this.setStatus("Surpresa salva com sucesso.");
    } catch (error) {
      this.setStatus(error.message, true);
    } finally {
      this.saveButton.disabled = false;
      this.saveButton.textContent = "Salvar surpresa";
    }
  }

  updatePreview() {
    const previewText =
      this.messageInput.value.trim() ||
      "A sua mensagem vai aparecer aqui assim que voce escrever alguma coisa.";

    this.previewMessage.innerHTML = this.formatText(previewText);
    this.renderPreviewGallery();
  }

  renderPreviewGallery() {
    this.previewGallery.innerHTML = "";

    if (!this.imageUrls.length) {
      this.previewMural.classList.add("hidden");
      return;
    }

    this.imageUrls.forEach((imageUrl, index) => {
      const card = document.createElement("figure");
      card.className = "photo-card admin-photo-card";

      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `Preview da foto ${index + 1}`;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-photo-button";
      removeButton.dataset.removeIndex = String(index);
      removeButton.textContent = "Remover";

      card.appendChild(image);
      card.appendChild(removeButton);
      this.previewGallery.appendChild(card);
    });

    this.previewMural.classList.remove("hidden");
  }

  setStatus(message, isError = false) {
    this.statusText.textContent = message;
    this.statusText.classList.toggle("error", isError);
  }

  formatText(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
      .replaceAll("\n", "<br>");
  }
}

new SurpriseAdminPage();