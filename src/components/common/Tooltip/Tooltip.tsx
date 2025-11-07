import { type ReactNode } from "react";

interface TooltipProps {
  children?: ReactNode;
}

export function Tooltip({ children }: TooltipProps) {
  return <div>{children}</div>;
}

export default Tooltip;
