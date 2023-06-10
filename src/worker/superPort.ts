import {
  MessagePort,
  Worker,
  MessageChannel,
  TransferListItem,
  threadId,
} from "node:worker_threads";
import { Socket, createConnection, createServer } from "node:net";
import * as path from "node:path";
import { debug } from "./constants.ts";
import { IWCJSONDry } from "./common.ts";

const superPortServer = <T extends Worker | MessagePort>(port: T) => {
  if (port instanceof MessagePort) {
    port.once("message", (msg) => {
      port.emit("start");
    });
  }
  const decoder = new TextDecoder();
  port.on("message", (msg) => {
    /**
     * 自定义数据的编解码
     */
    // if ( msg ) {
    //   return onMessage(msg);
    // }

    if (msg && msg.__dirty__) {
      return onMessage(IWCJSONDry.unDirty(msg.__dirty__));
    }
    // if (typeof msg === "string") {
    //   return onMessage(IWCJSONDry.parse(msg));
    // }
    // if (msg instanceof Uint8Array) {
    //   onMessage(IWCJSONDry.parse(decoder.decode(msg)));
    // }
    /// other
    else {
      onMessage(msg);
    }
  });
  const onMessage = (msg: any) => {
    port.emit("dirty-message", msg);
    if (msg && msg[0] === "--super-port-send-channel--") {
      const sendPort2 = msg[1];
      debug("init super-port-send-channel!!");
      sendPort2.on("message", ([dirtyMsg, socketAddress, socket_id]: any) => {
        const proxySocket = createConnection(socketAddress);
        proxySocket.write(socket_id);
        /// message port 是没法传递双参数的，所以这里统一使用process.on('message')
        (process as any).emit(
          "message",
          IWCJSONDry.unDirty(dirtyMsg),
          proxySocket,
          port
        );
      });
    }
  };

  const renameType =
    port instanceof Worker
      ? (type: string) => {
          if (type === "message") {
            type = "dirty-message";
          }
          if (type === "close") {
            type = "exit";
          }
          if (type === "start") {
            type = "online";
          }
          return type;
        }
      : (type: string) => {
          if (type === "message") {
            type = "dirty-message";
          }
          return type;
        };

  const on = (type: string, listener: any) => {
    port.on(renameType(type), listener);
  };
  const once = (type: string, listener: any) => {
    port.once(renameType(type), listener);
  };
  const off = (type: string, listener: any) => {
    port.off(renameType(type), listener);
  };
  return { on, once, off };
};
const superPortClient = <T extends Worker | MessagePort>(source: T) => {
  const initProxyServer = async () => {
    const sendChannel = new MessageChannel();
    source.postMessage(
      ["--super-port-send-channel--", sendChannel.port2],
      [sendChannel.port2]
    );

    const socketAddress = path.join(
      "\\\\?\\pipe",
      process.cwd(),
      process.pid.toString(),
      threadId.toString(),
      Date.now().toString()
    );
    const socketProxyMap = new Map<
      string,
      { sourceSocket: Socket; proxySocket?: Socket }
    >();
    const proxySocketServer = createServer((proxySocket) => {
      proxySocket.once("data", (socket_id_buf) => {
        const socket_id = socket_id_buf.toString();
        debug("get socket_id", socket_id);
        const info = socketProxyMap.get(socket_id);
        if (info === undefined) {
          proxySocket.destroy(
            new Error(
              `proxy socket(${socket_id}) is fail, maybe already closed.`
            )
          );
          return;
        }
        if (info.proxySocket !== undefined) {
          proxySocket.destroy(
            new Error(`reproxy socket(${socket_id}) is forbiden.`)
          );
          return;
        }

        const { sourceSocket } = info;
        sourceSocket.resume();
        info.proxySocket = proxySocket;
        /// 双向转发数据
        sourceSocket.on("data", (msg) => {
          proxySocket.write(msg);
        });
        proxySocket.on("data", (msg) => {
          sourceSocket.write(msg);
        });
        /// 双向控制关闭
        sourceSocket.on("close", (msg) => {
          proxySocket.destroy();
        });
        proxySocket.on("close", () => {
          sourceSocket.destroy();
        });
      });
    });
    await new Promise<void>((resolve, reject) => {
      proxySocketServer.once("error", reject).listen(socketAddress, resolve);
    });

    let closedPort = false;
    /// 在根通道关闭后，代理通达也一并关闭
    source.on("close", () => {
      closedPort = true;
    });
    source.on("exit", () => {
      closedPort = true;
    });

    const socketIdWeakMap = new WeakMap<Socket, string>();
    const transferSocket = (socket: Socket) => {
      let socket_id = socketIdWeakMap.get(socket);
      if (socket_id !== undefined) {
        throw new Error("duplication tansfer socket");
      }
      socket_id = `socket-${Date.now()}-${Math.random()}`;
      socketIdWeakMap.set(socket, socket_id);
      socketProxyMap.set(socket_id, { sourceSocket: socket });

      /// 暂停数据传输，直到被代理连接上了
      socket.pause();
      /// 如果通道被关闭，那么尝试释放内存
      socket.on("close", () => {
        socketProxyMap.delete(socket_id!);
        /// 如果所有相关的通道全部关闭了，那么关闭主代理通道
        if (closedPort) {
          proxySocketServer.close();
        }
      });

      return socket_id;
    };
    return { transferSocket, socketAddress, sendPort: sendChannel.port1 };
  };
  let proxyServerCache: ReturnType<typeof initProxyServer>;
  const getProxyServer = () => {
    return (proxyServerCache ??= initProxyServer());
  };
  const encoder = new TextEncoder();
  const sab = new SharedArrayBuffer(16 * 1024);
  const su8 = new Uint8Array(sab);
  const send = (
    msg: any,
    transferList?: readonly TransferListItem[],
    socket?: Socket
  ) => {
    if (socket) {
      getProxyServer().then(({ transferSocket, socketAddress, sendPort }) => {
        const socket_id = transferSocket(socket);
        sendPort.postMessage(
          [IWCJSONDry.toDirty(msg), socketAddress, socket_id],
          transferList
        );
      });
    } else if (transferList && transferList.length) {
      /**
       * @FIXME JSONDry 尚未支持 transferList
       */
      source.postMessage(msg, transferList);
    } else {
      source.postMessage({ __dirty__: IWCJSONDry.toDirty(msg) });

      // source.postMessage(IWCJSONDry.stringify(msg));

      // const msgbuf = encoder.encode(IWCJSONDry.stringify(msg));
      // source.postMessage(msgbuf, [msgbuf.buffer]);

      // const msgbuf = encoder.encodeInto(IWCJSONDry.stringify(msg), su8);
      // source.postMessage(su8.slice(0,msgbuf.written));

      // source.postMessage(msg);
    }
  };

  const destroy = (error?: unknown) => {
    if (source instanceof Worker) {
      source.terminate();
    } else {
      source.close();
    }
  };

  const pid = source instanceof Worker ? source.threadId : _getPid(source);
  return {
    id: pid,
    send,
    destroy,
  };
};

let _pid_acc = 0;
const _pid_cache = new WeakMap<MessagePort, number>();
const _getPid = (port: MessagePort) => {
  let pid = _pid_cache.get(port);
  if (pid === undefined) {
    pid = ++_pid_acc + 2 ** 16;
    _pid_cache.set(port, pid);
  }
  return pid;
};

const _superedPorts = new WeakMap<Worker | MessagePort, GIWC.SuperPort>();
export const superPort = <T extends Worker | MessagePort>(
  source: T
): GIWC.SuperPort<T> => {
  let sp = _superedPorts.get(source) as GIWC.SuperPort<T>;
  if (sp === undefined) {
    sp = { source, ...superPortClient(source), ...superPortServer(source) };
    _superedPorts.set(source, sp);
  }
  return sp;
};
