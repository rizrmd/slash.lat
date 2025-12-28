import Phaser from "phaser";
import { GameConfig } from "../types";
import { AudioManager } from "../managers/AudioManager";

export class LoadingScene extends Phaser.Scene {
  private gameConfig: GameConfig;
  private progressBar?: Phaser.GameObjects.Graphics;
  private progressBox?: Phaser.GameObjects.Graphics;
  private loadingLogo?: Phaser.GameObjects.Image;
  private percentText?: Phaser.GameObjects.Text;
  private assetText?: Phaser.GameObjects.Text;
  private fontLoaded: boolean = false;
  private audioManager?: AudioManager;

  constructor(gameConfig: GameConfig) {
    super({ key: "LoadingScene" });
    this.gameConfig = gameConfig;
  }

  preload(): void {
    // Initialize AudioManager and store in registry
    this.audioManager = new AudioManager(this);
    this.registry.set('managers', { audioManager: this.audioManager });
    const { dpr, canvasWidth, gameHeight } = this.gameConfig;
    const width = canvasWidth * dpr;
    const height = gameHeight;

    // Load logo image
    this.load.image("logo", "src/image/logo.webp");

    // Create loading UI
    this.createLoadingUI(width, height, dpr);

    // Load Google Font
    this.loadGoogleFont();

    // Load all game assets
    this.loadGameAssets();

    // Update progress bar
    this.load.on("progress", (value: number) => {
      this.percentText?.setText(`${Math.round(value * 100)}%`);
      if (this.progressBar) {
        this.progressBar.clear();
        this.progressBar.fillStyle(0xffffff, 1);
        this.progressBar.fillRect(
          width / 2 - 160 * dpr,
          height / 2 + 10 * dpr,
          300 * dpr * value,
          30 * dpr
        );
      }
    });

    this.load.on("fileprogress", (file: any) => {
      this.assetText?.setText(`Loading: ${file.key}`);
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

  createLoadingUI(width: number, height: number, dpr: number): void {
    // Create logo once it's loaded
    this.load.once("filecomplete-image-logo", () => {
      this.loadingLogo = this.add.image(width / 2, height / 2 - 60 * dpr, "logo");
      this.loadingLogo.setOrigin(0.5);

      // Set width to 200px, maintaining aspect ratio
      const logoWidth = 200 * dpr;
      const logoHeight = (logoWidth * this.loadingLogo.height) / this.loadingLogo.width;
      this.loadingLogo.setDisplaySize(logoWidth, logoHeight);
    });

    // Progress box (border)
    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(2 * dpr, 0xffffff, 1);
    this.progressBox.strokeRect(
      width / 2 - 162 * dpr,
      height / 2 + 8 * dpr,
      324 * dpr,
      34 * dpr
    );

    // Progress bar
    this.progressBar = this.add.graphics();

    // Percent text
    this.percentText = this.add.text(width / 2, height / 2 + 25 * dpr, "0%", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${18 * dpr}px`,
      color: "#ffffff",
    });
    this.percentText.setOrigin(0.5);

    // Asset text
    this.assetText = this.add.text(width / 2, height / 2 + 60 * dpr, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: `${14 * dpr}px`,
      color: "#888888",
    });
    this.assetText.setOrigin(0.5);
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
    // Fade out loading screen
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("GameScene");
    });
  }
}
