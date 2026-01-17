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
  protected shadow!: Phaser.GameObjects.Graphics; // Add ! to avoid not-assigned error
  public slashDamage: Phaser.GameObjects.Graphics; // Public for camera ignore
  protected imageData?: ImageData;
  protected gameConfig: GameConfig;
  protected audioManager: AudioManager;
  protected hp: number;
  protected maxHp: number;
  public hpBarFill?: Phaser.GameObjects.Graphics;
  protected hpBarVisible: boolean = false;
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private initialImageScale: number = 1;
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

    // Store spawn time to differentiate between fading enemies and entrance animations
    this.container.setData('spawnTime', Date.now());

    // Create Shadow for Realism (Grounding)
    this.shadow = this.scene.add.graphics();
    this.shadow.fillStyle(0x000000, 1);
    this.shadow.fillEllipse(0, 0, 100, 30); // Base ellipse size
    this.shadow.setAlpha(0.3);

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

    this.initialImageScale = finalScale; // Store for breathing reference
    this.image.setScale(finalScale);

    // Initial shadow positioning (below image)
    const shadowY = (imageHeight * finalScale) / 2 + 10;
    this.shadow.y = shadowY;
    // Shadow width relative to character width
    const shadowScale = (imageWidth * finalScale) / 100;
    this.shadow.scaleX = shadowScale * 1.2;
    this.shadow.scaleY = shadowScale * 0.4;

    // Create slash damage overlay (initially hidden)
    this.slashDamage = this.scene.add.graphics();
    this.slashDamage.setVisible(false);

    // Create HP bar
    this.hpBarFill = this.scene.add.graphics();
    this.hpBarFill.setVisible(false);
    this.updateHpBar();

    // Add all to container (Shadow FIRST so it's behind)
    this.container.add([this.shadow, this.image, this.slashDamage, this.hpBarFill]);

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
        // Start breathing effect AND movement pattern
        this.startBreathingEffect();
        this.startComplexMovement();

        // Notify subclasses when fully visible
        this.onFullyVisible();

        // START ATTACK TIMER (Kill or Be Killed!)
        // If player doesn't kill this target within 3000ms, it attacks!
        this.startAttackTimer();
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
    const normalizedY = Math.min(1, Math.max(0, this.container.y / canvasHeight)); // Clamp between 0 and 1
    const minScale = 0.85; // Moderate: Slightly smaller when far (was 0.5)
    const maxScale = 1.15; // Moderate: Slightly bigger when close (was 1.8)
    const depthScale = minScale + (normalizedY * (maxScale - minScale));
    this.container.setScale(depthScale);

    // Update Shadow Realism (Grounding)
    if (this.shadow) {
      // Darker when closer (0.2 to 0.4 opacity) - more visible
      const shadowAlpha = 0.2 + (normalizedY * 0.2);
      this.shadow.setAlpha(shadowAlpha);
    }
  }

  /**
   * Start UNPREDICTABLE random movement - NO DELAY!
   */
  /**
   * Start complex movement sequence utilizing various patterns
   * zigzag, horizontal, vertical, diagonal, semi-circle, full-circle
   */
  private startComplexMovement(): void {
    this.moveNext();
  }

  private moveNext(): void {
    // If we've been destroyed, stop
    if (!this.scene || !this.container) return;

    const patterns = ['zigzag', 'horizontal', 'vertical', 'diagonal', 'semicircle', 'fullcircle', 'random', 'lunge', 'lunge']; // Added 'lunge' twice to increase probability
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    // Ensure we stay within bounds
    const {
      dpr,
      gameAreaOffsetX,
      gameAreaOffsetY,
      gridMarginLeft,
      gridMarginTop,
      gridWidth,
      gridHeight,
      isPortrait
    } = this.gameConfig;

    // --- DYNAMIC BOUNDS CALCULATION ---
    // Use SMALLER padding on portrait/mobile
    const isMobile = isPortrait || gridWidth < 600;

    // 1. TOP EDGE
    const topScale = isMobile ? 0.3 : 0.8; // Smaller scale for mobile
    const paddingTop = (this.image.frame.height * this.initialImageScale * topScale) / 2 + (isMobile ? 5 : 20) * dpr;

    // 2. SIDE EDGES
    const sideScale = isMobile ? 0.5 : 2.0;
    const paddingSide = (this.image.frame.width * this.initialImageScale * sideScale) / 2 + (isMobile ? 10 : 50) * dpr;

    // 3. BOTTOM EDGE
    const bottomScale = isMobile ? 0.8 : 3.0;
    const paddingBottom = (this.image.frame.height * this.initialImageScale * bottomScale) / 2 + (isMobile ? 15 : 100) * dpr;

    // Calculate Grid start positions (Top-Left of the playable grid)
    const gridStartX = gameAreaOffsetX + gridMarginLeft;
    const gridStartY = gameAreaOffsetY + gridMarginTop;

    const centerX = gridStartX + (gridWidth / 2);
    const centerY = gridStartY + (gridHeight / 2);

    let minX = gridStartX + paddingSide;
    let maxX = gridStartX + gridWidth - paddingSide;

    // Top bound is much higher now -> triggers "Zoom Out"
    let minY = gridStartY + paddingTop;
    // Bottom bound is protected
    let maxY = gridStartY + gridHeight - paddingBottom;

    // Safety check: If padding is too big for the screen, lock to center
    if (minX > maxX) {
      minX = centerX;
      maxX = centerX;
    }
    if (minY > maxY) {
      minY = centerY;
      maxY = centerY;
    }

    const safeBounds = {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };

    // Common movement params
    const speedMultiplier = 1.0; // Adjustable speed factor
    const baseDuration = (300 + Math.random() * 400) / speedMultiplier; // 0.3 - 0.7s per segment

    switch (pattern) {
      case 'zigzag':
        this.moveZigzag(safeBounds, baseDuration);
        break;
      case 'horizontal':
        this.moveLinear(safeBounds, 'horizontal', baseDuration);
        break;
      case 'vertical':
        this.moveLinear(safeBounds, 'vertical', baseDuration);
        break;
      case 'diagonal':
        this.moveLinear(safeBounds, 'diagonal', baseDuration);
        break;
      case 'semicircle':
        this.moveArc(safeBounds, 'semi', baseDuration);
        break;
      case 'fullcircle':
        this.moveArc(safeBounds, 'full', baseDuration);
        break;
      case 'random':
        this.moveRandom(safeBounds, baseDuration);
        break;
      case 'lunge':
        this.moveLunge(safeBounds, baseDuration);
        break;
      default:
        this.moveRandom(safeBounds, baseDuration);
        break;
    }
  }

  // --- ATOMIC MOVEMENT PATTERNS ---

  /**
   * Pattern: Attack Lunge
   * Simulates an attack: Anticipate (pull back), Lunge (fast forward/down), Recover
   */
  private moveLunge(bounds: any, baseDuration: number): void {
    // 1. Anticipate: Pull back slightly (up/away) and wait
    const currentX = this.container.x;
    const currentY = this.container.y;

    // Calculate lunge target (bottom-ish area, towards player)
    // Target is somewhere in the bottom half of the safe bounds
    const lungeX = bounds.minX + Math.random() * bounds.width;
    const lungeY = bounds.minY + (bounds.height * 0.6) + (Math.random() * bounds.height * 0.4);

    // Anticipation point (slightly opposite to lunge direction)
    const antX = currentX - (lungeX - currentX) * 0.1;
    const antY = currentY - (lungeY - currentY) * 0.1;

    // Sequence: Anticipate -> Lunge -> Pause -> Recover
    // Sequence: Anticipate -> Lunge -> Pause -> Recover
    // We use nested tweens for maximum compatibility
    this.scene.tweens.add({
      targets: this.container,
      x: antX,
      y: antY,
      duration: baseDuration * 1.5, // Slow windup
      ease: 'Power1',
      onUpdate: () => this.updateScaleForDepth(),
      onComplete: () => {
        // LUNGE!
        this.scene.tweens.add({
          targets: this.container,
          x: lungeX,
          y: lungeY,
          duration: baseDuration * 0.6, // FAST attack!
          ease: 'Back.easeOut', // Overshoot slightly for impact
          onUpdate: () => this.updateScaleForDepth(),
          onComplete: () => {
            // Short Pause (Impact)
            this.scene.time.delayedCall(200, () => {
              this.moveNext();
            });
          }
        });
      }
    });
  }

  /**
   * Pattern 1: Zigzag
   * Moves to 3-4 points in a zigzag pattern
   */
  private moveZigzag(bounds: any, baseDuration: number): void {
    const points = 3 + Math.floor(Math.random() * 2); // 3 or 4 points
    let currentStep = 0;

    const executeStep = () => {
      if (currentStep >= points) {
        this.moveNext();
        return;
      }

      // Zigzag logic: alternate vertical direction while moving horizontally, or vice versa
      // For simplicity: just pick random points that are somewhat far apart but safe
      const targetX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.random() * (bounds.maxX - bounds.minX) + bounds.minX));
      const targetY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.random() * (bounds.maxY - bounds.minY) + bounds.minY));

      this.scene.tweens.add({
        targets: this.container,
        x: targetX,
        y: targetY,
        duration: baseDuration * 0.8, // Faster segments for zigzag
        ease: 'Sine.easeInOut',
        onUpdate: () => this.updateScaleForDepth(),
        onComplete: () => {
          currentStep++;
          executeStep();
        }
      });
    };

    executeStep();
  }

  /**
   * Pattern 2, 3, 4: Linear (Horizontal, Vertical, Diagonal)
   * Moves a significant distance in one direction
   */
  private moveLinear(bounds: any, type: 'horizontal' | 'vertical' | 'diagonal', duration: number): void {
    let targetX = this.container.x;
    let targetY = this.container.y;
    const minMove = 100 * this.gameConfig.dpr; // Minimum movement distance

    if (type === 'horizontal') {
      // Pick random X, keep Y (mostly)
      targetX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.random() * (bounds.maxX - bounds.minX) + bounds.minX));
      // Add slight Y variation for natural look
      targetY += (Math.random() - 0.5) * 50;
    } else if (type === 'vertical') {
      // Pick random Y, keep X (mostly)
      targetY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.random() * (bounds.maxY - bounds.minY) + bounds.minY));
      targetX += (Math.random() - 0.5) * 50;
    } else {
      // Diagonal: Pick random X and Y
      targetX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.random() * (bounds.maxX - bounds.minX) + bounds.minX));
      targetY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.random() * (bounds.maxY - bounds.minY) + bounds.minY));
    }

    // Clamp Y
    targetY = Math.max(bounds.minY, Math.min(bounds.maxY, targetY));
    targetX = Math.max(bounds.minX, Math.min(bounds.maxX, targetX));

    this.scene.tweens.add({
      targets: this.container,
      x: targetX,
      y: targetY,
      duration: duration * 1.5, // Longer duration for long slides
      ease: 'Quad.easeInOut',
      onUpdate: () => this.updateScaleForDepth(),
      onComplete: () => this.moveNext()
    });
  }

  /**
   * Pattern 5, 6: Arcs (Semi-circle, Full-circle)
   * Uses waypoints to approximate circular motion
   */
  private moveArc(bounds: any, type: 'semi' | 'full', duration: number): void {
    // Determine radius and center based on available space
    // We want the circle to be near current position
    const currentX = this.container.x;
    const currentY = this.container.y;

    // Random radius (between 10% and 30% of screen width)
    const minR = bounds.width * 0.1;
    const maxR = bounds.width * 0.25;
    const radius = minR + Math.random() * (maxR - minR);

    // Determines offset direction (so we don't always circle around the same center relative to us)
    const angleOffset = Math.random() * Math.PI * 2;
    // Calculate potential center
    const centerX = currentX + Math.cos(angleOffset) * radius;
    const centerY = currentY + Math.sin(angleOffset) * radius;

    // Clamp center to keep circle mostly in bounds
    // (It's OK if it clips slightly, safe area handles major padding)
    const clampedCenterX = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, centerX));
    const clampedCenterY = Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, centerY));

    // Calculate start angle relative to clamped center
    const startAngle = Math.atan2(currentY - clampedCenterY, currentX - clampedCenterX);

    const isClockwise = Math.random() > 0.5;
    const direction = isClockwise ? 1 : -1;

    // Full circle = 2PI, Semi = PI
    const arcLength = type === 'full' ? Math.PI * 2 : Math.PI * (0.5 + Math.random() * 0.5); // 0.5PI - 1.0PI for 'semi'

    const segments = type === 'full' ? 16 : 8;
    const waypoints: { x: number, y: number }[] = [];

    for (let i = 1; i <= segments; i++) {
      const progress = i / segments;
      const angle = startAngle + (arcLength * progress * direction);
      waypoints.push({
        x: clampedCenterX + Math.cos(angle) * radius,
        y: clampedCenterY + Math.sin(angle) * radius
      });
    }

    let currentPoint = 0;
    const stepDuration = (duration * (type === 'full' ? 4 : 2)) / segments; // Adjust total time based on length

    const moveStep = () => {
      if (currentPoint >= waypoints.length) {
        this.moveNext();
        return;
      }

      const p = waypoints[currentPoint];
      this.scene.tweens.add({
        targets: this.container,
        x: p.x,
        y: p.y,
        duration: stepDuration, // Linear for smooth curve approximation
        ease: 'Linear',
        onUpdate: () => this.updateScaleForDepth(),
        onComplete: () => {
          currentPoint++;
          moveStep();
        }
      });
    };

    moveStep();
  }

  /**
   * Fallback / Simple Random Move
   */
  private moveRandom(bounds: any, duration: number): void {
    const targetX = Math.max(bounds.minX, Math.min(bounds.maxX, Math.random() * (bounds.maxX - bounds.minX) + bounds.minX));
    const targetY = Math.max(bounds.minY, Math.min(bounds.maxY, Math.random() * (bounds.maxY - bounds.minY) + bounds.minY));

    this.scene.tweens.add({
      targets: this.container,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.updateScaleForDepth(),
      onComplete: () => this.moveNext()
    });
  }

  /**
   * Start breathing effect - SLOWER and MORE ORGANIC!
   * Simulates real-life breathing rhythm (Inhale -> Pause -> Exhale -> Pause)
   * UPDATED: Now targets THIS.IMAGE scale relative to BASE scale, independent of container depth scale!
   */
  private startBreathingEffect(): void {
    // Determine scale range based on INITIAL image scale
    const baseScale = this.initialImageScale;
    const maxBreathScale = baseScale * 1.5; // EXAGGERATED: 50% inhale

    const breatheCycle = () => {
      // Stop if destroyed
      if (!this.scene || !this.image || !this.image.active) return;

      // Random duration for more organic feel (2.5s - 4.5s cycle)
      const inhaleDuration = 1500 + Math.random() * 1000;
      const exhaleDuration = 1500 + Math.random() * 1000;
      const holdDuration = 100 + Math.random() * 200;

      // INHALE
      this.breathingTween = this.scene.tweens.add({
        targets: this.image, // Target the SPRITE, not the container
        scale: maxBreathScale,
        duration: inhaleDuration,
        ease: "Sine.easeInOut",
        onComplete: () => {
          // HOLD BREATH (tiny pause)
          this.scene.time.delayedCall(holdDuration, () => {
            // EXHALE
            if (!this.scene || !this.image) return;

            this.breathingTween = this.scene.tweens.add({
              targets: this.image,
              scale: baseScale,
              duration: exhaleDuration,
              ease: "Sine.easeInOut",
              onComplete: () => {
                // Loop after short pause
                this.scene.time.delayedCall(holdDuration, breatheCycle);
              }
            });
          });
        }
      });
    };

    breatheCycle();
  }

  protected onFullyVisible(): void {
    // Play emerge sound if available
    const audioKeys = this.getAudioKeys();
    if (audioKeys.emerge) {
      this.audioManager.play(audioKeys.emerge, { volume: 0.5 });
    }

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

    // CRITICAL FIX: Clear previous slash marks to prevent MULTIPLY blend mode accumulation
    // Without this, each slash makes the character progressively darker (shadow bug)
    this.slashDamage.clear();

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
        fontSize: damage >= 9000 ? `${28 * dpr}px` : `${20 * dpr}px`,
        color: damage >= 9000 ? "#ff0000" : "#ffffff",
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
      // console.log(`Reacting to damage! Changing movement...`);
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
      // console.log(`Teammate killed! Changing movement in fear!`);
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
    this.startComplexMovement();
  }

  destroy(): void {
    // CRITICAL FIX: Remove event listeners to prevent memory leaks and conflicts on retry
    this.scene.events.off('enemy-damaged', this.onEnemyDamaged, this);
    this.scene.events.off('enemy-killed', this.onEnemyKilled, this);

    // Kill all tweens targeting this container
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.image);

    // Destroy graphics
    this.slashDamage.clear();
    this.slashDamage.destroy();
    this.hpBarFill?.clear();
    this.hpBarFill?.destroy();

    // Destroy shadow to prevent ghost shadows
    this.shadow?.clear();
    this.shadow?.destroy();

    // Finally destroy container (this will destroy all children)
    this.container.destroy();
  }

  // Attack timer logic
  protected startAttackTimer(): void {
    // Randomize attack time slightly (2000 - 4000ms)
    const attackDelay = 2000 + Math.random() * 2000;

    this.scene.time.delayedCall(attackDelay, () => {
      if (this.isDead() || !this.scene || !this.container.active) return;

      // ATTACK PLAYER!
      this.attackPlayer();
    });
  }

  protected attackPlayer(): void {
    if (this.isDead()) return;

    // Visual feedback: Enemy lunges/flashes before hitting
    this.scene.tweens.add({
      targets: this.container,
      scale: this.container.scale * 1.5,
      alpha: 1,
      duration: 300,
      yoyo: true,
      onComplete: () => {
        if (this.isDead()) return;

        // Deal damage to player
        const gameScene = this.scene as any;
        // 200 damage = player dies in 5 hits (if max HP 1000)
        // Or make it more punishing? 
        if (gameScene.takeDamage) {
          gameScene.takeDamage(250, this.container.x, this.container.y);

          // Play gunshot sound when enemy attacks user
          this.audioManager.play("gunshot");
        }

        // Enemy leaves after attacking (or dies?)
        // Let's make them vanish laughingly
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          scale: 0,
          duration: 500,
          onComplete: () => {
            this.destroy();
          }
        });
      }
    });
  }

  abstract getAssetKey(): string;
  abstract getSize(): { w: number; h: number };
  abstract getAudioKeys(): { slash?: string; hit?: string; spark?: string; emerge?: string };
  abstract getMaxHP(): number;
}
