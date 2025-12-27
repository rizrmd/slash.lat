import { Scene } from "phaser";
import { FlyBot } from "../characters/FlyBot";
import { LeafBot } from "../characters/LeafBot";
import { OrangeBot } from "../characters/OrangeBot";
import { Target } from "../characters/Target";
import { SlashTrail } from "../effects/SlashTrail";
import { Sparks } from "../effects/Sparks";
import { AudioManager } from "../managers/AudioManager";
import { GameConfig } from "../types";

export class GameScene extends Scene {
  private orientationWarning?: Phaser.GameObjects.Text;
  private gameConfig: GameConfig;
  private currentTarget?: Target;
  private slashTrail?: SlashTrail;
  private sparks?: Sparks;
  private audioManager?: AudioManager;
  private canStartNewSlash: boolean = true;
  private hasHitTarget: boolean = false;
  private currentSlashLength: number = 0;
  private lastHitX: number = 0;
  private lastHitY: number = 0;

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
  private weaponIndicator?: Phaser.GameObjects.Graphics;
  private weaponText?: Phaser.GameObjects.Text;

  constructor(gameConfig: GameConfig) {
    super({ key: "GameScene" });
    this.gameConfig = gameConfig;
  }

  init(): void {
    // Get audio manager from registry (loaded in LoadingScene)
    this.audioManager = this.registry.get("managers").audioManager;
  }

  preload(): void {
    const dpr = this.gameConfig.dpr;

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
  }

  create(): void {
    const { canvasWidth, gameHeight, gameWidth, dpr } = this.gameConfig;

    // Check orientation on mobile
    this.checkOrientation();

    // Set background color
    this.cameras.main.setBackgroundColor("#000");

    // Initialize audio manager sounds
    this.audioManager?.addSound("slash");
    this.audioManager?.addSound("hit");
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

    // Spawn initial random target
    this.spawnRandomTarget();

    // Initialize slash trail effect
    this.slashTrail = new SlashTrail(this, this.gameConfig);

    // Initialize sparks effect
    this.sparks = new Sparks(this, this.gameConfig, "electric-spark");

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
    const { canvasWidth, gameHeight, dpr } = this.gameConfig;
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile) {
      const isPortrait = window.innerHeight > window.innerWidth;

      if (!isPortrait) {
        // Show warning overlay
        if (!this.orientationWarning) {
          this.orientationWarning = this.add
            .text(
              (canvasWidth * dpr) / 2,
              (gameHeight * dpr) / 2,
              "Please rotate your device\\nto portrait mode",
              {
                fontFamily: "Jura, sans-serif",
                fontSize: `${32 * dpr}px`,
                color: "#ffffff",
                align: "center",
                backgroundColor: "#000000",
                padding: { x: 20 * dpr, y: 20 * dpr },
              }
            )
            .setOrigin(0.5)
            .setDepth(1000);
        }
        this.orientationWarning.setVisible(true);
        this.scene.pause();
      } else {
        if (this.orientationWarning) {
          this.orientationWarning.setVisible(false);
        }
        this.scene.resume();
      }
    }
  }

  onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Only allow starting new slash if previous one is complete
    if (!this.canStartNewSlash || !this.slashTrail) return;

    this.canStartNewSlash = false;
    this.hasHitTarget = false;
    this.currentSlashLength = 0; // Reset slash length for new slash
    this.slashTrail.startDrawing(pointer.x, pointer.y);

    // Play slash sound
    this.audioManager?.play("slash");
  }

  onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.slashTrail?.isCurrentlyDrawing()) return;

    const prevPoint = this.slashTrail.getLastPoint();
    const canContinue = this.slashTrail.addTrailPoint(pointer.x, pointer.y);

    if (!canContinue) return;

    // Check for collision with target (pixel-perfect)
    // Only allow hits when target is at least 80% visible
    if (this.currentTarget && this.currentTarget.getContainer().alpha >= 0.8) {
      const containerBounds = this.currentTarget.getContainer().getBounds();
      let hitInThisSegment = false; // Track if we hit in this movement to avoid duplicate sounds/shakes

      // If we have a previous point, interpolate along the line to check all pixels
      if (prevPoint) {
        const dx = pointer.x - prevPoint.x;
        const dy = pointer.y - prevPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Accumulate slash length
        this.currentSlashLength += distance;

        // Check points along the line (every 4 pixels for performance)
        const stepSize = 4;
        const steps = Math.ceil(distance / stepSize);

        for (let i = 0; i <= steps; i++) {
          const t = steps > 0 ? i / steps : 1;
          const checkX = prevPoint.x + dx * t;
          const checkY = prevPoint.y + dy * t;

          if (containerBounds.contains(checkX, checkY)) {
            // Convert to container-relative coordinates
            const relativeX = checkX - containerBounds.centerX;
            const relativeY = checkY - containerBounds.centerY;

            // Check if pixel is opaque
            if (this.currentTarget.isPixelOpaque(relativeX, relativeY)) {
              // Only play sound and shake once per movement segment
              if (!hitInThisSegment) {
                this.hasHitTarget = true;
                this.audioManager?.play("hit");
                this.currentTarget.shake(dx, dy);
                hitInThisSegment = true;

                // Store last hit position for damage display
                this.lastHitX = checkX;
                this.lastHitY = checkY;
              }

              // Calculate entry/exit points once for both damage and sparks
              const containerBounds = this.currentTarget
                .getContainer()
                .getBounds();
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
                if (this.currentTarget.isPixelOpaque(testX, testY)) {
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
                if (this.currentTarget.isPixelOpaque(testX, testY)) {
                  worldEndX = testX + containerBounds.centerX;
                  worldEndY = testY + containerBounds.centerY;
                } else {
                  break;
                }
              }

              // Draw slash damage using pre-calculated points (no duplicate search)
              this.currentTarget.drawSlashDamage(
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
            }
          }
        }
      } else {
        // First point - just check this single point
        if (containerBounds.contains(pointer.x, pointer.y)) {
          const relativeX = pointer.x - containerBounds.centerX;
          const relativeY = pointer.y - containerBounds.centerY;

          if (this.currentTarget.isPixelOpaque(relativeX, relativeY)) {
            this.hasHitTarget = true;
            this.audioManager?.play("hit");
            this.currentTarget.drawSlashDamage(pointer.x, pointer.y, 0, 0);
            this.currentTarget.shake(0, 0);

            // Store hit position for damage display
            this.lastHitX = pointer.x;
            this.lastHitY = pointer.y;
          }
        }
      }
    }
  }

  onPointerUp(): void {
    if (this.slashTrail?.isCurrentlyDrawing()) {
      this.slashTrail.endDrawing();
    }

    // Show damage number if we hit the target during this slash
    if (this.hasHitTarget && this.currentTarget) {
      // Calculate damage based on slash length (50-100)
      const maxSlashLength = 300 * this.gameConfig.dpr;
      const damage = Math.min(
        50 + (this.currentSlashLength / maxSlashLength) * 50,
        100
      );
      this.currentTarget.showDamage(damage, this.lastHitX, this.lastHitY);

      // Apply damage to target
      this.currentTarget.takeDamage(damage);

      // Check if target is dead
      if (this.currentTarget.isDead()) {
        const dyingTarget = this.currentTarget;

        // Clear slash marks from sparks system
        this.sparks?.clearSlashMarks();

        // Kill entrance animation tweens before fade out
        this.tweens.killTweensOf(dyingTarget.getContainer());

        // Play explosion sound
        this.audioManager?.play("explode");

        // Spawn coin animation from enemy position
        const enemyPos = dyingTarget.getContainer().getBounds();
        this.spawnCoinAnimation(enemyPos.centerX, enemyPos.centerY, 10);

        // Trigger explosion animation and fade out
        dyingTarget.explode(() => {
          // Destroy target after explosion
          dyingTarget.destroy();
        });

        // Fade out the dying target (slower to see the explosion)
        this.tweens.add({
          targets: dyingTarget.getContainer(),
          alpha: 0,
          duration: 800,
          ease: "Cubic.easeOut",
        });

        // Spawn new target after explosion is visible
        this.time.delayedCall(600, () => {
          this.spawnRandomTarget();
        });
      }
    }

    // Allow starting new slash after release
    this.canStartNewSlash = true;
  }

  spawnRandomTarget(): void {
    const { canvasWidth, gameHeight, dpr } = this.gameConfig;

    // Array of available character classes
    const characterClasses = [OrangeBot, LeafBot, FlyBot];

    // Select random character
    const RandomCharacter =
      characterClasses[Math.floor(Math.random() * characterClasses.length)];

    // Create new target
    this.currentTarget = new RandomCharacter({
      scene: this,
      x: (canvasWidth * dpr) / 2,
      y: (gameHeight * dpr) / 2,
      gameConfig: this.gameConfig,
    });
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

    // Animated coin sprite (positioned to the left of the number)
    const coinSpriteSize = 24 * dpr;
    const coinSpriteX = this.coinCounterX - this.coinText.width - 15 * dpr; // 8px gap + 7px extra left
    const coinSpriteY = this.coinCounterY - this.coinText.height / 2;

    this.coinSprite = this.add.sprite(coinSpriteX, coinSpriteY, "coin-1");
    this.coinSprite.setScale(0.0425 * dpr); // 15% smaller
    this.coinSprite.setDepth(100);
    this.coinSprite.play("coin-spin");

    // Weapon Indicator (position and shape depends on screen width)
    const isDesktop = window.innerWidth > 700;

    const weaponWidth = 100 * dpr;
    const weaponHeight = 25 * dpr;
    const weaponSkew = 8 * dpr;

    let weaponX: number;
    let weaponY: number;

    if (isDesktop) {
      // Desktop: bottom center
      weaponX = (canvasWidth * dpr) / 2 - weaponWidth / 2;
      weaponY = bottomY - weaponHeight;
    } else {
      // Mobile: on top of HP bar
      weaponX = hpBarX;
      weaponY = hpBarY - weaponHeight - 15 * dpr; // 15px gap above HP bar
    }

    // Create weapon indicator
    this.weaponIndicator = this.add.graphics();
    this.weaponIndicator.setDepth(100);

    // Single border (white)
    this.weaponIndicator.lineStyle(2 * dpr, 0xffffff, 1);
    this.weaponIndicator.beginPath();

    if (isDesktop) {
      // Desktop: parallelogram
      this.weaponIndicator.moveTo(weaponX, weaponY + weaponHeight);
      this.weaponIndicator.lineTo(
        weaponX + weaponWidth,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponWidth + weaponSkew, weaponY);
      this.weaponIndicator.lineTo(weaponX + weaponSkew, weaponY);
    } else {
      // Mobile: regular box
      this.weaponIndicator.moveTo(weaponX, weaponY + weaponHeight);
      this.weaponIndicator.lineTo(
        weaponX + weaponWidth,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponWidth, weaponY);
      this.weaponIndicator.lineTo(weaponX, weaponY);
    }

    this.weaponIndicator.closePath();
    this.weaponIndicator.strokePath();

    // Add double border on left side only (thicker, touching the first border)
    const leftBorderWidth = 5 * dpr;
    const doubleInset = leftBorderWidth - 2 * dpr; // Position to make borders touch
    this.weaponIndicator.lineStyle(leftBorderWidth, 0xffffff, 1);
    this.weaponIndicator.beginPath();

    if (isDesktop) {
      // Desktop: parallelogram left border
      this.weaponIndicator.moveTo(
        weaponX + doubleInset,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + weaponSkew + doubleInset, weaponY);
    } else {
      // Mobile: regular box left border
      this.weaponIndicator.moveTo(
        weaponX + doubleInset,
        weaponY + weaponHeight
      );
      this.weaponIndicator.lineTo(weaponX + doubleInset, weaponY);
    }

    this.weaponIndicator.strokePath();

    // Weapon text (centered differently for box vs parallelogram)
    const textX = isDesktop
      ? weaponX + weaponWidth / 2 + weaponSkew / 2
      : weaponX + weaponWidth / 2;
    this.weaponText = this.add
      .text(textX, weaponY + weaponHeight / 2, "Knife", {
        fontFamily: "Jura, sans-serif",
        fontSize: `${14 * dpr}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2 * dpr,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(101);
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

  takeDamage(damage: number): void {
    this.currentHP = Math.max(0, this.currentHP - damage);
    this.updateHPBar();
  }

  spawnCoinAnimation(startX: number, startY: number, coinValue: number): void {
    const { dpr } = this.gameConfig;

    // Create coin sprite
    const coin = this.add.sprite(startX, startY, "coin-1");
    coin.setScale(0.08 * dpr);
    coin.setDepth(200);
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
