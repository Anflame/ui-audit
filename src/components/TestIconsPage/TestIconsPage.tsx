import type { FormEvent } from "react";
import { TestAntWrapped } from "../common/TestAntWrapped";
import { TestKSNM } from "../common/TestKSNM";
import { Input } from "antd";
import { TestLocal } from "../common/TestLocal";

const TestIconsPage = () => {
  const onSubmitForm = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };
  return (
    <form onSubmit={onSubmitForm}>
      <TestAntWrapped title="testicon.wrapped.ant" />
      <TestKSNM />
      <Input title="testicon.ant" />
      <TestLocal />
    </form>
  );
};

export default TestIconsPage;
