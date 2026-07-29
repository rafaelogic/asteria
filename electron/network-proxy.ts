import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { EventEmitter } from "node:events";
import { decideNetworkRequest } from "./network-policy.js";

export interface ProxyDecision {
  timestamp: string;
  host: string;
  url: string;
  decision: "allow" | "deny" | "review";
  reason: string;
}

export class NetworkPolicyProxy extends EventEmitter {
  private hostDecisions = new Map<string, "allow" | "deny">();
  private server = createServer((request, response) => {
    try {
      const target = new URL(request.url ?? "");
      const result = this.decide(target.toString());
      this.emitDecision(target.hostname, target.toString(), result);
      if (result.decision !== "allow") {
        response.writeHead(403, { "content-type": "text/plain" });
        response.end("Asteria network policy denied this destination.");
        return;
      }
      const upstream = httpRequest(target, { method: request.method, headers: request.headers }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on("error", () => response.destroy());
      request.pipe(upstream);
    } catch {
      response.writeHead(400);
      response.end();
    }
  });

  constructor() {
    super();
    this.server.on("connect", (request, clientSocket, head) => {
      const [host, rawPort] = (request.url ?? "").split(":");
      const port = Number(rawPort || 443);
      const result = this.decide(`https://${host}/`);
      this.emitDecision(host, `https://${host}:${port}/`, result);
      if (result.decision !== "allow") {
        clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        clientSocket.destroy();
        return;
      }
      const upstream = connect(port, host, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.on("error", () => clientSocket.destroy());
    });
  }

  private emitDecision(host: string, url: string, result: ReturnType<typeof decideNetworkRequest>) {
    this.emit("decision", { timestamp: new Date().toISOString(), host, url, ...result } satisfies ProxyDecision);
  }

  private decide(rawUrl: string) {
    const base = decideNetworkRequest(rawUrl);
    if (base.decision === "deny") return base;
    const host = new URL(rawUrl).hostname;
    const override = this.hostDecisions.get(host);
    return override ? { decision: override, reason: "User network approval policy." } : base;
  }

  setHostDecision(host: string, decision: "allow" | "deny") {
    if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new Error("Invalid network destination.");
    this.hostDecisions.set(host, decision);
  }

  revokeHost(host: string) { this.hostDecisions.delete(host); }

  async listen() {
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Network policy proxy did not bind.");
    return `http://127.0.0.1:${address.port}`;
  }

  close() {
    this.server.close();
  }
}
