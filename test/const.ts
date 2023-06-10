// /* cb转async的骚操作 by Gaubee
//  * 用法：obj.handleName(...args,function cb(err, res){})
//  * 可以改写成：await obj.promise.handleNameAsync(...args)
//  *
//  * 这个写法是将来的nodejs趋势写法，比如以后的fs模块会提供Promise返回的接口，
//  * 就是：fs.promise.readFileAsync(filename)
//  */
// const promisify = require("util").promisify;
// const promise_symbol = Symbol("promise");
// Object.defineProperty(Object.prototype, "promise", {
//     get() {
//         if (!this[promise_symbol]) {
//             const self_proxy = new Proxy(
//                 {} as any,
//                 {
//                     get: (target, name) => {
//                         if (target[name]) {
//                             return target[name];
//                         }
//                         if (typeof name === "string" && name.endsWith("Async")) {
//                             if (this[name]) {
//                                 const stack = new Error("").stack || "";
//                                 console.warn(`${name}已经在源对象上有定义，也许应该直接使用源对象上的方法\n${stack.split("\n")[2]}`);
//                             }
//                             const handle_name = name.substr(0, name.length - 5);
//                             let cur_handle:any;
//                             let promisify_handle:any;
//                             target[name] = (...args:any[]) => {
//                                 // 如果handle发生了变动，就需要重新初始化一次这个Async函数。
//                                 if (this[handle_name] !== cur_handle) {
//                                     cur_handle = this[handle_name];
//                                     promisify_handle = promisify(cur_handle).bind(this);
//                                 }
//                                 if (!promisify_handle) {
//                                     throw new Error(`in class [${target.constructor.name}],property ${name} is not an function.`);
//                                 }
//                                 return promisify_handle(...args);
//                             };
//                         }
//                         return target[name];
//                     },
//                 }
//             );
//             this[promise_symbol] = self_proxy;
//         }
//         return this[promise_symbol];
//     },
//     set(v) {
//         this[promise_symbol] = v;
//     },
// });

import path = require("node:path");

// function fromCallback(this:any,cb:Function) {
//     if (this.then instanceof Function) {
//         return this.then((res:any) => {
//             cb(null, res);
//         }, cb);
//     } else {
//         throw new TypeError("fromCb/fromCallback must for thenable(Promie or PromieLike).");
//     }
// }
// // 使用defineProperty，默认不可遍历出来。
// Object.defineProperty(Promise.prototype, "fromCb", {
//     value: fromCallback,
//     writable: true,
// });
// Object.defineProperty(Promise.prototype, "fromCallback", {
//     value: fromCallback,
//     writable: true,
// });

// /** 这里finally只是一个简单的模拟，如果要深入使用
//  *  如果要使用标准的shim
//  *  应该使用https://github.com/es-shims/Promise.prototype.finally这个
//  */
// if (typeof Promise.prototype.finally !== "function") {
//     (Promise.prototype as any).finally = function(fn:Function) {
//         return this.then((value:any) => Promise.resolve(fn()).then(() => value)).catch((reason:any) =>
//           Promise.resolve(fn()).then(() => {
//                 throw reason;
//             })
//         );
//     };
// }

// console.log("with dirty object_proto_")

export const TIMES = 50000;
export const DURACTION = 20_000; // 20s

let sodiumApi: any;
export const getSodiumApi = () => {
  if (sodiumApi === undefined) {
    sodiumApi = require(process.env.SODIUM_NODE_PATH ||
      path.join(process.cwd(), "../ifmchain/sodium.node"));
  }
  return sodiumApi;
};
let sodiumTestEnv: any;

const enum TEST_TYPE {
  sodium = "sodium",
  bfchain_log = "bfchain-log",
}

let testType: TEST_TYPE | undefined;
export const testSodiumApi =
  process.env.TEST_TYPE === TEST_TYPE.sodium
    ? ((testType = TEST_TYPE.sodium),
      () => {
        if (sodiumTestEnv === undefined) {
          const secretHash = new Uint8Array(32);
          const keypair = sodiumApi.crypto_sign_seed_keypair(secretHash);
          const hash = new Uint8Array(1024);
          sodiumTestEnv = [secretHash, keypair, hash];
        }
        getSodiumApi().crypto_sign_detached(
          sodiumTestEnv[2],
          sodiumTestEnv[1].secretKey
        );
      })
    : () => {};
import { IPC_Client, IWC_Client, IPCJSONDry, IWCJSONDry } from "@bfchain/ipc";
import * as fs from "node:fs";
import { threadId } from "node:worker_threads";

const testClient_Normal = (() => {
  let d = 0;
  return (c: IPC_Client | IWC_Client, msg?: any) => {
    if (msg === undefined) {
      //   console.log("send start", threadId);
      c.send("~~start~~");
      c.send({ d: 0 });
    } else if ("d" in msg) {
      const d = ++msg.d;
      if (d >= TIMES) {
        c.send("~~end~~");
      } else {
        c.send({ d });
      }
    }
  };
})();

const testServer_Normal = (
  port: IPC_Client | IWC_Client,
  label: string,
  endTest: Function,
  msg?: any
) => {
  if (msg === "~~start~~") {
    // console.log("start", label);
    console.time(label);
  } else if (msg === "~~end~~") {
    console.timeEnd(label);
    endTest();
  } else if (msg) {
    port.send(msg);
  }
};

let testClient = testClient_Normal;
let testServer = testServer_Normal;
if (process.env.TEST_TYPE === TEST_TYPE.bfchain_log) {
  testType = TEST_TYPE.bfchain_log;

  const testClient_BFChainLog = (() => {
    const logList = fs
      .readFileSync(
        process.env.BFCHAIN_LOG_PATH ||
          require.resolve("@bfchain/ipc/blockChain.log"),
        "utf-8"
      )
      .trim()
      .split("\n")
      .slice(0, TIMES)
      .map((line, i) => {
        line = line.slice(line.indexOf("\t") + 1);
        if (line.startsWith("[")) {
          const data = IPCJSONDry.parse(line);
          return { icmd: "IPC_REQS_RES", req_id: i, data };
        } else {
          const index = line.indexOf("\t");
          const header = line.slice(index);
          line = line.slice(line.indexOf("\t") + 1);
          const data = IPCJSONDry.parse(line);
          return { icmd: "IPC_REQS_REQ", req_id: i, pkg: { header, data } };
        }
      });
    const logIterator = logList[Symbol.iterator]();
    return (c: IPC_Client | IWC_Client) => {
      const n = logIterator.next();
      if (!n.done) {
        c.send(n.value);
      } else {
        c.send("---end---");
      }
    };
  })();
  const testServer_BFChainLog = (
    port: IPC_Client | IWC_Client,
    label: string,
    endTest: Function,
    msg?: any
  ) => {
    if (msg === undefined) {
      console.time(label);
      port.send("---start----");
      return;
    }
    if (msg === "---end---") {
      console.timeEnd(label);
      endTest();
    } else {
      port.send(msg);
    }
  };
  testClient = testClient_BFChainLog;
  testServer = testServer_BFChainLog;
}
export { testClient, testServer };

// console.log("Test Type:", testType || "normal");
