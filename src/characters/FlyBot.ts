import { Target, TargetConfig } from "./Target";

export class FlyBot extends Target {
  private hasTransformedToAttack: boolean = false;
  private attackImage?: Phaser.GameObjects.Image;

  constructor(config: TargetConfig) {
    super(config);

    // Add wiggling flight animation
    const dpr = config.gameConfig.dpr;
    const wiggleAmount = 8 * dpr; // Wiggle distance

    // Create continuous up-down wiggle effect
    this.scene.tweens.add({
      targets: this.container,
      y: `+=${wiggleAmount}`, // Move down
      duration: 300,
      ease: "Sine.easeInOut",
      yoyo: true, // Return to original position
      repeat: -1, // Repeat forever
    });
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
    return { w: 1, h: 1 };
  }

  getAssetKey(): string {
    return "fly-bot";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "knife-slash",
      hit: "knife-clank",
      spark: "electric-spark",
    };
  }

  getMaxHP(): number {
    return 200;
  }

  // Fly target can have specific behavior overrides here
  // For example:
  // - Custom animations (maybe buzzing/hovering effect)
  // - Special effects (fly particles)
  // - Unique audio (buzzing sound)
  // - Different damage patterns (smaller slash marks)
}
