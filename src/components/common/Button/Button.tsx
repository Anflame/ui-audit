import { Button as AntButton } from "antd";
import Tooltip from "@common/Tooltip/Tooltip.tsx";
import type { FC } from "react";

interface ButtonProps {
  label?: string;
}

const Button: FC<ButtonProps> = ({ label }) => {
  return (
    <Tooltip>
      <AntButton title={label}></AntButton>
    </Tooltip>
  );
};

export default Button;
