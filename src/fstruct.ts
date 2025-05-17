import { existsSync, mkdirSync } from 'fs'
import { logger } from './utils'

export let TMP = "./tmp"
export let TMP_TTS = `${TMP}/tts`
export let TMP_TTS_PUBLIC = `${TMP_TTS}/public`
export let TMP_TTS_PRIVATE = `${TMP_TTS}/private`
export let BUILD = `build`

/**
 * Create a folder if it doesn't exit
 * @param {string} path - The path to the folder that will exist when this function returns
 */
export function ensureFolderExists(path: string) {
	if (existsSync(path))
		return
	logger.info(`Created unexisting folder "${path}"`)
	mkdirSync(path)
}