class AudioVJ {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.particles = [];
    this.isRunning = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.cursorTimeout = null;
    this.fluidVisualizer = null;
    this.wapuuImages = {};

    this.settings = {
      sensitivity: 1,
      frequencyRange: "mid",
      particleShape: "circle",
      particleSize: 10,
      particleCount: 100,
      particleLife: 2,
      gravity: 0.1,
      wind: 0,
      rotation: false,
      trail: true,
      bloom: false,
      colorMode: "rainbow",
      mainColor: "#ff0080",
      subColor: "#0080ff",
      opacity: 0.8,
      visualMode: "fluid", // 新しい設定
      flowIntensity: 1.5,
      waveAmplitude: 50,
    };

    this.init();
  }

  init() {
    this.setupCanvas();
    this.preloadWapuuImages();
    this.setupControls();
    this.setupMouseEvents();
    this.setupFullscreenEvents();
    this.loadPresets();
    this.fluidVisualizer = new FluidVisualizer(this.canvas, this.ctx);
    this.animate();
  }

  preloadWapuuImages() {
    const colors = ['black', 'blue', 'green', 'red', 'yellow'];
    colors.forEach(color => {
      const img = new Image();
      img.src = `images/wapuu_${color}@2x-8.png`;
      img.onload = () => {
        console.log(`Loaded wapuu_${color} image`);
      };
      img.onerror = () => {
        console.error(`Failed to load wapuu_${color} image`);
      };
      this.wapuuImages[`wapuu_${color}`] = img;
    });
  }

  setupCanvas() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // FluidVisualizerが初期化されている場合は再初期化
    if (this.fluidVisualizer) {
      this.fluidVisualizer = new FluidVisualizer(this.canvas, this.ctx);
    }
  }

  setupControls() {
    console.log("Setting up controls...");

    // 各コントロールのイベントリスナーを設定
    Object.keys(this.settings).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        element.addEventListener("input", (e) => {
          if (e.target.type === "checkbox") {
            this.settings[key] = e.target.checked;
          } else if (e.target.type === "range") {
            this.settings[key] = parseFloat(e.target.value);
          } else {
            this.settings[key] = e.target.value;
          }
        });

        // 初期値を設定
        if (element.type === "checkbox") {
          element.checked = this.settings[key];
        } else if (element.type === "range") {
          element.value = this.settings[key];
        } else {
          element.value = this.settings[key];
        }
      } else {
        console.warn(`Element with id '${key}' not found`);
      }
    });

    // ボタンイベント
    console.log("Setting up button events...");
    const startStopBtn = document.getElementById("startStop");
    console.log("startStop button found:", !!startStopBtn);

    if (startStopBtn) {
      console.log("Adding click listener to startStop button");
      startStopBtn.addEventListener("click", (e) => {
        console.log("Start/Stop button clicked, event:", e);
        e.preventDefault();
        this.toggleAudio();
      });

      // ボタンが実際にクリック可能かテスト
      console.log("Button element:", startStopBtn);
      console.log("Button text:", startStopBtn.textContent);
      console.log("Button disabled:", startStopBtn.disabled);
    } else {
      console.error("startStop button not found in DOM");
      // DOMの状態を確認
      console.log("All buttons in DOM:");
      document.querySelectorAll("button").forEach((btn, index) => {
        console.log(`Button ${index}:`, btn.id, btn.textContent);
      });
    }

    // 他のボタンも同様に設定
    const fullscreenBtn = document.getElementById("fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    }

    const savePresetBtn = document.getElementById("savePreset");
    if (savePresetBtn) {
      savePresetBtn.addEventListener("click", () => this.savePreset());
    }

    const loadPresetBtn = document.getElementById("loadPreset");
    if (loadPresetBtn) {
      loadPresetBtn.addEventListener("click", () => this.loadPreset());
    }

    const deletePresetBtn = document.getElementById("deletePreset");
    if (deletePresetBtn) {
      deletePresetBtn.addEventListener("click", () => this.deletePreset());
    }

    console.log("Controls setup complete");
  }

  setupMouseEvents() {
    this.canvas.addEventListener("mousemove", (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    this.canvas.addEventListener("click", (e) => {
      this.createParticleBurst(e.clientX, e.clientY);
    });
  }

  async toggleAudio() {
    console.log("toggleAudio called, isRunning:", this.isRunning);

    if (!this.isRunning) {
      try {
        console.log("Attempting to start audio...");
        await this.startAudio();
        document.getElementById("startStop").textContent = "停止";
        this.isRunning = true;
        console.log("Audio started successfully");
      } catch (error) {
        console.error("オーディオの開始に失敗:", error);
        console.error("Error details:", error.name, error.message);
        alert(
          `マイクへのアクセスに失敗しました: ${error.message}\n\nHTTPSでアクセスしているか、ブラウザの設定を確認してください。`
        );
      }
    } else {
      this.stopAudio();
      document.getElementById("startStop").textContent = "開始";
      this.isRunning = false;
      console.log("Audio stopped");
    }
  }

  async startAudio() {
    console.log("startAudio called");
    console.log("Current URL:", window.location.href);
    console.log("Is HTTPS:", window.location.protocol === "https:");
    console.log(
      "Is localhost:",
      window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );

    // ブラウザサポートチェック
    if (!navigator.mediaDevices) {
      throw new Error("navigator.mediaDevices がサポートされていません");
    }

    if (!navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia がサポートされていません");
    }

    console.log("MediaDevices supported");

    // 利用可能なデバイスを確認
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );
      console.log("Available audio input devices:", audioInputs.length);
      audioInputs.forEach((device, index) => {
        console.log(
          `Device ${index}:`,
          device.label || `Microphone ${index + 1}`
        );
      });
    } catch (error) {
      console.warn("Could not enumerate devices:", error);
    }

    console.log("Creating AudioContext...");
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    console.log("AudioContext state:", this.audioContext.state);

    // AudioContextの状態チェック
    if (this.audioContext.state === "suspended") {
      console.log("AudioContext is suspended, resuming...");
      await this.audioContext.resume();
      console.log("AudioContext resumed, new state:", this.audioContext.state);
    }

    console.log("Creating analyser...");
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    console.log(
      "Analyser created, frequency bin count:",
      this.analyser.frequencyBinCount
    );

    console.log("Requesting microphone access...");

    // より基本的な設定でマイクアクセスを試行
    const constraints = {
      audio: true,
    };

    console.log("getUserMedia constraints:", constraints);

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    console.log("Microphone access granted");
    console.log("Stream active:", stream.active);
    console.log("Audio tracks:", stream.getAudioTracks().length);

    if (stream.getAudioTracks().length === 0) {
      throw new Error("オーディオトラックが見つかりません");
    }

    console.log("Creating media stream source...");
    this.microphone = this.audioContext.createMediaStreamSource(stream);
    this.microphone.connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    console.log(
      "Audio setup complete, data array length:",
      this.dataArray.length
    );

    // テスト用にオーディオデータを確認
    setTimeout(() => {
      this.analyser.getByteFrequencyData(this.dataArray);
      const sum = Array.from(this.dataArray).reduce((a, b) => a + b, 0);
      console.log(
        "Audio data test - sum:",
        sum,
        "average:",
        sum / this.dataArray.length
      );
    }, 1000);
  }

  stopAudio() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getAudioData() {
    if (!this.analyser || !this.dataArray) return 0;

    this.analyser.getByteFrequencyData(this.dataArray);

    let start, end;
    const length = this.dataArray.length;

    switch (this.settings.frequencyRange) {
      case "low":
        start = 0;
        end = Math.floor(length * 0.3);
        break;
      case "mid":
        start = Math.floor(length * 0.3);
        end = Math.floor(length * 0.7);
        break;
      case "high":
        start = Math.floor(length * 0.7);
        end = length;
        break;
      default:
        start = 0;
        end = length;
    }

    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += this.dataArray[i];
    }

    return (sum / (end - start)) * this.settings.sensitivity;
  }

  createParticles(audioLevel) {
    const particleCount = Math.floor(
      (audioLevel / 255) * this.settings.particleCount
    );

    for (let i = 0; i < particleCount; i++) {
      this.particles.push(
        new Particle(
          this.canvas.width / 2 + (Math.random() - 0.5) * 200,
          this.canvas.height / 2 + (Math.random() - 0.5) * 200,
          this.settings,
          audioLevel
        )
      );
    }
  }

  createParticleBurst(x, y) {
    for (let i = 0; i < 20; i++) {
      this.particles.push(new Particle(x, y, this.settings, 200));
    }
  }

  updateParticles() {
    this.particles = this.particles.filter((particle) => {
      particle.update(this.settings);
      return particle.life > 0;
    });
  }

  drawParticles() {
    this.particles.forEach((particle) => {
      particle.draw(this.ctx, this.settings);
    });
  }

  getColor(particle, settings) {
    const colors = {
      rainbow: this.getRainbowColor(particle.hue),
      fire: this.getFireColor(particle.life / particle.maxLife),
      ocean: this.getOceanColor(particle.life / particle.maxLife),
      neon: this.getNeonColor(particle.hue),
      custom: this.getCustomColor(particle.life / particle.maxLife, settings),
    };

    return colors[settings.colorMode] || colors.rainbow;
  }

  getRainbowColor(hue) {
    return `hsl(${hue}, 100%, 50%)`;
  }

  getFireColor(life) {
    const r = 255;
    const g = Math.floor(255 * life);
    const b = Math.floor(100 * life);
    return `rgb(${r}, ${g}, ${b})`;
  }

  getOceanColor(life) {
    const r = Math.floor(50 * life);
    const g = Math.floor(150 + 105 * life);
    const b = 255;
    return `rgb(${r}, ${g}, ${b})`;
  }

  getNeonColor(hue) {
    return `hsl(${hue}, 100%, 70%)`;
  }

  getCustomColor(life, settings) {
    const main = this.hexToRgb(settings.mainColor);
    const sub = this.hexToRgb(settings.subColor);

    const r = Math.floor(main.r * life + sub.r * (1 - life));
    const g = Math.floor(main.g * life + sub.g * (1 - life));
    const b = Math.floor(main.b * life + sub.b * (1 - life));

    return `rgb(${r}, ${g}, ${b})`;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  animate() {
    // ビジュアルモードに応じて背景処理を変更
    if (this.settings.visualMode === "particles") {
      if (this.settings.trail) {
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      // 流体系ビジュアルは部分的にクリア
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.isRunning && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);

      // ビジュアルモードに応じて描画
      switch (this.settings.visualMode) {
        case "fluid":
          this.fluidVisualizer.drawFluidMode(this.dataArray, this.settings);
          break;
        case "circular":
          this.fluidVisualizer.drawCircularMode(this.dataArray, this.settings);
          break;
        case "radial":
          this.fluidVisualizer.drawRadialMode(this.dataArray, this.settings);
          break;
        case "waves":
          this.fluidVisualizer.drawWaveMode(this.dataArray, this.settings);
          break;
        case "spectrum":
          this.fluidVisualizer.drawSpectrumMode(this.dataArray, this.settings);
          break;
        case "particles":
        default:
          const audioLevel = this.getAudioData();
          if (audioLevel > 10) {
            this.createParticles(audioLevel);
          }
          this.updateParticles();
          this.drawParticles();
          break;
      }
    } else if (this.settings.visualMode === "particles") {
      this.updateParticles();
      this.drawParticles();
    }

    requestAnimationFrame(() => this.animate());
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  setupFullscreenEvents() {
    // フルスクリーン状態の変更を監視
    document.addEventListener("fullscreenchange", () => {
      this.handleFullscreenChange();
    });

    // マウス移動でメニュー表示制御（フルスクリーン時のみ）
    document.addEventListener("mousemove", (e) => {
      this.handleMouseMove(e);
    });

    // ESCキーでフルスクリーン終了
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen();
      }
    });
  }

  handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;

    if (isFullscreen) {
      document.body.classList.add("fullscreen");
      console.log("Entered fullscreen mode");
    } else {
      document.body.classList.remove("fullscreen");
      console.log("Exited fullscreen mode");
    }

    // ボタンテキストを更新
    const fullscreenBtn = document.getElementById("fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.textContent = isFullscreen
        ? "フルスクリーン終了"
        : "フルスクリーン";
    }
  }

  handleMouseMove(e) {
    if (!document.fullscreenElement) return;

    const controls = document.getElementById("controls");
    if (!controls) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // カーソル表示制御
    document.body.classList.add("show-cursor");
    clearTimeout(this.cursorTimeout);
    this.cursorTimeout = setTimeout(() => {
      if (document.fullscreenElement) {
        document.body.classList.remove("show-cursor");
      }
    }, 2000);

    // 右端から250px以内、または右上角付近でメニューを表示
    const showMenu =
      mouseX > windowWidth - 250 ||
      (mouseX > windowWidth - 350 && mouseY < 100);

    if (showMenu) {
      controls.classList.add("show");
    } else {
      controls.classList.remove("show");
    }
  }

  savePreset() {
    const name = document.getElementById("presetName").value.trim();
    if (!name) {
      alert("プリセット名を入力してください");
      return;
    }

    const presets = JSON.parse(localStorage.getItem("vjPresets") || "{}");
    presets[name] = { ...this.settings };
    localStorage.setItem("vjPresets", JSON.stringify(presets));

    this.updatePresetList();
    document.getElementById("presetName").value = "";
    alert(`プリセット "${name}" を保存しました`);
  }

  loadPreset() {
    const name = document.getElementById("presetList").value;
    if (!name) return;

    const presets = JSON.parse(localStorage.getItem("vjPresets") || "{}");
    if (presets[name]) {
      this.settings = { ...presets[name] };
      this.updateControls();
    }
  }

  deletePreset() {
    const name = document.getElementById("presetList").value;
    if (!name) return;

    if (confirm(`プリセット "${name}" を削除しますか？`)) {
      const presets = JSON.parse(localStorage.getItem("vjPresets") || "{}");
      delete presets[name];
      localStorage.setItem("vjPresets", JSON.stringify(presets));
      this.updatePresetList();
    }
  }

  updatePresetList() {
    const presets = JSON.parse(localStorage.getItem("vjPresets") || "{}");
    const select = document.getElementById("presetList");

    select.innerHTML = '<option value="">プリセットを選択</option>';
    Object.keys(presets).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  }

  updateControls() {
    Object.keys(this.settings).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = this.settings[key];
        } else {
          element.value = this.settings[key];
        }
      }
    });
  }

  loadPresets() {
    this.updatePresetList();
  }
}

class FluidVisualizer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.time = 0;
    this.flowField = [];
    this.streamlines = [];
    this.wavePoints = [];
    this.spectrumBars = [];

    this.initializeFlowField();
    this.initializeStreamlines();
    this.initializeWavePoints();
  }

  initializeFlowField() {
    const cols = Math.floor(this.canvas.width / 20);
    const rows = Math.floor(this.canvas.height / 20);

    for (let i = 0; i < cols * rows; i++) {
      this.flowField[i] = 0;
    }
  }

  initializeStreamlines() {
    for (let i = 0; i < 50; i++) {
      this.streamlines.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: 0,
        vy: 0,
        life: Math.random() * 100 + 50,
        maxLife: 150,
        hue: Math.random() * 360,
      });
    }
  }

  initializeWavePoints() {
    for (let i = 0; i < 128; i++) {
      this.wavePoints.push({
        x: (i / 128) * this.canvas.width,
        y: this.canvas.height / 2,
        baseY: this.canvas.height / 2,
        amplitude: 0,
      });
    }
  }

  updateFlowField(audioData, settings) {
    const cols = Math.floor(this.canvas.width / 20);
    const rows = Math.floor(this.canvas.height / 20);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const index = x + y * cols;
        const audioIndex = Math.floor((x / cols) * audioData.length);
        const audioValue = audioData[audioIndex] || 0;

        this.flowField[index] =
          (audioValue / 255) * Math.PI * 2 * settings.flowIntensity;
      }
    }
  }

  drawFluidMode(audioData, settings) {
    this.time += 0.02;
    this.updateFlowField(audioData, settings);

    // 背景グラデーション
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      0,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.width / 2
    );
    gradient.addColorStop(0, "rgba(10, 5, 30, 0.1)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 流体ストリームライン
    this.drawStreamlines(audioData, settings);

    // 中央の波形
    this.drawCenterWave(audioData, settings);
  }

  drawStreamlines(audioData, settings) {
    const cols = Math.floor(this.canvas.width / 20);

    this.streamlines.forEach((stream) => {
      // フローフィールドから力を取得
      const col = Math.floor(stream.x / 20);
      const row = Math.floor(stream.y / 20);
      const index = col + row * cols;

      if (index >= 0 && index < this.flowField.length) {
        const angle = this.flowField[index];
        stream.vx += Math.cos(angle) * 0.1;
        stream.vy += Math.sin(angle) * 0.1;
      }

      // 音響データに基づく追加の力
      const audioIndex = Math.floor(
        (stream.x / this.canvas.width) * audioData.length
      );
      const audioForce = (audioData[audioIndex] || 0) / 255;

      stream.vx += (Math.random() - 0.5) * audioForce * 2;
      stream.vy += (Math.random() - 0.5) * audioForce * 2;

      // 速度制限
      stream.vx *= 0.95;
      stream.vy *= 0.95;

      // 位置更新
      stream.x += stream.vx;
      stream.y += stream.vy;

      // 境界チェック
      if (
        stream.x < 0 ||
        stream.x > this.canvas.width ||
        stream.y < 0 ||
        stream.y > this.canvas.height
      ) {
        stream.x = Math.random() * this.canvas.width;
        stream.y = Math.random() * this.canvas.height;
        stream.vx = 0;
        stream.vy = 0;
        stream.life = stream.maxLife;
      }

      // 描画
      stream.life--;
      if (stream.life <= 0) {
        stream.x = Math.random() * this.canvas.width;
        stream.y = Math.random() * this.canvas.height;
        stream.life = stream.maxLife;
        stream.hue = Math.random() * 360;
      }

      const alpha = (stream.life / stream.maxLife) * settings.opacity;
      const hue = (stream.hue + this.time * 50) % 360;

      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      this.ctx.lineWidth = 2 + audioForce * 3;
      this.ctx.lineCap = "round";

      this.ctx.beginPath();
      this.ctx.moveTo(stream.x, stream.y);
      this.ctx.lineTo(stream.x - stream.vx * 10, stream.y - stream.vy * 10);
      this.ctx.stroke();
      this.ctx.restore();
    });
  }

  drawCenterWave(audioData, settings) {
    // 波形ポイントを更新
    this.wavePoints.forEach((point, i) => {
      const audioValue =
        audioData[
          Math.floor((i / this.wavePoints.length) * audioData.length)
        ] || 0;
      point.amplitude = (audioValue / 255) * settings.waveAmplitude;
      point.y =
        point.baseY + Math.sin(this.time * 2 + i * 0.1) * point.amplitude;
    });

    // 波形を描画
    this.ctx.save();
    this.ctx.strokeStyle = `hsl(${(this.time * 30) % 360}, 100%, 70%)`;
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.ctx.strokeStyle;

    this.ctx.beginPath();
    this.wavePoints.forEach((point, i) => {
      if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        const prevPoint = this.wavePoints[i - 1];
        const cpx = (prevPoint.x + point.x) / 2;
        const cpy = (prevPoint.y + point.y) / 2;
        this.ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpx, cpy);
      }
    });
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawWaveMode(audioData, settings) {
    // 複数の波形レイヤー
    for (let layer = 0; layer < 5; layer++) {
      this.ctx.save();

      const hue = (this.time * 20 + layer * 60) % 360;
      this.ctx.strokeStyle = `hsl(${hue}, 70%, ${50 + layer * 10}%)`;
      this.ctx.lineWidth = 2 - layer * 0.3;
      this.ctx.globalAlpha = 0.7 - layer * 0.1;

      this.ctx.beginPath();

      for (let i = 0; i < this.canvas.width; i += 2) {
        const audioIndex = Math.floor(
          (i / this.canvas.width) * audioData.length
        );
        const audioValue = audioData[audioIndex] || 0;

        const y =
          this.canvas.height / 2 +
          Math.sin(i * 0.01 + this.time * (2 + layer)) *
            (audioValue / 255) *
            settings.waveAmplitude *
            (1 + layer * 0.5);

        if (i === 0) {
          this.ctx.moveTo(i, y);
        } else {
          this.ctx.lineTo(i, y);
        }
      }

      this.ctx.stroke();
      this.ctx.restore();
    }

    this.time += 0.05;
  }

  drawSpectrumMode(audioData, settings) {
    const barWidth = this.canvas.width / audioData.length;

    audioData.forEach((value, i) => {
      const barHeight = (value / 255) * this.canvas.height * 0.8;
      const x = i * barWidth;
      const y = this.canvas.height - barHeight;

      const hue = (i * 2 + this.time * 50) % 360;

      // グラデーション
      const gradient = this.ctx.createLinearGradient(
        0,
        y,
        0,
        this.canvas.height
      );
      gradient.addColorStop(0, `hsl(${hue}, 100%, 70%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 30%)`);

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, barWidth - 1, barHeight);

      // 反射効果
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.scale(1, -0.5);
      this.ctx.fillRect(x, -this.canvas.height, barWidth - 1, barHeight);
      this.ctx.restore();
    });

    this.time += 0.02;
  }

  drawCircularMode(audioData, settings) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY) * 0.9;

    // 暗い背景
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 放射状スペクトラムバー（メイン）
    this.drawRadialSpectrumBars(
      centerX,
      centerY,
      maxRadius,
      audioData,
      settings
    );

    // 中央の大きな円
    this.drawMainCentralCircle(centerX, centerY, audioData, settings);

    // 内側の小さな円（アクセント）
    this.drawInnerAccentCircle(centerX, centerY, audioData, settings);

    this.time += 0.02;
  }

  drawRadialSpectrumBars(centerX, centerY, maxRadius, audioData, settings) {
    const numBars = 64; // バーの数を64に固定
    const angleStep = (Math.PI * 2) / numBars;
    const innerRadius = maxRadius * 0.35; // 内側の半径
    const maxBarLength = maxRadius * 0.5; // バーの最大長

    for (let i = 0; i < numBars; i++) {
      const angle = i * angleStep + this.time * 0.5; // ゆっくり回転
      const audioIndex = Math.floor((i / numBars) * audioData.length);
      const audioValue = audioData[audioIndex] || 0;
      const barLength = (audioValue / 255) * maxBarLength;

      // バーの開始点と終了点
      const x1 = centerX + Math.cos(angle) * innerRadius;
      const y1 = centerY + Math.sin(angle) * innerRadius;
      const x2 = centerX + Math.cos(angle) * (innerRadius + barLength);
      const y2 = centerY + Math.sin(angle) * (innerRadius + barLength);

      // 色の計算（周波数に基づく）
      const hue = (i * 5.625 + this.time * 30) % 360; // 360/64 = 5.625
      const saturation = 70 + (audioValue / 255) * 30;
      const lightness = 50 + (audioValue / 255) * 30;

      this.ctx.save();
      this.ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = "round";
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawMainCentralCircle(centerX, centerY, audioData, settings) {
    // 音楽の平均レベルを計算
    const avgLevel =
      audioData.reduce((sum, val) => sum + val, 0) / audioData.length;
    const baseRadius = Math.min(centerX, centerY) * 0.25;
    const radius = baseRadius + (avgLevel / 255) * 30;

    // メインの円のグラデーション
    const gradient = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );

    const hue = (this.time * 40) % 360;
    gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.9)`);
    gradient.addColorStop(0.6, `hsla(${hue + 40}, 70%, 50%, 0.7)`);
    gradient.addColorStop(1, `hsla(${hue + 80}, 60%, 30%, 0.3)`);

    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.shadowBlur = 40;
    this.ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // 円の輪郭
    this.ctx.save();
    this.ctx.strokeStyle = `hsla(${hue + 120}, 90%, 80%, 0.8)`;
    this.ctx.lineWidth = 3;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = `hsl(${hue + 120}, 100%, 70%)`;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawInnerAccentCircle(centerX, centerY, audioData, settings) {
    // 高周波数の平均を計算
    const highFreqStart = Math.floor(audioData.length * 0.7);
    const highFreqData = audioData.slice(highFreqStart);
    const highFreqAvg =
      highFreqData.reduce((sum, val) => sum + val, 0) / highFreqData.length;

    const baseRadius = Math.min(centerX, centerY) * 0.08;
    const radius = baseRadius + (highFreqAvg / 255) * 20;

    // 内側の小さな円
    const hue = (this.time * 80 + 180) % 360;

    this.ctx.save();
    this.ctx.fillStyle = `hsla(${hue}, 100%, 80%, 0.9)`;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // パルス効果
    if (highFreqAvg > 100) {
      const pulseRadius = radius + 15;
      this.ctx.save();
      this.ctx.strokeStyle = `hsla(${hue}, 100%, 90%, 0.6)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawRadialMode(audioData, settings) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY);

    // 背景
    const bgGradient = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      maxRadius
    );
    bgGradient.addColorStop(0, "rgba(0, 0, 0, 0.1)");
    bgGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");

    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 放射状のライン
    this.drawRadialLines(centerX, centerY, maxRadius, audioData, settings);

    // 同心円
    this.drawConcentricCircles(
      centerX,
      centerY,
      maxRadius,
      audioData,
      settings
    );

    // 中央のパルス
    this.drawCentralPulse(centerX, centerY, audioData, settings);

    this.time += 0.02;
  }

  drawRadialLines(centerX, centerY, maxRadius, audioData, settings) {
    const numLines = 36;
    const angleStep = (Math.PI * 2) / numLines;

    for (let i = 0; i < numLines; i++) {
      const angle = i * angleStep + this.time * 0.5;
      const audioIndex = Math.floor((i / numLines) * audioData.length);
      const audioValue = audioData[audioIndex] || 0;
      const lineLength = (audioValue / 255) * maxRadius * 0.8;

      const x1 = centerX + Math.cos(angle) * (maxRadius * 0.2);
      const y1 = centerY + Math.sin(angle) * (maxRadius * 0.2);
      const x2 = centerX + Math.cos(angle) * (maxRadius * 0.2 + lineLength);
      const y2 = centerY + Math.sin(angle) * (maxRadius * 0.2 + lineLength);

      const hue = (i * 10 + this.time * 100) % 360;
      const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.9)`);
      gradient.addColorStop(1, `hsla(${hue + 60}, 100%, 50%, 0.2)`);

      this.ctx.save();
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = "round";
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawConcentricCircles(centerX, centerY, maxRadius, audioData, settings) {
    const numCircles = 8;

    for (let i = 0; i < numCircles; i++) {
      const baseRadius = (maxRadius / numCircles) * (i + 1);
      const audioIndex = Math.floor((i / numCircles) * audioData.length);
      const audioValue = audioData[audioIndex] || 0;
      const radius =
        baseRadius + Math.sin(this.time * 3 + i) * (audioValue / 255) * 20;

      const hue = (i * 45 + this.time * 80) % 360;

      this.ctx.save();
      this.ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.6 - i * 0.05})`;
      this.ctx.lineWidth = 2;
      this.ctx.shadowBlur = 5;
      this.ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawCentralPulse(centerX, centerY, audioData, settings) {
    const avgLevel =
      audioData.reduce((sum, val) => sum + val, 0) / audioData.length;
    const pulseRadius = 20 + (avgLevel / 255) * 60;

    // 複数のパルス層
    for (let i = 0; i < 3; i++) {
      const radius = pulseRadius * (1 + i * 0.3);
      const hue = (this.time * 120 + i * 120) % 360;

      const gradient = this.ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );
      gradient.addColorStop(0, `hsla(${hue}, 100%, 80%, ${0.8 - i * 0.2})`);
      gradient.addColorStop(
        0.7,
        `hsla(${hue + 30}, 80%, 60%, ${0.4 - i * 0.1})`
      );
      gradient.addColorStop(1, `hsla(${hue + 60}, 60%, 40%, 0)`);

      this.ctx.save();
      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;

      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }
}

class Particle {
  constructor(x, y, settings, audioLevel) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.life = settings.particleLife;
    this.maxLife = settings.particleLife;
    this.size = settings.particleSize * (0.5 + Math.random() * 0.5);
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    this.hue = Math.random() * 360;
    this.audioLevel = audioLevel;
    
    // わぷー用のランダム色を選択
    if (settings.particleShape === 'wapuu_random') {
      const colors = ['black', 'blue', 'green', 'red', 'yellow'];
      this.wapuuColor = colors[Math.floor(Math.random() * colors.length)];
    }

    // オーディオレベルに基づいて初期速度を調整
    const speedMultiplier = 1 + (audioLevel / 255) * 2;
    this.vx *= speedMultiplier;
    this.vy *= speedMultiplier;
  }

  update(settings) {
    // 物理演算
    this.vy += settings.gravity;
    this.vx += settings.wind;

    // 位置更新
    this.x += this.vx;
    this.y += this.vy;

    // 回転
    if (settings.rotation) {
      this.rotation += this.rotationSpeed;
    }

    // 寿命減少
    this.life -= 0.016; // 60FPS想定

    // 色相変化
    this.hue += 1;
    if (this.hue > 360) this.hue = 0;

    // 速度減衰
    this.vx *= 0.99;
    this.vy *= 0.99;
  }

  draw(ctx, settings) {
    const alpha = (this.life / this.maxLife) * settings.opacity;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (settings.rotation) {
      ctx.rotate(this.rotation);
    }

    // ブルーム効果
    if (settings.bloom) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.getColor(settings);
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.getColor(settings);
    ctx.strokeStyle = this.getColor(settings);
    ctx.lineWidth = 2;

    this.drawShape(ctx, settings);

    ctx.restore();
  }

  drawShape(ctx, settings) {
    const size = this.size * (this.life / this.maxLife);

    switch (settings.particleShape) {
      case "circle":
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case "square":
        ctx.fillRect(-size / 2, -size / 2, size, size);
        break;

      case "triangle":
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size, size);
        ctx.lineTo(size, size);
        ctx.closePath();
        ctx.fill();
        break;

      case "star":
        this.drawStar(ctx, 0, 0, 5, size, size / 2);
        ctx.fill();
        break;

      case "wapuu_random":
        this.drawWapuuImage(ctx, `wapuu_${this.wapuuColor}`, size);
        break;
    }
  }

  drawWapuuImage(ctx, shapeType, size) {
    const img = window.audioVJ.wapuuImages[shapeType];
    if (img && img.complete) {
      const drawSize = size * 2;
      ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }

    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  getColor(settings) {
    const vj = window.audioVJ;
    return vj.getColor(this, settings);
  }
}

// アプリケーション初期化
console.log("Script loaded, document ready state:", document.readyState);

function initializeApp() {
  console.log("Initializing AudioVJ...");
  console.log("Document ready state:", document.readyState);

  // 必要な要素が存在するかチェック
  const canvas = document.getElementById("canvas");
  const startStopBtn = document.getElementById("startStop");

  console.log("Canvas found:", !!canvas);
  console.log("StartStop button found:", !!startStopBtn);

  if (!canvas) {
    console.error("Canvas element not found");
    return;
  }

  if (!startStopBtn) {
    console.error("StartStop button not found");
    return;
  }

  try {
    window.audioVJ = new AudioVJ();
    console.log("AudioVJ initialized successfully");

    // 初期化後にボタンが機能するかテスト
    setTimeout(() => {
      console.log("Testing button functionality...");
      const btn = document.getElementById("startStop");
      if (btn) {
        console.log("Button still exists after initialization");
        console.log("Button onclick:", btn.onclick);
        console.log(
          "Button event listeners:",
          getEventListeners
            ? getEventListeners(btn)
            : "getEventListeners not available"
        );
      }
    }, 100);
  } catch (error) {
    console.error("Failed to initialize AudioVJ:", error);
    console.error("Error stack:", error.stack);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOMが既に読み込まれている場合
  initializeApp();
}
