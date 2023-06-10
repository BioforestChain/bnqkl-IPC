export {};
declare global {
  namespace GIWC {
    type Worker = import("node:worker_threads").Worker;
    type MessagePort = import("node:worker_threads").MessagePort;

    interface BaseMsg<C extends import("./constants.ts").constants> {
      GIWC_CMD: C;
    }
    interface RegistryIwcMsg
      extends BaseMsg<import("./constants.ts").constants.REGISTRY_IWC> {
      rid: number;
      iwc_path: string;
    }
    interface AskConnectMsg
      extends BaseMsg<import("./constants.ts").constants.ASK_CONNECT> {
      rid: number;
      // from_iwc_path: string;
      to_iwc_path: string;
      message_port: MessagePort;
    }

    type AnyMainMsg = RegistryIwcMsg | AskConnectMsg | AskMainThreadPortMsg;

    interface AnwserIwcMsg
      extends BaseMsg<import("./constants.ts").constants.ANWSER_IWC> {
      rid: number;
      success: boolean;
    }
    interface AnwserConnectMsg
      extends BaseMsg<import("./constants.ts").constants.ANWSER_CONNECT> {
      rid: number;
      success: boolean;
    }
    interface PingMsg extends BaseMsg<import("./constants.ts").constants.PING> {
      rid: number;
    }
    interface PongMsg extends BaseMsg<import("./constants.ts").constants.PONG> {
      rid: number;
    }

    interface AskMainThreadPortMsg
      extends BaseMsg<import("./constants.ts").constants.ASK_MAIN_THREAD_PORT> {
      message_port: MessagePort;
    }

    // interface TransferWorkerPortMsg
    //   extends BaseMsg<import("./constants.ts").constants.TRANSFER_WORKER_PORT> {
    //   message_port: MessagePort;
    // }

    type AnyWorkerMsg =
      | AnwserIwcMsg
      | AnwserConnectMsg
      | AskConnectMsg
      | PingMsg
      | PongMsg;
    type AnySubWorkerMsg = AskMainThreadPortMsg /* | TransferWorkerPortMsg */;

    type SuperPort<T extends Worker | MessagePort = Worker | MessagePort> = {
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
          | readonly import("node:worker_threads").TransferListItem[]
          | undefined,
        socket?: import("node:net").Socket | undefined
      ) => void;
      destroy(err?: unknown): void;
    };
  }
}
