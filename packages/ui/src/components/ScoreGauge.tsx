"use client";

import { cn } from "../lib/utils";

interface ScoreGaugeProps {
  score: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 56, radius: 22, stroke: 5, fontSize: "text-xs" },
  md: { width: 72, radius: 28, stroke: 6, fontSize: "text-sm" },
  lg: { width: 96, radius: 38, stroke: 7, fontSize: "text-base" },
};

export const ScoreGauge = ({
  score,
  max = 10,
  size = "md",
  label,
  className,
}: ScoreGaugeProps) => {
  const { width, radius, stroke, fontSize } = SIZE_MAP[size];
  const center = width / 2;

  // 270° arc (başlangıç: sol alt, bitiş: sağ alt)
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const ratio = Math.min(score / max, 1);
  const filled = arcLength * ratio;

  // SVG path: 270° arc
  const startAngle = 135;
  const endAngle = 135 + 270;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startX = center + radius * Math.cos(toRad(startAngle));
  const startY = center + radius * Math.sin(toRad(startAngle));
  const endX = center + radius * Math.cos(toRad(endAngle));
  const endY = center + radius * Math.sin(toRad(endAngle));

  const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`;

  // Durum tonu yalnız işarette (yay); değer metin renginde (DESIGN.md §28.2)
  const scoreClass =
    ratio >= 0.7 ? "stroke-success" : ratio >= 0.4 ? "stroke-warning" : "stroke-danger";

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg width={width} height={width} viewBox={`0 0 ${width} ${width}`}>
        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-surface-3"
        />
        {/* Score arc */}
        <path
          d={arcPath}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${arcLength}`}
          className={cn(scoreClass, "transition-[stroke-dasharray] duration-500 ease-bizmo")}
        />
        {/* Score text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn(fontSize, "fill-foreground font-display font-extrabold tabular-nums")}
          style={{ fontSize: size === "lg" ? 18 : size === "md" ? 14 : 11 }}
        >
          {score.toFixed(1)}
        </text>
      </svg>
      {label && (
        <span className="text-[11px] text-muted-foreground font-medium text-center leading-tight">
          {label}
        </span>
      )}
    </div>
  );
};
