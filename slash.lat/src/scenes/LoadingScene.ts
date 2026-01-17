import Phaser from "phaser";
import { GameConfig } from "../types";
import { AudioManager } from "../managers/AudioManager";

export class LoadingScene extends Phaser.Scene {

  private fontLoaded: boolean = false;
  private audioManager?: AudioManager;
  private loadingProgressBar?: HTMLElement;
  private loadingText?: HTMLElement;
  private transitionStarted: boolean = false;

  private minLoadingTime: number = 3000; // Minimum 3 seconds
  private loadingStartTime: number = 0;

  constructor() {
    super({ key: "LoadingScene" });
  }

  private unlockAudio?: () => void;

  init(): void {
    // Global Unlocker (Keep this, it's good for mobile)
    this.unlockAudio = () => {
      if (this.sound && this.sound.locked) {
        this.sound.unlock();
        const loadingSound = this.audioManager?.getSound("loading-sound");
        if (loadingSound && !loadingSound.isPlaying) {
          loadingSound.play({ loop: true, volume: 0.6 });
        }
      }
      // Remove listeners once unlocked
      if (!this.sound.locked) {
        this.cleanupListeners();
      }
    };

    document.addEventListener('click', this.unlockAudio);
    document.addEventListener('touchstart', this.unlockAudio);
    document.addEventListener('keydown', this.unlockAudio);

    // Safety cleanup on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupListeners();
    });
  }

  cleanupListeners(): void {
    if (this.unlockAudio) {
      document.removeEventListener('click', this.unlockAudio);
      document.removeEventListener('touchstart', this.unlockAudio);
      document.removeEventListener('keydown', this.unlockAudio);
      this.unlockAudio = undefined;
    }
  }

  preload(): void {
    this.loadingStartTime = Date.now();

    // Initialize AudioManager and store in registry
    this.audioManager = new AudioManager(this);
    this.registry.set('managers', { audioManager: this.audioManager });

    // Get DOM elements
    this.loadingProgressBar = document.getElementById('loading-progress-bar') || undefined;
    this.loadingText = document.getElementById('loading-text') || undefined;

    // Load Google Font
    this.loadGoogleFont();

    // Setup Listeners
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

    this.load.on("filecomplete", (key: string) => {
      if (key === "loading-sound") {
        // Attempt to play as soon as loaded
        if (this.audioManager) {
          this.audioManager.addSound("loading-sound");
          this.audioManager.play("loading-sound", { loop: true, volume: 0.6 });
        }
      }
    });

    this.load.on("complete", () => {
      console.log("Asset loading complete");
      this.checkFontAndTransition();
    });

    // Start Loading Assets
    this.loadGameAssets();
  }

  create(): void {
    // Create is empty because we wait for loading 'complete' event to trigger transition
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
      // Priority load for loading sound
      this.audioManager.preloadAudio("loading-sound", "audio/Loading Sound.mp3");

      this.audioManager.preloadAudio("knife-slash", "audio/knife-slash.mp3");
      this.audioManager.preloadAudio("knife-clank", "audio/knife-clank.mp3");
      this.audioManager.preloadAudio("punch-hit", "audio/punch-hit.mp3");
      this.audioManager.preloadAudio("electric-spark", "audio/electric-spark.mp3");
      this.audioManager.preloadAudio("explode", "audio/explode.mp3");
      this.audioManager.preloadAudio("coin-received", "audio/coin-received.mp3");

      // New Character Specific Audio
      this.audioManager.preloadAudio("bee-audio", "audio/Bee Robot.mp3");
      this.audioManager.preloadAudio("lion-audio", "audio/robot-tiger.mp3");
      this.audioManager.preloadAudio("robot-audio", "audio/Foot Step robot.mp3");
      this.audioManager.preloadAudio("alien-audio", "audio/little-alien.mp3");
      this.audioManager.preloadAudio("rusty-slice", "audio/rusty-blade-slice.mp3.mp3");
      this.audioManager.preloadAudio("gunshot", "audio/single-pistol-gunshot.mp3");
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
    if (this.transitionStarted) return;

    // Check if enough time has passed
    const elapsedTime = Date.now() - this.loadingStartTime;
    if (elapsedTime < this.minLoadingTime) {
      console.log(`Loading too fast (${elapsedTime}ms). Waiting remaining ${this.minLoadingTime - elapsedTime}ms...`);
      this.time.delayedCall(this.minLoadingTime - elapsedTime, () => {
        this.checkFontAndTransition();
      });
      return;
    }

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
    if (this.transitionStarted) return;
    this.transitionStarted = true;

    console.log("Transitioning to GameScene...");

    // Stop loading sound
    if (this.audioManager) {
      // Impact sound on finish
      this.audioManager.addSound("knife-slash");
      this.audioManager.play("knife-slash", { volume: 0.8 });

      const loadingSound = this.audioManager.getSound("loading-sound");
      if (loadingSound && loadingSound.isPlaying) {
        console.log("Fading out loading sound...");
        this.tweens.add({
          targets: loadingSound,
          volume: 0,
          duration: 500,
          onComplete: () => {
            console.log("Fade out complete. Stopping all sounds.");
            this.audioManager?.stopAll();

            if (loadingSound.isPlaying) {
              loadingSound.stop();
            }

            this.scene.start("GameScene");
          }
        });
      } else {
        console.log("No loading sound playing. Transitioning immediately.");
        this.audioManager.stopAll();
        this.scene.start("GameScene");
      }
    } else {
      console.log("No AudioManager. Transitioning immediately.");
      this.scene.start("GameScene");
    }

    // Hide DOM loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      // Remove from DOM after transition
      setTimeout(() => {
        loadingScreen.remove();
      }, 500);
    }

    // Ensure listeners are cleaned up
    this.cleanupListeners();
  }
}
