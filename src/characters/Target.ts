import Phaser from "phaser";
import { GameConfig } from "../types";
import { AudioManager } from "../managers/AudioManager";

export interface TargetConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  size?: number;
  gameConfig: GameConfig;
  audioManager: AudioManager;
}

export abstract class Target {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected image: Phaser.GameObjects.Sprite;
  public slashDamage: Phaser.GameObjects.Graphics; // Public for camera ignore
  protected imageData?: ImageData;
  protected gameConfig: GameConfig;
  protected audioManager: AudioManager;
  protected hp: number;
  protected maxHp: number;
  public hpBarBackground?: Phaser.GameObjects.Graphics; // Public for camera ignore
  public hpBarFill?: Phaser.GameObjects.Graphics; // Public for camera ignore
  protected hpBarVisible: boolean = false;
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []; // Track for cleanup

  constructor(config: TargetConfig) {
    this.scene = config.scene;
    this.gameConfig = config.gameConfig;
    this.audioManager = config.audioManager;

    // Initialize HP
    this.maxHp = this.getMaxHP();
    this.hp = this.maxHp;

    // Create container
    this.container = this.scene.add.container(config.x, config.y);

    // Add target image (as sprite to support animations)
    this.image = this.scene.add.sprite(0, 0, this.getAssetKey());

    // Scale to desired size while maintaining aspect ratio
    // Use frame.height for consistent sizing across different aspect ratios
    // Both orange-bot (513x720) and leaf-bot (754x720) have same height, so this makes them visually consistent
    const imageHeight = this.image.frame.height;

    // Calculate default size based on grid width (5 columns) to prevent overlap
    // Each character gets roughly 1/5 of grid width, scaled by the character's size multiplier
    const gridWidth = this.gameConfig.gridWidth ?? (this.gameConfig.gameWidth * this.gameConfig.dpr);
    const columnWidth = gridWidth / 5;
    const defaultSize = columnWidth * (this.getSize() || 1);

    const finalScale = (config.size || defaultSize) / imageHeight;
    this.image.setScale(finalScale);

    // Create slash damage overlay (initially hidden)
    this.slashDamage = this.scene.add.graphics();
    this.slashDamage.setVisible(false);

    // Create HP bar (initially hidden)
    const dpr = this.gameConfig.dpr;
    const barWidth = this.image.width * finalScale;
    const barHeight = 6 * dpr;
    const barY = (this.image.height * finalScale) / 2 + 15 * dpr;

    this.hpBarBackground = this.scene.add.graphics();
    this.hpBarBackground.setVisible(false);

    this.hpBarFill = this.scene.add.graphics();
    this.hpBarFill.setVisible(false);

    // Draw initial HP bar
    this.updateHpBar();

    // Add all to container
    this.container.add([this.image, this.slashDamage, this.hpBarBackground, this.hpBarFill]);

    // Extract image data for pixel-perfect collision
    this.extractImageData();

    // Store final position
    const finalY = config.y;

    // Start container small, transparent, and lower (simulating distance in perspective)
    this.container.setScale(0.3);
    this.container.setAlpha(0);
    this.container.setY(config.y + 50); // Start lower to simulate depth

    // Animate to create perspective effect (coming from far to near)
    this.scene.tweens.add({
      targets: this.container,
      y: finalY, // Move down to final position
      scale: 1, // Grow to full size
      alpha: 1, // Fade in to full opacity
      duration: 10000,
      ease: "Cubic.easeInOut", // Accelerates as it approaches (more realistic)
      onUpdate: (tween) => {
        // Show HP bar when alpha reaches 0.8 (hittable state)
        if (this.container.alpha >= 0.8 && !this.hpBarVisible) {
          this.showHpBar();
        }
      },
      onComplete: () => {
        // Notify subclasses when fully visible
        this.onFullyVisible();
      },
    });
  }

  protected onFullyVisible(): void {
    // Override in subclasses to handle when character reaches 100% opacity
  }

  extractImageData(): void {
    const texture = this.image.texture;
    const frame = this.image.frame;
    const source = texture.getSourceImage() as HTMLImageElement;

    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(
        source,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height
      );
      this.imageData = ctx.getImageData(0, 0, frame.width, frame.height);
    }
  }

  isPixelOpaque(relativeX: number, relativeY: number): boolean {
    if (!this.imageData) return false;

    // Convert container-relative position to image-local position
    const targetWidth = this.image.displayWidth;
    const targetHeight = this.image.displayHeight;

    // Convert from container coordinates (centered at 0,0) to image coordinates
    const imageX = relativeX + targetWidth / 2;
    const imageY = relativeY + targetHeight / 2;

    // Check if within image bounds
    if (
      imageX < 0 ||
      imageY < 0 ||
      imageX >= targetWidth ||
      imageY >= targetHeight
    ) {
      return false;
    }

    // Convert to texture coordinates (accounting for scale)
    const scale = this.image.scaleX;
    const textureX = Math.floor(imageX / scale);
    const textureY = Math.floor(imageY / scale);

    // Check if within texture bounds
    if (
      textureX < 0 ||
      textureY < 0 ||
      textureX >= this.imageData.width ||
      textureY >= this.imageData.height
    ) {
      return false;
    }

    // Get alpha value from image data
    const index = (textureY * this.imageData.width + textureX) * 4 + 3; // Alpha channel
    const alpha = this.imageData.data[index];

    // Consider opaque if alpha > 50 (threshold)
    return alpha > 50;
  }

  drawSlashDamage(
    slashX: number,
    slashY: number,
    directionX: number,
    directionY: number,
    worldStartX?: number,
    worldStartY?: number,
    worldEndX?: number,
    worldEndY?: number
  ): void {
    const dpr = this.gameConfig.dpr;

    // Normalize direction
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length === 0) return;

    const normalizedX = directionX / length;
    const normalizedY = directionY / length;

    // Perpendicular direction for thorns
    const perpX = -normalizedY;
    const perpY = normalizedX;

    // Convert world position to container-relative position
    const containerBounds = this.container.getBounds();
    const relativeX = slashX - containerBounds.centerX;
    const relativeY = slashY - containerBounds.centerY;

    let startX = relativeX;
    let startY = relativeY;
    let endX = relativeX;
    let endY = relativeY;

    // Use pre-calculated points if provided, otherwise search
    if (
      worldStartX !== undefined &&
      worldStartY !== undefined &&
      worldEndX !== undefined &&
      worldEndY !== undefined
    ) {
      startX = worldStartX - containerBounds.centerX;
      startY = worldStartY - containerBounds.centerY;
      endX = worldEndX - containerBounds.centerX;
      endY = worldEndY - containerBounds.centerY;
    } else {
      // Sample along the slash direction to find opaque entry/exit points
      const maxSearchLength = 100 * dpr;
      const sampleStep = 2 * dpr;
      let foundStart = false;
      let foundEnd = false;

      // Search backward to find entry point
      for (let dist = sampleStep; dist < maxSearchLength; dist += sampleStep) {
        const testX = relativeX - normalizedX * dist;
        const testY = relativeY - normalizedY * dist;

        if (this.isPixelOpaque(testX, testY)) {
          startX = testX;
          startY = testY;
          foundStart = true;
        } else if (foundStart) {
          break;
        }
      }

      // Search forward to find exit point
      for (let dist = sampleStep; dist < maxSearchLength; dist += sampleStep) {
        const testX = relativeX + normalizedX * dist;
        const testY = relativeY + normalizedY * dist;

        if (this.isPixelOpaque(testX, testY)) {
          endX = testX;
          endY = testY;
          foundEnd = true;
        } else if (foundEnd) {
          break;
        }
      }

      // Only draw if we found opaque pixels
      if (!foundStart && !foundEnd) {
        return;
      }
    }

    const thornCount = Math.floor(Math.random() * 4) + 1; // Random 1-4 thorns
    const thornLength = 1.5 * dpr; // Very small thorns

    // Set blend mode for realistic integration with target texture
    this.slashDamage.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Draw main slash line with semi-transparency
    this.slashDamage.lineStyle(1.5 * dpr, 0x000000, 0.6);

    this.slashDamage.beginPath();
    this.slashDamage.moveTo(startX, startY);
    this.slashDamage.lineTo(endX, endY);
    this.slashDamage.strokePath();

    // Draw thorns on both sides (angled like fishbone) with random gaps
    const thornAngle = Math.PI / 4; // 45 degrees
    for (let i = 0; i < thornCount; i++) {
      // Random position along the slash (between 0.2 and 0.8 to avoid edges)
      const t = 0.2 + Math.random() * 0.6;
      const centerX = startX + (endX - startX) * t;
      const centerY = startY + (endY - startY) * t;

      // Only draw thorn if center is on opaque pixel
      if (!this.isPixelOpaque(centerX, centerY)) continue;

      // Calculate angled thorn direction (pointing backward along the slash)
      const thornDirX =
        -normalizedX * Math.cos(thornAngle) + perpX * Math.sin(thornAngle);
      const thornDirY =
        -normalizedY * Math.cos(thornAngle) + perpY * Math.sin(thornAngle);

      // Left thorn (angled backward)
      this.slashDamage.beginPath();
      this.slashDamage.moveTo(centerX, centerY);
      this.slashDamage.lineTo(
        centerX + thornDirX * thornLength,
        centerY + thornDirY * thornLength
      );
      this.slashDamage.strokePath();

      // Right thorn (angled backward on opposite side)
      const thornDirX2 =
        -normalizedX * Math.cos(thornAngle) - perpX * Math.sin(thornAngle);
      const thornDirY2 =
        -normalizedY * Math.cos(thornAngle) - perpY * Math.sin(thornAngle);
      this.slashDamage.beginPath();
      this.slashDamage.moveTo(centerX, centerY);
      this.slashDamage.lineTo(
        centerX + thornDirX2 * thornLength,
        centerY + thornDirY2 * thornLength
      );
      this.slashDamage.strokePath();
    }

    this.slashDamage.setVisible(true);
  }

  shake(directionX: number, directionY: number): void {
    const dpr = this.gameConfig.dpr;

    // Store original position
    const originalX = this.container.x;
    const originalY = this.container.y;

    // Normalize direction and apply shake distance
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    const normalizedX = length > 0 ? directionX / length : 0;
    const normalizedY = length > 0 ? directionY / length : 0;
    const shakeDistance = 4 * dpr;

    // Create shake effect along the slash direction
    this.scene.tweens.add({
      targets: this.container,
      x: originalX + normalizedX * shakeDistance,
      y: originalY + normalizedY * shakeDistance,
      duration: 20,
      ease: "Quad.easeOut",
      onComplete: () => {
        // Return to original position
        this.scene.tweens.add({
          targets: this.container,
          x: originalX,
          y: originalY,
          duration: 40,
          ease: "Quad.easeOut",
        });
      },
    });
  }

  showDamage(damage: number, hitX: number, hitY: number): Phaser.GameObjects.Text {
    const dpr = this.gameConfig.dpr;

    // Create damage text at hit position
    const damageText = this.scene.add.text(
      hitX,
      hitY,
      Math.round(damage).toString(),
      {
        fontFamily: "Jura, sans-serif",
        fontSize: `${20 * dpr}px`,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3 * dpr,
      }
    );
    damageText.setOrigin(0.5);

    // Animate upward and fade out
    this.scene.tweens.add({
      targets: damageText,
      y: hitY - 80 * dpr,
      alpha: 0,
      duration: 1500,
      ease: "Cubic.easeOut",
      onComplete: () => {
        damageText.destroy();
      },
    });

    return damageText;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getImage(): Phaser.GameObjects.Sprite {
    return this.image;
  }

  getSlashDamageGraphics(): Phaser.GameObjects.Graphics {
    return this.slashDamage;
  }

  takeDamage(damage: number): void {
    this.hp = Math.max(0, this.hp - damage);
    this.updateHpBar();
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  showHpBar(): void {
    if (!this.hpBarVisible) {
      this.hpBarVisible = true;
      this.hpBarBackground?.setVisible(true);
      this.hpBarFill?.setVisible(true);
    }
  }

  updateHpBar(): void {
    if (!this.hpBarFill || !this.hpBarBackground) return;

    const dpr = this.gameConfig.dpr;

    // HP bar width should be proportional to character width (80% of character width)
    const characterWidth = this.image.displayWidth;
    const barWidth = characterWidth * 0.8;

    const barHeight = 6 * dpr;
    const barY = -this.image.displayHeight / 2 - 30 * dpr;

    // Clear and redraw background
    this.hpBarBackground.clear();

    // Draw white border
    this.hpBarBackground.lineStyle(2 * dpr, 0xffffff, 1);
    this.hpBarBackground.strokeRect(-barWidth / 2 - 1 * dpr, barY - 1 * dpr, barWidth + 2 * dpr, barHeight + 2 * dpr);

    // Draw black background
    this.hpBarBackground.fillStyle(0x000000, 0.7);
    this.hpBarBackground.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // Clear and redraw fill
    this.hpBarFill.clear();

    // Calculate HP percentage
    const hpPercent = this.hp / this.maxHp;

    // Color based on HP percentage
    let color = 0x00ff00; // Green
    if (hpPercent < 0.3) {
      color = 0xff0000; // Red
    } else if (hpPercent < 0.6) {
      color = 0xffaa00; // Orange
    }

    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRect(-barWidth / 2, barY, barWidth * hpPercent, barHeight);
  }

  explode(onComplete?: () => void): Phaser.GameObjects.GameObject[] {
    const dpr = this.gameConfig.dpr;
    const containerBounds = this.container.getBounds();

    // Get the center position in screen coordinates
    // The container's position is in game area coordinates, but for display
    // we need to account for the camera offset on desktop
    // Since getBounds() returns world coordinates, we can use them directly
    const centerX = containerBounds.centerX;
    const centerY = containerBounds.centerY;

    const characterSize = Math.max(containerBounds.width, containerBounds.height);

    // Track all explosion objects for camera ignore
    const explosionObjects: Phaser.GameObjects.GameObject[] = [];

    // Bright flash circle - intense light burst
    const flashCircle = this.scene.add.circle(centerX, centerY, characterSize * 0.3, 0xffffff, 1);
    flashCircle.setDepth(102);
    flashCircle.setBlendMode(Phaser.BlendModes.ADD);
    explosionObjects.push(flashCircle);
    this.scene.tweens.add({
      targets: flashCircle,
      scale: 4,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => flashCircle.destroy(),
    });

    // Secondary glow ring
    const glowRing = this.scene.add.circle(centerX, centerY, characterSize * 0.4, 0xffff00, 0.8);
    glowRing.setDepth(102);
    glowRing.setBlendMode(Phaser.BlendModes.ADD);
    explosionObjects.push(glowRing);
    this.scene.tweens.add({
      targets: glowRing,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: "Cubic.easeOut",
      onComplete: () => glowRing.destroy(),
    });

    // Outer transparent ring - final light wave
    const outerRing = this.scene.add.circle(centerX, centerY, characterSize * 0.5, 0xffaa00, 0.5);
    outerRing.setDepth(102);
    outerRing.setBlendMode(Phaser.BlendModes.ADD);
    explosionObjects.push(outerRing);
    this.scene.tweens.add({
      targets: outerRing,
      scale: 5,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => outerRing.destroy(),
    });

    // Core explosion flash - bright white burst
    const flashEmitter = this.scene.add.particles(centerX, centerY, "fire-particle", {
      speed: { min: 80 * dpr, max: 150 * dpr },
      angle: { min: -110, max: -70 }, // Focused upward
      scale: { start: 3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: 60,
      tint: [0xffffff, 0xffffff, 0xffff00],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 100 * dpr,
    });
    flashEmitter.setDepth(101);
    this.particleEmitters.push(flashEmitter);
    explosionObjects.push(flashEmitter);

    // Main fire burst - bright explosive upward movement
    const fireEmitter = this.scene.add.particles(centerX, centerY, "fire-particle", {
      speed: { min: 120 * dpr, max: 220 * dpr },
      angle: { min: -120, max: -60 }, // More upward focused (not full 360)
      scale: { start: 2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 100,
      tint: [0xffff00, 0xffdd00, 0xffaa00],
      blendMode: Phaser.BlendModes.ADD,
      gravityY: 150 * dpr,
      frequency: -1,
    });
    fireEmitter.setDepth(100);
    this.particleEmitters.push(fireEmitter);
    explosionObjects.push(fireEmitter);

    // Smoke - rising from explosion center
    const smokeEmitter = this.scene.add.particles(centerX, centerY, "smoke-particle", {
      speed: { min: 40 * dpr, max: 90 * dpr },
      angle: { min: -110, max: -70 }, // Mostly upward
      scale: { start: 1.2, end: 3 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 1800,
      quantity: 35,
      tint: [0x333333, 0x444444, 0x555555],
      gravityY: -60 * dpr,
      frequency: -1,
    });
    smokeEmitter.setDepth(98);
    this.particleEmitters.push(smokeEmitter);
    explosionObjects.push(smokeEmitter);

    // Emit all particles
    flashEmitter.explode();
    fireEmitter.explode();

    // Delayed smoke for realism
    this.scene.time.delayedCall(100, () => {
      smokeEmitter.explode();
    });

    // Trigger electric-leftover sprite after a short delay
    const randomDelay = 50 + Math.floor(Math.random() * 200); // Random 50-250ms delay
    this.scene.time.delayedCall(randomDelay, () => {
      const electricSprite = this.scene.add.sprite(centerX, centerY, "electric-leftover-6");
      const electricScale = (characterSize / electricSprite.width) * 0.8;
      electricSprite.setScale(electricScale);
      electricSprite.setDepth(101);
      electricSprite.setBlendMode(Phaser.BlendModes.ADD);
      explosionObjects.push(electricSprite);
      electricSprite.play("electric-leftover-anim");

      // Ignore from UI camera
      const gameScene = this.scene as any;
      if (gameScene.ignoreFromUICamera) {
        gameScene.ignoreFromUICamera(electricSprite);
      }

      electricSprite.on("animationcomplete", () => {
        electricSprite.destroy();
      });
    });

    // Clean up particle emitters
    this.scene.time.delayedCall(2000, () => {
      flashEmitter.destroy();
      fireEmitter.destroy();
      smokeEmitter.destroy();
      if (onComplete) onComplete();
    });

    // Return all explosion objects so they can be ignored by UI camera
    return explosionObjects;
  }

  /**
   * Get all game objects created by this target that should be ignored by UI camera
   */
  getAllGameObjects(): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [
      this.container,
      this.slashDamage,
    ];

    if (this.hpBarBackground) objects.push(this.hpBarBackground);
    if (this.hpBarFill) objects.push(this.hpBarFill);

    // Add all tracked particle emitters
    objects.push(...this.particleEmitters);

    return objects;
  }

  destroy(): void {
    // Stop all tweens targeting this container
    this.scene.tweens.killTweensOf(this.container);

    // Clear and destroy graphics
    this.slashDamage.clear();
    this.slashDamage.destroy();

    // Clear and destroy HP bar
    this.hpBarBackground?.clear();
    this.hpBarBackground?.destroy();
    this.hpBarFill?.clear();
    this.hpBarFill?.destroy();

    // Destroy container and all children
    this.container.destroy();
  }

  // Abstract methods to be implemented by specific targets
  abstract getAssetKey(): string;
  abstract getSize(): number;
  abstract getAudioKeys(): { slash?: string; hit?: string; spark?: string };
  abstract getMaxHP(): number;
}
