import { type FC, useMemo } from "react";
import { Form } from "antd";
import type { FormItemProps } from "antd/lib/form";
import type { PropsWithChildren, ReactElement } from "react";

interface FormFieldProps extends FormItemProps {
  help?: string;
  disabled?: boolean;
  isNeedOverflow?: boolean;
}

export const FormField: FC<PropsWithChildren<FormFieldProps>> = ({
  label,
  children,
  validateStatus,
  help = "",
  hidden,
  required,
  isNeedOverflow = true,
}): ReactElement => {
  const labelWithOverflow = useMemo(
    () => (
      <div>
        <p title={typeof label === "string" ? label : ""}>{label}</p>
        {required && <p>*</p>}
      </div>
    ),
    [label, required],
  );

  const labelWithoutOverflow = useMemo(
    () => (
      <span>
        <span title={typeof label === "string" ? label : ""}>{label}</span>
        {required && <span>*</span>}
      </span>
    ),
    [label, required],
  );

  const labelWithRequired = useMemo(() => {
    if (label) {
      return isNeedOverflow ? labelWithOverflow : labelWithoutOverflow;
    }
    return "";
  }, [isNeedOverflow, label, labelWithOverflow, labelWithoutOverflow]);

  return (
    <Form.Item
      label={labelWithRequired}
      validateStatus={validateStatus}
      help={help}
      hidden={hidden}
    >
      {children}
    </Form.Item>
  );
};
