/**
 * Heartbeat Configuration
 *
 * Parses and manages heartbeat.yml configuration.
 */
import type { HeartbeatConfig, AgentDatabase } from "../types.js";
/**
 * Load heartbeat config from YAML file, falling back to defaults.
 */
export declare function loadHeartbeatConfig(configPath?: string): HeartbeatConfig;
/**
 * Save heartbeat config to YAML file.
 */
export declare function saveHeartbeatConfig(config: HeartbeatConfig, configPath?: string): void;
/**
 * Write the default heartbeat.yml file.
 */
export declare function writeDefaultHeartbeatConfig(configPath?: string): void;
/**
 * Sync heartbeat entries from YAML config into the database.
 */
export declare function syncHeartbeatToDb(config: HeartbeatConfig, db: AgentDatabase): void;
//# sourceMappingURL=config.d.ts.map