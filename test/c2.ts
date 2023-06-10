import { IPC_Client } from "@bfchain/ipc";
import * as path from "path";
import { testSodiumApi, testClient } from "./const";

process.send &&
  process.send({
    cmd: "ask-ipc-address",
  });
process.on("message", (msg: any) => {
  if (msg.cmd === "answer-ipc-address") {
    const c = new IPC_Client();
    c.connect(msg.address);
    c.on("message", (msg) => {
      testSodiumApi();
      testClient(c, msg);
    });
    testClient(c);
    c.on("close", () => {
      process.exit(0);
    });
  }
});
