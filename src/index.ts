// @ts-ignore
import { setupPortalListSubscription } from "./portal.js";
import { maybeProcessItem, pruneRequests } from "./request.js";
import { auth } from "./auth.js";
import { health } from "./health.js";
import { gun } from "./globals.js";

await auth();
health();
setupPortalListSubscription();

// @ts-ignore
gun.get("requests").open(function (items) {
  Object.entries(items).forEach(maybeProcessItem);
});

setInterval(pruneRequests, 5000);
