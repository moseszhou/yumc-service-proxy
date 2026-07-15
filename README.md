# yumc-service-proxy

为 H5/Cordova、React Native 和其它非 Native 环境提供统一的服务代理。

这个包的目标是让业务代码用同一套服务对象访问平台能力，同时把平台差异收敛到代理层：

- H5/Cordova：等待 `deviceready` 或自定义 `ready` 后访问 `window[serviceName]`。
- React Native：同步读取 `NativeModules[serviceName]`。
- 其它平台/小程序：没有 native service，统一降级为 no-op。

## 安装

```bash
yarn add yumc-service-proxy
```

## 入口

```typescript
// React Native，默认入口
import { createReadyProxy } from 'yumc-service-proxy'

// H5/Cordova
import { createReadyProxy } from 'yumc-service-proxy/h5'

// 小程序/其它非 Native 平台
import { createReadyProxy } from 'yumc-service-proxy/other'
```

## HTML Canvas 流程图

完整 H5/RN 创建代理代码流程图使用 HTML Canvas 绘制，文件在 [docs/platform-flow.html](./docs/platform-flow.html)。

在浏览器打开该文件可以查看 `createReadyProxy` / `createRnProxy` 内部如何合并配置、读取 native service、创建 `Proxy`、注册实例并返回代理对象。

## H5/Cordova 用法

```typescript
import { createReadyProxy } from 'yumc-service-proxy/h5'

interface RedPacketRainService {
  start: (options: Record<string, unknown>) => Promise<void>
  stop: () => Promise<void>
}

export const redPacketRainService = createReadyProxy<RedPacketRainService>({}, 'redPacketRainService', {
  version: '1.0.0',
  queueTimeout: 30000,
  maxQueueSize: 300,
  properties: ['start', 'stop'],
  enforceMethodFilter: true,
  removeFromGlobal: true
})

await redPacketRainService.canIUse('start')
await redPacketRainService.start({ scene: 'home' })
```

### H5 执行规则

- `createReadyProxy` 创建代理后立即返回服务对象。
- 普通方法在 `ready` 前调用会进入队列，`ready` 后统一 flush。
- `ready` 默认来自 Cordova `deviceready`，也可以通过 `options.ready` 自定义。
- `ready` 后代理会捕获 `window[serviceName]`，并在 `removeFromGlobal=true` 时删除全局引用。
- 当本地 `originalService` 没有对应方法时，会桥接到 `window[serviceName][method]`。
- `canIUse(functionName)` 返回 `Promise<boolean>`，会等待 `ready` 后检查 native service。
- 开启 `enforceMethodFilter` 时，只有 `properties` 中声明的方法才可用。

## React Native 用法

```typescript
import { createReadyProxy } from 'yumc-service-proxy'

interface RedPacketRainService {
  start: (options: Record<string, unknown>) => void
  stop: () => void
}

export const redPacketRainService = createReadyProxy<RedPacketRainService>({}, 'RedPacketRainService', {
  version: '1.0.0',
  properties: ['start', 'stop'],
  enforceMethodFilter: true,
  removeFromGlobal: true
})

const available = await redPacketRainService.canIUse('start')
if (available) {
  redPacketRainService.start({ scene: 'home' })
}
```

### RN 执行规则

- `createRnProxy` 创建时立即读取 `NativeModules[serviceName]`。
- 如果 native module 不存在，会直接抛错。
- 用户传入的 `originalService` 会覆盖同名 native 方法，用于业务适配。
- `removeFromGlobal=true` 时会从 `NativeModules` 删除原始模块引用，强制业务走代理。
- `canIUse(functionName)` 返回 `Promise<boolean>`，不等待 ready。
- RN 的 `canIUse` 只检查 `NativeModules[serviceName]` 本体，不检查用户覆盖后的方法。
- 开启 `enforceMethodFilter` 时，native 方法也必须在 `properties` 中才可用。

## 小程序/其它平台用法

```typescript
import { createReadyProxy } from 'yumc-service-proxy/other'

interface RedPacketRainService {
  start: (options: Record<string, unknown>) => void
  stop: () => void
}

export const redPacketRainService = createReadyProxy<RedPacketRainService>({}, 'RedPacketRainService', { version: '1.0.0' })

await redPacketRainService.canIUse('start') // false
redPacketRainService.start({ scene: 'home' }) // no-op
```

### 其它平台执行规则

- 不访问 `window`。
- 不访问 `NativeModules`。
- `canIUse(functionName)` 永远返回 `Promise<false>`。
- 任意业务方法都返回空函数，调用后返回 `undefined`。

## 跨平台封装建议

```typescript
import type { ProxiedService } from 'yumc-service-proxy'

interface RedPacketRainService {
  start: (options: Record<string, unknown>) => Promise<void> | void
  stop: () => Promise<void> | void
}

let redPacketRainService: ProxiedService<RedPacketRainService>

if (process.env.TARO_ENV === 'h5') {
  const { createReadyProxy } = await import('yumc-service-proxy/h5')
} else if (process.env.TARO_ENV === 'rn') {
  const { createReadyProxy } = await import('yumc-service-proxy')
} else {
  const { createReadyProxy } = await import('yumc-service-proxy/other')
}
redPacketRainService = createReadyProxy<RedPacketRainService>({}, 'RedPacketRainService')
export { redPacketRainService }
```

## API

### `createReadyProxy<T>(service, serviceName, options?)`

H5/Cordova 入口和其它平台入口都使用这个函数名，但行为不同：

- `yumc-service-proxy/h5`：等待 ready，桥接 `window[serviceName]`。
- `yumc-service-proxy/other`：不访问 native，全部降级。
- React Native 入口，读取 `NativeModules[serviceName]` 并创建代理。

### `ProxyOptions`

```typescript
export interface ProxyOptions {
  queueTimeout?: number
  debug?: boolean
  maxQueueSize?: number
  ready?: Promise<void>
  version?: string
  properties?: string[]
  parameter?: {
    h5?: Record<string, { sc?: number } | undefined>
    rn?: Record<string, { sc?: number } | undefined>
  }
  enforceMethodFilter?: boolean
  removeFromGlobal?: boolean
}
```

### `ProxiedService<T>`

```typescript
export type ProxiedService<T> = T & {
  name: string
  version: string
  canIUse(functionName: string): Promise<boolean>
}
```

## `canIUse` 语义

H5/Cordova：

- 检查对象：`nativeServiceRef || window[serviceName]`
- 是否等待 ready：是
- 白名单规则：开启 `enforceMethodFilter` 时必须命中 `properties`
- 返回值：`Promise<boolean>`

React Native：

- 检查对象：`NativeModules[serviceName]`
- 是否等待 ready：否
- 白名单规则：开启 `enforceMethodFilter` 时必须命中 `properties`
- 返回值：`Promise<boolean>`

其它/小程序：

- 检查对象：无 native service
- 是否等待 ready：否
- 白名单规则：不适用
- 返回值：`Promise<false>`

## License

MIT
