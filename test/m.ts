import { gipcSetup, IPC_Server, IPC_Client } from "@bfchain/ipc";
import * as path from "path";
import * as cluster from "cluster";
gipcSetup();

let closed = 0;
let opend = 0;
const doFork = () => {
  opend += 1;
  return cluster.fork();
};
const tryClose = () => {
  closed++;
  if (closed >= opend) {
    process.exit(0);
  }
};

// 启动子进程1
cluster.setupMaster({
  exec: path.resolve(__dirname, "c1"),
});
const c1 = doFork();
c1.on("exit", tryClose);

// 子进程通讯转发连接地址
type Msg = { address: string; times: number };
let c1_info_promise_resolve: (value: Msg) => void;
const c1_info_promise = new Promise<Msg>((resolve) => {
  c1_info_promise_resolve = resolve;
});
cluster.on("message", (w, m) => {
  if (m.cmd === "ipc-address") {
    c1_info_promise_resolve(m);
  } else if (m.cmd === "ask-ipc-address") {
    c1_info_promise.then((info) =>
      w.send({
        cmd: "answer-ipc-address",
        address: info.address,
        times: info.times,
      })
    );
  }
});

// 启动子进程2
cluster.setupMaster({
  exec: path.resolve(__dirname, "c2"),
});
const N = parseInt(process.argv[2]) || 1;
for (let n = 0; n < N; n++) {
  doFork().on("exit", tryClose);
}
