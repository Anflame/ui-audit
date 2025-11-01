import { type FormEventHandler } from "react";
import { Select } from "antd";
import { TestAntWrapped } from "../../common/TestAntWrapped";

const Form = () => {
  const onSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
  };
  return (
    <form onSubmit={onSubmit}>
      <Select title="testhome.form.ant" />
      <TestAntWrapped title="testhome.form.wrapped.ant" />
      <input title="testhome.form.input" />
    </form>
  );
};

export default Form;
