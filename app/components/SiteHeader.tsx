"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sticky site header that auto-hides while scrolling down in mobile landscape.
 * On desktop and mobile portrait the header is always visible.
 */
export default function SiteHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const isLandscape = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(
      "(max-width: 1023px) and (orientation: landscape)"
    );

    isLandscape.current = mq.matches;

    function onMQChange(e: MediaQueryListEvent) {
      isLandscape.current = e.matches;
      // Reset when rotating out of landscape so the header is never stuck hidden
      if (!e.matches) setHidden(false);
    }

    function onScroll() {
      if (!isLandscape.current) return;

      const y = window.scrollY;

      if (y <= 10) {
        // Always show at the very top
        setHidden(false);
      } else if (y > lastScrollY.current + 4) {
        // Scrolling down — hide
        setHidden(true);
      } else if (y < lastScrollY.current - 4) {
        // Scrolling up — reveal
        setHidden(false);
      }

      lastScrollY.current = y;
    }

    mq.addEventListener("change", onMQChange);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      mq.removeEventListener("change", onMQChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={[
        // Desktop + landscape: sticky so it stays visible / can hide on scroll.
        // Portrait mobile: relative (non-sticky) so it scrolls away and the map
        // can become the top-most visible element.
        "sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md",
        "mobile-portrait:relative mobile-portrait:top-auto",
        "transition-transform duration-200 ease-in-out",
        hidden ? "-translate-y-full" : "translate-y-0",
      ].join(" ")}
    >
      {children}
    </header>
  );
}
