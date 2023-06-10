import net from "node:net";
import cluster from "node:cluster";
import type { Worker } from "node:cluster";
import { constants, debug } from "./constants.ts";

let is_setuped = false;
export function gipcSetup() {
  if (is_setuped) {
    debug("already setuped gipc.");
    return;
  }
  is_setuped = true;
  if (!cluster.isMaster) {
    debug("setup gipc on cluster, ignored.");
    return;
  }
  cluster.on("message", (worker: Worker, msg) => {
    if (msg && msg[constants.cmd_key] === constants.ASK_USEABLE_PORT) {
      const tmp_server = net.createServer();
      const useable_address = tmp_server.listen().address();
      tmp_server.close();
      worker.send({
        [constants.cmd_key]: constants.ANSWER_USEABLE_PORT,
        useable_address,
      });
    }
  });
  debug("setup gipc success.");
}
