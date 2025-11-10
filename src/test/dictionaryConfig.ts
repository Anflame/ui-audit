import { type Route, RoutePath } from "../routeConfig.ts";
import { Reports } from "@components/index.ts";
import { lazy } from "react";

const ReportEdit = lazy(() =>
  import("@components/Tree2Deep/FirstDeep/SecondDeep/Reports/ReportEdit").then(
    (module) => ({ default: module.ReportEdit }),
  ),
);

const OrganizationCardComponent = lazy(() =>
  import("@components/index.ts").then((module) => ({
    default: module.OrganizationCardComponent,
  })),
);

export const dictionaryConfig: Route = {
  title: "Справочники",
  routes: [
    {
      title: "Основные",
      resourceName: ["CmOrganization", "CmReportPeriods"],
      routes: [
        {
          title: "Общая информация об организации",
          path: `${RoutePath.ORGANIZATION_CARD}/:code`,
          component: OrganizationCardComponent,
          resourceName: "CmOrganization",
          hidden: true,
        },
      ],
    },
    {
      title: "Отчетность",
      resourceName: ["CmReport", "CmReportVersion", "CmReportSettings"],
      routes: [
        {
          title: "Отчеты",
          path: RoutePath.DICTIONARY_REPORT,
          component: Reports,
          resourceName: "CmReport",
        },
        {
          path: `${RoutePath.DICTIONARY_REPORT}/:code`,
          component: ReportEdit,
          hidden: true,
          resourceName: "CmReport",
        },
      ],
    },
  ],
};
