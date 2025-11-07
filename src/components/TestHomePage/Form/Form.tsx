import { type FormEventHandler } from "react";
import { Select } from "antd";
import { TestAntWrapped } from "../../common/TestAntWrapped";
import { CheckboxField } from "@form/CheckBoxField/CheckBoxField.tsx";
import { Button } from "@common/Button";

const Form = () => {
  const onSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
  };
  return (
    <form onSubmit={onSubmit}>
      <Select title="testhome.form.ant" />
      <TestAntWrapped title="testhome.form.wrapped.ant" />
      <input title="testhome.form.input" />
      <CheckboxField label="testhome.form.ant-wrapped" />
      <Button label="testhome.form.wrapped.ant" />
    </form>
  );
};

export default Form;
