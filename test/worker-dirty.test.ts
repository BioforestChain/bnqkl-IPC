import { giwcSetup, IWC_Client, IWC_Server } from "@bfchain/ipc";
import { isMainThread, threadId } from "worker_threads";
import { testClient, testServer, testSodiumApi } from "./const";

const { createWorker } = giwcSetup();

(async () => {
  if (isMainThread) {
    let closed = 0;
    let opend = 0;
    const tryClose = () => {
      closed += 1;
      if (closed >= opend) {
        process.exit(0);
      }
    };
    {
      const MM_WORKER = parseInt(process.argv[2]) || 0;

      if (MM_WORKER > 0) {
        const sever = new IWC_Server("mm");
        await sever.listen();

        let t = 0;
        sever.on("connection", (port) => {
          const label = `z-${t++}`;
          port.on("message", (msg: any) => {
            testServer(port, label, tryClose, msg);
          });

          testServer(port, label, tryClose);
        });

        for (let n = 0; n < MM_WORKER; n++) {
          createWorker(__filename, {
            env: {
              ...process.env,
              MM_TYPE: "worker",
            },
          });
        }
        opend += MM_WORKER;
      }
    }
    {
      const MM_OTHER = parseInt(process.argv[3]) || 0;

      for (let n = 1; n <= MM_OTHER; n++) {
        createWorker(__filename, {
          env: {
            ...process.env,
            MM_TYPE: "other",
            MM_OTHER_ID: n.toString(),
            MM_OTHER: MM_OTHER.toString(),
          },
        });
      }
      opend += MM_OTHER;
    }
  } else if (process.env.MM_TYPE === "worker") {
    console.log("mm child:", threadId);
    const client = new IWC_Client();
    await client.connect("mm");
    client.on("message", (msg) => {
      testSodiumApi();
      testClient(client, msg);
    });
    testClient(client);
  } else if (process.env.MM_TYPE === "other") {
    const uri = `mm-${process.env.MM_OTHER_ID}`;
    console.log("mm other:", uri);
    const server = new IWC_Server(uri);
    await server.listen();
    server.on("connection", (port) => {
      console.log("uri %s got connection", uri);
      port.on("message", (msg: any) => {
        port.send(msg);
      });
    });
    const MM_OTHER = parseInt(process.env.MM_OTHER || "") || 0;
    for (let i = 1; i <= MM_OTHER; i++) {
      const cc = new IWC_Client();
      const target = `mm-${i}`;
      await cc.connect(target);
      const logLabel = `${process.env.MM_OTHER_ID}=>${target}:`;
      cc.on("message", (msg) => {
        // console.log(logLabel, msg);
        setTimeout(() => {
          cc.send(msg);
        }, 10);
      });
      cc.send({ msg: "123456" });
    }
  }
})().catch(console.error);
