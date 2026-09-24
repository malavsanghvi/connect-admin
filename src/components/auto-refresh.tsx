"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the page from the server every `seconds`, and shows when it last did. */
export function AutoRefresh({ seconds = 20, timeZone }: { seconds?: number; timeZone: string }) {
  const router = useRouter();
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone }).format(new Date());
    const first = setTimeout(() => setStamp(fmt()), 0);
    const t = setInterval(() => {
      router.refresh();
      setStamp(fmt());
    }, seconds * 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [router, seconds, timeZone]);
  return (
    <p className="text-xs text-muted" aria-live="off">
      Updates every {seconds}s{stamp ? ` · last ${stamp}` : ""}
    </p>
  );
}
