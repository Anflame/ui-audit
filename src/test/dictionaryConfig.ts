import { RoutePath } from "../routeConfig.ts";
import { TestIconsPage } from "../components/TestIconsPage";
import { TestFAQPage } from "../components/TestFAQPage";

const entry = {
  title: "Словарь через объект",
  path: RoutePath.ICONS,
  component: TestIconsPage,
};

const dictionaryRoutes = [
  {
    title: "Словарь через массив",
    path: RoutePath.FAQ,
    component: TestFAQPage,
  },
];

export const dictionaryConfig = {
  entry,
  routes: dictionaryRoutes,
};

export const nestedDictionaryConfig = {
  ...entry,
  routes: [...dictionaryRoutes],
};
