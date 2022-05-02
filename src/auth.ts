import fs from "fs";
import { keyPairLocation } from "./constants.js";
import { Gun, gun } from "./globals.js";

export async function auth() {
  return new Promise<any>(async function (resolve) {
    let keyPair: any;
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
