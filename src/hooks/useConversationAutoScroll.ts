import { useEffect, useRef, useState } from "react";

const STICK_TO_BOTTOM_THRESHOLD = 72;

export function isNearScrollBottom(element: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">) {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= STICK_TO_BOTTOM_THRESHOLD;
}

export function useConversationAutoScroll(dependency: unknown) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  useEffect(() => {
    const messages = messagesRef.current;
    if (!messages) return;
    if (shouldStickToBottomRef.current) {
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
        setHasNewMessages(false);
      });
    } else {
      setHasNewMessages(true);
    }
  }, [dependency]);

  const handleMessagesScroll = () => {
    const messages = messagesRef.current;
    if (messages) {
      shouldStickToBottomRef.current = isNearScrollBottom(messages);
      if (shouldStickToBottomRef.current) setHasNewMessages(false);
    }
  };

  const resumeAutoScroll = () => {
    shouldStickToBottomRef.current = true;
    setHasNewMessages(false);
    const messages = messagesRef.current;
    if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  };

  return { messagesRef, handleMessagesScroll, resumeAutoScroll, hasNewMessages };
}
