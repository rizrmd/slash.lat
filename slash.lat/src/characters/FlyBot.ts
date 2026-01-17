import { Target, TargetConfig } from "./Target";

export class FlyBot extends Target {
  private hasTransformedToAttack: boolean = false;
  private attackImage?: Phaser.GameObjects.Image;
  private size: { w: number; h: number } = { w: 1, h: 1 }; // Default: small (1x1)

  constructor(config: TargetConfig) {
    // Call super() FIRST (required by JavaScript/TypeScript)
    super(config);

    // NOW we can use 'this' to randomize size
    // Random size for variety: 1x1 (40%), 2x1 (40%), or 3x2 (20%)
    const random = Math.random();
    if (random < 0.4) {
      this.size = { w: 1, h: 1 }; // 40% chance - small
    } else if (random < 0.8) {
      this.size = { w: 2, h: 1 }; // 40% chance - medium
    } else {
      this.size = { w: 3, h: 2 }; // 20% chance - large
    }
  }

  // Override to handle image transformation
  protected onFullyVisible(): void {
    if (this.hasTransformedToAttack) return;
    this.hasTransformedToAttack = true;

    // Create attack image overlay
    this.attackImage = this.scene.add.image(0, 0, "fly-bot-attack");
    this.attackImage.setScale(this.image.scaleX);
    this.attackImage.setAlpha(0);
    this.container.addAt(this.attackImage, 1);

    // Cross-fade: fade out original, fade in attack (simultaneously)
    this.scene.tweens.add({
      targets: this.image,
      alpha: 0,
      duration: 300,
      ease: "Linear",
    });

    this.scene.tweens.add({
      targets: this.attackImage,
      alpha: 1,
      duration: 300,
      ease: "Linear",
      onComplete: () => {
        // Swap main texture and clean up overlay
        this.image.setTexture("fly-bot-attack");
        this.image.setAlpha(1);
        this.extractImageData();
        this.attackImage?.destroy();
        this.attackImage = undefined;
      },
    });
  }

  getSize() {
    // Defensive check for when this.size is not yet initialized
    return this.size || { w: 1, h: 1 };
  }

  getAssetKey(): string {
    return "fly-bot";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string; emerge?: string } {
    return {
      slash: "knife-slash",
      hit: "alien-audio",
      spark: "electric-spark",
      emerge: "bee-audio", // Buzzing sound for fly
    };
  }

  getMaxHP(): number {
    // Scale HP based on size: larger = more HP
    // Use defensive check for when this.size is not yet initialized (during parent constructor)
    const size = this.size || { w: 1, h: 1 };
    const sizeMultiplier = size.w * size.h;
    return 200 * sizeMultiplier; // 1x1=200, 2x1=400, 3x2=1200
  }

  // Fly target can have specific behavior overrides here
  // For example:
  // - Custom animations (maybe buzzing/hovering effect)
  // - Special effects (fly particles)
  // - Unique audio (buzzing sound)
  // - Different damage patterns (smaller slash marks)
}
