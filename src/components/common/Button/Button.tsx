import { Button as AntButton } from "antd";
import Tooltip from "@common/Tooltip/Tooltip.tsx";
import { type FC, memo } from "react";

interface ButtonProps {
  label?: string;
}

export const Button: FC<ButtonProps> = memo(({ label }) => {
  return (
    <Tooltip>
      <AntButton title={label}></AntButton>
    </Tooltip>
  );
});
