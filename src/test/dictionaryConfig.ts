import { type Route, RoutePath } from "../routeConfig.ts";
import { OrganizationCard } from "@components/Tree1Deep/FistDeep/OrganizationCard";
import { Reports } from "@components/Tree2Deep/FirstDeep/SecondDeep/Reports";
import { lazy } from "react";

const ReportEdit = lazy(() =>
  import("@components/Tree2Deep/FirstDeep/SecondDeep/Reports/ReportEdit").then(
    (module) => ({ default: module.ReportEdit }),
  ),
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
          component: OrganizationCard,
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
