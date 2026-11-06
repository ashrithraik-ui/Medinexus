import { useEffect, useState } from "react";

export function LiveClock({
  showSeconds = true,
  className = "",
}: {
  showSeconds?: boolean;
  className?: string;
}) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    function update() {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          ...(showSeconds ? { second: "2-digit" } : {}),
          hour12: true,
        })
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [showSeconds]);

  return <span className={className}>{timeStr}</span>;
}

export function formatTimeAmPm(dateInput?: string | number | Date | null) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function calculateEtaAmPm(etaMinutes: number) {
  const target = new Date(Date.now() + Math.max(1, etaMinutes) * 60000);
  return target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

