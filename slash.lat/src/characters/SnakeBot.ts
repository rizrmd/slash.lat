import { Target, TargetConfig } from "./Target";

export class SnakeBot extends Target {
    private size: { w: number; h: number } = { w: 3, h: 1 };

    constructor(config: TargetConfig) {
        super(config);
        // Snake bot is wider
        this.size = { w: 3, h: 1 };
    }

    getSize() {
        return this.size;
    }

    getAssetKey(): string {
        return "snake-bot";
    }

    getAudioKeys(): { slash?: string; hit?: string; spark?: string } {
        return {
            slash: "rusty-slice",
            hit: "knife-clank",
            spark: "electric-spark",
        };
    }

    getMaxHP(): number {
        return 300;
    }
}
