import { Target, TargetConfig } from "./Target";

export class Lion extends Target {
    private size: { w: number; h: number } = { w: 2, h: 2 };

    constructor(config: TargetConfig) {
        super(config);
        // Lion is a bigger target
        this.size = { w: 2, h: 2 };
    }

    getSize() {
        return this.size;
    }

    getAssetKey(): string {
        return "lion-bot";
    }

    getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
        return {
            slash: "knife-slash",
            hit: "knife-clank",
            spark: "electric-spark",
        };
    }

    getMaxHP(): number {
        return 800; // Tankier target
    }
}
