import { Target, TargetConfig } from "./Target";

export class OrangeBot extends Target {
  constructor(config: TargetConfig) {
    super(config);
  }

  getSize() {
    return { w: 1, h: 2 };
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
    return 600;
  }

  // Orange target can have specific behavior overrides here
  // For example:
  // - Custom animations
  // - Special effects
  // - Unique audio
  // - Different damage patterns
}
