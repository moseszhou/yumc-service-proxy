/**
 * React Native 环境专用导出
 * 
 * 此文件只应在 process.env.TARO_ENV === 'rn' 时导入使用
 */

export { createRnProxy } from './src/createRnProxy'
