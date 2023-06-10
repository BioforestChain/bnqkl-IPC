import { Worker as _Worker, MessagePort as _MessagePort, TransferListItem as _TransferListItem} from "node:worker_threads";
import { constants as _constants} from "./constants.ts";
import { Socket as _Socket} from "node:net";
export {};
declare global {
  export namespace GIWC {
    export type Worker = _Worker;
    export type MessagePort = _MessagePort;

    export interface BaseMsg<C extends _constants> {
      GIWC_CMD: C;
    }
    export interface RegistryIwcMsg
      extends BaseMsg<_constants.REGISTRY_IWC> {
      rid: number;
      iwc_path: string;
    }
    export interface AskConnectMsg
      extends BaseMsg<_constants.ASK_CONNECT> {
      rid: number;
      // from_iwc_path: string;
      to_iwc_path: string;
      message_port: MessagePort;
    }

    export type AnyMainMsg =
      | RegistryIwcMsg
      | AskConnectMsg
      | AskMainThreadPortMsg;

    export interface AnwserIwcMsg
      extends BaseMsg<_constants.ANWSER_IWC> {
      rid: number;
      success: boolean;
    }
    export interface AnwserConnectMsg
      extends BaseMsg<_constants.ANWSER_CONNECT> {
      rid: number;
      success: boolean;
    }
    export interface PingMsg
      extends BaseMsg<_constants.PING> {
      rid: number;
    }
    export interface PongMsg
      extends BaseMsg<_constants.PONG> {
      rid: number;
    }

    export interface AskMainThreadPortMsg
      extends BaseMsg<_constants.ASK_MAIN_THREAD_PORT> {
      message_port: MessagePort;
    }

    // interface TransferWorkerPortMsg
    //   extends BaseMsg<_constants.TRANSFER_WORKER_PORT> {
    //   message_port: MessagePort;
    // }

    export type AnyWorkerMsg =
      | AnwserIwcMsg
      | AnwserConnectMsg
      | AskConnectMsg
      | PingMsg
      | PongMsg;
    export type AnySubWorkerMsg =
      AskMainThreadPortMsg /* | TransferWorkerPortMsg */;

    export type SuperPort<
      T extends Worker | MessagePort = Worker | MessagePort
    > = {
      id: number;
      source: T;
      on(type: "message", listener: (msg: any) => unknown): void;
      once(type: "message", listener: (msg: any) => unknown): void;
      off(type: "message", listener: (msg: any) => unknown): void;
      on(type: "close", listener: () => unknown): void;
      once(type: "close", listener: () => unknown): void;
      off(type: "close", listener: () => unknown): void;
      on(type: "start", listener: () => unknown): void;
      once(type: "start", listener: () => unknown): void;
      off(type: "start", listener: () => unknown): void;
      send: (
        msg: any,
        transferList?:
          | readonly _TransferListItem[]
          | undefined,
        socket?: _Socket | undefined
      ) => void;
      destroy(err?: unknown): void;
    };
  }
}
