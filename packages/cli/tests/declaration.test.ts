
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('@llmrpg/storage');
vi.mock('@llmrpg/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    TurnManager: vi.fn().mockImplementation(() => {
        let currentTurn: any = null;
        return {
            startTurn: vi.fn().mockImplementation(() => {
                currentTurn = { turnId: 1, events: [] };
                return currentTurn;
            }),
            addEvent: vi.fn().mockImplementation((type, action, data) => {
                if (currentTurn) {
                    currentTurn.events.push({
                        eventId: 'evt-' + Date.now(),
                        type,
                        action,
                        ...data
                    });
                }
            }),
            getTurn: vi.fn(),
        };
    }),
    DeltaCollector: vi.fn().mockImplementation(() => ({
      collect: vi.fn(),
      getDeltas: vi.fn().mockReturnValue([]),
    })),
    ActionResolver: Object.assign(
        vi.fn().mockImplementation(() => ({})),
        {
            resolve: vi.fn().mockReturnValue({ outcome: 'success', shifts: 2 }),
        }
    ),
    FateDice: vi.fn().mockImplementation(() => ({
      roll: vi.fn().mockReturnValue({ total: 2, faces: [1, 1, 0, 0] }),
    })),
  };
});

describe('Story Declaration System', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;
  let mockWriter: SessionWriter;

  beforeEach(async () => {
    mockLLM = new MockAdapter();
    // Mock SessionWriter and FileSystemAdapter
    const mockFsAdapter = new FileSystemAdapter('test-path');
    mockWriter = new SessionWriter(mockFsAdapter);
    
    // Mock methods on SessionWriter to avoid actual file IO
    mockWriter.updateCurrentState = vi.fn();
    mockWriter.writeTurn = vi.fn();
    mockWriter.writeDelta = vi.fn();

    gm = new GameMaster('test-session', mockLLM, mockWriter);

    // Initialize basic state manually to avoid LLM calls
    (gm as any).worldManager = {
        state: {
            theme: { name: 'test', genre: 'test' },
            locations: {
                'loc-1': {
                    id: 'loc-1',
                    name: 'Test Location',
                    aspects: [],
                    features: []
                }
            },
            time: { value: "0", display: "Day 1" }
        },
        getLocation: (id: string) => (gm as any).worldManager.state.locations[id],
        setTime: vi.fn()
    };

    (gm as any).currentScene = {
        id: 'scene-1',
        locationId: 'loc-1',
        name: 'Test Scene'
    };

    (gm as any).player = {
        id: 'player-1',
        name: 'Test Player',
        fatePoints: { current: 3, refresh: 3 },
        aspects: [],
        skills: [],
        inventory: []
    };
  });

  it('should process a valid declaration', async () => {
    // Mock DecisionEngine methods
    (gm as any).decisionEngine.classifyIntent = vi.fn().mockResolvedValue('declaration');
    // parseDeclaration returns a string, not an object
    (gm as any).decisionEngine.parseDeclaration = vi.fn().mockResolvedValue("Hidden Lever");

    const result = await gm.processPlayerAction("I spend a fate point to declare there is a hidden lever behind the bookshelf.");

    expect(result.result).toBe('success');
    expect(result.narration).toContain('You spend a Fate Point to declare');
    
    // Check FP spend
    const player = (gm as any).player;
    expect(player.fatePoints.current).toBe(2); // Started with 3, spent 1

    // Check Aspect creation
    const location = (gm as any).worldManager.getLocation('loc-1');
    const aspect = location.aspects.find((a: any) => a.name === "Hidden Lever");
    expect(aspect).toBeDefined();
    expect(aspect?.type).toBe('situational');
  });

  it('should fail declaration if insufficient Fate Points', async () => {
    // Set FP to 0
    if ((gm as any).player) {
        (gm as any).player.fatePoints.current = 0;
    }

    // Mock DecisionEngine methods
    (gm as any).decisionEngine.classifyIntent = vi.fn().mockResolvedValue('declaration');

    const result = await gm.processPlayerAction("I declare there is a secret door.");

    expect(result.result).toBe('failure');
    expect(result.narration).toContain("don't have enough Fate Points");
  });

  it('should fail if declaration is unclear', async () => {
    // Mock DecisionEngine methods
    (gm as any).decisionEngine.classifyIntent = vi.fn().mockResolvedValue('declaration');
    (gm as any).decisionEngine.parseDeclaration = vi.fn().mockResolvedValue(null); // LLM fails to parse

    const result = await gm.processPlayerAction("I declare something.");

    expect(result.result).toBe('failure');
    expect(result.narration).toContain("unsure what fact you are trying to declare");
    
    // Check FP not spent
    const player = (gm as any).player;
    expect(player.fatePoints.current).toBe(3);
  });
});
