import { Input } from "antd";
import { TestAntWrapped } from "@common/TestAntWrapped";
// import { Checkbox } from "@common/CheckBox/CheckBox.tsx";
import { Table } from "ksnm-common-ui-table";
import { getColumns } from "./utils/getColumns.tsx";

const Form = () => {
  return (
    <form>
      <Input
        type="text"
        title="testTree1Deep.FirstDeep.OrganizationCard.Form.antd"
      />
      <TestAntWrapped title="testTree1Deep.FirstDeep.OrganizationCard.Form.antd-wrapped" />
      <input title="testTree1Deep.FirstDeep.OrganizationCard.Form.local" />
      {/*<Checkbox />*/}
      <Table resource="" columns={getColumns()} />
    </form>
  );
};

export default Form;
