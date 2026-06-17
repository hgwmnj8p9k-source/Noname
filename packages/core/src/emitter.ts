import type { EngineEvent, EngineEventListener } from './domain/events.js';

/** A tiny, typed, synchronous event emitter used by the engine. */
export class EventEmitter {
  private readonly listeners = new Set<EngineEventListener>();

  on(listener: EngineEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: EngineEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A misbehaving listener must never break the engine loop.
      }
    }
  }
}
