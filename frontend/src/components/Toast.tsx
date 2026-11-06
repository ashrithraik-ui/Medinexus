import { useEffect } from "react";
import { Bell } from "lucide-react";

export function Toast({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed right-5 top-5 z-[2000] w-[min(92vw,380px)] rounded-2xl border border-rose-400/30 bg-navy-800 p-4 shadow-glow">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-rose-500/20 p-2 text-rose-300">
          <Bell size={16} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-300">{body}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}
