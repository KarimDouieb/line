import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

const SCRIPT_SRC = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";
const VISIBLE_PATHS = new Set(["/about", "/export"]);

/**
 * The vendor script only builds its button inside a
 * `window.addEventListener("DOMContentLoaded", …)` callback, and registers
 * that listener as a permanent global side effect every time it executes —
 * removing the `<script>` tag again doesn't undo it. An earlier version of
 * this component mounted/unmounted the script per route, which meant every
 * navigation into About or Export left one more stale listener registered,
 * and the next synthetic DOMContentLoaded dispatch fired all of them at
 * once, one extra floating button per visit. So instead: load the vendor
 * script exactly once for the app's whole lifetime (module-level guard),
 * and just show/hide the one button it ever creates based on the route.
 */
let loaded = false;

function loadWidgetOnce() {
  if (loaded) return;
  loaded = true;

  const script = document.createElement("script");
  script.src = SCRIPT_SRC;
  script.dataset.name = "BMC-Widget";
  script.dataset.cfasync = "false";
  script.dataset.id = "karim_douieb";
  script.dataset.description = "Support me on Buy Me a Coffee!";
  script.dataset.message = "If Line's been useful, a coffee helps cover hosting and keeps it free.";
  script.dataset.color = "#b4432e";
  script.dataset.position = "Right";
  script.dataset.x_margin = "18";
  script.dataset.y_margin = "18";
  script.onload = () => {
    // The real DOMContentLoaded already fired long before this dynamically
    // injected script existed, so its listener would otherwise never run.
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  };
  document.body.appendChild(script);
}

/** Mount once at the app root — shows the floating button only on About/Export, everywhere else it's hidden (not unmounted). */
export function BuyMeACoffeeWidget() {
  const pathname = useLocation({ select: (l) => l.pathname });

  useEffect(loadWidgetOnce, []);

  useEffect(() => {
    const visible = VISIBLE_PATHS.has(pathname);
    const apply = () => {
      // The vendor script sets its own inline `display: flex` (for centering
      // the icon) when it creates this button — clearing back to "" instead
      // of restoring "flex" would fall through to a bare <div>'s default
      // `block`, breaking that centering.
      const btn = document.getElementById("bmc-wbtn");
      if (btn) btn.style.display = visible ? "flex" : "none";

      // The auto-popup message bubble (data-message) is a completely
      // separate element from the button, created and shown on its own
      // timer regardless of the button's visibility — it needs the same
      // route gating or it shows up everywhere, including mid-draw.
      const iframe = document.getElementById("bmc-iframe");
      if (iframe) iframe.style.display = visible ? "block" : "none";
      const closeBtn = document.getElementById("bmc-close-btn");
      if (closeBtn) closeBtn.style.display = visible ? "flex" : "none";
    };
    apply();
    // The button is created asynchronously (script load -> dispatch -> DOM
    // insert), so on the very first render it may not exist yet — watch for
    // it instead of guessing a timeout.
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
