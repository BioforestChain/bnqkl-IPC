import * as net from "node:net";
import { commonMessageReceiver, commonMessageSender } from "./common.ts";
import { EventEmitter } from "node:events";
import { debug } from "./constants.ts";

export type IPC_LINK_PATH = any;
export class IPC_Client extends EventEmitter {
  socket: net.Socket;
  public ipc_link_path: IPC_LINK_PATH;
  constructor(
    ipc_link_path?: IPC_LINK_PATH,
    public readonly customReceiver = commonMessageReceiver,
    public customSender = commonMessageSender
  ) {
    super();
    this.socket = new net.Socket(ipc_link_path);
    customReceiver(this.socket);
    if (ipc_link_path) {
      this.connect(ipc_link_path);
    }

    let before_connnect_send_cache: any[] = [];
    const send_handler = this.send;
    this.send = (msg) => {
      before_connnect_send_cache.push(msg);
    };
    this.socket.once("connect", () => {
      this.send = send_handler;
      for (let msg of before_connnect_send_cache) {
        setImmediate(() => {
          this.send(msg);
        });
      }
      (before_connnect_send_cache as any) = null;
      this.emit("connection", this);
    });
    this.socket.on("message", (msg) => this.emit("message", msg));
    this.socket.on("close", () => this.emit("close"));
  }
  connect(ipc_link_path?: IPC_LINK_PATH, connectListener?: Function) {
    if (this.ipc_link_path) {
      return this;
    }
    this.ipc_link_path = ipc_link_path;
    this.socket.connect(this.ipc_link_path, () => {
      debug("IPC Client Connected, Sock Path In: %o", this.ipc_link_path);
      connectListener instanceof Function && connectListener();
    });
    return this;
  }
  send(msg: any) {
    return this.customSender(this.socket, msg);
  }
  close() {
    this.socket.destroy();
  }
}
