import { Form } from "./Form";
import { Table } from "ksnm-common-ui-table";
import type { ColumnInterface } from "ksnm-common-ui-table/lib/Table2/Table.interface";
import { observer } from "mobx-react";

const OrganizationCard = () => {
  return (
    <div>
      <Form />
      <Table resource="" columns={[] as ColumnInterface[]} />
    </div>
  );
};

export const OrganizationCardComponent = observer(OrganizationCard);
