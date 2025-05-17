// Imports
import fs from 'fs'
import { BUILD, ensureFolderExists } from './fstruct'
import { logger } from './utils'

export class Builds {
  private name: string
  private id: string
  private dir: string
  private prefix: string
  private ext: string
  private suffix: string
  private enabled: boolean
  private latest?: string

  constructor(name: string, id: string, prefix: string, ext: string, enabled: boolean) {
    this.name = name
    this.id = id
    this.dir = `${BUILD}/${id}`
    this.prefix = prefix
    this.ext = ext
    this.suffix = `.${this.ext}`
    this.enabled = enabled
  }

  private fmtLog(str: string) {
    return `${this.name} (${this.id}) builds: ${str}`
  }

  scan() {
    ensureFolderExists(this.dir)
    if (!this.enabled) {
      logger.warn(this.fmtLog("Disabled. All clients will be considered up-to-date."))
      return
    }
    logger.info(this.fmtLog("Scanning in progress.."))
    let latest: string | undefined
    fs.readdirSync(this.dir).forEach(file => {
      if (file.startsWith(this.prefix) && file.endsWith(this.suffix)) {
        const v = file.substring(this.prefix.length, file.length - this.suffix.length)
        if (v.split('.').length === 3) {
          if (latest !== undefined)
            logger.error(this.fmtLog(`Scanning: multiple matching files: current '${this.dir}/${file}', also have scanned ${latest}`))
            latest = v
        } else
          logger.error(this.fmtLog(`Scanning: invalid format for build '${this.dir}/${file}': expected three dot-separated version specifiers`))
      } else
        logger.error(this.fmtLog(`Scanning: invalid format for build '${this.dir}/${file}': expected prefix in ${this.prefix} and suffix in ${this.suffix}`))
    })
    this.latest = latest
    if (this.latest === undefined)
      logger.error(this.fmtLog(`Scanning: no build found in directory '${this.dir}'. Format is '${this.prefix}<major>.<minor>.<patch>${this.suffix}'.`))
    else
      logger.info(this.fmtLog(`Scanning: latest version scanned to ${this.latest}.`))
  }

  isUpToDate(v: string) {
    if (this.latest === undefined)
      return true
    else
      return compareVersion(this.latest, v) == 0
  }

  getLatestStream() {
    return fs.createReadStream(`${this.dir}/${this.prefix}${this.latest}.${this.suffix}`)
  }
};

/*
 * @function
 * 
 * Compare two version number
 * Returns: -1 if current version is lower, 0 if they are equal, 1 if current version is higher
 * 
 * @param {string} current The current known version
 * @param {string} reporter The user reported version to compare to
 * @return {number}
 */
export function compareVersion(current: string, reported: string) : number {
  function parse(version: string): number[] {
    const versionArray: number[] = version.split('.').map(Number)
    if (versionArray.length < 3) {
      throw new Error('Invalid version number')
    }
    return versionArray
  }

  const currentArray: number[] = parse(current)
  const reportedArray: number[] = parse(reported)

  for (let i = 0; i < 3; i++) {
    if (currentArray[i] !== reportedArray[i]) {
      return Math.sign(currentArray[i] - reportedArray[i])
    }
  }
  return 0
}