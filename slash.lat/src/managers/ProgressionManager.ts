import Phaser from "phaser";
import type { GameConfig } from "../types";
import { OrangeBot } from "../characters/OrangeBot";
import { LeafBot } from "../characters/LeafBot";
import { FlyBot } from "../characters/FlyBot";

// Character class types
export type CharacterClass = typeof OrangeBot | typeof LeafBot | typeof FlyBot;

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Enemy spawn definition with weighted probability
 */
export interface EnemySpawn {
  characterClass: CharacterClass;
  weight: number; // Higher weight = more likely to spawn
}

/**
 * Wave configuration for wave-based progression
 */
export interface WaveConfig {
  waveNumber: number;
  enemies: EnemySpawn[]; // Which enemies can spawn in this wave
  totalEnemyCount: number; // Total enemies to spawn in this wave
  maxConcurrent: number; // Max enemies on screen at once
  spawnInterval: number; // Time between spawns in milliseconds
  delayBeforeStart?: number; // Delay before wave starts (ms)
}

/**
 * Difficulty tier for continuous progression
 */
export interface DifficultyTier {
  startTime: number; // When this tier starts (seconds from game start)
  enemies: EnemySpawn[]; // Available enemies with weights
  maxConcurrent: number; // Max enemies on screen
  spawnInterval: number; // Time between spawns in milliseconds
}

/**
 * Continuous mode configuration
 */
export interface ContinuousConfig {
  tiers: DifficultyTier[]; // Difficulty tiers over time
}

/**
 * Wave-based mode configuration
 */
export interface WaveBasedConfig {
  waves: WaveConfig[]; // Array of wave configurations
  delayBetweenWaves?: number; // Delay between waves (ms), default 3000
}

/**
 * Main progression configuration
 */
export interface ProgressionConfig {
  mode: "wave" | "continuous";
  waveConfig?: WaveBasedConfig;
  continuousConfig?: ContinuousConfig;
}

// ============================================================================
// PROGRESSION MANAGER
// ============================================================================

export interface ProgressionEvents {
  onSpawnEnemy: (characterClass: CharacterClass, position: { x: number; y: number }) => void;
  onWaveStart?: (waveNumber: number) => void;
  onWaveComplete?: (waveNumber: number) => void;
  onAllWavesComplete?: () => void;
  onDifficultyChange?: (tierIndex: number) => void;
}

export class ProgressionManager {
  private scene: Phaser.Scene;
  private config: ProgressionConfig;
  private events: ProgressionEvents;
  private gameConfig: GameConfig;

  // State tracking
  private activeEnemyCount: number = 0;
  private gameStartTime: number = 0;
  private isActive: boolean = false;

  // Wave mode state
  private currentWaveIndex: number = 0;
  private enemiesSpawnedInWave: number = 0;
  private waveTimer?: Phaser.Time.TimerEvent;
  private waveDelayTimer?: Phaser.Time.TimerEvent;
  private isWaveActive: boolean = false;

  // Continuous mode state
  private currentTierIndex: number = 0;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    config: ProgressionConfig,
    events: ProgressionEvents,
    gameConfig: GameConfig
  ) {
    this.scene = scene;
    this.config = config;
    this.events = events;
    this.gameConfig = gameConfig;
  }

  /**
   * Start the progression system
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.gameStartTime = Date.now();
    this.activeEnemyCount = 0;

    if (this.config.mode === "wave") {
      this.startNextWave();
    } else if (this.config.mode === "continuous") {
      this.startContinuousMode();
    }
  }

  /**
   * Stop the progression system
   */
  stop(): void {
    this.isActive = false;
    this.waveTimer?.remove();
    this.waveDelayTimer?.remove();
    this.spawnTimer?.remove();
  }

  /**
   * Call this when an enemy is killed
   */
  onEnemyKilled(): void {
    this.activeEnemyCount = Math.max(0, this.activeEnemyCount - 1);

    if (this.config.mode === "wave") {
      this.checkWaveCompletion();
    }
  }

  /**
   * Get current progression info
   */
  getInfo() {
    if (this.config.mode === "wave") {
      const currentWave = this.getCurrentWave();
      return {
        mode: "wave" as const,
        currentWave: this.currentWaveIndex + 1,
        totalWaves: this.config.waveConfig?.waves.length ?? 0,
        enemiesRemaining: currentWave ? currentWave.totalEnemyCount - this.enemiesSpawnedInWave + this.activeEnemyCount : 0,
        activeEnemies: this.activeEnemyCount,
      };
    } else {
      const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
      return {
        mode: "continuous" as const,
        elapsedTime: elapsedSeconds,
        currentTier: this.currentTierIndex + 1,
        activeEnemies: this.activeEnemyCount,
      };
    }
  }

  // ============================================================================
  // WAVE MODE METHODS
  // ============================================================================

  private getCurrentWave(): WaveConfig | undefined {
    return this.config.waveConfig?.waves[this.currentWaveIndex];
  }

  private startNextWave(): void {
    const wave = this.getCurrentWave();
    if (!wave) {
      // All waves complete
      this.events.onAllWavesComplete?.();
      this.isActive = false;
      return;
    }

    this.enemiesSpawnedInWave = 0;
    this.isWaveActive = false;

    // Delay before wave starts (if specified)
    const delay = wave.delayBeforeStart ?? 0;
    if (delay > 0) {
      this.waveDelayTimer = this.scene.time.delayedCall(delay, () => {
        this.startWaveSpawning();
      });
    } else {
      this.startWaveSpawning();
    }
  }

  private startWaveSpawning(): void {
    const wave = this.getCurrentWave();
    if (!wave) return;

    this.isWaveActive = true;
    this.events.onWaveStart?.(wave.waveNumber);

    // Start spawn timer
    this.waveTimer = this.scene.time.addEvent({
      delay: wave.spawnInterval,
      callback: () => this.trySpawnWaveEnemy(),
      loop: true,
    });

    // Spawn first enemy immediately
    this.trySpawnWaveEnemy();
  }

  private trySpawnWaveEnemy(): void {
    const wave = this.getCurrentWave();
    if (!wave || !this.isWaveActive) return;

    // Check if we've spawned all enemies for this wave
    if (this.enemiesSpawnedInWave >= wave.totalEnemyCount) {
      this.waveTimer?.remove();
      return;
    }

    // Check if we're at max concurrent enemies
    if (this.activeEnemyCount >= wave.maxConcurrent) {
      return;
    }

    // Spawn enemy
    const characterClass = this.selectEnemyFromPool(wave.enemies);
    const position = this.getRandomGridPosition();

    this.spawnEnemy(characterClass, position);
    this.enemiesSpawnedInWave++;
  }

  private checkWaveCompletion(): void {
    const wave = this.getCurrentWave();
    if (!wave || !this.isWaveActive) return;

    // Wave is complete when all enemies spawned and all killed
    if (this.enemiesSpawnedInWave >= wave.totalEnemyCount && this.activeEnemyCount === 0) {
      this.isWaveActive = false;
      this.events.onWaveComplete?.(wave.waveNumber);

      // Move to next wave
      this.currentWaveIndex++;

      const delayBetweenWaves = this.config.waveConfig?.delayBetweenWaves ?? 3000;
      this.scene.time.delayedCall(delayBetweenWaves, () => {
        this.startNextWave();
      });
    }
  }

  // ============================================================================
  // CONTINUOUS MODE METHODS
  // ============================================================================

  private startContinuousMode(): void {
    this.currentTierIndex = 0;
    this.startSpawnTimer();

    // Check for tier changes every second
    this.scene.time.addEvent({
      delay: 1000,
      callback: () => this.checkTierChange(),
      loop: true,
    });
  }

  private getCurrentTier(): DifficultyTier | undefined {
    if (!this.config.continuousConfig) return undefined;

    const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
    const tiers = this.config.continuousConfig.tiers;

    // Find the appropriate tier based on elapsed time
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= tiers[i].startTime) {
        return tiers[i];
      }
    }

    return tiers[0];
  }

  private checkTierChange(): void {
    if (!this.config.continuousConfig) return;

    const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
    const tiers = this.config.continuousConfig.tiers;

    for (let i = 0; i < tiers.length; i++) {
      if (elapsedSeconds >= tiers[i].startTime && i > this.currentTierIndex) {
        this.currentTierIndex = i;
        this.events.onDifficultyChange?.(i);

        // Restart spawn timer with new interval
        this.spawnTimer?.remove();
        this.startSpawnTimer();
        break;
      }
    }
  }

  private startSpawnTimer(): void {
    const tier = this.getCurrentTier();
    if (!tier) return;

    this.spawnTimer = this.scene.time.addEvent({
      delay: tier.spawnInterval,
      callback: () => this.trySpawnContinuousEnemy(),
      loop: true,
    });

    // Spawn first enemy immediately
    this.trySpawnContinuousEnemy();
  }

  private trySpawnContinuousEnemy(): void {
    const tier = this.getCurrentTier();
    if (!tier) return;

    // Check if we're at max concurrent enemies
    if (this.activeEnemyCount >= tier.maxConcurrent) {
      return;
    }

    // Spawn enemy
    const characterClass = this.selectEnemyFromPool(tier.enemies);
    const position = this.getRandomGridPosition();

    this.spawnEnemy(characterClass, position);
  }

  // ============================================================================
  // SHARED HELPER METHODS
  // ============================================================================

  private selectEnemyFromPool(enemies: EnemySpawn[]): CharacterClass {
    // Calculate total weight
    const totalWeight = enemies.reduce((sum, e) => sum + e.weight, 0);

    // Random selection based on weights
    let random = Math.random() * totalWeight;

    for (const enemy of enemies) {
      random -= enemy.weight;
      if (random <= 0) {
        return enemy.characterClass;
      }
    }

    // Fallback to first enemy
    return enemies[0].characterClass;
  }

  private getRandomGridPosition(): { x: number; y: number } {
    const { gameWidth, gameHeight, gameAreaOffsetX, gameAreaOffsetY, gridMarginLeft, gridMarginTop, gridWidth, gridHeight, isPortrait } = this.gameConfig;

    // For smartphone (portrait), spread characters across FULL GRID area
    // For laptop (landscape), use centered grid positioning
    if (isPortrait) {
      // Smartphone: Use FULL canvas width/height with minimal padding for absolute maximum spread
      const { canvasWidth, canvasHeight } = this.gameConfig;
      const padding = 20;

      return {
        x: padding + Math.random() * (canvasWidth - padding * 2),
        y: padding + Math.random() * (canvasHeight - 300) // Keep away from bottom UI
      };
    } else {
      // Laptop: Wider grid system for better spread
      // Use column 1-5 and row 1-3 with random variation
      const column = 1 + Math.random() * 4; // 1.0 to 5.0
      const row = 1 + Math.random() * 2;    // 1.0 to 3.0

      const x = gameAreaOffsetX + gridMarginLeft + ((column - 0.5) / 5) * gridWidth;
      const y = gameAreaOffsetY + gridMarginTop + ((row - 0.5) / 3) * gridHeight;

      return { x, y };
    }
  }

  private spawnEnemy(characterClass: CharacterClass, position: { x: number; y: number }): void {
    this.activeEnemyCount++;
    this.events.onSpawnEnemy(characterClass, position);
  }
}
