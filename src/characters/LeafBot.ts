import { Target, TargetConfig } from "./Target";

export class LeafBot extends Target {
  constructor(config: TargetConfig) {
    super(config);
  }

  getSize() {
    return 3 / 5;
  }

  getAssetKey(): string {
    return "leaf-bot";
  }

  getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
    return {
      slash: "slash",
      hit: "hit",
      spark: "electric-spark",
    };
  }

  getMaxHP(): number {
    return 800;
  }

  // Leaf target can have specific behavior overrides here
  // For example:
  // - Custom animations (maybe flutter/leaf fall effect)
  // - Special effects (leaf particles)
  // - Unique audio (rustling leaves)
  // - Different damage patterns (cuts through leaves)
}
