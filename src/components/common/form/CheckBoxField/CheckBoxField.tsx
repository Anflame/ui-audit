import { type ReactNode, useMemo } from "react";
import cn from "classnames";
import type { CheckboxProps as AntdCheckboxProps } from "antd/lib/checkbox";
import type { ReactElement } from "react";

import styles from "./Checkbox.module.scss";
import { FormField } from "@common/FormField/FormField.tsx";
import { Checkbox } from "@common/CheckBox/CheckBox.tsx";

export interface CheckboxFieldProps extends AntdCheckboxProps {
  label: ReactNode;
  error?: string;
  groupStyle?: boolean;
  required?: boolean;
}

export function CheckboxField({
  label,
  value,
  disabled,
  error,
  className,
  onChange,
  groupStyle,
  required,
}: CheckboxFieldProps): ReactElement {
  const requiredLabel = useMemo(
    () =>
      typeof label === "string" ? (
        <span>
          <span>{label}</span>
          {required && (
            <span
              className={cn({
                [styles.required]: required,
                [styles.labelError]: !!error,
                [styles.labelDisabled]: disabled,
              })}
            >
              *
            </span>
          )}
        </span>
      ) : (
        label
      ),
    [disabled, error, label, required],
  );

  return (
    <FormField className={className} help={error} disabled={disabled}>
      <Checkbox
        checked={value}
        disabled={disabled}
        onChange={onChange}
        groupStyle={groupStyle}
      >
        {requiredLabel}
      </Checkbox>
    </FormField>
  );
}
