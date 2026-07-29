import { useState } from "react";
import { ArrowRightIcon, CheckIcon, SparkleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";

function improvePrompt(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const sentence = clean.charAt(0).toUpperCase() + clean.slice(1).replace(/[.?!]*$/, ".");
  const action = /^(create|build|add|fix|design|review|implement|update)\b/i.test(sentence) ? sentence : `Please ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
  return `${action} Preserve the existing product patterns, include clear success criteria, and verify the result in the primary user flow.`;
}

export function PromptComposer({ projectName }: { projectName: string }) {
  const [value, setValue] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [accepted, setAccepted] = useState(false);
  const refine = () => { setSuggestion(improvePrompt(value)); setAccepted(false); };
  const accept = () => { setValue(suggestion); setSuggestion(""); setAccepted(true); };
  return <section className="prompt-composer spotlight-surface">
    <header><span><SparkleIcon weight="fill" /> Prompt studio</span><small>Local refinement · {projectName}</small></header>
    <textarea value={value} onChange={(event) => { setValue(event.target.value); setAccepted(false); }} placeholder="Describe what you want the specialist team to accomplish…" />
    <footer>
      <span>{value.length ? `${value.split(/\s+/).filter(Boolean).length} words` : "Be specific about the outcome"}</span>
      <button className="button secondary" disabled={!value.trim()} onClick={refine}><SparkleIcon /> Improve writing</button>
      <button className="button primary" disabled={!value.trim()}><ArrowRightIcon /> Send to workflow</button>
    </footer>
    <AnimatePresence>
      {suggestion && <motion.div className="prompt-suggestion" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
        <span><small>Refined prompt</small><p>{suggestion}</p></span>
        <button className="text-button" onClick={accept}><CheckIcon /> Use this version</button>
      </motion.div>}
      {accepted && <motion.p className="prompt-accepted" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><CheckIcon /> Refined prompt applied</motion.p>}
    </AnimatePresence>
  </section>;
}
