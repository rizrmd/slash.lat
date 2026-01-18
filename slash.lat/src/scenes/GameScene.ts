import { Scene } from "phaser";
import { OrangeBot } from "../characters/OrangeBot";
import { LeafBot } from "../characters/LeafBot";
import { FlyBot } from "../characters/FlyBot";
import { Bee } from "../characters/Bee";
import { Lion } from "../characters/Lion";
import { Robot } from "../characters/Robot";
import { SnakeBot } from "../characters/SnakeBot";
import { Target } from "../characters/Target";
import { SlashTrail } from "../effects/SlashTrail";
import { Sparks } from "../effects/Sparks";
import { AudioManager } from "../managers/AudioManager";
import { WeaponManager } from "../managers/WeaponManager";
import {
  ProgressionManager,
  type CharacterClass,
  type ProgressionConfig,
} from "../managers/ProgressionManager";
import { GameConfig } from "../types";

export class GameScene extends Scene {
  private orientationWarning?: Phaser.GameObjects.Text;
  // Initialize with a placeholder to avoid TS errors
  private gameConfig: GameConfig = {} as GameConfig;

  private targets: Target[] = []; // Store all active targets
  private hitTargetsThisSlash: Set<Target> = new Set(); // Track targets hit in current slash
  private slashTrail?: SlashTrail;
  private sparks?: Sparks;
  private audioManager?: AudioManager;
  private canStartNewSlash: boolean = true;
  private isSlashCooldown: boolean = false; // New cooldown flag
  private hasHitTarget: boolean = false;
  private currentSlashLength: number = 0;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private gameLayer?: Phaser.GameObjects.Container;
  private uiLayer?: Phaser.GameObjects.Container;

  // HP and Coins
  private maxHP: number = 1000;
  private currentHP: number = 1000;
  private coins: number = 0;
  private playerLevel: number = 1; // Player level based on total coins
  private unlockedBackgrounds: string[] = ['bg-orange']; // Start with default background
  private selectedBackground: string = 'bg-orange';

  // Background unlock levels
  private backgroundLevels = [
    { coins: 0, background: 'bg-orange', name: 'Orange Level', character: 'OrangeBot' },
    { coins: 5000, background: 'bg-leaf', name: 'Leaf Level', character: 'LeafBot' },
    { coins: 15000, background: 'bg-fly', name: 'Fly Level', character: 'FlyBot' },
    { coins: 30000, background: 'game-bg', name: 'Bee Level', character: 'Bee' },
    { coins: 50000, background: 'game-bg', name: 'Lion Level', character: 'Lion' },
    { coins: 75000, background: 'game-bg', name: 'Robot Level', character: 'Robot' },
    { coins: 100000, background: 'game-bg', name: 'Master Level', character: 'SnakeBot' },
  ];

  private hpBarBackground?: Phaser.GameObjects.Graphics;
  private hpBarFill?: Phaser.GameObjects.Graphics;
  private hpText?: Phaser.GameObjects.Text;
  private coinText?: Phaser.GameObjects.Text;
  private levelProgressText?: Phaser.GameObjects.Text; // Show next level target
  private coinSprite?: Phaser.GameObjects.Sprite;
  private coinCounterX: number = 0;
  private coinCounterY: number = 0;
  private weaponManager?: WeaponManager;
  private progressionManager?: ProgressionManager;
  private gameBackground?: Phaser.GameObjects.Image;
  private backgroundContainer?: Phaser.GameObjects.Container; // Container for parallax effect
  private backgroundParticles?: Phaser.GameObjects.Particles.ParticleEmitter; // Floating particles
  private currentBackgroundKey?: string; // Track current background to prevent unnecessary changes
  private lastActivityTime: number = Date.now(); // Track player activity
  private isPlayerActive: boolean = false; // Is player currently active?
  private activityCheckEvent?: Phaser.Time.TimerEvent;
  private isRetry: boolean = false;
  private isInitializing: boolean = true; // Prevent damage during initialization

  private resizeHandler?: () => void;

  constructor() {
    super({ key: "GameScene" });
  }

  init(data?: { isRetry?: boolean }): void {
    if (data && data.isRetry) {
      this.isRetry = true;
    }

    // Get audio manager from registry (loaded in LoadingScene)
    const managers = this.registry.get("managers");
    if (managers && managers.audioManager) {
      this.audioManager = managers.audioManager;
    }

    // CRITICAL: Calculate game config FIRST before any initialization
    // Without this, all rendering will fail (blank screen)
    this.updateGameConfig();

    // CRITICAL: Set initialization flag IMMEDIATELY to block enemy attacks
    // This happens BEFORE create() so enemies cannot attack during scene setup
    this.isInitializing = true;
    console.log('[INIT] Initialization protection ENABLED - enemies cannot attack yet');
  }

  /**
   * Recalculate game config based on current screen size
   */
  private updateGameConfig(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const dpr = this.scale.displayScale ? this.scale.displayScale.x : 1;

    // Scale logic
    const logicalWidth = width;
    const logicalHeight = height;

    const aspectRatio = logicalWidth / logicalHeight;
    const isPortrait = aspectRatio < 1;
    const isLandscape = !isPortrait;

    // SAFE AREA: 95% on mobile (more space), 90% on desktop
    const SAFE_AREA_PERCENTAGE = isLandscape ? 0.90 : 0.95;
    const safeAreaWidth = logicalWidth * SAFE_AREA_PERCENTAGE;
    const safeAreaHeight = logicalHeight * SAFE_AREA_PERCENTAGE;
    const safeAreaOffsetX = (logicalWidth - safeAreaWidth) / 2;
    const safeAreaOffsetY = (logicalHeight - safeAreaHeight) / 2;

    // UI HEIGHT
    const uiHeight = isLandscape ? 80 : 120; // Reduced UI height for better view
    const gameAreaHeight = safeAreaHeight - uiHeight;
    const gameAreaWidth = safeAreaWidth;
    const gameAreaOffsetX = safeAreaOffsetX;
    const gameAreaOffsetY = safeAreaOffsetY;

    // GRID
    const gridMarginLeft = isLandscape ? 100 : 20;
    const gridMarginRight = isLandscape ? 100 : 20;
    const gridMarginTop = isLandscape ? 60 : 60;
    const gridMarginBottom = isLandscape ? 60 : 40;
    const gridWidth = gameAreaWidth - gridMarginLeft - gridMarginRight;
    const gridHeight = gameAreaHeight - gridMarginTop - gridMarginBottom;

    const newConfig: GameConfig = {
      baseWidth: logicalWidth,
      baseHeight: logicalHeight,
      baseAspectRatio: aspectRatio,
      isPortrait,
      isLandscape,
      dpr,
      scale: 1,
      gameWidth: logicalWidth,
      gameHeight: logicalHeight,
      canvasWidth: logicalWidth,
      canvasHeight: logicalHeight,
      windowAspectRatio: aspectRatio,
      safeAreaWidth,
      safeAreaHeight,
      safeAreaOffsetX,
      safeAreaOffsetY,
      gameAreaWidth,
      gameAreaHeight,
      gameAreaOffsetX,
      gameAreaOffsetY,
      gridWidth,
      gridHeight,
      gridMarginLeft,
      gridMarginRight,
      gridMarginTop,
      gridMarginBottom,
      isMobile: logicalWidth < 700
    };

    // Update existing object reference to keep managers happy
    Object.assign(this.gameConfig, newConfig);

    console.log(`Config updated: ${logicalWidth.toFixed(0)}x${logicalHeight.toFixed(0)}`);
  }

  handleResize(gameSize: Phaser.Structs.Size, baseSize: Phaser.Structs.Size, displaySize: Phaser.Structs.Size, previousWidth: number, previousHeight: number): void {
    try {
      this.updateGameConfig();

      // Update camera bounds to match new world size
      this.cameras.main.setViewport(0, 0, this.gameConfig.canvasWidth, this.gameConfig.canvasHeight);
      this.cameras.main.setBounds(0, 0, this.gameConfig.gameWidth, this.gameConfig.gameHeight);

      if (this.uiCamera) {
        this.uiCamera.setViewport(0, 0, this.gameConfig.canvasWidth, this.gameConfig.canvasHeight);
      }

      // Centered background container
      if (this.backgroundContainer) {
        this.backgroundContainer.setPosition(this.gameConfig.canvasWidth / 2, this.gameConfig.canvasHeight / 2);
      }

      // Mobile: Center background image and particles directly (since they're not in the container)
      const { isMobile } = this.gameConfig;
      if (isMobile) {
        if (this.gameBackground) {
          this.gameBackground.setPosition(this.gameConfig.canvasWidth / 2, this.gameConfig.canvasHeight / 2);
        }
        if (this.backgroundParticles) {
          this.backgroundParticles.setPosition(this.gameConfig.canvasWidth / 2, this.gameConfig.canvasHeight / 2);
        }
      }

      this.updateBackgroundSize();

      // Rebuild UI to fit new layout
      this.uiLayer?.removeAll(true);
      try { this.createUI(); } catch (e) { console.warn('createUI failed in resize:', e); }

      if (this.weaponManager) {
        try { this.weaponManager.createWeaponIndicator(); } catch (e) { console.warn('weaponManager resize failed:', e); }
      }
    } catch (e) {
      console.warn('handleResize failed:', e);
    }
  }

  updateBackgroundSize(): void {
    if (!this.gameBackground) return;

    try {
      const fullCanvasWidth = this.cameras.main.width;
      const fullCanvasHeight = this.cameras.main.height;

      const bgWidth = this.gameBackground.width;
      const bgHeight = this.gameBackground.height;

      // Safety check to prevent division by zero
      if (bgHeight <= 0 || fullCanvasHeight <= 0) return;

      const bgAspectRatio = bgWidth / bgHeight;
      const screenAspectRatio = fullCanvasWidth / fullCanvasHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (bgAspectRatio > screenAspectRatio) {
        // Background wider than screen - fit to HEIGHT (cover mode)
        displayHeight = fullCanvasHeight;
        displayWidth = fullCanvasHeight * bgAspectRatio;
      } else {
        // Background taller than screen - fit to WIDTH (cover mode)
        displayWidth = fullCanvasWidth;
        displayHeight = fullCanvasWidth / bgAspectRatio;
      }

      // Safety: scale up slightly (5%) to ensure no black edges / rounding gaps
      this.gameBackground.setDisplaySize(displayWidth * 1.05, displayHeight * 1.05);
    } catch (e) {
      // Ignore background resize errors
    }
  }

  // Preload handled by LoadingScene

  /**
   * Called when scene shuts down (restart or switch)
   * CRITICAL for preventing memory leaks and performance degradation
   */
  cleanupGameState(): void {
    console.log('[SCENE] Cleaning up game state...');

    // Clear targets array (objects should be destroyed in shutdown, but array needs clearing)
    this.targets = [];
    this.hitTargetsThisSlash = new Set();

    // Reset flags
    this.canStartNewSlash = true;
    this.isSlashCooldown = false;
    this.hasHitTarget = false;
    this.isPlayerActive = false;

    // Reset HP and other stats
    this.currentHP = this.maxHP;
  }

  shutdown(): void {
    console.log('[SCENE] Shutting down GameScene - cleaning up resources...');

    // 1. Stop Managers
    this.progressionManager?.stop();
    this.progressionManager = undefined;

    // 2. Clear Arrays & Lists
    this.targets.forEach(t => { try { t.destroy(); } catch (e) { } });
    this.targets = [];

    // 3. Destroy Effects
    if (this.slashTrail) {
      try { this.slashTrail.destroy(); } catch (e) { }
      this.slashTrail = undefined as any;
    }
    if (this.sparks) {
      try { this.sparks.destroy(); } catch (e) { }
      this.sparks = undefined as any;
    }

    // 4. Remove Input Listeners
    this.input.removeAllListeners();
    this.events.removeAllListeners();

    // 5. Kill Tweens & Timers
    this.tweens.killAll();
    this.time.removeAllEvents();

    // 6. Remove Window Listeners (CRITICAL for cleaning up re-created anonymous functions)
    if (this.resizeHandler) {
      window.removeEventListener("orientationchange", this.resizeHandler);
      window.removeEventListener("resize", this.resizeHandler);
    }

    // 7. Remove Phaser Scale Listeners (CRITICAL: Scale Manager is global)
    this.scale.off('resize', this.handleResize, this);

    // 8. Cleanup Audio (Prevent SoundManager bloat)
    if (this.audioManager) {
      this.audioManager.cleanup();
    }

    console.log('[SCENE] Shutdown complete');
  }

  create(): void {
    // Listen for resize events
    this.scale.on('resize', this.handleResize, this);

    // CRITICAL: Setup proper reactor/shutdown cleanup to prevent memory leaks and lag on retry
    this.events.off('shutdown'); // Clear previous listeners just in case
    this.events.on('shutdown', this.shutdown, this);

    // CRITICAL: Clean up previous game state if this is a reuse of the scene object
    // This handles the case where Phaser reuses the same Scene instance (which it often does)
    this.cleanupGameState();

    const {
      canvasWidth,
      canvasHeight,
      gameWidth,
      gameHeight,
      dpr,
      scale,
    } = this.gameConfig;

    // Reset coins if this is NOT a retry (e.g. fresh page load or manual refresh)
    if (!this.isRetry) {
      console.log("[LOAD] Fresh load detected, resetting session coins...");
      const saved = localStorage.getItem('slashlat_save');
      if (saved) {
        const saveData = JSON.parse(saved);
        // Reset coins to 0 but keep other progress (levels/backgrounds)
        saveData.totalCoins = 0;
        localStorage.setItem('slashlat_save', JSON.stringify(saveData));
      } else {
        // Create initial save if non-existent
        this.saveProgress();
      }
    }

    // Load saved progress (coins, unlocked backgrounds)
    this.loadProgress();

    // CRITICAL: Reset HP to maxHP AFTER loadProgress() to prevent corrupted state
    // This must happen here, not in init(), to ensure it overrides any loaded data
    this.currentHP = this.maxHP;
    console.log(`[HP INIT] HP reset to ${this.currentHP}/${this.maxHP}`);

    // Create separate layers for game objects and UI
    this.gameLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);

    // Add background image FIRST - position at center of full canvas
    // Use the actual canvas dimensions (not game world dimensions)
    const fullCanvasWidth = this.cameras.main.width;
    const fullCanvasHeight = this.cameras.main.height;

    const { isMobile } = this.gameConfig;

    if (isMobile) {
      // MOBILE: Put background at depth -100 to ensure it's behind everything
      this.gameBackground = this.add.image(fullCanvasWidth / 2, fullCanvasHeight / 2, this.selectedBackground);
      this.gameBackground.setOrigin(0.5);
      this.gameBackground.setVisible(true);
      this.gameBackground.setActive(true);

      // Calculate size to cover screen
      const bgWidth = this.gameBackground.width;
      const bgHeight = this.gameBackground.height;
      const bgAspectRatio = bgWidth / bgHeight;
      const screenAspectRatio = fullCanvasWidth / fullCanvasHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (bgAspectRatio > screenAspectRatio) {
        displayHeight = fullCanvasHeight;
        displayWidth = fullCanvasHeight * bgAspectRatio;
      } else {
        displayWidth = fullCanvasWidth;
        displayHeight = fullCanvasWidth / bgAspectRatio;
      }

      // Safety: scale up slightly (5%) to ensure no black edges / rounding gaps
      this.gameBackground.setDisplaySize(displayWidth * 1.05, displayHeight * 1.05);

      // Ensure it's centered
      this.gameBackground.setPosition(fullCanvasWidth / 2, fullCanvasHeight / 2);

      this.gameBackground.setDepth(-10); // Less extreme negative depth
      this.gameBackground.setAlpha(1.0);

      // ADD PARTICLES FOR MOBILE FOR "ALIVE" FEEL
      this.backgroundParticles = this.add.particles(fullCanvasWidth / 2, fullCanvasHeight / 2, "spark", {
        x: { min: -displayWidth / 2, max: displayWidth / 2 },
        y: { min: -displayHeight / 2, max: displayHeight / 2 },
        lifespan: { min: 3000, max: 6000 },
        speed: { min: 5, max: 15 },
        scale: { start: 0.15 * dpr, end: 0 },
        alpha: { start: 0.25, end: 0 },
        blendMode: 'ADD',
        quantity: 1,
        frequency: 300,
      });
      this.backgroundParticles.setDepth(-5);

      // Create a dummy container for compatibility
      this.backgroundContainer = this.add.container(0, 0);
      this.backgroundContainer.setDepth(-10000);

      console.log(`[OK] MOBILE Background + Particles: ${this.selectedBackground} - depth:-100,-90`);
    } else {
      // DESKTOP: Use container for parallax
      this.backgroundContainer = this.add.container(fullCanvasWidth / 2, fullCanvasHeight / 2);
      this.backgroundContainer.setDepth(-10000);

      this.gameBackground = this.add.image(0, 0, this.selectedBackground);
      this.gameBackground.setOrigin(0.5);
      this.updateBackgroundSize();
      this.backgroundContainer.add(this.gameBackground);
      this.add.existing(this.backgroundContainer);

      // Floating particles
      this.backgroundParticles = this.add.particles(0, 0, "spark", {
        x: { min: -1000, max: 1000 },
        y: { min: -1000, max: 1000 },
        lifespan: { min: 4000, max: 8000 },
        speed: { min: 10, max: 30 },
        scale: { start: 0.2 * dpr, end: 0 },
        alpha: { start: 0.3, end: 0 },
        blendMode: 'ADD',
        quantity: 1,
        frequency: 200,
      });
      this.backgroundParticles.setDepth(-9999);
      this.backgroundContainer.add(this.backgroundParticles);

      this.gameBackground.setAlpha(1.0);
      console.log(`[OK] DESKTOP Background: ${fullCanvasWidth.toFixed(0)}x${fullCanvasHeight.toFixed(0)}`);
    }

    // Track current background
    this.currentBackgroundKey = this.selectedBackground;

    // Setup animated background effects
    this.setupAnimatedBackground();

    // Create separate UI camera that spans full canvas (for UI elements)
    this.uiCamera = this.cameras.add(0, 0, canvasWidth * dpr, canvasHeight * dpr);
    this.uiCamera.setName("uiCamera");

    // CRITICAL FIX: Set camera bounds to match GAME WORLD size
    // This ensures the camera knows the full extent of the game world
    this.cameras.main.setBounds(0, 0, gameWidth, gameHeight);
    this.cameras.main.setViewport(0, 0, canvasWidth * dpr, canvasHeight * dpr);
    // NO background color - let the background image show through
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    // Main camera ignores UI layer (only shows game objects not in UI layer)
    this.cameras.main.ignore(this.uiLayer);

    // UI camera only shows UI layer (ignores everything else)
    this.uiCamera.ignore(this.gameLayer);

    // Make UI camera ignore all existing game objects
    const gameObjects = this.children.getAll();
    gameObjects.forEach((obj) => {
      if (obj !== this.uiLayer && obj !== this.gameLayer) {
        this.uiCamera?.ignore(obj as Phaser.GameObjects.GameObject);
      }
    });

    // IMPORTANT: Make sure background IS ignored by UI camera (only shown in main camera)
    if (this.gameBackground) {
      this.uiCamera?.ignore(this.gameBackground);
      console.log(`[OK] Background ignored by UI camera - alpha:${this.gameBackground.alpha}, visible:${this.gameBackground.visible}, depth:${this.gameBackground.depth}`);
    }
    if (this.backgroundContainer) {
      this.uiCamera?.ignore(this.backgroundContainer);
      console.log(`[OK] Background container ignored - depth:${this.backgroundContainer.depth}, visible:${this.backgroundContainer.visible}`);
    }

    // Initialize audio manager sounds
    // Initialize audio manager sounds
    if (this.audioManager) {
      this.audioManager.setScene(this);

      // CRITICAL FAILSAFE: Ensure loading sound is stopped!

      // 1. Try via AudioManager
      console.log("[GameScene] Removing loading sound via Manager");
      this.audioManager.removeSound("loading-sound");

      // 2. Try via Scene Sound Manager globally
      this.sound.getAll('loading-sound').forEach(s => {
        console.log("[GameScene] Force stopping loading sound (via Global)");
        s.stop();
        s.destroy();
      });

      this.audioManager.addSound("knife-slash");
      this.audioManager.addSound("knife-clank");
      this.audioManager.addSound("punch-hit");
      this.audioManager.addSound("electric-spark");
      this.audioManager.addSound("explode");
      this.audioManager.addSound("coin-received");

      // Character Specific & New Sounds
      this.audioManager.addSound("bee-audio");
      this.audioManager.addSound("lion-audio");
      this.audioManager.addSound("robot-audio");
      this.audioManager.addSound("alien-audio");
      this.audioManager.addSound("rusty-slice");
      this.audioManager.addSound("gunshot");
      // Stop adding loading-sound here, we don't need it in GameScene
    }

    // Create animations BEFORE UI
    // Create electric-leftover animation
    const electricFrames = [];
    for (let i = 6; i <= 10; i++) {
      electricFrames.push({ key: `electric-leftover-${i}` });
    }
    if (!this.anims.exists("electric-leftover-anim")) {
      this.anims.create({
        key: "electric-leftover-anim",
        frames: electricFrames,
        frameRate: 20,
        repeat: 0,
      });
    }

    // Create coin spin animation
    const coinFrames = [];
    for (let i = 1; i <= 6; i++) {
      coinFrames.push({ key: `coin-${i}` });
    }
    if (!this.anims.exists("coin-spin")) {
      this.anims.create({
        key: "coin-spin",
        frames: coinFrames,
        frameRate: 12,
        repeat: -1, // Loop forever
      });
    }

    // Create UI (HP bar and coins) - AFTER animations are created
    this.createUI();

    // Initialize weapon manager with knife as default weapon
    const defaultWeapon = WeaponManager.getWeaponById("knife");
    if (defaultWeapon && this.uiLayer) {
      this.weaponManager = new WeaponManager(
        this,
        this.gameConfig,
        this.uiLayer,
        defaultWeapon
      );
      this.weaponManager.createWeaponIndicator();
    }

    // Initialize progression manager
    // CONTINUOUS MODE: Unlimited enemies with increasing difficulty
    // Generate coin-based progression config (respects player level)
    const coinBasedConfig = this.getCoinBasedProgressionConfig();

    // CRITICAL: Set initialization flag BEFORE creating ProgressionManager
    // This prevents enemy spawns during grace period
    this.isInitializing = true;
    console.log('[INIT] Initialization protection ACTIVE - 3-second grace period');

    // UX: Add Visual Countdown/Ready Message so user doesn't think game is lagging
    const readyText = this.add.text(
      this.gameConfig.canvasWidth / 2,
      this.gameConfig.canvasHeight * 0.4,
      "GET READY",
      {
        fontFamily: "Jura",
        fontSize: `${48 * this.gameConfig.dpr}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 6,
        align: 'center'
      }
    ).setOrigin(0.5).setDepth(2000).setAlpha(0);

    // Fade in "GET READY"
    this.tweens.add({
      targets: readyText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 500,
      ease: 'Back.out',
      onComplete: () => {
        // Pulse animation
        this.tweens.add({
          targets: readyText,
          scale: 1,
          duration: 500,
          yoyo: true,
          repeat: 2
        });
      }
    });

    this.progressionManager = new ProgressionManager(
      this,
      coinBasedConfig,
      {
        onSpawnEnemy: (characterClass: CharacterClass, position: { x: number; y: number }) => {
          this.changeBackground(characterClass);
          this.spawnEnemy(characterClass, position);
        },
        onDifficultyChange: (tierIndex: number) => {
          console.log(`[WARNING] DIFFICULTY INCREASED! Tier ${tierIndex + 1}/12`);
        },
      },
      this.gameConfig
    );

    // Start ProgressionManager AFTER 3-second grace period
    this.time.delayedCall(3000, () => {
      this.isInitializing = false;
      console.log('[INIT] Grace period COMPLETE - enemies can now spawn and attack');

      // Change text to "SURVIVE!"
      readyText.setText("SURVIVE!");
      readyText.setColor("#ff0000");
      readyText.setScale(1.5);

      // Flash and fade out
      this.tweens.add({
        targets: readyText,
        alpha: 0,
        scale: 3,
        duration: 800,
        ease: 'Power2',
        onComplete: () => {
          readyText.destroy();
        }
      });

      if (this.progressionManager) {
        this.progressionManager.start();
        console.log('[PROGRESSION] Enemy spawning started');
      }
    });

    // Initialize slash trail effect
    this.slashTrail = new SlashTrail(this, this.gameConfig);
    // Make UI camera ignore slash trail graphics
    this.ignoreFromUICamera(this.slashTrail.graphics);
    this.ignoreFromUICamera(this.slashTrail.renderTexture);

    // Initialize sparks effect
    this.sparks = new Sparks(this, this.gameConfig, "electric-spark");
    // Make UI camera ignore spark particles (particle emitters are managed as GameObjects)
    this.ignoreFromUICamera(this.sparks.sparkParticles);

    // Start activity checker - runs every 1 second
    this.startActivityChecker();

    // Set up input handlers
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.input.on("pointerupoutside", this.onPointerUp, this);
    this.input.on("pointerout", this.onPointerUp, this);

    // Listen for orientation changes
    // CRITICAL: Store handler reference to remove it on shutdown/restart
    this.resizeHandler = () => this.checkOrientation();
    window.addEventListener("orientationchange", this.resizeHandler);
    window.addEventListener("resize", this.resizeHandler);
  }



  checkOrientation(): void {
    // Both portrait and landscape modes are now supported
    // No orientation warning needed
    // Game automatically adapts to window size
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Track player activity
    this.lastActivityTime = Date.now();
    this.updateActivityStatus(true);

    // Only allow starting new slash if previous one is complete AND not on cooldown
    if (!this.canStartNewSlash || this.isSlashCooldown || !this.slashTrail) return;

    // Convert screen coordinates to game area coordinates
    const gamePos = this.screenToGame(pointer.x, pointer.y);

    this.canStartNewSlash = false;
    this.hasHitTarget = false;
    this.currentSlashLength = 0; // Reset slash length for new slash
    this.hitTargetsThisSlash.clear(); // Clear hit targets for new slash
    this.slashTrail.startDrawing(gamePos.x, gamePos.y);

    // Play slash sound
    this.audioManager?.play("knife-slash");
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    // Track player activity
    if (this.slashTrail?.isCurrentlyDrawing()) {
      this.lastActivityTime = Date.now();
    }

    if (!this.slashTrail?.isCurrentlyDrawing()) return;

    // Convert screen coordinates to game area coordinates
    const gamePos = this.screenToGame(pointer.x, pointer.y);

    const prevPoint = this.slashTrail.getLastPoint();
    const canContinue = this.slashTrail.addTrailPoint(gamePos.x, gamePos.y);

    if (!canContinue) return;

    // Check for collision with ALL targets (pixel-perfect)
    // More sensitive - allow hits when target is at least 30% visible
    const visibleTargets = this.targets.filter(
      (t) => t.getContainer().alpha >= 0.3
    );

    if (visibleTargets.length === 0) return;

    let hitInThisSegment = false; // Track if we hit in this movement to avoid duplicate sounds/shakes

    // If we have a previous point, interpolate along the line to check all pixels
    if (prevPoint) {
      const dx = gamePos.x - prevPoint.x;
      const dy = gamePos.y - prevPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Accumulate slash length
      this.currentSlashLength += distance;

      // OPTIMIZATION: Cache bounds for all visible targets once per move event
      const targetCache = visibleTargets.map(t => ({
        target: t,
        bounds: t.getContainer().getBounds()
      }));

      // Filter targets that are even close to the line segment (Broad Phase)
      const segmentMinX = Math.min(prevPoint.x, gamePos.x) - 50;
      const segmentMaxX = Math.max(prevPoint.x, gamePos.x) + 50;
      const segmentMinY = Math.min(prevPoint.y, gamePos.y) - 50;
      const segmentMaxY = Math.max(prevPoint.y, gamePos.y) + 50;

      const nearbyTargets = targetCache.filter(({ bounds }) => {
        return !(bounds.right < segmentMinX ||
          bounds.left > segmentMaxX ||
          bounds.bottom < segmentMinY ||
          bounds.top > segmentMaxY);
      });

      if (nearbyTargets.length === 0) return;

      // Check points along the line (step size based on DPR for consistent accuracy)
      const dpr = this.gameConfig.dpr;
      // Optimize: Increase step size slightly to reduce iterations (4px is usually enough for responsiveness)
      const stepSize = 4 * dpr;
      const steps = Math.ceil(distance / stepSize);

      for (let i = 0; i <= steps; i++) {
        const t = steps > 0 ? i / steps : 1;
        const checkX = prevPoint.x + dx * t;
        const checkY = prevPoint.y + dy * t;

        // Check each nearby target for collision
        for (const { target, bounds } of nearbyTargets) {
          if (bounds.contains(checkX, checkY)) {
            // Convert to container-relative coordinates
            const relativeX = checkX - bounds.centerX;
            const relativeY = checkY - bounds.centerY;

            // Check if pixel is opaque
            if (target.isPixelOpaque(relativeX, relativeY)) {
              // Only play sound and shake once per movement segment
              if (!hitInThisSegment) {
                this.hasHitTarget = true;
                this.hitTargetsThisSlash.add(target); // Track this target as hit
                this.audioManager?.play("knife-clank");
                target.shake(dx, dy);
                hitInThisSegment = true;
              }

              // Calculate entry/exit points once for both damage and sparks
              const relativeStartX = checkX - bounds.centerX;
              const relativeStartY = checkY - bounds.centerY;

              const length = Math.sqrt(dx * dx + dy * dy);
              const normalizedX = length > 0 ? dx / length : 0;
              const normalizedY = length > 0 ? dy / length : 0;
              const maxSearchLength = 100 * dpr;
              const sampleStep = 2 * dpr;

              let worldStartX = checkX;
              let worldStartY = checkY;
              let worldEndX = checkX;
              let worldEndY = checkY;

              // Search backward
              for (
                let dist = sampleStep;
                dist < maxSearchLength;
                dist += sampleStep
              ) {
                const testX = relativeStartX - normalizedX * dist;
                const testY = relativeStartY - normalizedY * dist;
                if (target.isPixelOpaque(testX, testY)) {
                  worldStartX = testX + bounds.centerX;
                  worldStartY = testY + bounds.centerY;
                } else {
                  break;
                }
              }

              // Search forward
              for (
                let dist = sampleStep;
                dist < maxSearchLength;
                dist += sampleStep
              ) {
                const testX = relativeStartX + normalizedX * dist;
                const testY = relativeStartY + normalizedY * dist;
                if (target.isPixelOpaque(testX, testY)) {
                  worldEndX = testX + bounds.centerX;
                  worldEndY = testY + bounds.centerY;
                } else {
                  break;
                }
              }

              // Draw slash damage using pre-calculated points (no duplicate search)
              target.drawSlashDamage(
                checkX,
                checkY,
                dx,
                dy,
                worldStartX,
                worldStartY,
                worldEndX,
                worldEndY
              );

              // Emit sparks and store slash mark
              this.sparks?.emitAtSlash(
                worldStartX,
                worldStartY,
                worldEndX,
                worldEndY
              );
              this.sparks?.addSlashMark(
                worldStartX,
                worldStartY,
                worldEndX,
                worldEndY
              );

              this.hasHitTarget = true;
              this.hitTargetsThisSlash.add(target); // Track this target as hit
            }
          }
        }
      }
    } else {
      // First point - just check this single point
      for (const target of visibleTargets) {
        const containerBounds = target.getContainer().getBounds();
        if (containerBounds.contains(gamePos.x, gamePos.y)) {
          const relativeX = gamePos.x - containerBounds.centerX;
          const relativeY = gamePos.y - containerBounds.centerY;

          if (target.isPixelOpaque(relativeX, relativeY)) {
            this.hasHitTarget = true;
            this.hitTargetsThisSlash.add(target); // Track this target as hit
            this.audioManager?.play("knife-clank");
            target.drawSlashDamage(gamePos.x, gamePos.y, 0, 0);
            target.shake(0, 0);
          }
        }
      }
    }
  }

  onPointerUp(): void {
    if (this.slashTrail?.isCurrentlyDrawing()) {
      this.slashTrail.endDrawing();

      // INSTANT SLASH: No cooldown - allow rapid consecutive slashing
      // User can now slice berkali-kali without delay
      this.canStartNewSlash = true;
    }

    // Show damage numbers for all targets hit during this slash
    if (this.hitTargetsThisSlash.size > 0) {
      // One-hit kill damage (Precision Slash)
      const damage = 9999;

      // Process each hit target
      for (const target of this.hitTargetsThisSlash) {
        // Use target's center position for damage text
        const targetBounds = target.getContainer().getBounds();
        // Show SLASH! text instead of numbers (DISABLED)
        /*
        const damageText = target.showDamage(
          damage,
          targetBounds.centerX,
          targetBounds.centerY
        );
        this.ignoreFromUICamera(damageText);
        */

        // Apply damage to target
        target.takeDamage(damage);

        // Dispatch event so other enemies can react (sensor motorik training!)
        this.events.emit('enemy-damaged', target);

        // Check if target is dead
        if (target.isDead()) {
          // Clear slash marks from sparks system
          this.sparks?.clearSlashMarks();

          // Kill entrance animation tweens before fade out
          this.tweens.killTweensOf(target.getContainer());

          // Play explosion sound
          this.audioManager?.play("explode");

          // Spawn coin animation from enemy position
          const enemyPos = target.getContainer().getBounds();
          // Convert enemy position from game coordinates to screen coordinates
          const screenEnemyPos = this.gameToScreen(
            enemyPos.centerX,
            enemyPos.centerY
          );
          this.spawnCoinAnimation(screenEnemyPos.x, screenEnemyPos.y, 10);

          // Notify other enemies that this enemy is about to die
          this.events.emit('enemy-killed', target);

          // Trigger explosion animation
          const explosionObjects = target.explode();

          // Make UI camera ignore all explosion objects
          explosionObjects.forEach((obj) => this.ignoreFromUICamera(obj));

          // IMMEDIATELY destroy target and remove from array to prevent ghost
          target.destroy();
          const index = this.targets.indexOf(target);
          if (index > -1) {
            this.targets.splice(index, 1);
          }

          // Notify progression manager that enemy was killed
          this.progressionManager?.onEnemyKilled();
        }
      }
    }

    // Allow starting new slash after release
    this.canStartNewSlash = true;
  }

  /**
   * Convert grid position (column, row) to game coordinates.
   * Grid is 5x3: columns 1-5 (left to right), rows 1-3 (top to bottom).
   * Uses safe area and grid margins for multi-aspect ratio support.
   * @param column Grid column (1-5)
   * @param row Grid row (1-3)
   * @param width Character width in grid cells (default: 1)
   * @param height Character height in grid cells (default: 1)
   * @returns Object with x and y coordinates
   */
  public gridToGame(column: number, row: number, width: number = 1, height: number = 1): { x: number; y: number } {
    const {
      gridWidth,
      gridHeight,
      gridMarginLeft,
      gridMarginTop,
      safeAreaOffsetX,
      safeAreaOffsetY,
      gameAreaOffsetY,
    } = this.gameConfig;

    // Validate grid position
    if (column < 1 || column > 5 || row < 1 || row > 3) {
      throw new Error(
        `Invalid grid position: column must be 1-5, row must be 1-3. Got: ${column}, ${row}`
      );
    }

    // Calculate x position (center of the character's grid cells)
    // Character spans columns [column, column + width - 1]
    // Center column = column + (width - 1) / 2
    const centerColumn = column + (width - 1) / 2;
    const x = safeAreaOffsetX + gridMarginLeft + ((centerColumn - 0.5) / 5) * gridWidth;

    // Calculate y position (center of the character's grid cells)
    // Character spans rows [row, row + height - 1]
    // Center row = row + (height - 1) / 2
    const centerRow = row + (height - 1) / 2;
    // Use gameAreaOffsetY (not safeAreaOffsetY) since that's where the actual game area starts
    const y = gameAreaOffsetY + gridMarginTop + ((centerRow - 0.5) / 3) * gridHeight;

    return { x, y };
  }

  /**
   * Start activity checker - runs every second to detect if player is idle
   */
  startActivityChecker(): void {
    // Check every 1 second
    this.activityCheckEvent = this.time.addEvent({
      delay: 1000,
      callback: this.checkActivity,
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * Check if player is active or idle
   */
  checkActivity(): void {
    const now = Date.now();
    const idleTime = now - this.lastActivityTime;

    // If idle for more than 3 seconds, mark as inactive
    if (idleTime > 3000 && this.isPlayerActive) {
      this.updateActivityStatus(false);
    }
  }

  /**
   * Update activity status and adjust spawn rate
   */
  updateActivityStatus(isActive: boolean): void {
    if (this.isPlayerActive === isActive) return;

    this.isPlayerActive = isActive;

    // Update progression manager with new activity status
    // DISABLED: setPlayerActivity method removed from ProgressionManager
    // if (this.progressionManager) {
    //   this.progressionManager.setPlayerActivity(isActive);
    // }

    // console.log(`Player ${isActive ? "ACTIVE" : "IDLE"}`);
  }

  /**
   * Convert screen coordinates to game area coordinates.
   * Accounts for main camera viewport offset on desktop.
   * @param screenX Screen X coordinate
   * @param screenY Screen Y coordinate
   * @returns Object with x and y coordinates in game area space
   */
  screenToGame(screenX: number, screenY: number): { x: number; y: number } {
    // Phaser pointer.x/y are already in world coordinates (accounting for camera scroll)
    // Just return them directly for the slash trail positioning
    return {
      x: screenX,
      y: screenY
    };
  }

  /**
   * Change background based on character type
   * Fullscreen coverage - covers entire viewport
   * Falls back to default galaxy if specific background fails to load
   * @param characterClass The character class that spawned
   */
  changeBackground(characterClass: CharacterClass): void {
    if (!this.gameBackground) return;

    let bgKey: string;
    if (characterClass === OrangeBot) {
      bgKey = "bg-orange";
    } else if (characterClass === LeafBot) {
      bgKey = "bg-leaf";
    } else if (characterClass === FlyBot) {
      bgKey = "bg-fly";
    } else {
      return; // Unknown character type
    }

    // Use default galaxy background if specific one doesn't exist
    const finalBgKey = this.textures.exists(bgKey) ? bgKey : "game-bg";

    // Only change background if it's different from current
    if (this.currentBackgroundKey === finalBgKey) {
      return; // Same background, no need to change
    }

    // Update current background tracker
    this.currentBackgroundKey = finalBgKey;

    // Change texture
    this.gameBackground.setTexture(finalBgKey);

    // Recalculate fullscreen size for new background (cover mode)
    const fullCanvasWidth = this.cameras.main.width;
    const fullCanvasHeight = this.cameras.main.height;
    const bgWidth = this.gameBackground.width;
    const bgHeight = this.gameBackground.height;
    const bgAspectRatio = bgWidth / bgHeight;
    const screenAspectRatio = fullCanvasWidth / fullCanvasHeight;

    let displayWidth: number;
    let displayHeight: number;

    if (bgAspectRatio > screenAspectRatio) {
      // Background wider than screen - fit to HEIGHT (cover mode)
      displayHeight = fullCanvasHeight;
      displayWidth = fullCanvasHeight * bgAspectRatio;
    } else {
      // Background taller than screen - fit to WIDTH (cover mode)
      displayWidth = fullCanvasWidth;
      displayHeight = fullCanvasWidth / bgAspectRatio;
    }

    this.gameBackground.setDisplaySize(displayWidth, displayHeight);

    console.log(`[BG] Background: ${finalBgKey} -> ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)} (COVER MODE)`);
  }

  /**
   * Register a game object to be ignored by the UI camera.
   * Call this for any dynamically created game objects (particles, effects, etc.)
   * @param obj The game object to ignore
   */
  ignoreFromUICamera(obj: Phaser.GameObjects.GameObject): void {
    if (this.uiCamera) {
      this.uiCamera.ignore(obj);
    }
  }

  /**
   * Convert game area coordinates to screen coordinates.
   * Use this when game objects need to interact with screen/UI elements.
   * @param gameX Game area X coordinate
   * @param gameY Game area Y coordinate
   * @returns Object with x and y coordinates in screen space
   */
  gameToScreen(gameX: number, gameY: number): { x: number; y: number } {
    const { gameAreaOffsetX, dpr } = this.gameConfig;

    // Add camera offset to get screen coordinates
    return {
      x: gameX + gameAreaOffsetX * dpr,
      y: gameY, // Y is not offset
    };
  }

  /**
   * Spawn an enemy of a specific character class at a specific position
   * Called by ProgressionManager
   */
  spawnEnemy(characterClass: CharacterClass, position: { x: number; y: number }): void {
    // Create target at specified position
    const target = new characterClass({
      scene: this,
      x: position.x,
      y: position.y,
      gameConfig: this.gameConfig,
      audioManager: this.audioManager || {} as AudioManager,
    });

    // Make UI camera ignore all target's game objects
    const targetObjects = target.getAllGameObjects();
    targetObjects.forEach((obj) => this.ignoreFromUICamera(obj));

    // MOBILE FIX: Set all character objects depth ABOVE background (depth 10)
    if (this.gameConfig.isMobile) {
      targetObjects.forEach((obj) => (obj as any).setDepth?.(20));
    }

    // Add to targets array
    this.targets.push(target);
  }

  /**
   * Legacy method - kept for reference but no longer used
   * Progression is now handled by ProgressionManager
   */
  spawnRandomTarget(): void {
    // Array of available character classes
    // const characterClasses = [OrangeBot, LeafBot, FlyBot];
    const characterClasses = [OrangeBot];

    // TEST: Spawn characters in ALL grid positions at once
    // Set to false to go back to random spawning
    const testAllPositions = true;

    if (testAllPositions) {
      // Spawn in all grid positions
      for (let row = 1; row <= 3; row++) {
        for (let column = 1; column <= 5; column++) {
          const RandomCharacter =
            characterClasses[Math.floor(Math.random() * characterClasses.length)];

          // Create a temporary instance to get the character size
          const tempTarget = new RandomCharacter({
            scene: this,
            x: 0,
            y: 0,
            gameConfig: this.gameConfig,
            audioManager: this.audioManager || {} as AudioManager,
          });
          const size = tempTarget.getSize();
          tempTarget.destroy();

          // Skip if character doesn't fit at this position
          if (column + size.w - 1 > 5 || row + size.h - 1 > 3) {
            continue;
          }

          // Convert grid position to game coordinates (no manual offset needed anymore!)
          const { x, y } = this.gridToGame(column, row, size.w, size.h);

          // Create target
          const target = new RandomCharacter({
            scene: this,
            x,
            y,
            gameConfig: this.gameConfig,
            audioManager: this.audioManager || {} as AudioManager,
          });

          // Make UI camera ignore all target's game objects
          const targetObjects = target.getAllGameObjects();
          targetObjects.forEach((obj) => this.ignoreFromUICamera(obj));

          // Add to targets array for hit detection
          this.targets.push(target);
        }
      }
      return;
    }

    // NORMAL: Select random character and position
    // Select random character
    const RandomCharacter =
      characterClasses[Math.floor(Math.random() * characterClasses.length)];

    // Create a temporary instance to get the character size
    const tempTarget = new RandomCharacter({
      scene: this,
      x: 0,
      y: 0,
      gameConfig: this.gameConfig,
      audioManager: this.audioManager || {} as AudioManager,
    });
    const size = tempTarget.getSize();
    tempTarget.destroy();

    // Select random grid position (accounting for character size)
    let maxColumn = 5 - size.w + 1;
    let minColumn = 1;

    // Special case: restrict OrangeBot and LeafBot to central columns (2-4)
    if (size.h > 1 || size.w > 1) {
      minColumn = 2;
      maxColumn = 4;
    }

    const column = Math.floor(Math.random() * (maxColumn - minColumn + 1)) + minColumn;
    const maxRow = 3 - size.h + 1;
    const row = Math.floor(Math.random() * maxRow) + 1;

    // Convert grid position to game coordinates
    const { x, y } = this.gridToGame(column, row, size.w, size.h);

    // Create new target at game area coordinates
    const target = new RandomCharacter({
      scene: this,
      x,
      y,
      gameConfig: this.gameConfig,
      audioManager: this.audioManager || {} as AudioManager,
    });

    // Make UI camera ignore all target's game objects
    const targetObjects = target.getAllGameObjects();
    targetObjects.forEach((obj) => this.ignoreFromUICamera(obj));

    // Add to targets array
    this.targets.push(target);
  }

  update(): void {
    // FAILSAFE: If initialization gets stuck for more than 5 seconds, force start
    if (this.isInitializing && this.time.now > 5000 && this.progressionManager && !this.progressionManager.isActive) {
      console.warn('[FAILSAFE] Forced initialization completion!');
      this.isInitializing = false;
      this.progressionManager.start();
    }

    // Update slash trail
    if (this.slashTrail) {
      try { this.slashTrail.update(); } catch (e) { }
    }

    // CLEANUP: Remove any ghost/invisible/fading targets
    const initialCount = this.targets.length;
    this.targets = this.targets.filter(target => {
      const container = target.getContainer();

      // Safety check: Remove if container is destroyed/inactive
      if (!container || !container.active) {
        try { target.destroy(); } catch (e) { }
        return false;
      }

      // Remove completely invisible targets if they are dead
      if (container.alpha <= 0.01 && target.isDead()) {
        try { target.destroy(); } catch (e) { }
        return false;
      }

      // CRITICAL FIX: Remove fading ghosts (alpha < 0.3) that are NOT in entrance animation
      // Entrance animation targets start at alpha 0 and fade in to 1, so we check if alpha is stable/decreasing
      // A target is considered "fading ghost" if:
      // 1. Alpha is very low (< 0.3) - too transparent to interact with
      // 2. AND it's been alive for more than 2 seconds (not a fresh spawn)
      // This prevents removing newly spawned enemies that are fading IN
      const isOldEnough = container.getData('spawnTime') && (Date.now() - container.getData('spawnTime')) > 2000;
      if (container.alpha < 0.3 && isOldEnough) {
        // console.log(`[CLEANUP] Removing fading ghost with alpha: ${container.alpha.toFixed(2)}`);
        try { target.destroy(); } catch (e) { }
        return false;
      }

      return true;
    });

    // Notify progression manager for every target removed
    const removedCount = initialCount - this.targets.length;
    if (removedCount > 0 && this.progressionManager) {
      for (let i = 0; i < removedCount; i++) {
        this.progressionManager.onEnemyKilled();
      }
    }

    // BACKGROUND PARALLAX (Real-time depth reaction)
    const { canvasWidth, canvasHeight, isMobile, dpr } = this.gameConfig;
    const parallaxTarget = isMobile ? this.gameBackground : this.backgroundContainer;

    if (parallaxTarget && this.gameConfig) {
      const pointer = this.input.activePointer;

      // Calculate offset from center (normalized -1 to 1)
      const normX = (pointer.x / canvasWidth) - 0.5;
      const normY = (pointer.y / canvasHeight) - 0.5;

      // Parallax intensity (Top layer moves opposite to mouse)
      // Subtle 15px for mobile, 30px for desktop
      const intensity = (isMobile ? 15 : 30) * dpr;

      const targetX = (canvasWidth / 2) - (normX * intensity);
      const targetY = (canvasHeight / 2) - (normY * intensity);

      // Smooth lerp for weight/fluidity
      parallaxTarget.x += (targetX - parallaxTarget.x) * 0.05;
      parallaxTarget.y += (targetY - parallaxTarget.y) * 0.05;
    }
  }

  createUI(): void {
    const { canvasWidth, gameHeight, dpr } = this.gameConfig;
    const padding = 20 * dpr;

    // Use game config dimensions (already accounts for DPR properly)
    const bottomY = gameHeight * dpr - padding;

    // HP Bar (bottom left)
    const hpBarWidth = 150 * dpr;
    const hpBarHeight = 20 * dpr;
    const hpBarX = padding;
    const hpBarY = bottomY - hpBarHeight;
    const hpBarSkew = 15 * dpr; // Skew amount for parallelogram

    // HP Bar Background (white border with black fill for padding)
    this.hpBarBackground = this.add.graphics();
    this.uiLayer!.add(this.hpBarBackground);
    this.hpBarBackground.fillStyle(0x000000, 1);
    this.hpBarBackground.lineStyle(2 * dpr, 0xffffff, 1);
    // Draw parallelogram: bottom-left, bottom-right, top-right, top-left
    this.hpBarBackground.beginPath();
    this.hpBarBackground.moveTo(hpBarX, hpBarY + hpBarHeight);
    this.hpBarBackground.lineTo(hpBarX + hpBarWidth, hpBarY + hpBarHeight);
    this.hpBarBackground.lineTo(hpBarX + hpBarWidth + hpBarSkew, hpBarY);
    this.hpBarBackground.lineTo(hpBarX + hpBarSkew, hpBarY);
    this.hpBarBackground.closePath();
    this.hpBarBackground.fillPath();
    this.hpBarBackground.strokePath();
    this.hpBarBackground.setDepth(100);

    // HP Bar Fill (green to red gradient based on HP)
    this.hpBarFill = this.add.graphics();
    this.uiLayer!.add(this.hpBarFill);
    this.hpBarFill.setDepth(101);
    this.updateHPBar();

    // HP Text (positioned to the right of the bar)
    this.hpText = this.add
      .text(
        hpBarX + hpBarWidth + hpBarSkew + 10 * dpr,
        hpBarY + hpBarHeight / 2,
        `${this.currentHP}/${this.maxHP}`,
        {
          fontFamily: "Jura, sans-serif",
          fontSize: `${16 * dpr}px`,
          color: "#ffffff",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3 * dpr,
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(102);
    this.uiLayer!.add(this.hpText);

    // Coin Counter (bottom right)
    this.coinCounterX = canvasWidth * dpr - padding;
    this.coinCounterY = bottomY;

    // Coin number text (no emoji)
    this.coinText = this.add
      .text(this.coinCounterX, this.coinCounterY, `${this.coins}`, {
        fontFamily: "Jura, sans-serif",
        fontSize: `${18 * dpr}px`,
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3 * dpr,
      })
      .setOrigin(1, 1)
      .setDepth(100);
    this.uiLayer!.add(this.coinText);

    // Animated coin sprite (positioned to the left of the number)
    const coinSpriteX = this.coinCounterX - this.coinText.width - 15 * dpr; // 8px gap + 7px extra left
    const coinSpriteY = this.coinCounterY - this.coinText.height / 2;

    this.coinSprite = this.add.sprite(coinSpriteX, coinSpriteY, "coin-1");
    this.coinSprite.setScale(0.0425 * dpr); // 15% smaller
    this.coinSprite.setDepth(100);
    this.coinSprite.setInteractive({ useHandCursor: true }); // Make clickable
    this.uiLayer!.add(this.coinSprite);
    this.coinSprite.play("coin-spin");

    // Add click handler to cycle backgrounds
    this.coinSprite.on('pointerdown', () => {
      this.cycleBackground();
    });

    // Level Progress Text (show next level target)
    this.updateLevelProgressText();
  }

  /**
   * Update level progress text to show target for next level
   */
  updateLevelProgressText(): void {
    // Safety check: Don't update if scene is not ready
    if (!this.scene || !this.scene.isActive() || !this.uiLayer) {
      return;
    }

    if (!this.levelProgressText) {
      // Create the text if it doesn't exist
      const { canvasWidth, dpr } = this.gameConfig;
      const padding = 20 * dpr;

      try {
        this.levelProgressText = this.add
          .text(this.coinCounterX, this.coinCounterY + 25 * dpr, '', {
            fontFamily: "Jura, sans-serif",
            fontSize: `${12 * dpr}px`,
            color: "#AAAAAA",
            fontStyle: "normal",
            stroke: "#000000",
            strokeThickness: 2 * dpr,
          })
          .setOrigin(1, 0) // Top-right origin
          .setDepth(100);
        this.uiLayer!.add(this.levelProgressText);
      } catch (e) {
        console.warn('Failed to create level progress text:', e);
        return;
      }
    }

    // Safety check: Ensure text object is valid before updating
    if (!this.levelProgressText || !this.levelProgressText.active) {
      return;
    }

    // Find next level target
    let nextTarget = null;
    for (const levelData of this.backgroundLevels) {
      if (levelData.coins > this.coins) {
        nextTarget = levelData;
        break;
      }
    }

    // Update text based on current progress
    try {
      if (nextTarget) {
        // Show progress to next level
        const progress = Math.min(100, (this.coins / nextTarget.coins) * 100);
        this.levelProgressText.setText(`Next Level: ${nextTarget.coins.toLocaleString()} coins (${progress.toFixed(0)}%)`);
        this.levelProgressText.setColor('#FFD700'); // Gold color
      } else {
        // Max level reached
        this.levelProgressText.setText('MAX LEVEL!');
        this.levelProgressText.setColor('#00FF00'); // Green color
      }
    } catch (e) {
      console.warn('Failed to update level progress text:', e);
    }
  }

  /**
   * Setup animated background effects
   * - Breathing effect (subtle zoom in/out)
   * - Floating particles (stars/dust)
   */
  setupAnimatedBackground(): void {
    const { isMobile } = this.gameConfig;

    // 1. VIGNETTE REMOVAL (As requested to keep background bright)
    // No longer creating vignette to ensure maximum visibility and "premium" feel


    // 2. BACKGROUND ANIMATIONS
    const animationTarget = isMobile ? this.gameBackground : this.backgroundContainer;

    if (animationTarget) {
      const baseScale = isMobile ? (animationTarget as any).scaleX : 1.0;

      // Smooth Breathing
      this.tweens.add({
        targets: animationTarget,
        scale: { from: baseScale, to: baseScale * 1.03 },
        duration: 10000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Slow Rotation
      this.tweens.add({
        targets: animationTarget,
        angle: { from: -0.5, to: 0.5 },
        duration: 15000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  updateHPBar(): void {
    if (!this.hpBarFill || !this.hpBarFill.scene) return;

    try {
      const { gameHeight, dpr } = this.gameConfig;
      const padding = 20 * dpr;
      const hpBarWidth = 150 * dpr;
      const hpBarHeight = 20 * dpr;
      const hpBarX = padding;
      const hpBarY = gameHeight * dpr - padding - hpBarHeight;
      const hpBarSkew = 15 * dpr;
      const inset = 3 * dpr; // Inner padding (black padding between fill and border)

      const hpPercentage = this.currentHP / this.maxHP;
      const innerHeight = hpBarHeight - inset * 2;

      // Reduce inner slant for better proportions
      const skewRatio = innerHeight / hpBarHeight;
      const innerSkew = hpBarSkew * skewRatio;

      // Adjust horizontal offset for the reduced slant
      const horizontalShift = (inset * hpBarSkew) / hpBarHeight;
      const fillWidth = (hpBarWidth - inset * 2) * hpPercentage;

      // White fill color
      const color = 0xffffff;

      this.hpBarFill.clear();
      this.hpBarFill.fillStyle(color, 1);

      // Draw inner parallelogram fill with adjusted horizontal position
      const innerX = hpBarX + inset + horizontalShift;
      const innerY = hpBarY + inset;

      this.hpBarFill.beginPath();
      this.hpBarFill.moveTo(innerX, innerY + innerHeight);
      this.hpBarFill.lineTo(innerX + fillWidth, innerY + innerHeight);
      this.hpBarFill.lineTo(innerX + fillWidth + innerSkew, innerY);
      this.hpBarFill.lineTo(innerX + innerSkew, innerY);
      this.hpBarFill.closePath();
      this.hpBarFill.fillPath();

      // Update HP text
      if (this.hpText && this.hpText.active) {
        this.hpText.setText(`${Math.ceil(this.currentHP)}/${this.maxHP}`);
      }
    } catch (e) {
      console.warn('Error updating HP bar:', e);
    }
  }

  updateCoins(amount: number): void {
    this.coins += amount;

    // Play coin sound when coins increase
    if (amount > 0) {
      this.audioManager?.play("coin-received");
    }

    if (this.coinText) {
      this.coinText.setText(`${this.coins}`);

      // Reposition coin sprite based on new text width
      if (this.coinSprite) {
        const { dpr } = this.gameConfig;
        const coinSpriteX = this.coinCounterX - this.coinText.width - 15 * dpr;
        this.coinSprite.setX(coinSpriteX);
      }
    }

    // Update level progress text
    this.updateLevelProgressText();

    // Save total coins to localStorage
    this.saveProgress();

    // Check for background unlock at 10,000 coins
    this.checkBackgroundUnlock();
  }

  /**
   * Save game progress to localStorage
   */
  saveProgress(): void {
    try {
      const saveData = {
        totalCoins: this.coins,
        playerLevel: this.playerLevel,
        unlockedBackgrounds: this.unlockedBackgrounds,
        selectedBackground: this.selectedBackground,
      };
      localStorage.setItem('slashlat_save', JSON.stringify(saveData));
      console.log(`[SAVE] Saved: Level ${this.playerLevel}, Coins ${this.coins}, Background ${this.selectedBackground}`);
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  /**
   * Load game progress from localStorage
   */
  loadProgress(): void {
    try {
      const saved = localStorage.getItem('slashlat_save');
      if (saved) {
        const saveData = JSON.parse(saved);
        this.coins = saveData.totalCoins || 0;
        this.playerLevel = saveData.playerLevel || 1;
        this.unlockedBackgrounds = saveData.unlockedBackgrounds || ['bg-orange'];
        this.selectedBackground = saveData.selectedBackground || 'bg-orange';

        // Update UI
        if (this.coinText) {
          this.coinText.setText(`${this.coins}`);
        }

        console.log(`[LOAD] Loaded: Level ${this.playerLevel}, Coins ${this.coins}, Backgrounds ${this.unlockedBackgrounds.length}/4`);
      }
    } catch (e) {
      console.warn('Failed to load progress:', e);
    }
  }

  /**
   * Check for level up and new background unlocks
   */
  checkBackgroundUnlock(): void {
    // Calculate player level based on total coins
    const newLevel = this.calculatePlayerLevel();

    if (newLevel > this.playerLevel) {
      // Level up!
      this.playerLevel = newLevel;
      console.log(`[LEVEL UP] Now level ${this.playerLevel}`);

      // Check for new background unlocks
      this.backgroundLevels.forEach((levelData) => {
        if (levelData.coins > 0 && !this.unlockedBackgrounds.includes(levelData.background) && this.coins >= levelData.coins) {
          this.unlockedBackgrounds.push(levelData.background);

          // Show unlock notification
          this.showLevelUpNotification(levelData);
        }
      });

      // Save progress
      this.saveProgress();

      // Restart progression manager with new difficulty config
      this.updateProgressionConfig();
    }
  }

  /**
   * Calculate player level based on total coins
   */
  calculatePlayerLevel(): number {
    for (let i = this.backgroundLevels.length - 1; i >= 0; i--) {
      if (this.coins >= this.backgroundLevels[i].coins) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * Update progression config when player levels up
   * Restarts progression manager with appropriate enemies for new level
   */
  updateProgressionConfig(): void {
    // Stop current progression
    this.progressionManager?.stop();

    // Generate new config based on updated level
    const newConfig = this.getCoinBasedProgressionConfig();

    // Restart progression manager with new config
    this.progressionManager = new ProgressionManager(
      this,
      newConfig,
      {
        onSpawnEnemy: (characterClass: CharacterClass, position: { x: number; y: number }) => {
          this.spawnEnemy(characterClass, position);
        },
        onDifficultyChange: (tierIndex: number) => {
          console.log(`[WARNING] DIFFICULTY INCREASED! Tier ${tierIndex + 1}/12`);
        },
      },
      this.gameConfig
    );

    // Start new progression
    this.progressionManager.start();

    console.log(`[UPDATE] Progression config updated for Level ${this.playerLevel}`);
  }

  /**
   * Generate coin-based progression config (respects player level)
   * UNLIMITED continuous spawn - enemies keep coming until player reaches target coins
   */
  getCoinBasedProgressionConfig(): ProgressionConfig {
    const level = this.calculatePlayerLevel();

    // Level 1: Introduction
    if (level === 1) {
      return {
        mode: "continuous",
        continuousConfig: {
          tiers: [
            {
              startTime: 0,
              enemies: [{ characterClass: OrangeBot, weight: 1 }],
              maxConcurrent: 6,
              spawnInterval: 1000,
            },
          ],
        },
      };
    }

    // Level 2: Adding variety
    if (level === 2) {
      return {
        mode: "continuous",
        continuousConfig: {
          tiers: [
            {
              startTime: 0,
              enemies: [
                { characterClass: OrangeBot, weight: 5 },
                { characterClass: LeafBot, weight: 3 },
                { characterClass: Bee, weight: 2 },
              ],
              maxConcurrent: 8,
              spawnInterval: 800,
            },
          ],
        },
      };
    }

    // Level 3: More challenge
    if (level === 3) {
      return {
        mode: "continuous",
        continuousConfig: {
          tiers: [
            {
              startTime: 0,
              enemies: [
                { characterClass: OrangeBot, weight: 3 },
                { characterClass: LeafBot, weight: 3 },
                { characterClass: FlyBot, weight: 2 },
                { characterClass: Robot, weight: 2 },
              ],
              maxConcurrent: 10,
              spawnInterval: 600,
            },
          ],
        },
      };
    }

    // Level 4: MASTER INTENSE - ALL CHARACTERS
    return {
      mode: "continuous",
      continuousConfig: {
        tiers: [
          {
            startTime: 0,
            enemies: [
              { characterClass: OrangeBot, weight: 2 },
              { characterClass: LeafBot, weight: 2 },
              { characterClass: FlyBot, weight: 2 },
              { characterClass: Bee, weight: 1 },
              { characterClass: Lion, weight: 1 },
              { characterClass: Robot, weight: 1 },
              { characterClass: SnakeBot, weight: 1 },
            ],
            maxConcurrent: 15,
            spawnInterval: 400,
          },
        ],
      },
    };
  }

  /**
   * Show unlock notification for new background
   */
  showUnlockNotification(backgroundName: string): void {
    // Deprecated - use showLevelUpNotification instead
  }

  /**
   * Show level up notification with new background unlock
   */
  showLevelUpNotification(levelData: any): void {
    const { canvasWidth, canvasHeight } = this.gameConfig;

    // Create notification container
    const notification = this.add.container(canvasWidth / 2, canvasHeight / 2);

    // Background panel
    const panel = this.add.rectangle(0, 0, 500, 250, 0x000000, 0.9);
    panel.setStrokeStyle(5, 0xffd700);
    notification.add(panel);

    // Level up title
    const title = this.add.text(0, -80, 'LEVEL UP!', {
      fontSize: '42px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);
    notification.add(title);

    // Level number
    const levelText = this.add.text(0, -30, `Level ${this.playerLevel}`, {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
    });
    levelText.setOrigin(0.5);
    notification.add(levelText);

    // Background name
    const name = this.add.text(0, 20, `${levelData.name.toUpperCase()}`, {
      fontSize: '24px',
      color: '#66ff66',
      stroke: '#000',
      strokeThickness: 3,
    });
    name.setOrigin(0.5);
    notification.add(name);

    // Coin requirement
    const coinsText = this.add.text(0, 60, `${(levelData.coins / 1000).toFixed(0)}k coins reached!`, {
      fontSize: '18px',
      color: '#aaaaaa',
    });
    coinsText.setOrigin(0.5);
    notification.add(coinsText);

    // Instruction
    const instruction = this.add.text(0, 95, 'Click coin icon to change background', {
      fontSize: '16px',
      color: '#66ccff',
    });
    instruction.setOrigin(0.5);
    notification.add(instruction);

    notification.setDepth(10000);

    // Animate in
    this.tweens.add({
      targets: notification,
      scale: { from: 0, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 600,
      ease: 'Back.easeOut',
    });

    // Play sound
    this.audioManager?.play('coin-received');

    // Auto hide after 5 seconds
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: notification,
        scale: 0,
        alpha: 0,
        duration: 400,
        ease: 'Back.easeIn',
        onComplete: () => {
          notification.destroy();
        },
      });
    });
  }

  /**
   * Toggle background selection
   */
  cycleBackground(): void {
    if (this.unlockedBackgrounds.length <= 1) {
      // Only default background, show locked message
      this.showLockedMessage();
      return;
    }

    // Cycle to next unlocked background
    const currentIndex = this.unlockedBackgrounds.indexOf(this.selectedBackground);
    const nextIndex = (currentIndex + 1) % this.unlockedBackgrounds.length;
    this.selectedBackground = this.unlockedBackgrounds[nextIndex];

    // Apply new background
    this.changeBackgroundByName(this.selectedBackground);

    // Save selection
    this.saveProgress();

    // Show notification
    this.showBackgroundChangeNotification(this.selectedBackground);
  }

  /**
   * Show message when backgrounds are still locked
   */
  showLockedMessage(): void {
    const { canvasWidth, canvasHeight } = this.gameConfig;

    // Find next unlock
    const nextUnlock = this.backgroundLevels.find(level => level.coins > this.coins);

    if (!nextUnlock) {
      // All unlocked
      return;
    }

    const message = `Next unlock at ${nextUnlock.name}\n${(nextUnlock.coins / 1000).toFixed(0)}k coins needed\nCurrent: ${(this.coins / 1000).toFixed(1)}k / ${(nextUnlock.coins / 1000).toFixed(0)}k`;

    const notification = this.add.text(canvasWidth / 2, canvasHeight / 2 - 100, message, {
      fontSize: '22px',
      color: '#ff6666',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
      align: 'center',
    });
    notification.setOrigin(0.5);
    notification.setDepth(10000);

    this.tweens.add({
      targets: notification,
      alpha: { from: 1, to: 0 },
      duration: 2000,
      delay: 2000,
      onComplete: () => {
        notification.destroy();
      },
    });
  }

  /**
   * Show notification when background changes
   */
  showBackgroundChangeNotification(backgroundKey: string): void {
    const { canvasWidth, canvasHeight } = this.gameConfig;

    // Find level data for this background
    const levelData = this.backgroundLevels.find(level => level.background === backgroundKey);

    const message = levelData
      ? `${levelData.name.toUpperCase()} (Level ${this.backgroundLevels.indexOf(levelData) + 1})`
      : `Background: ${backgroundKey.toUpperCase()}`;

    const notification = this.add.text(canvasWidth / 2, canvasHeight / 2 - 120, message, {
      fontSize: '26px',
      color: '#66ff66',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
    });
    notification.setOrigin(0.5);
    notification.setDepth(10000);

    this.tweens.add({
      targets: notification,
      alpha: { from: 1, to: 0 },
      y: canvasHeight / 2 - 170,
      duration: 1500,
      delay: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        notification.destroy();
      },
    });
  }

  /**
   * Change background by name (for player selection)
   */
  changeBackgroundByName(backgroundKey: string): void {
    if (!this.gameBackground) return;

    // Update texture
    this.gameBackground.setTexture(backgroundKey);

    // Recalculate cover mode
    const { canvasWidth, canvasHeight } = this.gameConfig;
    const bgWidth = this.gameBackground.width;
    const bgHeight = this.gameBackground.height;
    const bgAspectRatio = bgWidth / bgHeight;
    const screenAspectRatio = canvasWidth / canvasHeight;

    let displayWidth: number;
    let displayHeight: number;

    if (bgAspectRatio > screenAspectRatio) {
      displayHeight = canvasHeight;
      displayWidth = canvasHeight * bgAspectRatio;
    } else {
      displayWidth = canvasWidth;
      displayHeight = canvasWidth / bgAspectRatio;
    }

    this.gameBackground.setDisplaySize(displayWidth, displayHeight);

    console.log(`[BG] Background changed to: ${backgroundKey}`);
  }

  takeDamage(damage: number, enemyX?: number, enemyY?: number): void {
    // CRITICAL: Block damage during initialization (first 1 second)
    if (this.isInitializing) {
      console.log('[BLOCKED] Damage blocked during initialization period');
      return;
    }

    // CRITICAL: Ignore damage if scene is not active (prevents zombie interactions)
    if (!this.sys.isActive()) {
      return;
    }

    if (this.currentHP <= 0) return; // Already dead

    this.currentHP = Math.max(0, this.currentHP - damage);
    this.updateHPBar();

    // Flash health bar red
    this.flashHealthBarRed();

    // Show floating damage text near health bar
    this.showPlayerDamage(damage);

    // Red gradient flash at bottom of screen
    this.flashBottomScreenRed();

    // Blood particles at enemy position
    if (enemyX !== undefined && enemyY !== undefined) {
      this.spawnBloodParticles(enemyX, enemyY);
    }

    // Check for death
    if (this.currentHP <= 0) {
      this.gameOver();
    }
  }

  gameOver(): void {
    // CRITICAL: Block game over during initialization
    if (this.isInitializing) {
      console.log('[BLOCKED] Game Over blocked during initialization period');
      return;
    }

    // 1. Stop all game systems
    this.progressionManager?.stop();
    this.input.off("pointerdown");
    this.input.off("pointermove");
    this.input.off("pointerup");
    this.tweens.killAll();
    this.isPlayerActive = false;

    // CRITICAL FIX: Destroy all enemies to prevent event listener conflicts on retry
    this.targets.forEach(target => {
      target.destroy();
    });
    this.targets = [];

    // 2. Visual Effects
    this.cameras.main.shake(500, 0.05);
    this.audioManager?.play("explode"); // Big explosion sound

    // Dark overlay
    const overlay = this.add.rectangle(
      this.gameConfig.canvasWidth / 2,
      this.gameConfig.canvasHeight / 2,
      this.gameConfig.canvasWidth,
      this.gameConfig.canvasHeight,
      0x000000,
      0
    );
    overlay.setDepth(10000);
    this.uiCamera?.ignore(overlay); // Show in main camera or UI? UI is better

    // Animate overlay
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.8,
      duration: 1000,
      onComplete: () => {
        this.showGameOverUI();
      }
    });

    // Save final stats potentially?
    this.saveProgress();
  }

  showGameOverUI(): void {
    const { canvasWidth, canvasHeight, dpr } = this.gameConfig;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const container = this.add.container(centerX, centerY);
    container.setDepth(10001);

    // 1. Premium Glass Panel Background - REMOVED per user request
    const panelHeight = 350 * dpr; // Kept for positioning reference

    // 2. GAME OVER Title (Cyberpunk Style)
    const title = this.add.text(0, -panelHeight / 2 + 60 * dpr, "GAME OVER", {
      fontFamily: "Jura",
      fontSize: `${64 * dpr}px`, // Increased size since no panel constraint
      color: "#ff3333", // Bright neon red
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setAlpha(0);

    // Add a shadow/glow effect
    title.setShadow(0, 0, '#ff0000', 20 * dpr, true, true); // Stronger glow

    // 3. Stats Layout
    // Coins
    const scoreLabel = this.add.text(0, -40 * dpr, "COINS COLLECTED", {
      fontFamily: "Jura",
      fontSize: `${16 * dpr}px`, // Slightly larger
      color: "#aaaaaa", // Lighter grey for better contrast on background
      align: "center"
    }).setOrigin(0.5);
    scoreLabel.setShadow(1, 1, '#000000', 2, false, true);

    const scoreValue = this.add.text(0, -5 * dpr, `${this.coins.toLocaleString()}`, {
      fontFamily: "Jura",
      fontSize: `${42 * dpr}px`,
      color: "#FFD700", // Gold
      fontStyle: "bold",
    }).setOrigin(0.5);
    scoreValue.setShadow(0, 0, '#DAA520', 10 * dpr, true, true);

    // Level
    const levelLabel = this.add.text(0, 40 * dpr, "LEVEL REACHED", {
      fontFamily: "Jura",
      fontSize: `${16 * dpr}px`,
      color: "#aaaaaa",
      align: "center"
    }).setOrigin(0.5);
    levelLabel.setShadow(1, 1, '#000000', 2, false, true);

    const levelValue = this.add.text(0, 75 * dpr, `${this.playerLevel}`, {
      fontFamily: "Jura",
      fontSize: `${36 * dpr}px`,
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    levelValue.setShadow(0, 0, '#ffffff', 5 * dpr, true, true);

    const statsContainer = this.add.container(0, 0, [scoreLabel, scoreValue, levelLabel, levelValue]);
    statsContainer.setAlpha(0);

    // 4. Premium 'RETRY' Button
    const btnWidth = 220 * dpr;
    const btnHeight = 60 * dpr;
    const btnY = panelHeight / 2 - 45 * dpr;

    const btnContainer = this.add.container(0, btnY);
    btnContainer.setSize(btnWidth, btnHeight);
    btnContainer.setInteractive({ cursor: 'pointer' });
    btnContainer.setAlpha(0);

    // Button Background - Modern Skewed Gradient
    const btnGraphics = this.add.graphics();
    const skewX = 20 * dpr; // Skew amount

    const drawButton = (isHover: boolean) => {
      btnGraphics.clear();

      const w = btnWidth;
      const h = btnHeight;
      const x = -w / 2;
      const y = -h / 2;

      // Parallelogram path
      btnGraphics.beginPath();
      btnGraphics.moveTo(x + skewX, y);       // Top Left
      btnGraphics.lineTo(x + w + skewX, y);   // Top Right
      btnGraphics.lineTo(x + w - skewX, y + h); // Bottom Right
      btnGraphics.lineTo(x - skewX, y + h);   // Bottom Left
      btnGraphics.closePath();

      if (isHover) {
        // HOVER: Bright White/Red gradient
        btnGraphics.fillGradientStyle(0xffffff, 0xffcccc, 0xff0000, 0xcc0000, 1);
        // NO STROKE - prevents horizontal line artifact on mobile
      } else {
        // DEFAULT: Vibrant Red/Orange Gradient (Action Style)
        btnGraphics.fillGradientStyle(0xff4444, 0xff0000, 0x990000, 0xcc0000, 1);
        // NO STROKE - prevents horizontal line artifact on mobile
      }

      btnGraphics.fillPath();
    };

    drawButton(false);

    const btnText = this.add.text(0, 0, "RETRY", {
      fontFamily: "Jura",
      fontSize: `${28 * dpr}px`, // Larger, bolder
      color: "#ffffff",
      fontStyle: "900" // Extra Bold
    }).setOrigin(0.5);

    // Skew text slightly to match button? Maybe not readability first.
    // btnText.setSkewX(-0.2); 

    btnContainer.add([btnGraphics, btnText]);

    container.add([title, statsContainer, btnContainer]);

    // Constant Pulse Animation (Heartbeat) to invite click
    this.tweens.add({
      targets: btnContainer,
      scale: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Button Interactions
    btnContainer.on('pointerover', () => {
      drawButton(true);
      btnText.setColor('#000000'); // Black text on bright button
      btnText.setFontSize(`${30 * dpr}px`);
      this.tweens.killTweensOf(btnContainer); // Stop pulse
      btnContainer.setScale(1.1); // Immediate pop
      this.input.setDefaultCursor('pointer');
    });

    btnContainer.on('pointerout', () => {
      drawButton(false);
      btnText.setColor('#ffffff');
      btnText.setFontSize(`${28 * dpr}px`);
      // Restart Pulse
      this.tweens.add({
        targets: btnContainer,
        scale: 1.05,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.input.setDefaultCursor('default');
    });

    btnContainer.on('pointerdown', () => {
      this.input.setDefaultCursor('default');
      this.scene.restart({ isRetry: true });
    });

    // 5. Entrance Animation Sequence
    // Elements slide in
    this.tweens.add({
      targets: title,
      alpha: 1,
      y: title.y - 20 * dpr, // Move up slightly
      duration: 600,
      delay: 200,
      ease: 'Cubic.out'
    });

    this.tweens.add({
      targets: statsContainer,
      alpha: 1,
      y: statsContainer.y - 10 * dpr,
      duration: 600,
      delay: 400,
      ease: 'Cubic.out'
    });

    this.tweens.add({
      targets: btnContainer,
      alpha: 1,
      y: btnY - 10 * dpr,
      duration: 600,
      delay: 600,
      ease: 'Cubic.out'
    });
  }

  flashHealthBarRed(): void {
    if (!this.hpBarFill) return;

    const { dpr } = this.gameConfig;
    const padding = 20 * dpr;
    const hpBarWidth = 150 * dpr;
    const hpBarHeight = 20 * dpr;
    const hpBarX = padding;
    const hpBarY = this.gameConfig.gameHeight * dpr - padding - hpBarHeight;
    const hpBarSkew = 15 * dpr;
    const inset = 3 * dpr;

    const hpPercentage = this.currentHP / this.maxHP;
    const innerHeight = hpBarHeight - inset * 2;
    const skewRatio = innerHeight / hpBarHeight;
    const innerSkew = hpBarSkew * skewRatio;
    const horizontalShift = (inset * hpBarSkew) / hpBarHeight;
    const fillWidth = (hpBarWidth - inset * 2) * hpPercentage;

    const innerX = hpBarX + inset + horizontalShift;
    const innerY = hpBarY + inset;

    // Flash red 3 times
    let flashCount = 0;
    const maxFlashes = 3;

    const flash = () => {
      if (!this.hpBarFill) return;

      if (flashCount >= maxFlashes * 2) {
        // Reset to white after all flashes
        this.hpBarFill.clear();
        this.hpBarFill.fillStyle(0xffffff, 1);
        this.hpBarFill.beginPath();
        this.hpBarFill.moveTo(innerX, innerY + innerHeight);
        this.hpBarFill.lineTo(innerX + fillWidth, innerY + innerHeight);
        this.hpBarFill.lineTo(innerX + fillWidth + innerSkew, innerY);
        this.hpBarFill.lineTo(innerX + innerSkew, innerY);
        this.hpBarFill.closePath();
        this.hpBarFill.fillPath();
        return;
      }

      const isRed = flashCount % 2 === 0;
      const color = isRed ? 0xff0000 : 0xffffff;

      this.hpBarFill.clear();
      this.hpBarFill.fillStyle(color, 1);
      this.hpBarFill.beginPath();
      this.hpBarFill.moveTo(innerX, innerY + innerHeight);
      this.hpBarFill.lineTo(innerX + fillWidth, innerY + innerHeight);
      this.hpBarFill.lineTo(innerX + fillWidth + innerSkew, innerY);
      this.hpBarFill.lineTo(innerX + innerSkew, innerY);
      this.hpBarFill.closePath();
      this.hpBarFill.fillPath();

      flashCount++;
      this.time.delayedCall(50, flash);
    };

    flash();
  }

  showPlayerDamage(damage: number): void {
    const { dpr } = this.gameConfig;
    const padding = 20 * dpr;
    const hpBarWidth = 150 * dpr;
    const hpBarHeight = 20 * dpr;
    const hpBarX = padding;
    const hpBarY = this.gameConfig.gameHeight * dpr - padding - hpBarHeight;

    // Position damage text above the health bar
    const damageX = hpBarX + hpBarWidth / 2;
    const damageY = hpBarY - 30 * dpr;

    const damageText = this.add.text(
      damageX,
      damageY,
      `-${Math.round(damage)}`,
      {
        fontFamily: "Jura, sans-serif",
        fontSize: `${24 * dpr}px`,
        color: "#ff4444",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4 * dpr,
      }
    );
    damageText.setOrigin(0.5);
    damageText.setDepth(150);
    this.uiLayer!.add(damageText);

    // Animate upward and fade out
    this.tweens.add({
      targets: damageText,
      y: damageY - 60 * dpr,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.easeOut",
      onComplete: () => {
        damageText.destroy();
      },
    });
  }

  flashBottomScreenRed(): void {
    const { canvasWidth, gameHeight, dpr } = this.gameConfig;

    // Create gradient flash overlay at bottom of screen
    const flashGraphics = this.add.graphics();
    flashGraphics.setDepth(90);
    this.uiLayer!.add(flashGraphics);

    const flashHeight = gameHeight * dpr * 0.52; // 52% of screen height (40% + 30%)

    // Draw gradient (red at bottom, transparent at top)
    const y = gameHeight * dpr - flashHeight;

    // Top-Left, Top-Right, Bottom-Left, Bottom-Right colors and alphas
    // Red color (0xff0000) for all corners
    // Alpha 0 at top, Alpha 0.6 at bottom
    flashGraphics.fillGradientStyle(0xff0000, 0xff0000, 0xff0000, 0xff0000, 0, 0, 0.6, 0.6);
    flashGraphics.fillRect(0, y, canvasWidth * dpr, flashHeight);

    // Animate the flash (fade out)
    this.tweens.add({
      targets: flashGraphics,
      alpha: 0,
      duration: 400,
      ease: "Cubic.easeOut",
      onComplete: () => {
        flashGraphics.destroy();
      },
    });
  }

  spawnBloodParticles(x: number, y: number): void {
    const dpr = this.gameConfig.dpr;

    // Create blood particle emitter
    const bloodEmitter = this.add.particles(x, y, "blood-particle", {
      speed: { min: 60 * dpr, max: 180 * dpr },
      angle: { min: -120, max: -60 }, // Upward cone
      scale: { start: 1.5, end: 0.3 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 25,
      gravityY: 200 * dpr,
      blendMode: Phaser.BlendModes.NORMAL,
      frequency: -1, // Explode once
    });
    bloodEmitter.setDepth(95);

    // Make UI camera ignore blood particles
    this.ignoreFromUICamera(bloodEmitter);

    // Explode particles
    bloodEmitter.explode();

    // Clean up emitter after particles are done
    this.time.delayedCall(1000, () => {
      bloodEmitter.destroy();
    });
  }

  spawnCoinAnimation(startX: number, startY: number, coinValue: number): void {
    const { dpr } = this.gameConfig;

    // Create coin sprite
    const coin = this.add.sprite(startX, startY, "coin-1");
    coin.setScale(0.08 * dpr);
    coin.setDepth(200);
    this.uiLayer!.add(coin);
    coin.play("coin-spin");

    // Calculate arc midpoint
    const arcHeight = 100 * dpr;
    const midX = (startX + this.coinCounterX) / 2;
    const midY = Math.min(startY, this.coinCounterY) - arcHeight;

    // First tween: rise up to midpoint
    this.tweens.add({
      targets: coin,
      x: midX,
      y: midY,
      scale: 0.06 * dpr,
      duration: 300,
      ease: "Quad.easeOut",
      onComplete: () => {
        // Second tween: descend to target
        this.tweens.add({
          targets: coin,
          x: this.coinCounterX,
          y: this.coinCounterY,
          scale: 0.04 * dpr,
          duration: 300,
          ease: "Quad.easeIn",
          onComplete: () => {
            // Award coins when animation completes
            this.updateCoins(coinValue);

            // Flash the coin text
            if (this.coinText) {
              this.tweens.add({
                targets: this.coinText,
                scale: 1.3,
                duration: 100,
                yoyo: true,
                ease: "Quad.easeOut",
              });
            }

            // Destroy coin sprite
            coin.destroy();
          },
        });
      },
    });
  }
}
