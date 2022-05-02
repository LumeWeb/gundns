import { Mutex } from "async-mutex";
import { clearTimeout, setTimeout } from "timers";
import crypto from "crypto";
import {
  clients,
  gun,
  pendingRequests,
  processedRequests,
  ttlTimers,
} from "./globals.js";
import { dnsTtl, requestTtl } from "./constants.js";
import { DnsRequest, DnsResponse } from "./types.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const jayson = require("jayson/promise");

function expireResponse(reqId: string): () => void {
  return () => {
    gun
      .user()
      .get("responses")
      .get(reqId)
      .put(null, function (ack) {
        // @ts-ignore
        if (ack.ok) {
          delete ttlTimers[reqId];
        }
      });
  };
}

export function maybeProcessItem(item: any[]): void {
  if (item[0] in processedRequests) {
    return;
  }

  if (!(item[1] && undefined !== item[1].data)) {
    return;
  }

  processedRequests[item[0]] = Date.now();
  processRequest(item[1]);
}

async function processRequest(request: DnsRequest): Promise<void> {
  const reqId = getRequestId(request);

  pendingRequests[reqId] = pendingRequests[reqId] ?? new Mutex();

  const lock = pendingRequests[reqId];

  let processed = false;

  gun
    .user()
    .get("responses")
    .get(reqId)
    .once(async function (response) {
      if (lock.isLocked()) {
        return;
      }
      await lock.acquire();

      if (processed) {
        gun.user().get("responses").get(reqId).off();
        await lock.release();
        return;
      }

      processed = true;

      if (response && !request.force) {
        let reqCount = response.requests + 1;
        gun
          .user()
          .get("responses")
          .get(reqId)
          .put({
            requests: reqCount,
            updated: response.updated,
            data: response.data,
          } as DnsResponse);

        await lock.release();
        return;
      }

      let rpcResp;

      let error;
      try {
        // @ts-ignore
        rpcResp = await getClient(request.chain).request(
          request.query,
          JSON.parse(request.data as string)
        );
      } catch (e) {
        error = (e as Error).message;
      }

      let dnsResp: DnsResponse = {
        updated: Date.now(),
        requests: 1,
        data: "",
      };

      if (rpcResp) {
        if (false === rpcResp.result) {
          error = true;
        }
        if (rpcResp.error) {
          error = rpcResp.error.message;
        }
      }

      dnsResp.data = error ? { error } : rpcResp.result;

      if (typeof dnsResp.data !== "string") {
        dnsResp.data = JSON.stringify(dnsResp.data);
      }
      gun.user().get("responses").get(reqId).put(dnsResp);

      if (ttlTimers[reqId] && request.force) {
        clearTimeout(ttlTimers[reqId]);
        delete ttlTimers[reqId];
      }

      if (!ttlTimers[reqId]) {
        ttlTimers[reqId] = setTimeout(expireResponse(reqId), dnsTtl * 1000);
      }
      await lock.release();
    });
}

function hashRequest(request: DnsRequest) {
  return crypto
    .createHash("sha256")
    .update(request.data as string)
    .digest("hex");
}

function getRequestId(request: DnsRequest) {
  return `${request.query};${request.chain};${hashRequest(request)}`;
}

export function pruneRequests() {
  for (const request in processedRequests) {
    if (Date.now() > processedRequests[request] + requestTtl * 1000) {
      delete processedRequests[request];
      gun.get("requests").get(request).put(null);
    }
  }
}

function getClient(chain: string): Function {
  chain = chain.replace(/[^a-z0-9\-]/g, "");

  if (!(chain in clients)) {
    clients[chain] = jayson.Client.http({
      host: process.env.RPC_PROXY_HOST,
      port: parseInt(process.env.RPC_PROXY_PORT as string),
      path: "/",
      headers: {
        "X-Chain": chain,
      },
    });
  }

  return clients[chain];
}
