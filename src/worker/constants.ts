export const debug = require("debug")("gipc");
export const cmd_key = "GIWC_CMD";

export const enum constants {
  REGISTRY_IWC = "registry iwc",
  ANWSER_IWC = "anwser iwc",

  ASK_CONNECT = "ask connect",
  ANWSER_CONNECT = "anwser connect",

  PING = "ping",
  PONG = "pong",

  /**
   * 如果是 main 创建了 worker1，
   * 那么在进行 giwcSetup 的时候，会创建一个 messageChannel(m-1)，
   * 然后将 m1.port2 通过 parentPort 发送给 main。
   * 那么接下来，所有的通讯都会通过 m1 进行
   *
   * 如果是 worker1 创建的 worker2，
   * 那么 worker2 那么在进行 giwcSetup 的时候，会创建一个 messageChannel(m-2)，
   * 然后将 m2.port2 通过 parentPort 发送给 worker1，
   * worker1 发现自己不是 main， 将 m2.port2 通过 m1.port1 转发给 main
   *
   */
  ASK_MAIN_THREAD_PORT = "ask main thread port",
  // TRANSFER_WORKER_PORT = "transfer worker port",
}

let _rid_acc = 0;
export const getRid = () => _rid_acc++;
