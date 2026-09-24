export function createRenderScheduler(
  renderFrame: () => boolean,
  requestFrame: (callback: FrameRequestCallback) => number = callback => requestAnimationFrame(callback),
  cancelFrame: (handle: number) => void = handle => cancelAnimationFrame(handle),
) {
  let pending: number | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped || pending !== null) return;
    pending = requestFrame(() => {
      pending = null;
      if (stopped) return;
      if (renderFrame()) schedule();
    });
  };

  const stop = () => {
    stopped = true;
    if (pending !== null) cancelFrame(pending);
    pending = null;
  };

  return { schedule, stop };
}
