import { createRequire } from "module";
import { JSONPortalList } from "./types.js";
import { portalListName, portalListOwner } from "./constants.js";
import WSReconnect from "./ws.js";

const require = createRequire(import.meta.url);
const { SkynetClient } = require("skynet-js");
const { hashDataKey } = require("skynet-js/dist/cjs/crypto.js");
const { toHexString } = require("skynet-js/dist/cjs/utils/string.js");

/*
 TODO: Use kernel code to use many different portals and not hard code a portal
 */
let portalConnection: WSReconnect;
const portalClient = new SkynetClient("https://fileportal.org");

async function fetchPortals() {
  let portals: JSONPortalList = (
    await portalClient.dbV2.getJSON(portalListOwner, portalListName)
  ).data as JSONPortalList;

  setPeers(getPeersFromPortalList(portals));
}

function getPeersFromPortalList(portals: JSONPortalList) {
  const list = [];

  for (const host of Object.keys(portals)) {
    const portal = portals[host];
    if (portal.supports.includes("dns")) {
      list.push(`https://${host}`);
    }
  }

  return list;
}

function setPeers(peers: string[]) {
  // @ts-ignore
  const mesh = gun.back("opt.mesh");
  // @ts-ignore
  const currentPeers = gun.back("opt.peers");

  Object.keys(currentPeers).forEach((id) => mesh.bye(id));
  peers.forEach((item) => mesh.hi({ url: item }));
}

export function setupPortalListSubscription() {
  portalConnection = new WSReconnect(
    "wss://fileportal.org/skynet/registry/subscription"
  );
  portalConnection.on("open", () => {
    portalConnection.send(
      JSON.stringify({
        action: "subscribe",
        pubkey: `ed25519:${portalListOwner}`,
        datakey: toHexString(hashDataKey(portalListName)),
      })
    );
  });
  portalConnection.on("message", fetchPortals);
}
