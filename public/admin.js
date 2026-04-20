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
    this.imageDataUrls = [];

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
      text: "❤",
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
      text: "🌻",
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
      text: "🐕",
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

  normalizeImageDataUrls(content) {
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
      this.messageInput.value = content.message || "";
      this.imageDataUrls = this.normalizeImageDataUrls(content);
      this.setStatus("Conteudo carregado. Edite o que quiser e salve.");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async handleImageSelection(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    if (this.imageDataUrls.length + files.length > this.maxImageCount) {
      this.setStatus(`Voce pode manter no maximo ${this.maxImageCount} fotos no mural.`, true);
      this.imageInput.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);

    if (oversizedFile) {
      this.setStatus(`A foto ${oversizedFile.name} passou de 5 MB.`, true);
      this.imageInput.value = "";
      return;
    }

    try {
      const dataUrls = await Promise.all(files.map((file) => this.readFileAsDataUrl(file)));
      this.imageDataUrls = [...this.imageDataUrls, ...dataUrls];
      this.imageInput.value = "";
      this.updatePreview();
      this.setStatus(`${files.length} foto(s) adicionada(s) ao preview. Falta salvar.`);
    } catch (error) {
      this.setStatus("Nao foi possivel ler uma das imagens.", true);
    }
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

    this.imageDataUrls = this.imageDataUrls.filter((_, cursor) => cursor !== index);
    this.updatePreview();
    this.setStatus("Foto removida do preview. Salve para aplicar.");
  }

  clearImages() {
    this.imageDataUrls = [];
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
          imageDataUrls: this.imageDataUrls
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel salvar.");
      }

      this.messageInput.value = payload.message || "";
      this.imageDataUrls = this.normalizeImageDataUrls(payload);
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

    if (!this.imageDataUrls.length) {
      this.previewMural.classList.add("hidden");
      return;
    }

    this.imageDataUrls.forEach((imageDataUrl, index) => {
      const card = document.createElement("figure");
      card.className = "photo-card admin-photo-card";

      const image = document.createElement("img");
      image.src = imageDataUrl;
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
