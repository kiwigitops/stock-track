import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function InfoTip({ text }: { text: string }) {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; placement: "bottom" | "top"; top: number } | null>(null);

  function showTooltip() {
    const icon = iconRef.current;
    if (!icon) return;

    const rect = icon.getBoundingClientRect();
    const tooltipWidth = Math.min(280, window.innerWidth - 40);
    const tooltipHeight = Math.min(220, window.innerHeight - 24);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + 12),
      window.innerWidth - tooltipWidth / 2 - 12,
    );
    const showAbove = window.innerHeight - rect.bottom < tooltipHeight && rect.top > tooltipHeight;
    const rawTop = showAbove ? rect.top - tooltipHeight - 10 : rect.bottom + 10;
    const top = Math.min(Math.max(rawTop, 12), window.innerHeight - tooltipHeight - 12);

    setTooltip({
      left,
      placement: showAbove ? "top" : "bottom",
      top,
    });
  }

  return (
    <span
      aria-label={text}
      className="info-tip"
      onBlur={() => setTooltip(null)}
      onFocus={showTooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltip(null)}
      ref={iconRef}
      tabIndex={0}
    >
      <Info size={12} />
      {tooltip
        ? createPortal(
            <span
              className={tooltip.placement === "top" ? "floating-info-tooltip above" : "floating-info-tooltip"}
              role="tooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
