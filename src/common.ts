import * as net from "node:net";
import { JSONDryFactory } from "npm:@bnqkl/json-dry-factory";
import { Buffer } from "node:buffer";
import { setImmediate } from "node:timers";
export const IPCJSONDry = new JSONDryFactory("gipc");
/**
 * 粘包分包的处理函数
 */
export function commonMessageReceiver(socket: NodeJS.EventEmitter) {
  var tomsg: {
    length: number;
    data: Buffer;
  } | null = null;
  const handle_chunk = (chunk: any) => {
    if (tomsg && tomsg.length === -1) {
      chunk = Buffer.concat([tomsg.data, chunk]);
      tomsg = null;
    }
    if (!tomsg) {
      if (chunk.length < Uint32Array.BYTES_PER_ELEMENT) {
        tomsg = {
          length: -1,
          data: chunk,
        };
        return;
      }
      tomsg = {
        length: chunk.readUInt32LE(0),
        data: Buffer.alloc(0),
      };
      chunk = chunk.slice(Uint32Array.BYTES_PER_ELEMENT);
    }
    const cur_len = tomsg.data.length;
    const next_len = chunk.length;
    const need_len = tomsg.length - cur_len;
    if (next_len > need_len) {
      // 粘包
      // console.log('tomsg.data', tomsg.data)
      tomsg.data = Buffer.concat([tomsg.data, chunk.slice(0, need_len)]);
      const message = IPCJSONDry.parse(tomsg.data.toString());
      setImmediate(() => {
        // 使用setImmediate，还没进入下一次事件循环，所以不用考虑socket断开连接的情况，即便是断开也是在这之后去触发的。
        socket.emit("message", message);
      });
      tomsg = null;
      handle_chunk(chunk.slice(need_len));
      return;
    } else if (next_len == need_len) {
      tomsg.data += chunk;
      const message = IPCJSONDry.parse(tomsg.data.toString());
      setImmediate(() => {
        socket.emit("message", message);
      });
      tomsg = null;
    } else {
      tomsg.data = Buffer.concat([tomsg.data, chunk]);
    }
  };
  socket.on("data", handle_chunk);
  socket.on("close", () => {
    // console.log("socket closed")
    tomsg = null;
  });
  socket.on("close", () => {
    socket.emit("exit");
  });
}
export function commonMessageSender(socket: net.Socket, obj: any) {
  const data = Buffer.from(IPCJSONDry.stringify(obj));
  const pre_info = new Uint32Array(1);
  pre_info[0] = data.length;
  socket.write(Buffer.from(pre_info.buffer));
  socket.write(data);
}
