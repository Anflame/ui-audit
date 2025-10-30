import { type RouteConfig, RoutePath } from "./routeConfig.ts";

export const appRouter: RouteConfig = {
  defaultRoute: RoutePath.HOME_PAGE,
  routes: [
    {
      path: RoutePath.ICONS,
      hidden: true,
    },
    {
      path: RoutePath.FAQ,
      hidden: true,
    },
    {
      path: RoutePath.FEEDBACK,
      hidden: true,
    },
    {
      path: RoutePath.HOME_PAGE,
      hidden: true,
    },
    {
      path: RoutePath.ERROR_PAGE,
      hidden: true,
    },
  ],
};
