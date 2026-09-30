"use client";

import { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  className?: string;
  fallback?: string;
}

export function AnimatedNumber({
  value,
  duration = 500,
  formatter = (v) => v.toLocaleString(),
  className,
  fallback = "—",
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      setDisplayValue(value);
      return;
    }

    let start = displayValue;
    const end = value;
    if (start === end) return;

    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out expo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (end - start) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayValue(end);
      }
    };

    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration, hasMounted]);

  if (!hasMounted && (value === undefined || value === null)) {
    return <span className={className} suppressHydrationWarning>{fallback}</span>;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {formatter(displayValue)}
    </span>
  );
}
