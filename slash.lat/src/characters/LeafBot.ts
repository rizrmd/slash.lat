import { Target, TargetConfig } from "./Target";
import { GameScene } from "../scenes/GameScene";

export class LeafBot extends Target {
  private hasPlayedAnimation: boolean = false;
  private attackTimerEvent?: Phaser.Time.TimerEvent;
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

    // Create the animation for leaf-bot-720
    this.scene.anims.create({
      key: "leaf-bot-attack",
      frames: this.scene.anims.generateFrameNumbers("leaf-bot-720", {
        start: 0,
        end: 4,
      }),
      frameRate: 8, // Adjust for desired animation speed
      repeat: 0, // Play once
    });
  }

  getSize() {
    // Defensive check for when this.size is not yet initialized
    return this.size || { w: 1, h: 1 };
  }

  getAssetKey(): string {
    return "leaf-bot-720";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "knife-slash",
      hit: "alien-audio",
      spark: "electric-spark",
    };
  }

  getMaxHP(): number {
    // Scale HP based on size: larger = more HP
    // Use defensive check for when this.size is not yet initialized (during parent constructor)
    const size = this.size || { w: 1, h: 1 };
    const sizeMultiplier = size.w * size.h;
    return 200 * sizeMultiplier; // 1x1=200, 2x1=400, 3x2=1200
  }

  protected onFullyVisible(): void {
    // play the attack animation once
    this.attackTimerEvent = this.scene.time.delayedCall(0, () => {
      if (this.image && !this.hasPlayedAnimation && !this.isDead()) {
        this.hasPlayedAnimation = true;
        this.image.play("leaf-bot-attack");

        // After animation completes, damage player and recalibrate hitbox
        this.image.once("animationcomplete", () => {
          if (this.isDead()) return;

          // Recalibrate hitbox and slash damage for the final frame
          this.extractImageData();

          // Play hit sound
          this.audioManager.play("punch-hit");

          // Damage player with enemy position for blood particles
          const gameScene = this.scene as GameScene;
          gameScene.takeDamage(100, this.container.x, this.container.y);
        });
      }
    });
  }

  destroy(): void {
    // Cancel the attack timer if it's still pending
    if (this.attackTimerEvent) {
      this.attackTimerEvent.destroy();
      this.attackTimerEvent = undefined;
    }

    // Call parent destroy
    super.destroy();
  }
}
