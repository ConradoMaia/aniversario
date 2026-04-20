class BirthdayRouletteApp {
  constructor() {
    this.canvas = document.getElementById("wheelCanvas");
    this.spinButton = document.getElementById("spinButton");
    this.helperText = document.getElementById("helperText");
    this.wheelStage = document.querySelector(".wheel-stage");
    this.resultModal = document.getElementById("resultModal");
    this.resultTitle = document.getElementById("resultTitle");
    this.resultText = document.getElementById("resultText");
    this.revealButton = document.getElementById("revealButton");
    this.prizeCard = document.getElementById("prizeCard");
    this.birthdayMessage = document.getElementById("birthdayMessage");
    this.photoMural = document.getElementById("photoMural");
    this.photoGallery = document.getElementById("photoGallery");
    this.heartsContainer = document.querySelector(".floating-hearts");

    this.isSpinning = false;
    this.hasSpun = false;
    this.highlightedSegmentIndex = -1;
    this.content = {
      message:
        "Feliz aniversario, meu amor. Que o seu novo ciclo venha leve, divertido e cheio de coisas bonitas.",
      imageDataUrls: []
    };

    this.segments = [
      { lines: ["Casa", "nova"], weight: 2.8, color: "#f8c8d4" },
      { lines: ["Carro", "novo"], weight: 2.6, color: "#f3a8bb" },
      { lines: ["Viagem", "pra Europa"], weight: 2.7, color: "#ffd9df" },
      { lines: ["1 milhao", "de reais"], weight: 2.5, color: "#f6b6c8" },
      { lines: ["Nao foi", "dessa vez"], weight: 0.5, color: "#9d315d", losing: true }
    ];

    this.losingIndex = this.getLosingIndex();
    this.fakeStopIndex = 0;
    this.homeRotation = this.getSegmentTargetRotation(this.losingIndex);
    this.rotation = this.homeRotation;

    this.init();
  }

  async init() {
    this.spawnFloatingScene();
    this.bindEvents();
    this.resizeCanvas();
    await this.loadContent();
    this.updatePrizeContent();
    this.drawWheel();
  }

  bindEvents() {
    this.spinButton.addEventListener("click", () => this.spinWheel());
    this.revealButton.addEventListener("click", () => this.revealPrize());
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  spawnFloatingScene() {
    this.spawnFloatingGroup({
      count: 14,
      text: "❤",
      className: "float-heart",
      sizeMin: 18,
      sizeRange: 26,
      durationMin: 9,
      durationRange: 7,
      driftRange: 70,
      scaleX: 1,
      scaleY: 1
    });

    this.spawnFloatingGroup({
      count: 6,
      text: "🌻",
      className: "float-sunflower",
      sizeMin: 22,
      sizeRange: 20,
      durationMin: 11,
      durationRange: 6,
      driftRange: 58,
      scaleX: 1,
      scaleY: 1
    });

    this.spawnFloatingGroup({
      count: 4,
      text: "🐕",
      className: "float-dachshund",
      sizeMin: 26,
      sizeRange: 16,
      durationMin: 12,
      durationRange: 5,
      driftRange: 44,
      scaleX: 1.45,
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
      item.style.setProperty("--delay", `${Math.random() * -15}s`);
      item.style.setProperty("--drift", `${-config.driftRange + Math.random() * config.driftRange * 2}px`);
      item.style.setProperty("--rotate-end", `${-18 + Math.random() * 36}deg`);
      item.style.setProperty("--scale-x", String(config.scaleX));
      item.style.setProperty("--scale-y", String(config.scaleY));
      this.heartsContainer.appendChild(item);
    }
  }

  async loadContent() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o conteudo.");
      }

      const payload = await response.json();
      this.content = {
        ...payload,
        imageDataUrls: this.normalizeImageDataUrls(payload)
      };
    } catch (error) {
      this.helperText.textContent =
        "A surpresa abre normalmente, mas o conteudo editavel nao foi carregado.";
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

  resizeCanvas() {
    const size = Math.min(this.canvas.parentElement.clientWidth, 520);
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvasSize = size;

    this.drawWheel();
  }

  drawWheel() {
    if (!this.ctx || !this.canvasSize) {
      return;
    }

    const ctx = this.ctx;
    const size = this.canvasSize;
    const center = size / 2;
    const radius = center - 18;
    const totalWeight = this.segments.reduce((sum, segment) => sum + segment.weight, 0);

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 248, 250, 0.95)";
    ctx.shadowColor = "rgba(119, 27, 61, 0.2)";
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.restore();

    let currentAngle = -Math.PI / 2 + this.rotation;

    this.segments.forEach((segment, index) => {
      const segmentAngle = (segment.weight / totalWeight) * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, currentAngle, currentAngle + segmentAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      if (this.highlightedSegmentIndex === index) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, currentAngle, currentAngle + segmentAngle);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 248, 250, 0.22)";
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#fff8fa";
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, currentAngle, currentAngle + segmentAngle);
      ctx.closePath();
      ctx.clip();
      ctx.translate(center, center);
      ctx.rotate(currentAngle + segmentAngle / 2);
      ctx.textAlign = "center";
      ctx.fillStyle = segment.losing ? "#fff6f8" : "#6b2440";
      ctx.font = `${segment.losing ? Math.max(10, size * 0.024) : Math.max(13, size * 0.032)}px Georgia, serif`;

      segment.lines.forEach((line, lineIndex) => {
        const lineOffset = segment.lines.length === 1 ? 0 : (lineIndex - (segment.lines.length - 1) / 2) * 16;
        const textRadius = segment.losing ? radius - 28 : radius - 52;
        ctx.fillText(line, textRadius, lineOffset + 5);
      });

      ctx.restore();
      currentAngle += segmentAngle;
    });

    ctx.beginPath();
    ctx.arc(center, center, radius * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9fb";
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#f4c7d5";
    ctx.stroke();
  }

  getLosingIndex() {
    return this.segments.findIndex((segment) => segment.losing);
  }

  getSegmentBounds(index) {
    const totalWeight = this.segments.reduce((sum, segment) => sum + segment.weight, 0);
    let startAngle = 0;

    for (let cursor = 0; cursor < index; cursor += 1) {
      startAngle += (this.segments[cursor].weight / totalWeight) * Math.PI * 2;
    }

    const angle = (this.segments[index].weight / totalWeight) * Math.PI * 2;

    return { startAngle, angle };
  }

  normalizeAngle(angle) {
    const fullTurn = Math.PI * 2;
    return ((angle % fullTurn) + fullTurn) % fullTurn;
  }

  getSegmentTargetRotation(index) {
    const { startAngle, angle } = this.getSegmentBounds(index);
    return this.normalizeAngle(-(startAngle + angle / 2));
  }

  getForwardRotationToTarget(targetRotation, extraTurns) {
    const currentRotation = this.normalizeAngle(this.rotation);
    let delta = this.normalizeAngle(targetRotation - currentRotation);

    if (delta < 0.12) {
      delta += Math.PI * 2;
    }

    return this.rotation + delta + extraTurns * Math.PI * 2;
  }

  spinWheel() {
    if (this.isSpinning || this.hasSpun) {
      return;
    }

    this.isSpinning = true;
    this.highlightedSegmentIndex = -1;
    this.spinButton.disabled = true;
    this.helperText.textContent = "Girando a roleta de aniversario e escolhendo um premio bom demais...";

    const fakeStopRotation = this.getForwardRotationToTarget(
      this.getSegmentTargetRotation(this.fakeStopIndex),
      6.2 + Math.random() * 0.8
    );

    this.animateRiggedSpin(fakeStopRotation, 4300);
  }

  animateRiggedSpin(fakeStopRotation, duration) {
    const startRotation = this.rotation;
    const startTime = performance.now();

    const frame = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4.4);

      this.rotation = startRotation + (fakeStopRotation - startRotation) * eased;
      this.drawWheel();

      if (progress < 1) {
        requestAnimationFrame(frame);
        return;
      }

      this.rotation = fakeStopRotation;
      this.drawWheel();
      this.helperText.textContent = "Opa... o sistema resolveu conferir de novo.";

      window.setTimeout(() => {
        this.snapBackToLoss();
      }, 220);
    };

    requestAnimationFrame(frame);
  }

  snapBackToLoss() {
    this.rotation = this.homeRotation;
    this.isSpinning = false;
    this.hasSpun = true;
    this.highlightedSegmentIndex = this.losingIndex;
    this.drawWheel();
    this.helperText.textContent = "Pronto... olha bem: ela parou em Nao foi dessa vez.";
    this.wheelStage.classList.remove("loss-hit");
    void this.wheelStage.offsetWidth;
    this.wheelStage.classList.add("loss-hit");

    window.setTimeout(() => {
      this.showLossResult();
    }, 3000);
  }

  showLossResult() {
    document.body.classList.add("modal-open", "loss-mode");
    this.resultTitle.textContent = "Nao foi dessa vez...";
    this.resultText.textContent =
      "A roleta ate ensaiou te dar Casa nova, mas voltou correndo para o lugar dela.";
    this.helperText.textContent =
      "Resultado confirmado: a posicao inicial ja sabia exatamente onde ia parar.";
    this.resultModal.classList.remove("hidden");
  }

  revealPrize() {
    this.updatePrizeContent();
    document.body.classList.remove("loss-mode", "modal-open");
    document.body.classList.add("celebration-mode");
    this.resultModal.classList.add("hidden");
    this.prizeCard.classList.remove("hidden");
    this.helperText.textContent = "Agora sim: premio revelado.";
    this.revealButton.disabled = true;
    this.revealButton.textContent = "Premio revelado";
    this.prizeCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  updatePrizeContent() {
    this.birthdayMessage.innerHTML = this.formatText(this.content.message || "");
    this.renderPhotoGallery(this.normalizeImageDataUrls(this.content));
  }

  renderPhotoGallery(imageDataUrls) {
    this.photoGallery.innerHTML = "";

    if (!imageDataUrls.length) {
      this.photoMural.classList.add("hidden");
      return;
    }

    imageDataUrls.forEach((imageDataUrl, index) => {
      const card = document.createElement("figure");
      card.className = "photo-card";

      const image = document.createElement("img");
      image.src = imageDataUrl;
      image.alt = `Foto ${index + 1} da surpresa`;

      card.appendChild(image);
      this.photoGallery.appendChild(card);
    });

    this.photoMural.classList.remove("hidden");
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

new BirthdayRouletteApp();
