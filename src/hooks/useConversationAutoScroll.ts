import { useEffect, useRef } from "react";

const STICK_TO_BOTTOM_THRESHOLD = 72;

export function isNearScrollBottom(element: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">) {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= STICK_TO_BOTTOM_THRESHOLD;
}

export function useConversationAutoScroll(dependency: unknown) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const messages = messagesRef.current;
    if (messages && shouldStickToBottomRef.current) messages.scrollTop = messages.scrollHeight;
  }, [dependency]);

  const handleMessagesScroll = () => {
    const messages = messagesRef.current;
    if (messages) shouldStickToBottomRef.current = isNearScrollBottom(messages);
  };

  const resumeAutoScroll = () => {
    shouldStickToBottomRef.current = true;
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
  };

  return { messagesRef, handleMessagesScroll, resumeAutoScroll };
}
