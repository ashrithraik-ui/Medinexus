export function StatusBadge({ value }: { value: string }) {
  const color =
    value.includes("READY") || value.includes("GREEN") || value === "ACCEPTED" || value === "ARRIVED" || value === "IDLE"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/20"
      : value.includes("RED") || value === "DECLINED" || value === "UNAVAILABLE"
        ? "bg-rose-500/15 text-rose-300 border-rose-400/20"
        : value.includes("YELLOW") || value === "LIMITED" || value === "PENDING_HOSPITAL"
          ? "bg-orange-500/15 text-orange-300 border-orange-400/20"
          : value === "EMERGENCY_PRIORITY" || value === "EN_ROUTE"
            ? "bg-teal-500/15 text-teal-300 border-teal-400/20"
            : "bg-sky-500/15 text-sky-300 border-sky-400/20";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${color}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
