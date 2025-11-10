import { Input, Form as AntdForm } from "antd";
import { TestAntWrapped } from "@common/TestAntWrapped";
import { Table } from "ksnm-common-ui-table";
import { getColumns } from "./utils/getColumns.tsx";

const Form = () => {
  return (
    <AntdForm>
      <Input
        type="text"
        title="testTree1Deep.FirstDeep.OrganizationCard.Form.antd"
      />
      <TestAntWrapped title="testTree1Deep.FirstDeep.OrganizationCard.Form.antd-wrapped" />
      <input title="testTree1Deep.FirstDeep.OrganizationCard.Form.local" />
      <Table resource="" columns={getColumns()} />
    </AntdForm>
  );
};

export default Form;
