import { Mutex } from "async-mutex";
import Gun from "gun";
import http from "http";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
export const server = http.createServer().listen(80);
export const clients: { [chain: string]: any } = {};
export const pendingRequests: { [requestId: string]: Mutex } = {};
export const ttlTimers: { [requestId: string]: NodeJS.Timer } = {};
export const processedRequests: { [id: string]: number } = {};

require("gun/lib/open");
const Rmem = require("gun/lib/rmem");

export const gun = new Gun({
  web: server,
  store: Rmem(),
  ws: { path: "/dns" },
  axe: false,
});
export { Gun };
