import { createContext, useContext } from "react";

type RouteLoadingContextValue = (loading: boolean) => void;

const RouteLoadingContext = createContext<RouteLoadingContextValue>(() => {});

export const RouteLoadingProvider = RouteLoadingContext.Provider;

export function useRouteLoading() {
  return useContext(RouteLoadingContext);
}
