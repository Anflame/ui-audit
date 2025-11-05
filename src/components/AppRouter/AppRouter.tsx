import { type ReactElement, useMemo } from "react";
import { Route, Routes } from "react-router-dom";
import { routeConfig } from "../../test/routeConfig.ts";

export const AppRouter = (): ReactElement => {
  const config = useMemo(
    () =>
      routeConfig.routes.map((route, idx) => (
        <Route key={idx} path={route.path} Component={route.component} />
      )),
    [],
  );

  return <Routes>{config}</Routes>;
};
