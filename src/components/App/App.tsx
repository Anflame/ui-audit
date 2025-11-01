import { type ReactElement, Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "../AppRouter/AppRouter.tsx";

export const App = (): ReactElement => {
  return (
    <BrowserRouter>
      <Suspense fallback="loading...">
        <AppRouter />
      </Suspense>
    </BrowserRouter>
  );
};
