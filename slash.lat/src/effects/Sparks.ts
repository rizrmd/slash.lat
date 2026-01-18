import Phaser from 'phaser';
import { SlashMark, GameConfig } from '../types';

export class Sparks {
    private scene: Phaser.Scene;
    public sparkParticles: Phaser.GameObjects.Particles.ParticleEmitter; // Public for camera ignore
    private slashMarks: SlashMark[] = [];
    private sparkTimer?: Phaser.Time.TimerEvent;
    private sparkSound?: Phaser.Sound.BaseSound;
    private gameConfig: GameConfig;

    constructor(scene: Phaser.Scene, gameConfig: GameConfig, sparkSoundKey: string) {
        this.scene = scene;
        this.gameConfig = gameConfig;

        const dpr = gameConfig.dpr;

        // Create particle emitter for electric sparks
        this.sparkParticles = scene.add.particles(0, 0, 'spark', {
            speed: { min: 50 * dpr, max: 150 * dpr },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 300,
            gravityY: 100 * dpr,
            tint: [0xffff00, 0xffffff, 0xff8800],
            blendMode: 'ADD',
            emitting: false
        });
        this.sparkParticles.setDepth(10);

        // Load spark sound
        this.sparkSound = scene.sound.add(sparkSoundKey);

        // Set up periodic spark replays on slash marks
        this.sparkTimer = scene.time.addEvent({
            delay: 800 + Math.random() * 1200, // Random 0.8-2s between sparks
            callback: this.replaySparks,
            callbackScope: this,
            loop: true
        });
    }

    addSlashMark(startX: number, startY: number, endX: number, endY: number): void {
        this.slashMarks.push({
            startX,
            startY,
            endX,
            endY,
            time: this.scene.time.now
        });
    }

    emitAtSlash(startX: number, startY: number, endX: number, endY: number): void {
        // Emit sparks along the slash line
        const sparkCount = 3 + Math.floor(Math.random() * 3); // 3-5 sparks
        for (let i = 0; i < sparkCount; i++) {
            const t = Math.random();
            const sparkX = startX + (endX - startX) * t;
            const sparkY = startY + (endY - startY) * t;
            this.sparkParticles.emitParticleAt(sparkX, sparkY, 2 + Math.floor(Math.random() * 3));
        }
    }

    private replaySparks(): void {
        // Only replay sparks if there are slash marks
        if (this.slashMarks.length === 0) return;

        // Randomly pick a slash mark
        const randomMark = this.slashMarks[Math.floor(Math.random() * this.slashMarks.length)];

        // Emit 1-2 sparks at a random position along the slash
        const sparkCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < sparkCount; i++) {
            const t = Math.random();
            const sparkX = randomMark.startX + (randomMark.endX - randomMark.startX) * t;
            const sparkY = randomMark.startY + (randomMark.endY - randomMark.startY) * t;
            this.sparkParticles.emitParticleAt(sparkX, sparkY, 1 + Math.floor(Math.random() * 2));
        }

        // Play electric spark sound with random volume variation
        if (this.sparkSound) {
            this.sparkSound.play({
                volume: 0.3 + Math.random() * 0.2 // Random 0.3-0.5 volume
            });
        }

        // Randomize next spark timing by recreating the timer
        if (this.sparkTimer) {
            this.sparkTimer.remove();
            this.sparkTimer = this.scene.time.addEvent({
                delay: 800 + Math.random() * 1200,
                callback: this.replaySparks,
                callbackScope: this,
                loop: true
            });
        }
    }

    clearSlashMarks(): void {
        this.slashMarks = [];
    }

    destroy(): void {
        if (this.sparkTimer) {
            this.sparkTimer.remove();
        }
        if (this.sparkSound) {
            this.sparkSound.destroy();
        }
        this.sparkParticles.destroy();
    }
}
