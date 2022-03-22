import Gun from "gun";
import crypto from "crypto";
import * as http from "http";
import { createRequire } from "module";
import * as fs from "fs";
import { Mutex } from "async-mutex";
// @ts-ignore
import { IGunCryptoKeyPair } from "gun/types/types";
import * as path from "path";
import { fileURLToPath } from "url";

const server = http.createServer().listen(8081);
const require = createRequire(import.meta.url);
const Rmem = require("gun/lib/rmem");
const jayson = require("jayson/promise");
const __dirname = fileURLToPath(path.dirname(import.meta.url));

const dnsTtl: number = isNaN(parseInt(process.env.DNS_TTL as string))
  ? 12 * 60 * 60
  : parseInt(process.env.DNS_TTL as string);
const requestTtl: number = isNaN(parseInt(process.env.REQ_TTL as string))
  ? 5 * 60
  : parseInt(process.env.REQ_TTL as string);
const keyPairLocation = path.join(path.dirname(__dirname), "data", "auth.json");

const clients: { [chain: string]: any } = {};
const pendingRequests: { [requestId: string]: Mutex } = {};
const ttlTimers: { [requestId: string]: NodeJS.Timer } = {};
const processedRequests: { [id: string]: number } = {};

require("gun/lib/open");

const gun = new Gun({ web: server, store: Rmem(), ws: { path: "/dns" } });

type DnsRequest = {
  query: string;
  chain: string;
  data: object | any[] | string;
};

type DnsResponse = {
  updated: number;
  requests: number;
  data:
    | string
    | {
        error: string | boolean;
      };
};

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

async function auth() {
  return new Promise<any>(async function (resolve) {
    let keyPair: IGunCryptoKeyPair | undefined;
    if (!fs.existsSync(keyPairLocation)) {
      keyPair = await Gun.SEA.pair();
      // @ts-ignore
      await new Promise(async (resolve) => gun.user().create(keyPair, resolve));
      fs.writeFileSync(keyPairLocation, JSON.stringify(keyPair));
    } else {
      keyPair = JSON.parse(fs.readFileSync(keyPairLocation).toString());
    }

    // @ts-ignore
    gun.user().auth(keyPair, resolve);
  });
}

function health() {
  setInterval(function () {
    gun
      .user()
      .get("ping")
      .put(Date.now() as unknown as Partial<any>);
  }, 5000);
}

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

function maybeProcessItem(item: any[]): void {
  if (item[0] in processedRequests) {
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
    .get(reqId, async function (response) {
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

      if (response.put) {
        let reqCount = response.put.requests + 1;
        gun
          .user()
          .get("responses")
          .get(reqId)
          .put({
            requests: reqCount,
            updated: response.put.updated,
            data: response.put.data,
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
        if (null !== rpcResp.result) {
          if (false === rpcResp.result) {
            error = true;
          } else {
            if (typeof rpcResp.result !== "string") {
              rpcResp.result = JSON.stringify(rpcResp.result);
            }
          }
        }
        if (rpcResp.error) {
          error = rpcResp.error.message;
        }
      }

      dnsResp.data = error ? { error } : rpcResp.result;

      gun.user().get("responses").get(reqId).put(dnsResp);

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

function pruneRequests() {
  for (const request in processedRequests) {
    if (Date.now() > processedRequests[request] + requestTtl * 1000) {
      delete processedRequests[request];
      gun.get("requests").get(request).put(null);
    }
  }
}

async function bootup() {
  await auth();
  health();
  // @ts-ignore
  gun.get("requests").open(function (items) {
    Object.entries(items).forEach(maybeProcessItem);
  });

  setInterval(pruneRequests, 5000);
}

bootup();
