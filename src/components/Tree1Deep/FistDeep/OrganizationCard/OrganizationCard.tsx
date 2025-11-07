import { Form } from "./Form";
import { Table } from "ksnm-common-ui-table";
import type { ColumnInterface } from "ksnm-common-ui-table/lib/Table2/Table.interface";

const OrganizationCard = () => {
  return (
    <div>
      <Form />
      <Table resource="" columns={[] as ColumnInterface[]} />
    </div>
  );
};

export default OrganizationCard;
