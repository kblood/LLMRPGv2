import { Delta, DeltaOperation, DeltaTarget } from '../types/state';

export interface DeltaRequest {
  target: DeltaTarget;
  operation: DeltaOperation;
  path: string[];
  previousValue: any;
  newValue: any;
  cause: string;
  eventId: string;
}

export class DeltaCollector {
  private deltas: Delta[] = [];
  private sessionId: string;
  private turnId: number;

  constructor(sessionId: string, turnId: number) {
    this.sessionId = sessionId;
    this.turnId = turnId;
  }

  collect(request: DeltaRequest): Delta {
    const sequence = this.deltas.length + 1;
    const deltaId = `${this.sessionId}-${this.turnId}-${sequence}`;

    const delta: Delta = {
      deltaId,
      turnId: this.turnId,
      sequence,
      timestamp: Date.now(),
      ...request,
    };

    this.deltas.push(delta);
    return delta;
  }

  getDeltas(): Delta[] {
    return [...this.deltas];
  }

  clear(): void {
    this.deltas = [];
  }
}
