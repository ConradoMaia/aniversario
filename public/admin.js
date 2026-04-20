class SurpriseAdminPage {
  constructor() {
    this.form = document.getElementById("adminForm");
    this.messageInput = document.getElementById("messageInput");
    this.imageInput = document.getElementById("imageInput");
    this.saveButton = document.getElementById("saveButton");
    this.clearImageButton = document.getElementById("clearImageButton");
    this.statusText = document.getElementById("statusText");
    this.previewMessage = document.getElementById("previewMessage");
    this.previewFrame = document.getElementById("previewFrame");
    this.previewPhoto = document.getElementById("previewPhoto");
    this.heartsContainer = document.querySelector(".floating-hearts");

    this.imageDataUrl = "";

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
    this.clearImageButton.addEventListener("click", () => this.clearImage());
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
      html: this.getDachshundSvgMarkup(),
      className: "float-dachshund",
      sizeMin: 28,
      sizeRange: 10,
      durationMin: 12,
      durationRange: 4,
      driftRange: 38,
      scaleX: 1,
      scaleY: 1
    });
  }

  spawnFloatingGroup(config) {
    for (let index = 0; index < config.count; index += 1) {
      const item = document.createElement("span");
      item.className = `floating-item ${config.className}`;
      if (config.html) {
        item.innerHTML = config.html;
      } else {
        item.textContent = config.text;
      }
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

  async loadContent() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o conteudo atual.");
      }

      const content = await response.json();
      this.messageInput.value = content.message || "";
      this.imageDataUrl = content.imageDataUrl || "";
      this.setStatus("Conteudo carregado. Edite o que quiser e salve.");
    } catch (error) {
      this.setStatus(error.message, true);
    }
  }

  async handleImageSelection(event) {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.setStatus("Escolha uma imagem menor que 5 MB.", true);
      this.imageInput.value = "";
      return;
    }

    try {
      this.imageDataUrl = await this.readFileAsDataUrl(file);
      this.setStatus("Imagem carregada no preview. Falta salvar.");
      this.updatePreview();
    } catch (error) {
      this.setStatus("Nao foi possivel ler a imagem.", true);
    }
  }

  clearImage() {
    this.imageDataUrl = "";
    this.imageInput.value = "";
    this.updatePreview();
    this.setStatus("Foto removida do preview. Salve para aplicar.");
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
          imageDataUrl: this.imageDataUrl
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel salvar.");
      }

      this.messageInput.value = payload.message || "";
      this.imageDataUrl = payload.imageDataUrl || "";
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

    if (this.imageDataUrl) {
      this.previewPhoto.src = this.imageDataUrl;
      this.previewFrame.classList.remove("hidden");
    } else {
      this.previewPhoto.removeAttribute("src");
      this.previewFrame.classList.add("hidden");
    }
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

