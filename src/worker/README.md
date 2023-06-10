# IPC & IWC

IWC 是用于模拟 IPC。
IPC 的行为是，将通讯的路径注册到 fileSystem 中，然后通过文件系统进行通讯，而在操作系统底层会对这种文件系统之间的通讯进行特殊优化，直接走内存而不是磁盘。
IWC 需要模拟该行为，就需要有一个可以注册到全局的动作，这里由 `giwcSetup` 来承担这个任务。

## 工作原理

1. 首先 `giwcSetup` 提供一个 `createWorker` 函数，用于替代 `new worker_threads.Worker`。
   > 注意这里`giwcSetup`可以在`MainThread`与`WorkerThread`的任意地方工作
1. 接着在`WorkerThread`中创建的`new IWC_Server`会向`MainThread`发送注册信息。
   > 注册的信息是字符串(`iwc_path`)，方便用其它渠道发送给其它线程
1. 再然后，在`WorkerThread`中使用`new IWC_Client.connect(iwc_path)`
   1. 此时就会将连接需求发送给`MainThread`，带上`source.iwc_path`、`target.iwc_path`与`MessagePort`
   1. `MainThread`向目标线程转发`source.iwc_path`与`MessagePort`，同时向起点线程报告自己的行为
   1. 目标线程收到`MessagePort`，发送第一个数据包 ping
   1. 起点线程收到数据包后，响应一个数据包 pong
   1. 连接建立成果

## ReturnTypeof giwcSetup()

#### createWorker

用于取代 cluster.force ，本质上使用的是 new worker_threads.Worker

#### parentPort

与父级进行通讯的线路，该对象在 mainThread 中也有，只不过，接收该信息的，同样也是 mainThread 自身

#### childrenPorts

与所有 children(通过 createWorker 创建的) 通讯的总线，可以监听 message 与 exit 事件
