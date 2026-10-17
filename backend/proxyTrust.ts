import type { Express } from "express";

export function configureProxyTrust(app: Express, environment: NodeJS.ProcessEnv = process.env) {
  app.set("trust proxy", environment.NODE_ENV === "production" ? 1 : false);
}
