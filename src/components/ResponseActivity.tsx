import { useEffect, useState } from "react";

export function ResponseActivity({ hasContent = false }: { hasContent?: boolean }) {
  const [takingLonger, setTakingLonger] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTakingLonger(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const label = takingLonger ? "Still working" : hasContent ? "Working" : "Thinking";

  return <div className={`response-activity${takingLonger ? " taking-longer" : ""}`} role="status" aria-live="polite">
    <span>{label}</span>
    <i aria-hidden="true"><b /><b /><b /></i>
  </div>;
}
