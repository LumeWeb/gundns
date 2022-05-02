import { gun } from "./globals.js";

export function health() {
  setInterval(function () {
    gun
      .user()
      .get("ping")
      .put(Date.now() as unknown as Partial<any>);
  }, 5000);
}
