import { PromiseOut } from "npm:@bnqkl/util-node";
import { MessageChannel, MessagePort } from "node:worker_threads";
import { constants, debug, getRid } from "./constants.ts";
import { giwcSetup } from "./mainShim.ts";
import { superPort } from "./superPort.ts";

type EventConnection = { (type: "connection", listener: () => unknown): void };

export class IWC_Client {
  public to_iwc_path?: string;
  private _mc = new MessageChannel();
  private _mp1 = this._mc.port1;
  private _sp1 = superPort(this._mp1);
  on = this._sp1.on as GIWC.SuperPort["on"] & EventConnection;
  off = this._sp1.off as GIWC.SuperPort["off"] & EventConnection;
  once = this._sp1.once as GIWC.SuperPort["once"] & EventConnection;

  constructor(to_iwc_path?: string) {
    this.pp = giwcSetup()._mainThreadPort;

    if (to_iwc_path) {
      this.connect(to_iwc_path);
    }
  }
  private pp: MessagePort;
  async connect(to_iwc_path: string, connectListener?: Function) {
    if (this.to_iwc_path) {
      return this;
    }
    this.to_iwc_path = to_iwc_path;
    const mainThreadPort = this.pp;

    /// 请求建立连接
    const askConnectMsg: GIWC.AskConnectMsg = {
      GIWC_CMD: constants.ASK_CONNECT,
      rid: getRid(),
      to_iwc_path,
      message_port: this._mc.port2,
    };
    mainThreadPort.postMessage(askConnectMsg, [this._mc.port2]);
    const t1 = new Promise<void>((resolve, reject) => {
      const onAnswerConnect = (msg: GIWC.AnyWorkerMsg) => {
        if (
          msg.GIWC_CMD === constants.ANWSER_CONNECT &&
          msg.rid === askConnectMsg.rid
        ) {
          mainThreadPort.off("message", onAnswerConnect);
          if (msg.success) {
            resolve();
          } else {
            reject("ask worker fail");
          }
        }
      };
      mainThreadPort.on("message", onAnswerConnect);
    });
    const t2 = new Promise<void>((resolve, reject) => {
      const onPing = (msg: GIWC.AnyWorkerMsg) => {
        if (msg.GIWC_CMD === constants.PING) {
          const pongMsg: GIWC.PongMsg = {
            GIWC_CMD: constants.PONG,
            rid: msg.rid,
          };
          this._mp1.postMessage(pongMsg);
          off();
          resolve();
        }
      };
      const onClose = () => {
        off();
        reject("client pingpong closed");
      };
      this._sp1.on("message", onPing);
      this._sp1.on("close", onClose);
      const off = () => {
        this._sp1.off("message", onPing);
        this._sp1.off("close", onClose);
      };
    });
    await t1;
    await t2;
    this._mp1.emit("connection", this);

    this.send = this._sp1.send;

    debug("IWC Client Connected, Sock Path In: %o", this.to_iwc_path);
    connectListener instanceof Function && connectListener();
    return this;
  }
  private _conncectd_promise?: PromiseOut<void>;
  send(...args: Parameters<GIWC.SuperPort["send"]>) {
    if (this._conncectd_promise === undefined) {
      this._conncectd_promise = new PromiseOut();
      this.once("connection", this._conncectd_promise.resolve);
    }
    this._conncectd_promise.onSuccess(() => {
      this._sp1.send(...args);
    });
  }
  close() {
    this._mp1.close();
  }
}
