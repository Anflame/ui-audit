import type { ColumnInterface } from "ksnm-common-ui-table/lib/Table2/Table.interface";
import { Checkbox } from "@common/CheckBox/CheckBox.tsx";

export function getColumns(): ColumnInterface[] {
  return [
    {
      key: "1",
      render: () => <Checkbox />,
    },
  ];
}
