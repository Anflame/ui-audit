import { Checkbox as AntdCheckbox } from "antd";
import cm from "classnames";
import type { CheckboxProps as AntdCheckboxProps } from "antd/lib/checkbox";

import type { FC } from "react";

interface CheckboxProps extends AntdCheckboxProps {
  className?: string;
  groupStyle?: boolean;
}

export const Checkbox: FC<CheckboxProps> = ({
  className,
  ...props
}: CheckboxProps) => <AntdCheckbox className={cm(className)} {...props} />;
