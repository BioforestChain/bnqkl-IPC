import { PromiseOut } from "npm:@bnqkl/util-node";
import {
  isMainThread, MessageChannel, MessagePort, parentPort, Worker,
  WorkerOptions
} from "node:worker_threads";
import { cmd_key, constants, debug } from "./constants.ts";
import { superPort } from "./superPort.ts";
import EventEmitter = require("events");

type RegInfo = { port: MessagePort; worker?: Worker };
class WorkerPortMap {
  regMap = new Map<string, RegInfo | PromiseOut<RegInfo>>();
  wait(iwc_path: string) {
    let info = this.regMap.get(iwc_path);
    if (info === undefined) {
      info = new PromiseOut<RegInfo>();
      this.regMap.set(iwc_path, info);
    }
    if ("port" in info) {
      return info;
    }
    return info.promise;
  }
  set(iwc_path: string, port: MessagePort, worker?: Worker) {
    let po = this.regMap.get(iwc_path);
    const info: RegInfo = { port, worker };
    if (po instanceof PromiseOut) {
      po.resolve(info);
    }
    this.regMap.set(iwc_path, info);
  }
  has(iwc_path: string) {
    const regInfo = this.regMap.get(iwc_path);
    return !(regInfo === undefined || regInfo instanceof PromiseOut);
  }
  delete(iwc_path: string) {
    const regInfo = this.regMap.get(iwc_path);
    if (regInfo instanceof PromiseOut) {
      regInfo.reject(new Error("deleted"));
    }
    return this.regMap.delete(iwc_path);
  }
  *entries() {
    for (const item of this.regMap) {
      if (item[1] instanceof PromiseOut) {
        continue;
      }
      yield item as [string, RegInfo];
    }
  }
}

class SuperWorkerManager<T extends GIWC.SuperPort> extends EventEmitter {
  private _store = new Map<number, T>();
  getById(id: number) {
    return this._store.get(id);
  }
  add(port: T) {
    if (this._store.has(port.id)) {
      return false;
    }
    this._store.set(port.id, port);

    const onExit = (code: number = 0) => {
      this.emit("exit", port, code);
      this._store.delete(port.id);
    };
    port.on("close", () => onExit(0));

    port.on("message", (msg) => {
      this.emit("message", port, msg);
    });
    return true;
  }
  send(msg: any) {
    for (const port of this._store.values()) {
      port.send(msg);
    }
  }
  entries() {
    return this._store.entries();
  }
}

function giwcSetupForWorkerThread(parentPort: MessagePort) {
  const { port1: mainThreadPortForWorker, port2: mainThreadPortForMain } =
    new MessageChannel();
  const askMainThreadPortMsg: GIWC.AskMainThreadPortMsg = {
    GIWC_CMD: constants.ASK_MAIN_THREAD_PORT,
    message_port: mainThreadPortForMain,
  };
  parentPort.postMessage(askMainThreadPortMsg, [mainThreadPortForMain]);

  const childrenPorts = new SuperWorkerManager();
  const createWorker = (stringUrl: string, options?: WorkerOptions) => {
    const worker = new Worker(stringUrl, options);

    const onAskMainThreadPortMsg = (msg: GIWC.AskMainThreadPortMsg) => {
      if (msg && msg.GIWC_CMD === constants.ASK_MAIN_THREAD_PORT) {
        worker.off("message", onAskMainThreadPortMsg);
        /// 直接转发给 主线程
        mainThreadPortForWorker.postMessage(msg, [msg.message_port]);
      }
    };
    worker.on("message", onAskMainThreadPortMsg);

    const superWorker = superPort(worker);
    childrenPorts.add(superWorker);
    return superWorker;
  };
  debug("setup gipc for worker_thread success.");
  return {
    createWorker,
    _mainThreadPort: mainThreadPortForWorker,
    parentPort: superPort(parentPort),
    childrenPorts,
  };
}
function giwcSetupForMainThread() {
  const workerPortMap = new WorkerPortMap();
  const hookPort = (port: MessagePort, worker?: Worker) => {
    port.on("message", async (msg: GIWC.AnyMainMsg) => {
      if (!(msg && typeof msg === "object" && "GIWC_CMD" in msg)) {
        return;
      }
      switch (msg.GIWC_CMD) {
        case constants.ASK_MAIN_THREAD_PORT:
          hookPort(msg.message_port);
          break;
        case constants.REGISTRY_IWC:
          let canReg = true;
          if (workerPortMap.has(msg.iwc_path)) {
            canReg = false;
          } else {
            workerPortMap.set(msg.iwc_path, port, worker);
          }
          port.postMessage({
            [cmd_key]: constants.ANWSER_IWC,
            rid: msg.rid,
            success: canReg,
          } as GIWC.AnwserIwcMsg);
          break;
        case constants.ASK_CONNECT:
          const targetInfo = await workerPortMap.wait(msg.to_iwc_path);
          let canAsk = true;
          if (targetInfo === undefined) {
            canAsk = false;
          } else {
            targetInfo.port.postMessage(msg, [msg.message_port]);
          }
          port.postMessage({
            [cmd_key]: constants.ANWSER_CONNECT,
            rid: msg.rid,
            success: canAsk,
          } as GIWC.AnwserConnectMsg);
          break;
      }
    });
    /// worker 关闭后，注销相关的注册
    const onExit = () => {
      for (const [iwc, info] of workerPortMap.entries()) {
        if (info.port === port) {
          workerPortMap.delete(iwc);
        }
      }
    };
    worker?.on("exit", onExit);
    port.on("close", onExit);
  };
  const childrenPorts = new SuperWorkerManager();
  const createWorker = (stringUrl: string, options?: WorkerOptions) => {
    const worker = new Worker(stringUrl, options);

    const onAskMainThreadPortMsg = (msg: GIWC.AskMainThreadPortMsg) => {
      if (msg && msg.GIWC_CMD === constants.ASK_MAIN_THREAD_PORT) {
        worker.off("message", onAskMainThreadPortMsg);
        hookPort(msg.message_port, worker);
      }
    };
    worker.on("message", onAskMainThreadPortMsg);

    const superWorker = superPort(worker);
    childrenPorts.add(superWorker);
    return superWorker;
  };

  /// 为主进程提供定制通道，取代parentPort
  const { port1: workerForMainThread, port2: parentPortForMainThread } =
    new MessageChannel();
  hookPort(workerForMainThread);

  childrenPorts.add(superPort(workerForMainThread));

  debug("setup gipc for main_thread success.");
  return {
    createWorker,
    _mainThreadPort: parentPortForMainThread,
    parentPort: superPort(parentPortForMainThread),
    childrenPorts,
  };
}

let steup_cache: ReturnType<
  typeof giwcSetupForMainThread | typeof giwcSetupForWorkerThread
>;

export const giwcSetup = () => {
  if (steup_cache === undefined) {
    steup_cache = isMainThread
      ? giwcSetupForMainThread()
      : giwcSetupForWorkerThread(parentPort!);
  }
  return steup_cache;
};

/// 为 parentPort 提供监听通过 来自 parentThread 的 send事件
if (parentPort) {
  superPort(parentPort);
}
