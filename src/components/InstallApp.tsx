"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureServiceWorker, isIos, isStandalone } from "@/lib/pwa";

/**
 * The home-screen nudge on the join screen.
 *
 * There is no such thing as an install link — a page can't install itself. What
 * exists is Chromium's `beforeinstallprompt`, which hands over a one-shot prompt
 * we can fire from a tap. But it's unreliable: Brave often suppresses it, and
 * Chrome only fires it after an engagement heuristic and never before mount. So
 * a one-tap button can't be the only path, or Android users see nothing.
 *
 * The fallback is therefore the default on Android — written instructions for
 * the ⋮ menu — and the button *upgrades* over it if and when the event arrives.
 * iOS gets the Share-sheet steps; nothing programmatic exists there at all.
 *
 * It sits above the form on purpose. An iOS home-screen app gets its own cookie
 * jar, so anyone who signs in here first has to sign in again inside the app.
 */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const isAndroid = () =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

// "manual" = show the menu instructions; "prompt" = we captured the one-tap event.
type Mode = "checking" | "installed" | "prompt" | "ios" | "manual" | "none";

export function InstallApp() {
  const [mode, setMode] = useState<Mode>("checking");
  const [busy, setBusy] = useState(false);
  const deferred = useRef<InstallEvent | null>(null);

  useEffect(() => {
    // Registering here is what makes the landing page itself installable.
    ensureServiceWorker();

    if (isStandalone()) {
      setMode("installed");
      return;
    }

    // Android's floor is the menu instructions; if the event later fires it
    // upgrades to the button. Other browsers (desktop) get nothing until it does.
    setMode(isIos() ? "ios" : isAndroid() ? "manual" : "none");

    // Chromium fires this whenever it decides the app qualifies, which may be
    // after this component has already mounted — hence a listener, not a check.
    function onPrompt(event: Event) {
      event.preventDefault(); // suppress Chrome's own mini-infobar
      deferred.current = event as InstallEvent;
      setMode("prompt");
    }

    function onInstalled() {
      deferred.current = null;
      setMode("installed");
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = deferred.current;
    if (!event) return;

    setBusy(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      // The prompt is single-use whichever way they answered; Chrome will offer
      // a fresh one later if it feels like it. If they dismissed, drop back to
      // the menu instructions rather than a blank space.
      deferred.current = null;
      setMode(
        outcome === "accepted" ? "installed" : isAndroid() ? "manual" : "none",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  if (mode === "checking" || mode === "none" || mode === "installed") return null;

  if (mode === "manual") {
    // Reached only after mount, so window is safe to read here.
    const secure = window.isSecureContext;
    return (
      <Panel>
        {secure ? (
          <>
            <p className="leading-relaxed">
              <span className="font-bold text-flash">Add it to your home screen</span>{" "}
              for alerts and a proper icon: open the{" "}
              <span className="font-bold">⋮</span> menu, then{" "}
              <span className="font-bold">Add to Home screen</span> on Brave, or{" "}
              <span className="font-bold">Install app</span> on Chrome.
            </p>
            <p className="mt-2 leading-relaxed text-muted">
              Brave doesn&rsquo;t always pop this up on its own — the menu is the
              way that always works.
            </p>
          </>
        ) : (
          <p className="leading-relaxed">
            To install this you need the{" "}
            <span className="font-bold text-flash">https://</span> link — a local{" "}
            <span className="font-bold">http://</span> address can&rsquo;t be added
            as an app. Open that, then ⋮ → <span className="font-bold">Add to Home
            screen</span>.
          </p>
        )}
      </Panel>
    );
  }

  if (mode === "ios") {
    return (
      <Panel>
        <p className="leading-relaxed">
          <span className="font-bold text-flash">On iPhone:</span> tap Share, then{" "}
          <span className="font-bold">Add to Home Screen</span>, and join from that
          icon instead. The installed app signs in separately — and it&rsquo;s the
          only place iOS will send you alerts.
        </p>
        <p className="mt-2 leading-relaxed text-muted">
          No Share button? You&rsquo;re in a chat app&rsquo;s built-in browser —
          open the link in Safari first.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <p className="leading-relaxed">
          <span className="font-bold text-flash">Add it to your home screen</span>{" "}
          for alerts and a proper icon.
        </p>
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="shrink-0 rounded-full bg-flash px-4 py-2 text-xs font-black uppercase tracking-wide text-ink disabled:opacity-50"
        >
          {busy ? "…" : "Install"}
        </button>
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-edge bg-panel px-4 py-3 text-sm">
      {children}
    </section>
  );
}
