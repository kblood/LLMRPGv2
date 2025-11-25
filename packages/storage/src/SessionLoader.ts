import { FileSystemAdapter } from './FileSystemAdapter';
import { Turn, Delta } from '@llmrpg/core';
import path from 'path';

export class SessionLoader {
  constructor(private adapter: FileSystemAdapter) {}

  private getSessionPath(sessionId: string): string {
    return path.join('sessions', 'active', sessionId);
  }

  async loadSessionMetadata(sessionId: string): Promise<any> {
    return await this.adapter.readJson(path.join(this.getSessionPath(sessionId), 'session.meta.json'));
  }

  async loadCurrentState(sessionId: string): Promise<{ world: any, player: any }> {
    const sessionPath = this.getSessionPath(sessionId);
    const world = await this.adapter.readJson(path.join(sessionPath, 'world.state.json'));
    const player = await this.adapter.readJson(path.join(sessionPath, 'player.state.json'));
    return { world, player };
  }

  async loadTurns(sessionId: string, startTurn: number, endTurn: number): Promise<Turn[]> {
    const turns: Turn[] = [];
    const startChunk = Math.floor((startTurn - 1) / 100);
    const endChunk = Math.floor((endTurn - 1) / 100);

    for (let i = startChunk; i <= endChunk; i++) {
      const start = i * 100 + 1;
      const end = (i + 1) * 100;
      const filename = `turns-${start.toString().padStart(4, '0')}-${end.toString().padStart(4, '0')}.jsonl`;
      const filePath = path.join(this.getSessionPath(sessionId), 'turns', filename);
      
      if (await this.adapter.exists(filePath)) {
        const content = await this.adapter.readFile(filePath);
        const lines = content.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          try {
            const turn = JSON.parse(line) as Turn;
            if (turn.turnId >= startTurn && turn.turnId <= endTurn) {
              turns.push(turn);
            }
          } catch (e) {
            console.error(`Failed to parse turn line in ${filename}`, e);
          }
        }
      }
    }
    
    return turns;
  }

  async loadDeltas(sessionId: string, startTurn: number, endTurn: number): Promise<Delta[]> {
    const deltas: Delta[] = [];
    const startChunk = Math.floor((startTurn - 1) / 100);
    const endChunk = Math.floor((endTurn - 1) / 100);

    for (let i = startChunk; i <= endChunk; i++) {
      const start = i * 100 + 1;
      const end = (i + 1) * 100;
      const filename = `deltas-${start.toString().padStart(4, '0')}-${end.toString().padStart(4, '0')}.jsonl`;
      const filePath = path.join(this.getSessionPath(sessionId), 'deltas', filename);
      
      if (await this.adapter.exists(filePath)) {
        const content = await this.adapter.readFile(filePath);
        const lines = content.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          try {
            const delta = JSON.parse(line) as Delta;
            if (delta.turnId >= startTurn && delta.turnId <= endTurn) {
              deltas.push(delta);
            }
          } catch (e) {
             console.error(`Failed to parse delta line in ${filename}`, e);
          }
        }
      }
    }
    
    return deltas;
  }
}
