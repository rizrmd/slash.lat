import { Target, TargetConfig } from "./Target";

export class OrangeBot extends Target {
  private size: { w: number; h: number } = { w: 1, h: 1 }; // Default: small (1x1)

  constructor(config: TargetConfig) {
    // Call super() FIRST (required by JavaScript/TypeScript)
    super(config);

    // NOW we can use 'this' to randomize size
    // Random size for variety: 1x1, 2x2, 3x2, or 3x3
    const random = Math.random();
    if (random < 0.3) {
      this.size = { w: 1, h: 1 }; // 30% chance - 1x1
    } else if (random < 0.6) {
      this.size = { w: 2, h: 2 }; // 30% chance - 2x2
    } else if (random < 0.8) {
      this.size = { w: 3, h: 2 }; // 20% chance - 3x2
    } else {
      this.size = { w: 3, h: 3 }; // 20% chance - 3x3
    }
  }

  getSize() {
    // Defensive check for when this.size is not yet initialized
    return this.size || { w: 1, h: 1 };
  }

  getAssetKey(): string {
    return "orange-bot";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "knife-slash",
      hit: "knife-clank",
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

  // Orange target can have specific behavior overrides here
  // For example:
  // - Custom animations
  // - Special effects
  // - Unique audio
  // - Different damage patterns
}
