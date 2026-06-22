import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

type TooltipState = {
  anchorBottom: number;
  anchorTop: number;
  anchorX: number;
  left: number;
  placement: "bottom" | "top";
  top: number;
};

const TOOLTIP_GAP = 10;
const VIEWPORT_PAD = 12;

export function InfoTip({ text }: { text: string }) {
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useLayoutEffect(() => {
    if (!tooltip) return;

    const node = tooltipRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const bottomTop = tooltip.anchorBottom + TOOLTIP_GAP;
    const topTop = tooltip.anchorTop - rect.height - TOOLTIP_GAP;
    let placement = tooltip.placement;
    let top = placement === "top" ? topTop : bottomTop;

    if (placement === "bottom" && bottomTop + rect.height > window.innerHeight - VIEWPORT_PAD && topTop >= VIEWPORT_PAD) {
      placement = "top";
      top = topTop;
    } else if (placement === "top" && topTop < VIEWPORT_PAD && bottomTop + rect.height <= window.innerHeight - VIEWPORT_PAD) {
      placement = "bottom";
      top = bottomTop;
    } else {
      top = Math.min(Math.max(top, VIEWPORT_PAD), window.innerHeight - rect.height - VIEWPORT_PAD);
    }

    const left = Math.min(
      Math.max(tooltip.anchorX, rect.width / 2 + VIEWPORT_PAD),
      window.innerWidth - rect.width / 2 - VIEWPORT_PAD,
    );

    if (Math.abs(left - tooltip.left) > 0.5 || Math.abs(top - tooltip.top) > 0.5 || placement !== tooltip.placement) {
      setTooltip({ ...tooltip, left, placement, top });
    }
  }, [tooltip]);

  function showTooltip() {
    const icon = iconRef.current;
    if (!icon) return;

    const rect = icon.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const showAbove = window.innerHeight - rect.bottom < 130 && rect.top > 130;

    setTooltip({
      anchorBottom: rect.bottom,
      anchorTop: rect.top,
      anchorX,
      left: anchorX,
      placement: showAbove ? "top" : "bottom",
      top: showAbove ? rect.top - TOOLTIP_GAP : rect.bottom + TOOLTIP_GAP,
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
              ref={tooltipRef}
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
