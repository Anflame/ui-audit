import { type RouteConfig, RoutePath } from "../routeConfig.ts";
import { TestIconsPage } from "../components/TestIconsPage";
import { TestFAQPage } from "../components/TestFAQPage";
import { TestFeedbackPage } from "../components/TestFeedBackPage";
import { TestHomePage } from "../components/TestHomePage";
import { dictionaryConfig } from "./dictionaryConfig.ts";

export const routeConfig: RouteConfig = {
  defaultRoute: RoutePath.HOME_PAGE,
  routes: [
    {
      title: "Иконки",
      path: RoutePath.ICONS,
      component: TestIconsPage,
      hidden: true,
    },
    {
      title: "FAQ",
      path: RoutePath.FAQ,
      component: TestFAQPage,
      hidden: true,
    },
    {
      title: "Обратная связь",
      path: RoutePath.FEEDBACK,
      component: TestFeedbackPage,
      hidden: true,
    },
    {
      title: "Домашняя страница",
      path: RoutePath.HOME_PAGE,
      component: TestHomePage,
      hidden: true,
    },
    { ...dictionaryConfig },
  ],
};
