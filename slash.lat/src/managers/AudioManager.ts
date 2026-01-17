import Phaser from 'phaser';

export class AudioManager {
    private scene: Phaser.Scene;
    private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    setScene(scene: Phaser.Scene): void {
        this.scene = scene;
    }

    preloadAudio(key: string, path: string): void {
        this.scene.load.audio(key, path);
    }

    addSound(key: string): void {
        const sound = this.scene.sound.add(key);
        this.sounds.set(key, sound);
    }

    play(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        const sound = this.sounds.get(key);
        if (sound) {
            sound.play(config);
        }
    }

    getSound(key: string): Phaser.Sound.BaseSound | undefined {
        return this.sounds.get(key);
    }

    stopAll(): void {
        this.sounds.forEach(sound => sound.stop());
    }

    removeSound(key: string): void {
        const sound = this.sounds.get(key);
        if (sound) {
            sound.stop();
            sound.destroy();
            this.sounds.delete(key);
        }
    }

    destroy(): void {
        this.sounds.forEach(sound => sound.destroy());
        this.sounds.clear();
    }
}
