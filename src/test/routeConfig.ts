import { ErrorPage } from "../../ErrorPage";
import { HomePage } from "../../HomePage";
import { FAQPage } from "../../FAQPage";
import { RouteConfig, RoutePath } from "../types";
import { Feedback } from "../../Feedback";
import {
  mainDataConfig,
  processesConfig,
  reportsConfig,
  risksConfig,
  incidentManagementConfig,
  dictionaryConfig,
} from "./routes";
import { IconShowAll } from "../../common/Icon/IconShowAll";
import { constantStore } from "../../../stores/constantStore";

const { RESOURCE_NAME } = constantStore;

export const routeConfig: RouteConfig = {
  defaultRoute: RoutePath.HOME_PAGE,
  routes: [
    {
      path: RoutePath.ICONS,
      component: IconShowAll,
      hidden: true,
    },
    {
      path: RoutePath.FAQ,
      component: FAQPage,
      hidden: true,
    },
    {
      path: RoutePath.FEEDBACK,
      component: Feedback,
      hidden: true,
      resourceName: RESOURCE_NAME.EXPERIMENTAL,
    },
    {
      path: RoutePath.HOME_PAGE,
      component: HomePage,
      hidden: true,
    },
    {
      path: RoutePath.ERROR_PAGE,
      component: ErrorPage,
      hidden: true,
    },
    { ...mainDataConfig },
    { ...risksConfig },
    { ...processesConfig },
    { ...dictionaryConfig },
    { ...incidentManagementConfig },
    { ...reportsConfig },
  ],
};
