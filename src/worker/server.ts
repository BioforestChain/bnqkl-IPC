import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as v8 from "node:v8";
import { constants, getRid } from "./constants.ts";
import { giwcSetup } from "./mainShim.ts";
import { superPort } from "./superPort.ts";

type Middleware = (socket: GIWC.SuperPort, msg: any, cb: Function) => unknown;
/**
 * worker之间的IPC，注意，只能用于worker之间，不可以worker与process之间。
 */
export class IWC_Server extends EventEmitter {
  // implements
  //   {
  //     on(
  //       type: "connection",
  //       listener: (port: GIWC.SuperPort<MessagePort>) => any
  //     ): this;,
  //   }
  /**
   *
   * @param {number} threadId 线程pid
   * @param {string} name 服务名
   * @param {*} uid_info 描述服务的拓展信息
   */
  static generateUUID(threadId: number, name: string, uid_info = {}) {
    const uuid_buffer = v8.serialize(uid_info);
    const md5 = crypto.createHash("md5");
    const _uid = md5.update(uuid_buffer).digest("hex");
    return `${name}-${threadId}-${_uid}`;
  }

  constructor(readonly path: string) {
    super();
  }
  private pp = giwcSetup()._mainThreadPort;
  private _listen_pp_msg?: (msg: GIWC.AnyWorkerMsg) => {};

  async listen(
    middleware: Middleware = (socket: GIWC.SuperPort, msg: any, cb: Function) =>
      cb()
  ) {
    if (this._listen_pp_msg) {
      return;
    }
    this._listen_pp_msg = (msg) => this._onMsg(msg, middleware);

    const regMsg: GIWC.RegistryIwcMsg = {
      GIWC_CMD: constants.REGISTRY_IWC,
      rid: getRid(),
      iwc_path: this.path,
    };
    const mainThreadPort = this.pp;
    /// 注册握手连接的事件
    /**
     * @TODO 这里过多地进行onmessage监听，会导致nodejs性能警告
     */
    mainThreadPort.on("message", this._listen_pp_msg);

    /// 发送注册服务的事件
    mainThreadPort.postMessage(regMsg);
    await new Promise<void>((resolve, reject) => {
      const onMessage = (msg: GIWC.AnyWorkerMsg) => {
        switch (msg.GIWC_CMD) {
          case constants.ANWSER_IWC:
            if (msg.rid === regMsg.rid) {
              mainThreadPort.off("message", onMessage);
              if (msg.success) {
                resolve();
              } else {
                reject();
              }
            }
            break;
        }
      };
      mainThreadPort.on("message", onMessage);
    });
    return this.path;
  }
  private async _onMsg(msg: GIWC.AnyWorkerMsg, middleware: Middleware) {
    switch (msg.GIWC_CMD) {
      case constants.ASK_CONNECT:
        const { message_port } = msg;
        if (msg.to_iwc_path !== this.path) {
          /// 信息不是发给自己的，忽略
          return;
        }
        const pingMsg: GIWC.PingMsg = {
          GIWC_CMD: constants.PING,
          rid: getRid(),
        };
        message_port.postMessage(pingMsg);
        const startBindMessage = () => {
          const super_port = superPort(message_port);
          super_port.on("message", (msg) => {
            middleware(super_port, msg, () => {
              this.emit("message", super_port, msg);
            });
          });

          this.emit("connection", super_port);
        };
        await new Promise<void>((resolve, reject) => {
          const onPong = (msg: GIWC.AnyWorkerMsg) => {
            if (msg.GIWC_CMD === constants.PONG && msg.rid === pingMsg.rid) {
              startBindMessage();
              off();
              resolve();
            }
          };
          const onClose = () => (off(), reject("server pingpong closed"));

          message_port.on("message", onPong);
          message_port.on("close", onClose);
          const off = () => {
            message_port.off("message", onPong);
            message_port.off("close", onClose);
          };
        });

        break;
    }
  }
}
