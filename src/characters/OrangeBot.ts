import { Target, TargetConfig } from "./Target";

export class OrangeBot extends Target {
  constructor(config: TargetConfig) {
    super(config);
  }

  getSize() {
    return 3 / 5;
  }

  getAssetKey(): string {
    return "orange-bot";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "slash",
      hit: "hit",
      spark: "electric-spark",
    };
  }

  getMaxHP(): number {
    return 600;
  }

  // Orange target can have specific behavior overrides here
  // For example:
  // - Custom animations
  // - Special effects
  // - Unique audio
  // - Different damage patterns
}
