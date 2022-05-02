export interface DnsRequest {
  query: string;
  chain: string;
  data: object | any[] | string;
  force?: boolean;
}

export interface DnsResponse {
  updated: number;
  requests: number;
  data:
    | string
    | {
        error: string | boolean;
      };
}

export interface JSONPortalItem {
  pubkey?: string;
  supports: string[];
}

export interface JSONPortalList {
  [domain: string]: JSONPortalItem;
}

export interface Portal extends JSONPortalItem {
  host: string;
}

export interface PortalList {
  [domain: string]: Portal;
}
