// Section imports still in flight. Tests wait for them, so no import outlives its test file and fails at
// environment teardown.
const inFlight = new Set<Promise<unknown>>();

export function track<T>(load: Promise<T>): Promise<T> {
  inFlight.add(load);
  load.then(
    () => inFlight.delete(load),
    () => inFlight.delete(load),
  );
  return load;
}

export function settled(): Promise<unknown> {
  return Promise.allSettled(inFlight);
}
