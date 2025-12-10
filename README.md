# yumc-service-proxy

为 Cordova/PhoneGap 与 React Native 原生服务提供智能代理包装，统一就绪控制、方法过滤与安全隔离。

## 安装

```bash
npm install yumc-service-proxy
# 或
yarn add yumc-service-proxy
```

## 入口

- H5/Cordova：`import { createReadyProxy } from "yumc-service-proxy"`
- React Native：`import { createRnProxy } from "yumc-service-proxy/rn"`（RN 专用 bundle，避免 Web 构建时引入 react-native）

## 使用示例

### Cordova/H5 - `createReadyProxy`

```typescript
import { createReadyProxy } from "yumc-service-proxy";

interface NavigatorService {
  push: (params: any) => Promise<void>;
  pop: () => Promise<void>;
}

const navigatorService = createReadyProxy<NavigatorService>({}, "navigatorService", {
  version: "1.0.0",
  queueTimeout: 20000,
  maxQueueSize: 200,
  functions: ["push", "pop"],
  enforceMethodFilter: true,
  removeFromGlobal: true, // deviceready 后移除 window.navigatorService，强制走代理
});

// 即使在 deviceready 前调用，也会被加入队列并在就绪后执行
await navigatorService.push({ url: "/home" });
```

### React Native - `createRnProxy`

```typescript
// RN 环境专用入口
import { createRnProxy } from "yumc-service-proxy/rn";

interface NavigatorService {
  pushUri: (action: NavigationAction, opt?: any) => void;
  pop: () => void;
  close: () => void;
}

const navigatorService = createRnProxy<NavigatorService>(
  (nativeModules) => { // 此处只能使用 nativeModules，不能使用 {service: NavigatorService},RN中直接解析没有问题，但是H5中 service 会是 undefined，需要通过 nativeModules.service 访问。nativeModules.service为native提供的原始服务。
    // 覆盖/包装原生方法
    pushUri: (action, opt) => {
      if (typeof opt !== "object") {
        opt = { _value: opt };
      }
      nativeModules.service.pushUri(action, opt);
    },
  },
  "navigatorService",
  {
    version: "1.0.0",
    enforceMethodFilter: true,
    functions: ["pushUri", "pop", "close"],
    removeFromGlobal: true, // 从 NativeModules 移除，避免绕过代理
    debug: true,
  }
);

navigatorService.pushUri({ url: "/home" });
navigatorService.pop();
```

### 跨平台（Taro 等）

```typescript
// services/navigator.ts
import { createReadyProxy } from "yumc-service-proxy";
import { createRnProxy } from "yumc-service-proxy/rn";
import type { ProxiedService } from "yumc-service-proxy";

interface NavigatorService {
  push: (params: any) => Promise<void> | void;
  pop: () => Promise<void> | void;
}

let navigatorService: ProxiedService<NavigatorService>;

if (process.env.TARO_ENV === "rn") {
  navigatorService = createRnProxy<NavigatorService>({}, "NavigatorService");
} else {
  navigatorService = createReadyProxy<NavigatorService>({}, "navigatorService");
}

export { navigatorService };
```

## 核心能力

- `deviceready` 队列：H5/Cordova 在就绪前缓存调用，超时/队列上限可控
- 原生桥接：方法缺失时自动从 `window[serviceName]`（H5）或 `NativeModules[serviceName]`（RN）桥接
- 方法过滤：`functions` + `enforceMethodFilter` 限定可暴露方法，默认为关闭
- 全局隔离：`removeFromGlobal` 可在就绪后移除 `window.serviceName` 或 `NativeModules.ServiceName`
- 单例注册：同名服务只创建一个代理，避免重复实例
- 调试与版本：`debug` 输出日志，自动附加 `name`、`version` 字段

## API

### `createReadyProxy<T>(service, serviceName, options?)`

为 Cordova/H5 原生服务创建代理。未就绪时入队，`deviceready` 或自定义 `ready` Promise 结束后自动执行；缺失方法会桥接到 `window[serviceName]`；可选删除全局引用防止绕过代理。工厂函数会在创建阶段执行，`deviceready` 前传入的 `service` 可能为空。

**参数**

- `service`: `Partial<T>` 或 `({ service }: { service: T }) => Partial<T>`（工厂函数会在创建时执行）
- `serviceName`: `string` - 全局原生对象名称
- `options`: `ProxyOptions`
  - `queueTimeout` (`number`, 默认 `30000`)：队列调用超时
  - `maxQueueSize` (`number`, 默认 `300`)：队列最大长度
  - `ready` (`Promise<void>`, 默认 `deviceReadyPromise`)：自定义就绪条件
  - `functions` (`string[]`, 默认 `[]`)：允许暴露的方法名
  - `enforceMethodFilter` (`boolean`, 默认 `false`)：是否只暴露 `functions` 中的方法
  - `removeFromGlobal` (`boolean`, 默认与 `enforceMethodFilter` 一致)：就绪后是否删除 `window[serviceName]`
  - `version` (`string`, 默认 `''`)、`debug` (`boolean`, 默认 `false`)

**返回** `ProxiedService<T>`：包装后的服务，附带 `name`、`version`

### `createRnProxy<T>(service, serviceName, options?)`

为 React Native 原生模块创建代理。立即从 `NativeModules[serviceName]` 读取模块（不存在会抛错），将原生方法与自定义实现合并；可选方法过滤和从 `NativeModules` 移除原始引用。

**参数**

- `service`: `Partial<T>` 或 `({ service }: { service: T }) => Partial<T>`（工厂接收原生模块）
- `serviceName`: `string` - `NativeModules` 中的模块名
- `options`: `ProxyOptions`
  - `functions` (`string[]`, 默认 `[]`)
  - `enforceMethodFilter` (`boolean`, 默认 `false`)
  - `removeFromGlobal` (`boolean`, 默认与 `enforceMethodFilter` 一致) - 控制是否从 `NativeModules` 删除
  - `version` (`string`, 默认 `''`)、`debug` (`boolean`, 默认 `false`)
  - `queueTimeout`、`maxQueueSize`、`ready` 在 RN 代理中不会被使用

**返回** `ProxiedService<T>`：包装后的模块，附带 `name`、`version`

### 类型定义

```typescript
export interface ProxyOptions {
  queueTimeout?: number;
  debug?: boolean;
  maxQueueSize?: number;
  ready?: Promise<void>;
  version?: string;
  functions?: string[];
  enforceMethodFilter?: boolean;
  removeFromGlobal?: boolean;
}

export type ProxiedService<T> = T & {
  name: string;
  version: string;
};
```

## License

MIT
