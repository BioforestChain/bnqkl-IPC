import { giwcSetup, IWC_Client, IWC_Server } from "@bfchain/ipc";
import { isMainThread, MessagePort, workerData } from "worker_threads";
import { createServer, createConnection, Socket } from "net";

(async () => {
  if (isMainThread) {
    const socketServer = createServer((socket) => {
      socket.on("data", (data) => {
        console.log(data.toString());
      });
      socket.write("hi~");
    }).listen(() => {
      const address = socketServer.address();
      giwcSetup().createWorker(__filename, {
        workerData: {
          type: 1,
          address,
        },
      });

      giwcSetup().createWorker(__filename, {
        workerData: {
          type: 2,
          address,
        },
      });
    });
  } else if (workerData.type === 1) {
    const server = new IWC_Server("zz");
    server.listen();
    process.on("message", (msg, socket?: Socket, from?: MessagePort) => {
      if (socket) {
        socket.on("data", (data) => {
          console.log("proxy data:" + data);
          socket.write("echo:" + data);
        });
      }
    });
  } else if (workerData.type === 2) {
    const client = new IWC_Client();
    await client.connect("zz");
    const socket = createConnection(workerData.address);
    client.send("zzzz", undefined, socket);
  }
})();
