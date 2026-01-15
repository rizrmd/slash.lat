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
  public hpBarFill?: Phaser.GameObjects.Graphics;
  protected hpBarVisible: boolean = false;
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private breathingTween?: Phaser.Tweens.Tween;

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
    // Grid dimensions are already in game coordinates (no DPR multiplication needed)
    const imageHeight = this.image.frame.height;
    const imageWidth = this.image.frame.width;

    // Get grid dimensions from config (already properly scaled)
    const gridWidth = this.gameConfig.gridWidth;
    const gridHeight = this.gameConfig.gridHeight;

    const size = this.getSize();
    const targetWidth = (gridWidth / 5) * size.w;
    const targetHeight = (gridHeight / 3) * size.h;

    // Calculate scale to fit within the designated grid cells while maintaining aspect ratio
    const scaleX = targetWidth / imageWidth;
    const scaleY = targetHeight / imageHeight;
    const finalScale = Math.min(scaleX, scaleY);

    this.image.setScale(finalScale);

    // Create slash damage overlay (initially hidden)
    this.slashDamage = this.scene.add.graphics();
    this.slashDamage.setVisible(false);

    // Create HP bar
    this.hpBarFill = this.scene.add.graphics();
    this.hpBarFill.setVisible(false);
    this.updateHpBar();

    // Add all to container
    this.container.add([this.image, this.slashDamage, this.hpBarFill]);

    // Extract image data for pixel-perfect collision
    this.extractImageData();

    // Listen to enemy damage events - react when other characters are slashed
    this.scene.events.on('enemy-damaged', this.onEnemyDamaged.bind(this));
    this.scene.events.on('enemy-killed', this.onEnemyKilled.bind(this));

    // Store final position
    const finalX = config.x;
    const finalY = config.y;

    // ========================================================================
    // DYNAMIC ENTRANCE ANIMATION - Randomized movement from multiple directions
    // ========================================================================

    // Random entrance direction: 0=top, 1=right, 2=bottom, 3=left, 4-7=diagonals
    const entranceDirection = Math.floor(Math.random() * 8);

    // Random speed: faster (600ms) to slower (1200ms)
    const entranceDuration = 600 + Math.random() * 600;

    // Random easing for smooth SOLID entrance (no bouncy effects)
    const easingOptions = [
      "Cubic.easeOut",
      "Quad.easeOut",
      "Sine.easeOut"
    ];
    const randomEasing = easingOptions[Math.floor(Math.random() * easingOptions.length)];

    // Calculate start position based on direction (off-screen)
    const { canvasWidth, canvasHeight } = this.gameConfig;
    const offsetAmount = Math.min(canvasWidth, canvasHeight) * 0.5; // 50% of screen size

    let startX = finalX;
    let startY = finalY;

    // NO ROTATION - character stays upright throughout entrance
    switch (entranceDirection) {
      case 0: // From top
        startY = finalY - offsetAmount;
        break;
      case 1: // From right
        startX = finalX + offsetAmount;
        break;
      case 2: // From bottom
        startY = finalY + offsetAmount;
        break;
      case 3: // From left
        startX = finalX - offsetAmount;
        break;
      case 4: // From top-left diagonal
        startX = finalX - offsetAmount * 0.7;
        startY = finalY - offsetAmount * 0.7;
        break;
      case 5: // From top-right diagonal
        startX = finalX + offsetAmount * 0.7;
        startY = finalY - offsetAmount * 0.7;
        break;
      case 6: // From bottom-left diagonal
        startX = finalX - offsetAmount * 0.7;
        startY = finalY + offsetAmount * 0.7;
        break;
      case 7: // From bottom-right diagonal
        startX = finalX + offsetAmount * 0.7;
        startY = finalY + offsetAmount * 0.7;
        break;
    }

    // Set initial state - NO ROTATION, character is upright
    this.container.setPosition(startX, startY);
    this.container.setScale(0.1); // Start very small
    this.container.setAlpha(0);
    this.container.setRotation(0); // Always start upright

    // Calculate target scale based on final Y position (depth effect)
    const normalizedY = finalY / canvasHeight;
    const minScale = 0.7;
    const maxScale = 1.3;
    const targetScale = minScale + (normalizedY * (maxScale - minScale));

    // Animate entrance with dynamic movement - NO ROTATION
    this.scene.tweens.add({
      targets: this.container,
      x: finalX,
      y: finalY,
      scale: targetScale,
      alpha: 1,
      duration: entranceDuration,
      ease: randomEasing,
      onUpdate: (tween) => {
        // Update scale based on current Y position during entrance
        this.updateScaleForDepth();

        // Show HP bar ONLY when entrance is COMPLETE (alpha reaches 1.0)
        // Changed from 0.8 to 1.0 to prevent early appearance
        if (this.container.alpha >= 1.0 && !this.hpBarVisible) {
          this.showHpBar();
        }
      },
      onComplete: () => {
        // Start breathing effect AND circular wandering movement
        this.startBreathingEffect();
        this.startCircularWandering();

        // Notify subclasses when fully visible
        this.onFullyVisible();
      },
    });
  }

  /**
   * Update character scale based on Y position (pseudo-3D depth effect)
   * Higher Y (lower on screen) = closer = bigger (zoom in)
   * Lower Y (higher on screen) = further = smaller (zoom out)
   */
  private updateScaleForDepth(): void {
    const { canvasHeight } = this.gameConfig;
    const normalizedY = this.container.y / canvasHeight;
    const minScale = 0.7;
    const maxScale = 1.3;
    const depthScale = minScale + (normalizedY * (maxScale - minScale));
    this.container.setScale(depthScale);
  }

  /**
   * Start UNPREDICTABLE random movement - gabungan berbagai pola acak
   * Gerakan benar-benar random dan sulit ditebak
   * Delay dulu agar user sempat lihat karakter spawn dengan sempurna
   */
  private startCircularWandering(): void {
    // DELAY sebelum movement dimulai - biar karakter terlihat jelas dulu!
    const delayBeforeMovement = 600 + Math.random() * 400; // 600-1000ms delay

    this.scene.time.delayedCall(delayBeforeMovement, () => {
      const { gridWidth, gridHeight, gameAreaWidth, gameAreaHeight, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop } = this.gameConfig;

      // Pilih pola movement secara RANDOM
      const patterns = ['random', 'circular', 'figure8', 'chaos'];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      // console.log(`🎲 RANDOM movement pattern: ${pattern}`);

      switch (pattern) {
        case 'random':
          this.startRandomWaypoints();
          break;
        case 'circular':
          this.startCircularMotion();
          break;
      case 'figure8':
        this.startFigure8Motion();
        break;
      case 'chaos':
        this.startChaosMotion();
        break;
      }
    });
  }

  /**
   * Pattern 1: Random waypoints - ADAPTIVE BOUNDARIES!
   * Smartphone: lebih longgar, Laptop: lebih ketat
   */
  private startRandomWaypoints(): void {
    const { gameWidth, gameHeight, dpr, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop, isPortrait } = this.gameConfig;

    // Adaptive padding - smartphone butuh lebih banyak ruang!
    const padding = isPortrait ? 60 * dpr : 100 * dpr;
    const minX = gameAreaOffsetX + gridMarginLeft + padding;
    const maxX = gameAreaOffsetX + gridMarginLeft + gameWidth - padding;
    const minY = gameAreaOffsetY + gridMarginTop + padding;
    const maxY = gameAreaOffsetY + gridMarginTop + gameHeight - padding;

    const moveToRandom = () => {
      const targetX = minX + Math.random() * (maxX - minX);
      const targetY = minY + Math.random() * (maxY - minY);

      // Lebih cepat dan dinamis - 0.3-0.8 seconds
      const duration = 300 + Math.random() * 500;

      // Random easing untuk variasi
      const easings = ['Sine.easeInOut', 'Quad.easeInOut', 'Cubic.easeInOut', 'Circ.easeOut'];
      const randomEase = easings[Math.floor(Math.random() * easings.length)];

      this.scene.tweens.add({
        targets: this.container,
        x: targetX,
        y: targetY,
        duration: duration,
        ease: randomEase,
        onComplete: () => moveToRandom(),
      });
    };

    moveToRandom();
  }

  /**
   * Pattern 2: Circular motion - ADAPTIVE SAFE CIRCLES!
   * Smartphone: radius dan padding lebih besar
   */
  private startCircularMotion(): void {
    const { gridWidth, gridHeight, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop, dpr, isPortrait } = this.gameConfig;
    const centerX = this.container.x;
    const centerY = this.container.y;
    const cellSize = Math.min(gridWidth / 5, gridHeight / 3);

    // Adaptive radius - smartphone dapat lebih besar!
    const minRadius = isPortrait ? cellSize * 0.5 : cellSize * 0.4;
    const maxRadius = isPortrait ? cellSize * 1.0 : cellSize * 0.8;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    // Adaptive padding - smartphone butuh lebih longgar!
    const safePadding = isPortrait ? 80 * dpr : 120 * dpr;
    const minSafeX = gameAreaOffsetX + gridMarginLeft + safePadding;
    const maxSafeX = gameAreaOffsetX + gridMarginLeft + gameWidth - safePadding;
    const minSafeY = gameAreaOffsetY + gridMarginTop + safePadding;
    const maxSafeY = gameAreaOffsetY + gridMarginTop + gameHeight - safePadding;

    // Pastikan circle tidak akan keluar dari safe area
    const clampedCenterX = Math.max(minSafeX + radius, Math.min(maxSafeX - radius, centerX));
    const clampedCenterY = Math.max(minSafeY + radius, Math.min(maxSafeY - radius, centerY));

    const clockwise = Math.random() > 0.5;
    const arcPoints = 12 + Math.floor(Math.random() * 12); // 12-23 points (more = smoother!)

    const waypoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < arcPoints; i++) {
      const angle = (Math.PI * 2 * i) / arcPoints;
      waypoints.push({
        x: clampedCenterX + Math.cos(angle) * radius,
        y: clampedCenterY + Math.sin(angle) * radius,
      });
    }

    // console.log(`⭕ Circular: radius=${radius.toFixed(0)}, points=${arcPoints}, clockwise=${clockwise}`);

    let currentWaypoint = 0;
    const moveToNext = () => {
      const target = waypoints[clockwise ? currentWaypoint : (waypoints.length - 1 - currentWaypoint)];

      // Lebih cepat - 0.3-0.6s per point
      const duration = 300 + Math.random() * 300;

      this.scene.tweens.add({
        targets: this.container,
        x: target.x,
        y: target.y,
        duration: duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          currentWaypoint = (currentWaypoint + 1) % waypoints.length;
          moveToNext();
        },
      });
    };

    moveToNext();
  }

  /**
   * Pattern 3: Figure-8 (infinity symbol) - SAFE FIGURE-8!
   * Gerakan fig-8 dengan radius KECIL dan aman
   * ADAPTIVE - Smartphone dapat radius dan ruang lebih besar!
   */
  private startFigure8Motion(): void {
    const { gridWidth, gridHeight, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop, dpr, isPortrait } = this.gameConfig;
    const centerX = this.container.x;
    const centerY = this.container.y;
    const cellSize = Math.min(gridWidth / 5, gridHeight / 3);

    // Adaptive radius - smartphone dapat lebih besar!
    const minRadius = isPortrait ? cellSize * 0.5 : cellSize * 0.35;
    const maxRadius = isPortrait ? cellSize * 0.8 : cellSize * 0.7;
    const radiusX = minRadius + Math.random() * (maxRadius - minRadius); // Horizontal
    const radiusY = (minRadius * 0.5) + Math.random() * ((maxRadius * 0.5) - (minRadius * 0.5)); // Vertical (50% of horizontal)

    // Adaptive padding - smartphone butuh lebih longgar!
    const safePadding = isPortrait ? 80 * dpr : 120 * dpr;
    const minSafeX = gameAreaOffsetX + gridMarginLeft + safePadding;
    const maxSafeX = gameAreaOffsetX + gridMarginLeft + gridWidth - safePadding;
    const minSafeY = gameAreaOffsetY + gridMarginTop + safePadding;
    const maxSafeY = gameAreaOffsetY + gridMarginTop + gameHeight - safePadding;

    // Pastikan figure-8 tidak akan keluar dari safe area
    const clampedCenterX = Math.max(minSafeX + radiusX, Math.min(maxSafeX - radiusX, centerX));
    const clampedCenterY = Math.max(minSafeY + radiusY, Math.min(maxSafeY - radiusY, centerY));

    const waypoints: Array<{ x: number; y: number }> = [];
    const points = 20; // More points for smoother figure-8

    for (let i = 0; i < points; i++) {
      const t = (Math.PI * 2 * i) / points;
      // Lissajous curve untuk figure-8
      waypoints.push({
        x: clampedCenterX + Math.sin(t) * radiusX,
        y: clampedCenterY + Math.sin(t * 2) * radiusY,
      });
    }

    // console.log(`∞ Figure-8: radiusX=${radiusX.toFixed(0)}, radiusY=${radiusY.toFixed(0)}`);

    let currentWaypoint = 0;
    const moveToNext = () => {
      const target = waypoints[currentWaypoint];

      // Cepat dan smooth - 0.3-0.5s per point
      const duration = 300 + Math.random() * 200;

      this.scene.tweens.add({
        targets: this.container,
        x: target.x,
        y: target.y,
        duration: duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          currentWaypoint = (currentWaypoint + 1) % waypoints.length;
          moveToNext();
        },
      });
    };

    moveToNext();
  }

  /**
   * Pattern 4: CHAOS - SAFE CHAOS!
   * Campuran semua pola secara acak dengan BOUNDARIES yang sangat aman
   * ADAPTIVE - Smartphone dapat ruang gerak lebih luas!
   */
  private startChaosMotion(): void {
    const { gameWidth, gameHeight, dpr, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop, isPortrait } = this.gameConfig;

    // Adaptive padding - smartphone butuh lebih banyak ruang!
    const padding = isPortrait ? 70 * dpr : 100 * dpr;
    const minX = gameAreaOffsetX + gridMarginLeft + padding;
    const maxX = gameAreaOffsetX + gridMarginLeft + gameWidth - padding;
    const minY = gameAreaOffsetY + gridMarginTop + padding;
    const maxY = gameAreaOffsetY + gridMarginTop + gameHeight - padding;

    const moveChaos = () => {
      // Random setiap kali: pilih pola berbeda!
      const chaosType = Math.random();

      if (chaosType < 0.35) {
        // Random jump - teleport ke posisi acak dalam EXTRA SAFE area!
        this.scene.tweens.add({
          targets: this.container,
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
          duration: 200 + Math.random() * 300, // Super cepat - 0.2-0.5s!
          ease: 'Quad.easeInOut',
          onComplete: () => moveChaos(),
        });
      } else if (chaosType < 0.65) {
        // Small circle/arc movement dengan radius KECIL
        const gridWidth = gameWidth;
        const gridHeight = gameHeight;
        const cellSize = Math.min(gridWidth / 5, gridHeight / 3);
        const radius = cellSize * (0.25 + Math.random() * 0.3); // 25-55% dari cell size (KECIL!)
        const angle = Math.random() * Math.PI * 2;

        // Clamp hasil movement dalam safe area!
        const newX = this.container.x + Math.cos(angle) * radius;
        const newY = this.container.y + Math.sin(angle) * radius;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        const clampedY = Math.max(minY, Math.min(maxY, newY));

        this.scene.tweens.add({
          targets: this.container,
          x: clampedX,
          y: clampedY,
          duration: 200 + Math.random() * 250, // Cepat - 0.2-0.45s
          ease: 'Sine.easeInOut',
          onComplete: () => moveChaos(),
        });
      } else {
        // Diagonal dash dengan jarak KECIL!
        const gridWidth = gameWidth;
        const gridHeight = gameHeight;
        const cellSize = Math.min(gridWidth / 5, gridHeight / 3);
        const dashDistance = cellSize * (0.3 + Math.random() * 0.6); // 30-90% dari cell size (KECIL!)
        const angle = Math.random() * Math.PI * 2;

        // Clamp hasil dash dalam safe area!
        const newX = this.container.x + Math.cos(angle) * dashDistance;
        const newY = this.container.y + Math.sin(angle) * dashDistance;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        const clampedY = Math.max(minY, Math.min(maxY, newY));

        this.scene.tweens.add({
          targets: this.container,
          x: clampedX,
          y: clampedY,
          duration: 250 + Math.random() * 300, // Cepat - 0.25-0.55s
          ease: 'Quad.easeOut',
          onComplete: () => moveChaos(),
        });
      }
    };

    moveChaos();
  }

  /**
   * Start breathing effect - SUBTLE zoom in/out
   * Optimized for performance - much smaller scale changes
   */
  private startBreathingEffect(): void {
    // Get CURRENT scale from container
    const currentScale = this.container.scale;
    const targetScale = currentScale * 1.08; // Only 8% increase - SUBTLE for better performance

    this.breathingTween = this.scene.tweens.add({
      targets: this.container,
      scale: targetScale,
      duration: 2000 + Math.random() * 1000, // 2-3 seconds (slower = smoother)
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  protected onFullyVisible(): void {
    // Override in subclasses to handle when character reaches 100% opacity
    // Subclasses should call super.onFullyVisible() if they want to keep default behavior
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
      this.hpBarFill?.setVisible(true);
    }
  }

  updateHpBar(): void {
    if (!this.hpBarFill) return;

    const { isLandscape, gameAreaOffsetY } = this.gameConfig;

    // HP bar width - MORE COMPACT
    const characterWidth = this.image.displayWidth;
    const barWidth = characterWidth * 0.35; // 35% of character width (very compact)

    // HP bar is just a thin colored line (account for container scale)
    const containerScale = this.container.scaleX || 1;
    const barHeight = 0.3 / containerScale; // Counter-scale to keep it thin

    // Calculate HP bar position
    const baseOffset = isLandscape ? 2 : 2;
    let barY = -this.image.displayHeight / 2 - baseOffset;

    // Only constrain if HP bar would go above game area
    const hpBarWorldY = this.container.y + barY;
    const minAllowedY = gameAreaOffsetY + 5;
    if (hpBarWorldY < minAllowedY) {
      // HP bar would be above game area, push it down
      barY = minAllowedY - this.container.y;
    }

    // Clear and redraw
    this.hpBarFill.clear();

    // Calculate HP percentage
    const hpPercent = this.hp / this.maxHp;

    // Dynamic color based on HP: Green -> Orange -> Red
    let finalColor: number;
    if (hpPercent > 0.5) {
      finalColor = 0x00ff00; // Green
    } else if (hpPercent > 0.25) {
      finalColor = 0xff8800; // Orange
    } else {
      finalColor = 0xff0000; // Red
    }

    // Draw just the colored HP line
    this.hpBarFill.fillStyle(finalColor, 1);
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

    if (this.hpBarFill) objects.push(this.hpBarFill);
    objects.push(...this.particleEmitters);

    return objects;
  }

  /**
   * React when another enemy is damaged by player
   * Change movement pattern to make game more challenging
   */
  onEnemyDamaged(damagedTarget: any): void {
    // Don't react to self
    if (damagedTarget === this) return;

    // 30% chance to change movement pattern
    if (Math.random() < 0.3) {
      // console.log(`⚡ Reacting to damage! Changing movement...`);
      this.changeMovementPattern();
    }
  }

  /**
   * React when another enemy is killed
   * Higher chance to change movement when teammate dies
   */
  onEnemyKilled(killedTarget: any): void {
    // Don't react to self
    if (killedTarget === this) return;

    // 60% chance to change movement pattern (fear reaction!)
    if (Math.random() < 0.6) {
      // console.log(`💀 Teammate killed! Changing movement in fear!`);
      this.changeMovementPattern();
    }
  }

  /**
   * Change movement pattern randomly
   * Forces character to pick a new random movement pattern
   */
  changeMovementPattern(): void {
    // Kill existing wandering tweens
    this.scene.tweens.killTweensOf(this.container);

    // Start new random movement
    this.startCircularWandering();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.slashDamage.clear();
    this.slashDamage.destroy();
    this.hpBarFill?.clear();
    this.hpBarFill?.destroy();
    this.container.destroy();
  }

  // Abstract methods to be implemented by specific targets
  abstract getAssetKey(): string;
  abstract getSize(): { w: number; h: number };
  abstract getAudioKeys(): { slash?: string; hit?: string; spark?: string };
  abstract getMaxHP(): number;
}
