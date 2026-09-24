import { describe, expect, it, vi } from 'vitest';
import { createRenderScheduler } from './renderScheduler';

describe('render scheduler', () => {
  it('coalesces invalidations and stops requesting frames after an idle render', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    const request = vi.fn((callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
    const cancel = vi.fn((id: number) => { frames.delete(id); });
    const render = vi.fn(() => false);
    const scheduler = createRenderScheduler(render, request, cancel);

    scheduler.schedule();
    scheduler.schedule();
    expect(request).toHaveBeenCalledTimes(1);
    frames.get(1)!(0);
    frames.delete(1);
    expect(render).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);

    scheduler.schedule();
    expect(request).toHaveBeenCalledTimes(2);
    scheduler.stop();
    expect(cancel).toHaveBeenCalledWith(2);
    expect(frames.size).toBe(0);
  });

  it('keeps rendering while active and stops when the work settles', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    let renders = 0;
    const scheduler = createRenderScheduler(
      () => ++renders < 3,
      callback => { frames.set(++nextId, callback); return nextId; },
      id => { frames.delete(id); },
    );

    scheduler.schedule();
    for (let id = 1; id <= 3; id++) {
      const callback = frames.get(id)!;
      frames.delete(id);
      callback(0);
    }
    expect(renders).toBe(3);
    expect(frames.size).toBe(0);
    scheduler.schedule();
    expect(frames.size).toBe(1);
    scheduler.stop();
    expect(frames.size).toBe(0);
  });
});
