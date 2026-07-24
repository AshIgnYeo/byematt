"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureServiceWorker, isIos } from "@/lib/pwa";

/**
 * The opt-in strip for push notifications.
 *
 * Everything about this is browser-permission choreography, so it renders what
 * it actually found rather than a button that might not work: on iOS, push only
 * exists inside a home-screen app, and everywhere it needs a secure origin —
 * which the LAN-over-HTTP dev setup is not.
 */
type Mode =
  | "checking"
  | "insecure" // http:// on a phone — no service worker, no push
  | "install" // iOS Safari, not added to the home screen yet
  | "unsupported"
  | "blocked" // permission denied; only the browser's settings can undo it
  | "off"
  | "on"
  | "busy";

/** VAPID keys travel as base64url; PushManager wants the raw bytes. */
function decodeKey(base64: string): Uint8Array {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

async function sync(subscription: PushSubscription): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}

export function PushAlerts() {
  const [mode, setMode] = useState<Mode>("checking");
  const [error, setError] = useState("");

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!PUBLIC_KEY) {
      setMode("unsupported"); // server never generated keys; stay quiet
      return;
    }

    if (!window.isSecureContext) {
      setMode("insecure");
      return;
    }

    if (!supported) {
      // On an iPhone that means the browser tab, not the home-screen app —
      // which is exactly the thing that unlocks push.
      setMode(isIos() ? "install" : "unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setMode("blocked");
      return;
    }

    let alive = true;

    (async () => {
      const registration = await ensureServiceWorker();
      if (!alive) return;

      if (!registration) {
        setMode("unsupported");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      if (!alive) return;

      if (existing) {
        // Re-post it: the endpoint outlives the database, so this is what puts
        // everyone back on the list after the schema is reset.
        await sync(existing);
        if (alive) setMode("on");
      } else {
        setMode("off");
      }
    })();

    return () => {
      alive = false;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    setError("");
    setMode("busy");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMode(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required everywhere, and true anyway: every push here shows up.
        userVisibleOnly: true,
        applicationServerKey: decodeKey(PUBLIC_KEY!) as BufferSource,
      });

      await sync(subscription);
      setMode("on");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't turn those on.");
      setMode("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setMode("busy");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
    } finally {
      setMode("off");
    }
  }, []);

  if (mode === "checking" || mode === "unsupported") return null;

  if (mode === "on") {
    return (
      <Strip>
        <span className="text-muted">🔔 Alerts on</span>
        <button
          type="button"
          onClick={disable}
          className="font-bold text-muted underline underline-offset-2"
        >
          Turn off
        </button>
      </Strip>
    );
  }

  if (mode === "install") {
    return (
      <Note>
        <span className="font-bold text-flash">Want the buzz?</span> Tap Share →{" "}
        <span className="font-bold">Add to Home Screen</span>, then open ByeMatt
        from there. iPhones only allow alerts for the installed app.
      </Note>
    );
  }

  if (mode === "insecure") {
    return (
      <Note>
        Alerts need an <span className="font-bold">https://</span> address. Over
        plain wifi the game still works — you just won&rsquo;t get buzzed.
      </Note>
    );
  }

  if (mode === "blocked") {
    return (
      <Note>
        Notifications are blocked for this site. Turn them back on in your
        browser&rsquo;s settings for this page.
      </Note>
    );
  }

  return (
    <div className="border-b border-edge bg-panel px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-snug">
          <span className="font-bold">Get buzzed</span>
          <span className="text-muted">
            {" "}
            — every shot that lands, and every time Matt owes one.
          </span>
        </p>
        <button
          type="button"
          onClick={enable}
          disabled={mode === "busy"}
          className="shrink-0 rounded-full bg-flash px-4 py-2 text-xs font-black uppercase tracking-wide text-ink disabled:opacity-50"
        >
          {mode === "busy" ? "…" : "Alerts on"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-2 text-xs">
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-edge px-4 py-3 text-xs leading-relaxed text-muted">
      {children}
    </p>
  );
}
