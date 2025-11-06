import { Input } from "antd";
import { TestAntWrapped } from "@common/TestAntWrapped";

const Form = () => {
  return (
    <form>
      <Input
        type="text"
        title="testTree1Deep.FirstDeep.OrganizationCard.Form.antd"
      />
      <TestAntWrapped />
      <input title="testTree1Deep.FirstDeep.OrganizationCard.Form.local" />
    </form>
  );
};

export default Form;
