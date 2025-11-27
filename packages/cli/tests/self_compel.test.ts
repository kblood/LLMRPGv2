import { describe, it, expect, beforeEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');

describe('Self-Compel System', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;
  let sessionWriter: SessionWriter;
  let sessionLoader: SessionLoader;
  let sessionId: string;

  beforeEach(async () => {
    sessionId = `self-compel-test-${Date.now()}`;
    
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    
    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    sessionWriter = new SessionWriter(fsAdapter);
    sessionLoader = new SessionLoader(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
      startTime: Date.now(),
      player: 'Test Player'
    });
    
    mockLLM = new MockAdapter();
    gm = new GameMaster(sessionId, mockLLM, sessionWriter, sessionLoader);
    
    await gm.initializeWorld('Dark Fantasy');
    await gm.createCharacter('A clumsy wizard');
    
    // Add trouble aspect and set FP
    if ((gm as any).player) {
      (gm as any).player.aspects.push({
        id: 'aspect-clumsy',
        name: 'Clumsy',
        type: 'trouble',
        description: 'Prone to accidents',
        freeInvokes: 0
      });
      (gm as any).player.fatePoints.current = 3;
    }
    
    await gm.start();
  });

  it('should award FP for self-compel', async () => {
    (gm as any).decisionEngine.classifyIntent = async () => 'self_compel';
    (gm as any).decisionEngine.parseSelfCompel = async () => ({
      aspectName: 'Clumsy',
      description: 'I trip over my own robes.'
    });
    
    const initialFP = (gm as any).player?.fatePoints.current || 0;
    
    const result = await gm.processPlayerAction('I compel my Clumsy aspect to trip.') as any;
    
    expect(result.result).toBe('success');
    expect((gm as any).player?.fatePoints.current).toBe(initialFP + 1);
  });

  it('should log self-compel event with player source', async () => {
    (gm as any).decisionEngine.classifyIntent = async () => 'self_compel';
    (gm as any).decisionEngine.parseSelfCompel = async () => ({
      aspectName: 'Clumsy',
      description: 'I trip over my own robes.'
    });
    
    await gm.processPlayerAction('I compel my Clumsy aspect to trip.');
    
    const lastTurn = (gm as any).history[(gm as any).history.length - 1];
    const compelEvent = lastTurn.events.find((e: any) => e.type === 'fate_compel' && e.action === 'self_compel');
    
    expect(compelEvent).toBeDefined();
    expect(compelEvent?.metadata?.source).toBe('player');
  });

  it('should fail if aspect does not exist', async () => {
    (gm as any).decisionEngine.classifyIntent = async () => 'self_compel';
    (gm as any).decisionEngine.parseSelfCompel = async () => ({
      aspectName: 'NonexistentAspect',
      description: 'Something happens.'
    });
    
    const result = await gm.processPlayerAction('I compel my NonexistentAspect.') as any;
    
    expect(result.result).toBe('failure');
  });
});
