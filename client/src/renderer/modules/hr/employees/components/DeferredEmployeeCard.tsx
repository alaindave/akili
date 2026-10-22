import { Box } from "@chakra-ui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep off-screen cards cheap while preserving forms the user has interacted with. */
export default function DeferredEmployeeCard({ children }: { children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [height, setHeight] = useState(82);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && node.offsetHeight) setHeight(node.offsetHeight);
      setVisible(entry.isIntersecting);
    }, { rootMargin: "200px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={element}
      minH={visible || interacted ? undefined : `${height}px`}
      onPointerDownCapture={() => setInteracted(true)}
      onFocusCapture={() => setInteracted(true)}
    >
      {visible || interacted ? children : null}
    </Box>
  );
}
