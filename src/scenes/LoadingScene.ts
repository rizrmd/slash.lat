import Phaser from "phaser";
import { GameConfig } from "../types";
import { AudioManager } from "../managers/AudioManager";

export class LoadingScene extends Phaser.Scene {
  private gameConfig: GameConfig;
  private fontLoaded: boolean = false;
  private audioManager?: AudioManager;
  private loadingProgressBar?: HTMLElement;
  private loadingText?: HTMLElement;

  constructor(gameConfig: GameConfig) {
    super({ key: "LoadingScene" });
    this.gameConfig = gameConfig;
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
    // Load audio assets
    this.audioManager!.preloadAudio("slash", "src/audio/sword-slash-simple.mp3");
    this.audioManager!.preloadAudio("hit", "src/audio/sword-slash-clank.mp3");
    this.audioManager!.preloadAudio("electric-spark", "src/audio/electric-spark.mp3");
    this.audioManager!.preloadAudio("explode", "src/audio/explode.mp3");
    this.audioManager!.preloadAudio("coin-received", "src/audio/coin-received.mp3");

    // Load character assets
    this.load.image("orange-bot", "src/image/orange-bot.webp");
    this.load.image("leaf-bot", "src/image/leaf-bot.webp");
    this.load.image("fly-bot", "src/image/fly-bot.webp");
    this.load.image("fly-bot-attack", "src/image/fly-bot-attack.webp");

    // Load coin animation frames
    for (let i = 1; i <= 6; i++) {
      this.load.image(`coin-${i}`, `src/image/coin/star coin rotate ${i}.webp`);
    }

    // Load electric-leftover animation frames
    for (let i = 6; i <= 10; i++) {
      this.load.image(
        `electric-leftover-${i}`,
        `src/anim/electric-leftover/Explosion_blue_circle${i}.png`
      );
    }
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
