import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');

describe('Boost System', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;
  let sessionWriter: SessionWriter;
  let sessionLoader: SessionLoader;
  let sessionId: string;

  beforeEach(async () => {
    sessionId = `boost-test-${Date.now()}`;
    
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
    await gm.createCharacter('A skilled rogue');
    await gm.start();
  });

  it('should create a boost on success with style', async () => {
    // Mock for success with style: roll +4 against difficulty 0 = +4 shifts
    (gm as any).decisionEngine.classifyIntent = async () => 'fate_action';
    (gm as any).decisionEngine.classifyAction = async () => 'overcome';
    (gm as any).decisionEngine.selectSkill = async () => ({ name: 'Athletics', rating: 4 });
    (gm as any).decisionEngine.setOpposition = async () => 0;
    (gm as any).decisionEngine.identifyTarget = async () => null;
    (gm as any).decisionEngine.generateCompel = async () => null;
    (gm as any).decisionEngine.determineKnowledgeGain = async () => null;
    (gm as any).decisionEngine.determineQuestUpdate = async () => null;
    (gm as any).decisionEngine.determineWorldUpdates = async () => [];
    (gm as any).decisionEngine.generateBoostName = async () => 'Momentum';
    (gm as any).fateDice.roll = () => ({ dice: [1, 1, 1, 1], total: 4 }); // +4 roll

    const result = await gm.processPlayerAction('I gracefully dodge the attack.');
    
    expect(result.result).toBe('success_with_style');
    
    const player = (gm as any).player;
    const boost = player?.aspects.find((a: any) => a.type === 'boost');
    
    expect(boost).toBeDefined();
    expect(boost?.name).toBe('Momentum');
    expect(boost?.freeInvokes).toBe(1);
  });

  it('should remove boost after use', async () => {
    // First create a boost
    (gm as any).decisionEngine.classifyIntent = async () => 'fate_action';
    (gm as any).decisionEngine.classifyAction = async () => 'overcome';
    (gm as any).decisionEngine.selectSkill = async () => ({ name: 'Athletics', rating: 4 });
    (gm as any).decisionEngine.setOpposition = async () => 0;
    (gm as any).decisionEngine.identifyTarget = async () => null;
    (gm as any).decisionEngine.generateCompel = async () => null;
    (gm as any).decisionEngine.determineKnowledgeGain = async () => null;
    (gm as any).decisionEngine.determineQuestUpdate = async () => null;
    (gm as any).decisionEngine.determineWorldUpdates = async () => [];
    (gm as any).decisionEngine.generateBoostName = async () => 'Momentum';
    (gm as any).fateDice.roll = () => ({ dice: [1, 1, 1, 1], total: 4 });

    await gm.processPlayerAction('I gracefully dodge the attack.');
    
    const player = (gm as any).player;
    const boost = player?.aspects.find((a: any) => a.type === 'boost');
    expect(boost).toBeDefined();
    
    // Now use the boost
    (gm as any).fateDice.roll = () => ({ dice: [0, 0, 0, 0], total: 0 });
    
    await gm.processAIPlayerAction('I strike back!', 'Using my momentum', 0, [
      { aspectName: boost.name, bonus: '+2' }
    ]);
    
    const playerAfter = (gm as any).player;
    const boostAfter = playerAfter?.aspects.find((a: any) => a.id === boost.id);
    
    // Boost should be removed after use
    expect(boostAfter).toBeUndefined();
  });
});
