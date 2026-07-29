import type { PointerEvent, ReactNode } from "react";
import { motion } from "motion/react";

export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`shiny-text ${className}`}>{children}</span>;
}

export function AgenticOrbit({ paused = false, label }: { paused?: boolean; label: string }) {
  return <div className={`agentic-orbit ${paused ? "paused" : ""}`} role="img" aria-label={label}>
    <i className="orbit-ring ring-one" /><i className="orbit-ring ring-two" /><i className="orbit-ring ring-three" />
    <span className="orbit-signal"><b /><b /><b /></span>
    <span className="orbit-core">&gt;_</span>
  </div>;
}

export function AnimatedContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 10, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(3px)" }} transition={{ duration: .32, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function AnimatedListItem({ children, index, className = "" }: { children: ReactNode; index: number; className?: string }) {
  return <motion.div className={className} layout initial={{ opacity: 0, x: 9, filter: "blur(3px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} transition={{ duration: .28, delay: Math.min(index * .035, .2), ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

export function spotlightPointer(event: PointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
}
