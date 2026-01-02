import { Target, TargetConfig } from "./Target";
import { GameScene } from "../scenes/GameScene";

export class LeafBot extends Target {
  private hasPlayedAnimation: boolean = false;
  private attackTimerEvent?: Phaser.Time.TimerEvent;

  constructor(config: TargetConfig) {
    super(config);

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
    return { w: 3, h: 2 };
  }

  getAssetKey(): string {
    return "leaf-bot-720";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "knife-slash",
      hit: "knife-clank",
      spark: "electric-spark",
    };
  }

  getMaxHP(): number {
    return 600;
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
