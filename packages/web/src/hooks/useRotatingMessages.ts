import { useEffect, useState } from "react";

// Cycles through `messages` on a timer while `active` is true — used to make
// a several-second Claude call feel alive instead of a static "Thinking…"
// that looks identical whether it's working or stuck.
export function useRotatingMessages(
  messages: readonly string[],
  active: boolean,
  intervalMs = 1800
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  return messages[index] ?? messages[0];
}
