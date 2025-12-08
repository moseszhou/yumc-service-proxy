# yumc-service-proxy

为 Cordova/PhoneGap 和 React Native 原生服务提供智能代理包装。

## 安装

```bash
npm install yumc-service-proxy
# 或
yarn add yumc-service-proxy
```

## 使用方法

### 1. Cordova/H5 环境 - 使用 `createReadyProxy`

适用于需要等待 `deviceready` 事件的 Cordova/PhoneGap 应用：

```typescript
import { createReadyProxy } from "yumc-service-proxy";

interface NavigatorService {
  push: (params: any) => Promise<void>;
  pop: () => Promise<void>;
}

const navigatorService = createReadyProxy<NavigatorService>({}, "navigatorService", {
  version: "1.0.0",
  debug: true,
  queueTimeout: 30000,
});

// 即使在 deviceready 前调用，也会被加入队列并在就绪后执行
await navigatorService.push({ url: "/home" });
```

### 2. React Native 环境 - 使用 `createRnProxy`

⚠️ **重要**：`createRnProxy` 只能在 RN 环境使用。

**方式 1：从主入口导入（推荐）**

```typescript
import { createRnProxy } from "yumc-service-proxy";

interface NavigatorService {
  pushUri: (action: NavigationAction, opt?: any) => void;
  pop: () => void;
  close: () => void;
}

const { NativeModules } = require("react-native");

const navigatorService = createRnProxy<NavigatorService>(
  {
    // 覆盖部分方法
    pushUri: (action, opt) => {
      if (typeof opt !== "object") {
        opt = { _value: opt };
      }
      NativeModules.NavigatorService.pushUri(action, opt);
    },
  },
  "NavigatorService",
  { version: "1.0.0", debug: true }
);

// 直接使用，无需等待
navigatorService.pushUri({ url: "/home" });
navigatorService.pop();
```

**方式 2：从 RN 专用入口导入（兼容性更好）**

```typescript
// 从子路径导入，避免在非 RN 环境编译时引入
import { createRnProxy } from "yumc-service-proxy/rn";

// 使用方式相同
const navigatorService = createRnProxy<NavigatorService>(/* ... */);
```

### 3. 跨平台使用（推荐）

在 Taro 项目中根据环境自动选择：

```typescript
// services/navigator.ts
import { createRnProxy, createReadyProxy } from "yumc-service-proxy";
import type { ProxiedService } from "yumc-service-proxy";

interface NavigatorService {
  push: (params: any) => Promise<void> | void;
  pop: () => Promise<void> | void;
}

let navigatorService: ProxiedService<NavigatorService>;

if (process.env.TARO_ENV === "rn") {
  // React Native 环境
  const { NativeModules } = require("react-native");

  navigatorService = createRnProxy<NavigatorService>(
    {
      push: (params) => {
        NativeModules.NavigatorService.pushUri(params);
      },
    },
    "NavigatorService"
  );
} else {
  // H5/Cordova 环境
  navigatorService = createReadyProxy<NavigatorService>({}, "navigatorService");
}

export { navigatorService };
```

## API

### `createReadyProxy<T>(service, serviceName, options)`

为 Cordova 原生服务创建代理。

**参数：**

- `service`: `Partial<T>` - 原始服务对象（可以是空对象）
- `serviceName`: `string` - 服务名称
- `options`: `ProxyOptions` - 配置选项
  - `queueTimeout`: `number` - 队列超时时间（默认 30000ms）
  - `debug`: `boolean` - 是否启用调试日志（默认 false）
  - `maxQueueSize`: `number` - 最大队列大小（默认 300）
  - `version`: `string` - 服务版本号（默认 ''）
  - `ready`: `Promise<void>` - 自定义就绪 Promise（默认 deviceReadyPromise）

**返回：** `ProxiedService<T>` - 代理后的服务对象，包含 `name` 和 `version` 字段

### `createRnProxy<T>(service, serviceName, options)`

为 React Native 原生模块创建代理。

**参数：**

- `service`: `Partial<T>` - 原始服务对象（可覆盖部分方法）
- `serviceName`: `string` - 原生模块名称
- `options`: `ProxyOptions` - 配置选项
  - `version`: `string` - 服务版本号（默认 ''）
  - `debug`: `boolean` - 是否启用调试日志（默认 false）

**返回：** `ProxiedService<T>` - 代理后的服务对象，包含 `name` 和 `version` 字段

## 特性

### ✅ `createReadyProxy` 特性

- 自动处理 `deviceready` 事件
- 在设备未就绪时缓存方法调用
- 就绪后自动执行队列中的调用
- 支持超时保护和队列大小限制
- 动态桥接到 `window` 对象上的原生方法
- 防止重复创建同一服务的代理

### ✅ `createRnProxy` 特性

- 从 `NativeModules` 自动获取原生模块
- 支持覆盖部分方法实现
- 自动合并原生方法和自定义方法
- 防止重复创建同一服务的代理
- **编译时环境隔离**：只在 RN 环境编译

## 类型定义

```typescript
export interface ProxyOptions {
  queueTimeout?: number;
  debug?: boolean;
  maxQueueSize?: number;
  ready?: Promise<void>;
  version?: string;
}

export type ProxiedService<T> = T & {
  name: string;
  version: string;
};
```

## License

MIT
