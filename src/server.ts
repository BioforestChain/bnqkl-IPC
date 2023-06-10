import * as net from "node:net";
import * as cluster from "node:cluster";
import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
const v8 = require("v8");
import { commonMessageReceiver, commonMessageSender } from "./common.ts";

export type IPC_SERVER_PATH = ReturnType<typeof net.Server.prototype.address>;
export type IPC_SERVER_PATH_PROMISE =
  | string
  | number
  | Promise<IPC_SERVER_PATH>;

import { debug, constants } from "./constants.ts";
let uid = 0;
export class IPC_Server extends EventEmitter {
  /**
   *
   * @param {number} process_id 进程pid
   * @param {string} name 服务名
   * @param {*} uid_info 描述服务的拓展信息
   */
  static generateUUID(process_id: number, name: string, uid_info = {}) {
    const uuid_buffer = v8.serialize(uid_info);
    const md5 = crypto.createHash("md5");
    const _uid = md5.update(uuid_buffer).digest("hex");
    return `${name}-${process_id}-${_uid}`;
  }
  static getIPCAddress(uuid: string, useable_port?: number) {
    if (process.platform === "win32") {
      if (cluster.isMaster) {
        return `\\\\.\\pipe\\${uuid}`;
      } else {
        /**
         * Windows系统上，对于子进程套接字的支持，有bug
         * https://github.com/RIAEvangelist/node-ipc/issues/109
         * 所以在子进程模式下，返回null对象，这样在listen的时候，会默认启用TCP连接，
         * 届时再将path对象重新赋值。也就是说真实的path对象，必须在listen后才能使用。
         */
        if (useable_port) {
          return useable_port;
        } else {
          return new Promise<IPC_SERVER_PATH>((resolve, reject) => {
            debug("ask master useable port:%o", {
              [constants.cmd_key]: constants.ASK_USEABLE_PORT
            });
            (process.send as any)({
              [constants.cmd_key]: constants.ASK_USEABLE_PORT
            });
            setTimeout(() => {
              reject(new Error("get useable_address time out"));
            }, 10000);
            const wait_answer = (msg: any) => {
              if (
                msg &&
                msg[constants.cmd_key] === constants.ANSWER_USEABLE_PORT
              ) {
                process.removeListener("message", wait_answer);
                resolve(msg.useable_address);
              }
            };
            process.on("message", wait_answer);
          });
        }
        // debugger
        // const tmp_server = net.createServer();
        // return new Promise((resolve, reject) => {
        //     tmp_server.listen(() => {
        //         resolve(tmp_server.address())
        //     });
        //     tmp_server.on('error', reject);
        // });
      }
    }
    return `/tmp/${uuid}.sock`;
  }
  // 注意，这个只能在主进程中使用。
  static getFreeTCPPort() {
    const tmp_server = net.createServer();
    try {
      tmp_server.listen();
      // 在主进程中，端口是可以直接生成的，如果是子进程，则是异步的。
      return (tmp_server.address() as net.AddressInfo).port;
    } finally {
      tmp_server.close();
    }
  }
  server = new net.Server();
  path?: IPC_SERVER_PATH;
  private _path: IPC_SERVER_PATH_PROMISE;
  constructor(
    public uuid: string = `anonymous_${++uid}`, //= IPC_Server.generateUUID(process.pid, )
    useable_port?: number,
    public customReceiver = commonMessageReceiver,
    public customSender = commonMessageSender
  ) {
    super();
    this._path = IPC_Server.getIPCAddress(uuid, useable_port);
  }
  _releaseSockFile() {
    if (process.platform !== "win32" && typeof this._path === "string") {
      const path = this._path;
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    }
  }
  async listen(
    middleware = (socket: net.Socket, msg: any, cb: Function) => {
      cb();
    }
  ) {
    this._releaseSockFile();
    const path = await this._path;
    return new Promise<IPC_SERVER_PATH>((resolve, reject) => {
      this.server.listen(path, () => {
        resolve((this.path = this.server.address()));
        this.server.removeListener("error", reject);
        // 释放文件引用
        this.server.on("close", () => {
          this._releaseSockFile();
          this.emit("close");
        });
        this.server.on("connection", socket => {
          this.customReceiver(socket);
          (socket as any)["send"] = this.send.bind(this, socket);
          this.emit("connection", socket);
          socket.on("message", msg => {
            //这里加拦截中间件
            middleware(socket, msg, () => {
              this.emit("message", socket, msg);
            });
          });
        });
        debug(`IPC Server <${this.uuid}> Started, Sock Path In: %o`, this.path);
      });
      this.server.on("error", reject);
      this.server.on("error", err => this.emit("error", err));
    });
  }
  send(socket: net.Socket, msg: any) {
    return this.customSender(socket, msg);
  }
}
