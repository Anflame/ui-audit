import type { FormEvent } from "react";
import { TestAntWrapped } from "../common/TestAntWrapped";
import { TestKSNM } from "../common/TestKSNM";
import { Input } from "antd";
import { TestLocal } from "../common/TestLocal";
import { Button } from "@common/Button";

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
      <Button />
    </form>
  );
};

export default TestIconsPage;
