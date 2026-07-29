import { ArrowSquareOutIcon, CircleIcon } from "@phosphor-icons/react";
import type { AgentEvent } from "../types";
import { AnimatedListItem, ShinyText } from "./MotionBits";

export function ActivityTimeline({ events, onOpen }: { events: AgentEvent[]; onOpen: () => void }) {
  return (
    <aside className="activity-panel">
      <div className="panel-heading"><h3>Activity</h3><span><ShinyText>Live</ShinyText></span></div>
      <div className="timeline">
        {events.map((event, index) => (
          <AnimatedListItem className="timeline-event" index={index} key={event.id}>
            <time>{event.timestamp}</time>
            <CircleIcon className={`event-dot dot-${index}`} weight="fill" />
            <span><strong>{event.title}</strong><small>{event.detail}</small></span>
          </AnimatedListItem>
        ))}
      </div>
      <button className="text-button" onClick={onOpen}>View full timeline <ArrowSquareOutIcon /></button>
    </aside>
  );
}
