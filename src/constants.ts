// Constants
export const HTTP_PORT = Number(process.env.HTTP_PORT) || 80
export const HTTP_ADMIN_PORT = Number(process.env.HTTP_ADMIN_PORT) || 8686

export const BUILD_DEVICE_ESP32_ENABLE = (process.env.BUILD_DEVICE_ESP32_ENABLE === 'true') || false
export const BUILD_APP_ANDROID_ENABLE = (process.env.BUILD_APP_ANDROID_ENABLE === 'true') || false
export const BUILD_APP_IOS_ENABLE = (process.env.BUILD_APP_IOS_ENABLE === 'true') || false
export const BUILD_DEVICE_ANDROID_ENABLE = (process.env.BUILD_DEVICE_ANDROID_ENABLE === 'true') || false

export const SENDGRID_API_KEY = (process.env.SENDGRID_API_KEY) || undefined
