/**
 * CreateRnProxy 使用示例
 * 
 * 展示如何在 React Native 项目中使用 createRnProxy
 * 
 * ⚠️ 重要提示：
 * createRnProxy 只能在 Taro RN 环境中使用 (process.env.TARO_ENV === 'rn')
 * 在其他环境（H5、小程序等）中调用会抛出错误
 * 请在非 RN 环境使用 createReadyProxy
 */

import { createRnProxy } from 'yumc-service-proxy'
import type { ProxiedService } from 'yumc-service-proxy'

// 定义服务接口
interface NavigatorService {
  pushUri: (action: NavigationAction, opt?: any) => void
  pop: () => void
  close: () => void
}

interface NavigationAction {
  url: string
  params?: Record<string, any>
}

// ============================================
// 示例 1: 覆盖部分方法
// ============================================

// 获取原生模块的引用（仅用于方法内部调用）
const { NativeModules } = require('react-native')

const navigatorService = createRnProxy<NavigatorService>(
  {
    // 覆盖 pushUri 方法，添加参数处理逻辑
    pushUri: (action: NavigationAction, opt?: any) => {
      // 确保 opt 是对象
      if (typeof opt !== 'object') {
        opt = { _value: opt }
      }
      // 调用原生方法
      NativeModules.NavigatorService.pushUri(action, opt)
    }
  },
  'NavigatorService',
  { version: '1.0.0', debug: true }
)

// 使用代理服务
navigatorService.pushUri({ url: '/home' }, 'someValue') // opt 会被转换为 { _value: 'someValue' }
navigatorService.pop() // 直接调用原生方法
navigatorService.close() // 直接调用原生方法

console.log(navigatorService.name) // 'NavigatorService'
console.log(navigatorService.version) // '1.0.0'

// ============================================
// 示例 2: 使用空对象（所有方法从原生模块获取）
// ============================================

interface StorageService {
  setItem: (key: string, value: string) => Promise<void>
  getItem: (key: string) => Promise<string>
  removeItem: (key: string) => Promise<void>
}

const storageService = createRnProxy<StorageService>(
  {}, // 空对象，所有方法从 NativeModules.StorageService 获取
  'StorageService'
)

// 所有方法都是原生方法
await storageService.setItem('key', 'value')
const value = await storageService.getItem('key')

// ============================================
// 示例 3: 重复创建会返回同一实例
// ============================================

const navigatorService2 = createRnProxy<NavigatorService>(
  {},
  'NavigatorService' // 同一个 serviceName
)

// 会输出警告: [ServiceProxy] Service "NavigatorService" has already been proxied.
// navigatorService2 === navigatorService (同一个实例)

// ============================================
// 示例 4: 完整的实际使用场景
// ============================================

// types.ts
export namespace NavigatorServiceTypes {
  export interface NavigationAction {
    url: string
    params?: Record<string, any>
    animated?: boolean
  }

  export interface NavigatorService {
    pushUri: (action: NavigationAction, opt?: any) => void
    pop: () => void
    popTo: (index: number) => void
    close: () => void
    replace: (action: NavigationAction) => void
  }
}

// navigatorService.ts
import { createRnProxy } from 'yumc-service-proxy'
import { NavigatorServiceTypes } from './types'

const { NativeModules } = require('react-native')

export const navigatorService = createRnProxy<NavigatorServiceTypes.NavigatorService>(
  {
    pushUri: (action: NavigatorServiceTypes.NavigationAction, opt?: any) => {
      // 参数规范化
      if (typeof opt !== 'object') {
        opt = { _value: opt }
      }

      // 添加默认值
      const normalizedAction = {
        animated: true,
        ...action
      }

      // 调用原生方法
      NativeModules.NavigatorService.pushUri(normalizedAction, opt)
    }
  },
  'NavigatorService',
  {
    version: '2.0.0',
    debug: __DEV__ // 开发环境启用调试
  }
)

// app.tsx
import { navigatorService } from './navigatorService'

function App() {
  const handleNavigate = () => {
    navigatorService.pushUri({
      url: '/details',
      params: { id: 123 }
    })
  }

  return (
    <Button onPress= { handleNavigate } >
    Go to Details
      </Button>
  )
}
