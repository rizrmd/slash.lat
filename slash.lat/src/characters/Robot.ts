import { Target, TargetConfig } from "./Target";

export class Robot extends Target {
    private size: { w: number; h: number } = { w: 1, h: 2 };

    constructor(config: TargetConfig) {
        super(config);
        // Standard robot size
        this.size = { w: 1, h: 2 };
    }

    getSize() {
        return this.size;
    }

    getAssetKey(): string {
        return "robot-bot";
    }

    getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
        return {
            slash: "knife-slash",
            hit: "knife-clank",
            spark: "electric-spark",
        };
    }

    getMaxHP(): number {
        return 400;
    }
}
