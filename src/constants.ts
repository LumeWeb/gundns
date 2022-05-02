import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

export const require = createRequire(import.meta.url);
export const __dirname = fileURLToPath(path.dirname(import.meta.url));

export const dnsTtl: number = isNaN(parseInt(process.env.DNS_TTL as string))
  ? 12 * 60 * 60
  : parseInt(process.env.DNS_TTL as string);
export const requestTtl: number = isNaN(parseInt(process.env.REQ_TTL as string))
  ? 5 * 60
  : parseInt(process.env.REQ_TTL as string);
export const portalListName: string =
  process.env.PORTAL_LIST_NAME ?? "community-portals";
export const portalListOwner: string =
  process.env.PORTAL_SKYLINK_OWNER ??
  "86c7421160eb5cb4a39495fc3e3ae25a60b330fff717e06aab978ad353722014";
export const keyPairLocation = path.join(
  path.dirname(__dirname),
  "data",
  "auth.json"
);
