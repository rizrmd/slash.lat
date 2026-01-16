import Phaser from "phaser";
import { GameConfig } from "../types";
import { AudioManager } from "../managers/AudioManager";

export class LoadingScene extends Phaser.Scene {

  private fontLoaded: boolean = false;
  private audioManager?: AudioManager;
  private loadingProgressBar?: HTMLElement;
  private loadingText?: HTMLElement;

  constructor() {
    super({ key: "LoadingScene" });
  }

  preload(): void {
    // Initialize AudioManager and store in registry
    this.audioManager = new AudioManager(this);
    this.registry.set('managers', { audioManager: this.audioManager });

    // Get DOM elements
    this.loadingProgressBar = document.getElementById('loading-progress-bar') || undefined;
    this.loadingText = document.getElementById('loading-text') || undefined;

    // Load Google Font
    this.loadGoogleFont();

    // Load all game assets
    this.loadGameAssets();

    // Update progress bar
    this.load.on("progress", (value: number) => {
      if (this.loadingProgressBar) {
        this.loadingProgressBar.style.width = `${Math.round(value * 100)}%`;
      }
    });

    this.load.on("fileprogress", (file: any) => {
      if (this.loadingText) {
        this.loadingText.textContent = `Loading: ${file.key}`;
      }
    });

    this.load.on("complete", () => {
      // Wait for font to load before transitioning
      this.checkFontAndTransition();
    });
  }

  loadGoogleFont(): void {
    // Load Jura font from Google Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Jura:wght@400;700&display=swap";
    document.head.appendChild(link);

    // Wait for font to load
    if (document.fonts) {
      document.fonts.load("700 16px Jura").then(() => {
        this.fontLoaded = true;
      });
    } else {
      // Fallback for browsers without Font Loading API
      setTimeout(() => {
        this.fontLoaded = true;
      }, 2000);
    }
  }

  loadGameAssets(): void {
    // Load audio assets (with null check)
    if (this.audioManager) {
      this.audioManager.preloadAudio("knife-slash", "audio/knife-slash.mp3");
      this.audioManager.preloadAudio("knife-clank", "audio/knife-clank.mp3");
      this.audioManager.preloadAudio("punch-hit", "audio/punch-hit.mp3");
      this.audioManager.preloadAudio("electric-spark", "audio/electric-spark.mp3");
      this.audioManager.preloadAudio("explode", "audio/explode.mp3");
      this.audioManager.preloadAudio("coin-received", "audio/coin-received.mp3");
    }

    // Load backgrounds
    this.load.image("bg-orange", "image/bg-orange.png");
    this.load.image("bg-leaf", "image/bg-leaf.png");
    this.load.image("bg-fly", "image/bg-fly.png");
    this.load.image("game-bg", "image/game-bg.png");

    // Load character assets
    this.load.image("orange-bot", "image/characters/orange-bot.webp");
    this.load.image("leaf-bot", "image/characters/leaf-bot.webp");
    this.load.spritesheet("leaf-bot-720", "image/characters/leaf-bot-720.webp", {
      frameWidth: 754,
      frameHeight: 720,
      startFrame: 0,
      endFrame: 4
    });
    this.load.image("fly-bot", "image/characters/fly-bot.webp");
    this.load.image("fly-bot-attack", "image/characters/fly-bot-attack.webp");
    this.load.image("bee-bot", "image/characters/Bee.webp");
    this.load.image("lion-bot", "image/characters/Lion.webp");
    this.load.image("robot-bot", "image/characters/Robot.webp");
    this.load.image("snake-bot", "image/characters/snake-bot-1764.webp");

    // Load logo
    this.load.image("logo", "image/characters/logo.webp");

    // Load animation frames
    for (let i = 1; i <= 6; i++) {
      this.load.image(`coin-${i}`, `image/coin/star coin rotate ${i}.webp`);
    }
    for (let i = 6; i <= 10; i++) {
      this.load.image(`electric-leftover-${i}`, `anim/electric-leftover/Explosion_blue_circle${i}.png`);
    }

    // Generate procedural textures
    this.generateProceduralTextures();
  }

  generateProceduralTextures(): void {
    // Spark texture
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture("spark", 4, 4);
    graphics.clear();

    // Fire particle
    graphics.fillStyle(0xffaa00, 1);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture("fire-particle", 4, 4);
    graphics.clear();

    // Electric particle
    graphics.fillStyle(0x00ffff, 1);
    graphics.fillRect(3, 0, 2, 8);
    graphics.fillRect(0, 3, 8, 2);
    graphics.fillTriangle(4, 0, 2, 3, 6, 3);
    graphics.fillTriangle(4, 8, 2, 5, 6, 5);
    graphics.fillTriangle(0, 4, 3, 2, 3, 6);
    graphics.fillTriangle(8, 4, 5, 2, 5, 6);
    graphics.generateTexture("electric-particle", 8, 8);
    graphics.clear();

    // Smoke particle
    graphics.fillStyle(0x333333, 1);
    graphics.fillCircle(6, 6, 6);
    graphics.generateTexture("smoke-particle", 12, 12);
    graphics.clear();

    // Blood particle
    graphics.fillStyle(0x8b0000, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture("blood-particle", 8, 8);

    graphics.destroy();
  }

  checkFontAndTransition(): void {
    // Check if font is loaded
    if (this.fontLoaded) {
      this.transitionToGame();
    } else {
      // Wait a bit longer
      this.time.delayedCall(100, () => {
        this.checkFontAndTransition();
      });
    }
  }

  transitionToGame(): void {
    // Hide DOM loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      // Remove from DOM after transition
      setTimeout(() => {
        loadingScreen.remove();
      }, 500);
    }

    // Start game scene
    this.scene.start("GameScene");
  }
}
