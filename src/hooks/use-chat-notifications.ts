import { useEffect, useRef, useCallback } from "react";

/**
 * Encapsulates browser side-effects for new chat messages from the team leader:
 *  - Plays a short ping (Web Audio API, no asset needed)
 *  - Shows a native Notification when the tab is hidden / not focused
 *  - Blinks the tab title while there are unread messages
 *
 * SSR-safe: all `window`/`document` access happens inside effects or callbacks.
 */
export function useChatNotifications(opts: {
  unread: number;
  enabled: boolean;
}) {
  const { unread, enabled } = opts;
  const originalTitle = useRef<string>("");
  const blinkInterval = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const permissionRequested = useRef(false);

  /* ── Ping via WebAudio (no asset file) ───────────────────── */
  const playPing = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx.current) audioCtx.current = new Ctx();
      const ctx = audioCtx.current!;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      // Two-tone "ping"
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* ignore – browser may block audio without user gesture */
    }
  }, []);

  /* ── Native Notification ─────────────────────────────────── */
  const notify = useCallback(
    (title: string, body: string, icon?: string) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (!document.hidden) return; // only when tab not focused
      try {
        const n = new Notification(title, { body, icon, tag: "team-leader-chat" });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* ignore */
      }
    },
    []
  );

  /* ── Request permission once when user enables chat ──────── */
  const requestPermission = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (permissionRequested.current) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    permissionRequested.current = true;
  }, []);

  /* ── Trigger: new incoming message ───────────────────────── */
  const trigger = useCallback(
    (msg: { body: string; senderName: string; icon?: string }) => {
      if (!enabled) return;
      playPing();
      notify(msg.senderName, msg.body, msg.icon);
    },
    [enabled, playPing, notify]
  );

  /* ── Tab-Title-Blink ─────────────────────────────────────── */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!originalTitle.current) originalTitle.current = document.title;

    const stop = () => {
      if (blinkInterval.current) {
        window.clearInterval(blinkInterval.current);
        blinkInterval.current = null;
      }
      if (originalTitle.current) document.title = originalTitle.current;
    };

    if (!enabled || unread <= 0) {
      stop();
      return;
    }

    // Only blink while tab is hidden
    const startIfHidden = () => {
      if (!document.hidden) {
        stop();
        return;
      }
      if (blinkInterval.current) return;
      let toggle = false;
      blinkInterval.current = window.setInterval(() => {
        document.title = toggle
          ? originalTitle.current
          : `(${unread}) Neue Nachricht – ${originalTitle.current}`;
        toggle = !toggle;
      }, 1000);
    };

    startIfHidden();
    const onVisibility = () => startIfHidden();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", stop);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", stop);
    };
  }, [unread, enabled]);

  return { trigger, requestPermission };
}
