import { Scene } from "phaser";
import { FlyBot } from "../characters/FlyBot";
import { LeafBot } from "../characters/LeafBot";
import { OrangeBot } from "../characters/OrangeBot";
import { Target } from "../characters/Target";
import { SlashTrail } from "../effects/SlashTrail";
import { Sparks } from "../effects/Sparks";
import { AudioManager } from "../managers/AudioManager";
import { WeaponManager } from "../managers/WeaponManager";
import {
  ProgressionManager,
  TEST_CONTINUOUS_CONFIG,
  type CharacterClass,
} from "../managers/ProgressionManager";
import { GameConfig } from "../types";

export class GameScene extends Scene {
  private orientationWarning?: Phaser.GameObjects.Text;
  private gameConfig: GameConfig;
  private targets: Target[] = []; // Store all active targets
  private hitTargetsThisSlash: Set<Target> = new Set(); // Track targets hit in current slash
  private slashTrail?: SlashTrail;
  private sparks?: Sparks;
  private audioManager?: AudioManager;
  private canStartNewSlash: boolean = true;
  private hasHitTarget: boolean = false;
  private currentSlashLength: number = 0;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private gameLayer?: Phaser.GameObjects.Container;
  private uiLayer?: Phaser.GameObjects.Container;

  // HP and Coins
  private maxHP: number = 1000;
  private currentHP: number = 1000;
  private coins: number = 0;
  private hpBarBackground?: Phaser.GameObjects.Graphics;
  private hpBarFill?: Phaser.GameObjects.Graphics;
  private hpText?: Phaser.GameObjects.Text;
  private coinText?: Phaser.GameObjects.Text;
  private coinSprite?: Phaser.GameObjects.Sprite;
  private coinCounterX: number = 0;
  private coinCounterY: number = 0;
  private weaponManager?: WeaponManager;
  private progressionManager?: ProgressionManager;
  private gameBackground?: Phaser.GameObjects.Image;
  private currentBackgroundKey?: string; // Track current background to prevent unnecessary changes
  private lastActivityTime: number = Date.now(); // Track player activity
  private isPlayerActive: boolean = false; // Is player currently active?
  private activityCheckEvent?: Phaser.Time.TimerEvent;

  constructor(gameConfig: GameConfig) {
    super({ key: "GameScene" });
    this.gameConfig = gameConfig;
  }

  init(): void {
    // Get audio manager from registry (loaded in LoadingScene)
    const managers = this.registry.get("managers");
    if (managers && managers.audioManager) {
      this.audioManager = managers.audioManager;
    }
  }

  preload(): void {
    const dpr = this.gameConfig.dpr;

    // Load game backgrounds for each character
    console.log("Loading backgrounds...");
    this.load.image("bg-orange", "image/bg-orange.png");
    this.load.image("bg-leaf", "image/bg-leaf.png");
    this.load.image("bg-fly", "image/bg-fly.png");

    // Default galaxy background (fallback)
    this.load.image("game-bg", "image/game-bg.png");

    // Log when loading is complete
    this.load.on("complete", () => {
      console.log("✓ All backgrounds loaded successfully!");
      console.log("  - bg-orange:", this.textures.exists("bg-orange"));
      console.log("  - bg-leaf:", this.textures.exists("bg-leaf"));
      console.log("  - bg-fly:", this.textures.exists("bg-fly"));
      console.log("  - game-bg:", this.textures.exists("game-bg"));
    });

    // Create a simple particle texture for sparks
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture("spark", 4, 4);
    graphics.destroy();

    // Create particle textures for explosion
    // Fire particle (very small, orange-yellow)
    const fireGraphics = this.make.graphics({ x: 0, y: 0 });
    fireGraphics.fillStyle(0xffaa00, 1);
    fireGraphics.fillCircle(2, 2, 2);
    fireGraphics.generateTexture("fire-particle", 4, 4);
    fireGraphics.destroy();

    // Electricity particle (bright blue-white, star/cross shape)
    const electricGraphics = this.make.graphics({ x: 0, y: 0 });
    electricGraphics.fillStyle(0x00ffff, 1);
    // Draw a cross/star shape for electric spark
    electricGraphics.fillRect(3, 0, 2, 8); // Vertical line
    electricGraphics.fillRect(0, 3, 8, 2); // Horizontal line
    electricGraphics.fillTriangle(4, 0, 2, 3, 6, 3); // Top spike
    electricGraphics.fillTriangle(4, 8, 2, 5, 6, 5); // Bottom spike
    electricGraphics.fillTriangle(0, 4, 3, 2, 3, 6); // Left spike
    electricGraphics.fillTriangle(8, 4, 5, 2, 5, 6); // Right spike
    electricGraphics.generateTexture("electric-particle", 8, 8);
    electricGraphics.destroy();

    // Smoke particle (smaller, dark gray)
    const smokeGraphics = this.make.graphics({ x: 0, y: 0 });
    smokeGraphics.fillStyle(0x333333, 1);
    smokeGraphics.fillCircle(6, 6, 6);
    smokeGraphics.generateTexture("smoke-particle", 12, 12);
    smokeGraphics.destroy();

    // Blood particle (dark red droplet)
    const bloodGraphics = this.make.graphics({ x: 0, y: 0 });
    bloodGraphics.fillStyle(0x8b0000, 1);
    bloodGraphics.fillCircle(4, 4, 4);
    bloodGraphics.generateTexture("blood-particle", 8, 8);
    bloodGraphics.destroy();
  }

  create(): void {
    const {
      canvasWidth,
      canvasHeight,
      gameWidth,
      gameHeight,
      dpr,
      scale,
    } = this.gameConfig;

    // Create separate layers for game objects and UI
    this.gameLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);

    // Add background image FIRST - position at center of full canvas
    // Use the actual canvas dimensions (not game world dimensions)
    const fullCanvasWidth = this.cameras.main.width;
    const fullCanvasHeight = this.cameras.main.height;

    this.gameBackground = this.add.image(fullCanvasWidth / 2, fullCanvasHeight / 2, "game-bg");
    this.gameBackground.setOrigin(0.5);

    // FULLSCREEN - cover entire visible canvas area (like CSS background-size: cover)
    // Scale to cover BOTH dimensions, cropping if necessary
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
    this.gameBackground.setDepth(-10000); // Render behind everything
    this.gameBackground.setAlpha(0.7);

    console.log(`✓ Fullscreen background: ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)} (screen: ${fullCanvasWidth.toFixed(0)}x${fullCanvasHeight.toFixed(0)})`);

    this.currentBackgroundKey = "game-bg";

    // Create separate UI camera that spans full canvas (for UI elements)
    this.uiCamera = this.cameras.add(0, 0, canvasWidth * dpr, canvasHeight * dpr);
    this.uiCamera.setName("uiCamera");

    // CRITICAL FIX: Set camera bounds to match GAME WORLD size
    // This ensures the camera knows the full extent of the game world
    this.cameras.main.setBounds(0, 0, gameWidth, gameHeight);
    this.cameras.main.setViewport(0, 0, canvasWidth * dpr, canvasHeight * dpr);
    this.cameras.main.setBackgroundColor("#000000");

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
      console.log("✓ Background ignored by UI camera");
    }

    // Initialize audio manager sounds
    this.audioManager?.addSound("knife-slash");
    this.audioManager?.addSound("knife-clank");
    this.audioManager?.addSound("punch-hit");
    this.audioManager?.addSound("electric-spark");
    this.audioManager?.addSound("explode");
    this.audioManager?.addSound("coin-received");

    // Create animations BEFORE UI
    // Create electric-leftover animation
    const electricFrames = [];
    for (let i = 6; i <= 10; i++) {
      electricFrames.push({ key: `electric-leftover-${i}` });
    }
    this.anims.create({
      key: "electric-leftover-anim",
      frames: electricFrames,
      frameRate: 20,
      repeat: 0,
    });

    // Create coin spin animation
    const coinFrames = [];
    for (let i = 1; i <= 6; i++) {
      coinFrames.push({ key: `coin-${i}` });
    }
    this.anims.create({
      key: "coin-spin",
      frames: coinFrames,
      frameRate: 12,
      repeat: -1, // Loop forever
    });

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
    this.progressionManager = new ProgressionManager(
      this,
      TEST_CONTINUOUS_CONFIG,
      {
        onSpawnEnemy: (characterClass, position) => {
          this.changeBackground(characterClass);
          this.spawnEnemy(characterClass, position);
        },
        gridToGame: (col, row, w, h) => this.gridToGame(col, row, w, h),
        onDifficultyChange: (tierIndex) => {
          console.log(`⚠️ DIFFICULTY INCREASED! Tier ${tierIndex + 1}/12`);
        },
      },
      this.gameConfig
    );

    // Start the progression system
    this.progressionManager.start();

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
    window.addEventListener("orientationchange", () => this.checkOrientation());
    window.addEventListener("resize", () => this.checkOrientation());
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

    // Only allow starting new slash if previous one is complete
    if (!this.canStartNewSlash || !this.slashTrail) return;

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

      // Check points along the line (every 2 pixels for MORE SENSITIVE collision)
      const stepSize = 2;
      const steps = Math.ceil(distance / stepSize);

      for (let i = 0; i <= steps; i++) {
        const t = steps > 0 ? i / steps : 1;
        const checkX = prevPoint.x + dx * t;
        const checkY = prevPoint.y + dy * t;

        // Check each target for collision
        for (const target of visibleTargets) {
          const containerBounds = target.getContainer().getBounds();

          if (containerBounds.contains(checkX, checkY)) {
            // Convert to container-relative coordinates
            const relativeX = checkX - containerBounds.centerX;
            const relativeY = checkY - containerBounds.centerY;

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
              const relativeStartX = checkX - containerBounds.centerX;
              const relativeStartY = checkY - containerBounds.centerY;

              const dpr = this.gameConfig.dpr;
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
                  worldStartX = testX + containerBounds.centerX;
                  worldStartY = testY + containerBounds.centerY;
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
                  worldEndX = testX + containerBounds.centerX;
                  worldEndY = testY + containerBounds.centerY;
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
    }

    // Show damage numbers for all targets hit during this slash
    if (this.hitTargetsThisSlash.size > 0) {
      // Calculate damage based on slash length (50-100)
      const maxSlashLength = 300 * this.gameConfig.dpr;
      const damage = Math.min(
        50 + (this.currentSlashLength / maxSlashLength) * 50,
        100
      );

      // Process each hit target
      for (const target of this.hitTargetsThisSlash) {
        // Use target's center position for damage text (not last hit position)
        const targetBounds = target.getContainer().getBounds();
        const damageText = target.showDamage(
          damage,
          targetBounds.centerX,
          targetBounds.centerY
        );
        this.ignoreFromUICamera(damageText);

        // Apply damage to target
        target.takeDamage(damage);

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

          // Trigger explosion animation and fade out
          const explosionObjects = target.explode(() => {
            // Destroy target after explosion
            target.destroy();
            // Remove from targets array
            const index = this.targets.indexOf(target);
            if (index > -1) {
              this.targets.splice(index, 1);
            }

            // Notify progression manager that enemy was killed
            this.progressionManager?.onEnemyKilled();
          });

          // Make UI camera ignore all explosion objects
          explosionObjects.forEach((obj) => this.ignoreFromUICamera(obj));

          // Fade out the dying target (slower to see the explosion)
          this.tweens.add({
            targets: target.getContainer(),
            alpha: 0,
            duration: 800,
            ease: "Cubic.easeOut",
          });
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
    const y = safeAreaOffsetY + gridMarginTop + ((centerRow - 0.5) / 3) * gridHeight;

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

    console.log(`Player ${isActive ? "ACTIVE" : "IDLE"}`);
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

    console.log(`🎨 Background: ${finalBgKey} → ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)} (COVER MODE)`);
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
    console.log(`🎯 Spawning enemy at position: x=${position.x.toFixed(0)}, y=${position.y.toFixed(0)}`);

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
    // Update slash trail
    this.slashTrail?.update();
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
    this.uiLayer!.add(this.coinSprite);
    this.coinSprite.play("coin-spin");
  }

  updateHPBar(): void {
    if (!this.hpBarFill) return;

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
    if (this.hpText) {
      this.hpText.setText(`${Math.ceil(this.currentHP)}/${this.maxHP}`);
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
  }

  takeDamage(damage: number, enemyX?: number, enemyY?: number): void {
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
    // Since Phaser doesn't support gradient fills directly, we'll use multiple horizontal strips
    const stripCount = 20;
    const stripHeight = flashHeight / stripCount;

    for (let i = 0; i < stripCount; i++) {
      const alpha = 0.6 * (i / stripCount); // 0 to 0.6 (transparent to opaque)
      const y = gameHeight * dpr - flashHeight + i * stripHeight;

      flashGraphics.fillStyle(0xff0000, alpha);
      flashGraphics.fillRect(0, y, canvasWidth * dpr, stripHeight + 1); // +1 to avoid gaps
    }

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
