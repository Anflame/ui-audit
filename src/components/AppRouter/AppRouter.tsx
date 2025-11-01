import { type ReactElement, useMemo } from "react";
import { Route, Routes } from "react-router-dom";
import { appRouter } from "../../AppRouter.ts";

export const AppRouter = (): ReactElement => {
  const config = useMemo(
    () =>
      appRouter.routes.map((route, idx) => (
        <Route key={idx} path={route.path} Component={route.component} />
      )),
    [],
  );

  return <Routes>{config}</Routes>;
};
