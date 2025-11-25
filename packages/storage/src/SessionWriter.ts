import { FileSystemAdapter } from './FileSystemAdapter';
import { Turn, Delta } from '@llmrpg/core';
import path from 'path';

export class SessionWriter {
  constructor(private adapter: FileSystemAdapter) {}

  private getSessionPath(sessionId: string): string {
    return path.join('sessions', 'active', sessionId);
  }

  async createSession(sessionId: string, metadata: any): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    await this.adapter.ensureDir(sessionPath);
    await this.adapter.ensureDir(path.join(sessionPath, 'scenes'));
    await this.adapter.ensureDir(path.join(sessionPath, 'turns'));
    await this.adapter.ensureDir(path.join(sessionPath, 'deltas'));
    await this.adapter.ensureDir(path.join(sessionPath, 'snapshots'));
    
    await this.adapter.writeJson(path.join(sessionPath, 'session.meta.json'), metadata);
  }

  async writeTurn(sessionId: string, turn: Turn): Promise<void> {
    const chunkIndex = Math.floor((turn.turnId - 1) / 100);
    const start = chunkIndex * 100 + 1;
    const end = (chunkIndex + 1) * 100;
    const filename = `turns-${start.toString().padStart(4, '0')}-${end.toString().padStart(4, '0')}.jsonl`;
    
    const filePath = path.join(this.getSessionPath(sessionId), 'turns', filename);
    await this.adapter.appendLine(filePath, JSON.stringify(turn));
  }

  async writeDelta(sessionId: string, delta: Delta): Promise<void> {
    // Deltas are also chunked by turn number for easier correlation
    const chunkIndex = Math.floor((delta.turnId - 1) / 100);
    const start = chunkIndex * 100 + 1;
    const end = (chunkIndex + 1) * 100;
    const filename = `deltas-${start.toString().padStart(4, '0')}-${end.toString().padStart(4, '0')}.jsonl`;

    const filePath = path.join(this.getSessionPath(sessionId), 'deltas', filename);
    await this.adapter.appendLine(filePath, JSON.stringify(delta));
  }

  async saveSnapshot(sessionId: string, turnId: number, state: any): Promise<void> {
    const filename = `snapshot-turn-${turnId.toString().padStart(4, '0')}.json`;
    const filePath = path.join(this.getSessionPath(sessionId), 'snapshots', filename);
    await this.adapter.writeJson(filePath, state);
  }

  async updateCurrentState(sessionId: string, worldState: any, playerState: any): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    await this.adapter.writeJson(path.join(sessionPath, 'world.state.json'), worldState);
    await this.adapter.writeJson(path.join(sessionPath, 'player.state.json'), playerState);
  }
}
