import { Target, TargetConfig } from "./Target";

export class Bee extends Target {
    private size: { w: number; h: number } = { w: 1, h: 1 };

    constructor(config: TargetConfig) {
        super(config);
        // Bee is usually small but fast
        this.size = { w: 1, h: 1 };
    }

    getSize() {
        return this.size;
    }

    getAssetKey(): string {
        return "bee-bot";
    }

    getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
        return {
            slash: "knife-slash",
            hit: "bee-audio",
            spark: "electric-spark",
        };
    }

    getMaxHP(): number {
        return 150; // Squishy but hard to hit
    }
}
