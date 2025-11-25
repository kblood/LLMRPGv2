import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemAdapter } from '../src/FileSystemAdapter';
import { SessionWriter } from '../src/SessionWriter';
import { SessionLoader } from '../src/SessionLoader';
import { Turn } from '@llmrpg/core';
import fs from 'fs-extra';
import path from 'path';

const TEST_DIR = path.join(__dirname, 'test-data');

describe('Storage System', () => {
  let adapter: FileSystemAdapter;
  let writer: SessionWriter;
  let loader: SessionLoader;

  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
    adapter = new FileSystemAdapter(TEST_DIR);
    writer = new SessionWriter(adapter);
    loader = new SessionLoader(adapter);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should create a session structure', async () => {
    const sessionId = 'test-session';
    await writer.createSession(sessionId, { created: Date.now() });

    const sessionPath = path.join(TEST_DIR, 'sessions', 'active', sessionId);
    expect(await fs.pathExists(path.join(sessionPath, 'session.meta.json'))).toBe(true);
    expect(await fs.pathExists(path.join(sessionPath, 'turns'))).toBe(true);
    expect(await fs.pathExists(path.join(sessionPath, 'deltas'))).toBe(true);
  });

  it('should write and read turns', async () => {
    const sessionId = 'test-session';
    await writer.createSession(sessionId, {});

    const turn: Turn = {
      turnId: 1,
      turnNumber: 1,
      actor: 'player',
      sceneId: 'scene-1',
      timestamp: Date.now(),
      gameTime: { day: 1, timeOfDay: 'morning', timestamp: 100 },
      events: []
    };

    await writer.writeTurn(sessionId, turn);

    const loadedTurns = await loader.loadTurns(sessionId, 1, 1);
    expect(loadedTurns).toHaveLength(1);
    expect(loadedTurns[0].turnId).toBe(1);
  });
});
