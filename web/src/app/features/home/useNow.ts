import { useEffect, useState } from 'react';

/** The current time, refreshed every `interval` milliseconds while the component is mounted. */
export function useNow(interval = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}
