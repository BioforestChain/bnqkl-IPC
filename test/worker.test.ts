import { giwcSetup, IWC_Client, IWC_Server } from "@bfchain/ipc";
import { isMainThread, workerData } from "worker_threads";

const sendTo = async (target: string, msg: string) => {
  const client = new IWC_Client();
  await client.connect(target);
  client.send({
    msg,
  });
};

(async () => {
  if (isMainThread) {
    const { createWorker } = giwcSetup();
  createWorker(__filename, { workerData: { type: 2 } });
    setTimeout(() => {
      createWorker(__filename, { workerData: { type: 1 } });
    }, 1000);

    const sever = new IWC_Server("mm");
    await sever.listen();
    sever.on("message", (_port, msg) => {
      console.log(sever.path, msg);
    });

    await sendTo("t1", "from main thread");
    await sendTo("mm", "from main thread");
  } else {
    if (workerData.type === 1) {
      const sever = new IWC_Server("t1");
      await sever.listen();
      sever.on("message", (_port, msg) => {
        console.log(sever.path, msg);
      });
    } else if (workerData.type === 2) {
      await sendTo("t1", "from thread 2");
      await sendTo("mm", "from thread 2");

      const { createWorker } = giwcSetup();
      createWorker(__filename, { workerData: { type: 3 } });
    } else if (workerData.type === 3) {
      await sendTo("mm", "from thread 3");
      await sendTo("t1", "from thread 3");
    }
  }
})().catch(console.error);
