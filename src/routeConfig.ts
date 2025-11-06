import type { ComponentType } from "react";

declare const REACT_APP_ENV: { [index: string]: string | null | undefined };

const prefix = REACT_APP_ENV.PUBLIC_URL ?? process.env.PUBLIC_URL;
export const prefixRouteUrl = prefix ? `${prefix}/` : "/";

export const RoutePath = {
  ERROR_PAGE: `${prefixRouteUrl}error`,
  HOME_PAGE: `${prefixRouteUrl}`,
  INCIDENT: `${prefixRouteUrl}incident`,
  FEEDBACK: `${prefixRouteUrl}feedback`,
  FAQ: `${prefixRouteUrl}faq`,
  ICONS: `${prefixRouteUrl}iconsShowAll`,
  DICTIONARY_REPORT: `${prefixRouteUrl}dictionary/report`,
  ORGANIZATION_CARD: `${prefixRouteUrl}organizations/card`,
} as const;

type Keys = keyof typeof RoutePath;
type RouteValue = (typeof RoutePath)[Keys];
export interface Route {
  title?: string;
  path?: string;
  hidden?: boolean;
  component?: ComponentType;
  routes?: Route[];
  redirectTo?: RouteValue;
  link?: boolean;
  resourceName?: string | string[];
}

export interface RouteConfig {
  defaultRoute?: RouteValue;
  routes: Route[];
}
