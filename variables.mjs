import path from "path";
import { fileURLToPath } from "url";

export const IS_DOCKER_RUN = process.env.DOCKER_RUN !== undefined;
export const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;

export const dirname = () => path.dirname(fileURLToPath(import.meta.url));

export const rpcUri = () => "wss://rpc.basilisk.cloud";

export const gqlHost = () =>
  "https://basilisk-explorer.play.hydration.cloud/graphql";
