import { IPC_Server } from "@bfchain/ipc";
import { testServer, TIMES } from "./const";

const s = new IPC_Server();
s.listen().then((address) => {
  process.send &&
    process.send({
      cmd: "ipc-address",
      address,
      times: TIMES,
    });
});
let t = 0;
let closed = 0;
const tryClose = () => {
  closed += 1;
  if (closed === t) {
    process.exit(0);
  }
};
s.on("connection", (client) => {
  const label = `z-${t++}`;
  client.on("message", (msg: any) => {
    testServer(client, label, tryClose, msg);
  });
  testServer(client, label, tryClose);
});
