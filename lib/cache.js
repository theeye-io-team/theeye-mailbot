const fs = require('fs')
const path = require('path')

class Cache {
  /**
   * @constructor
   * @param {Object} options
   */
  constructor (options = {}) {
    const { cacheId, path } = options
    this.path = (path || './cache')
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path, { recursive: true })
      console.log(`cache directory ${this.path} created`)
    }

    this.cacheId = process.env.CACHE_ID || this.checkEnv(cacheId)
  }

  drop () {
    const files = fs.readdirSync(this.path)
    for (const file of files){
      console.log(file)
      if(file === `${this.cacheId}.json`) {
        fs.unlinkSync(path.join(this.path, file))
        return true
      }
    }
    return false
  }

  rotate () {
    const filename = path.join(path.resolve(this.path), `${this.cacheId}.json`)
    const date = fs.lstatSync(filename).birthtime
    const month = (date.getMonth() + 1) < 10 ? `0${date.getMonth() + 1}` : `${date.getMonth() + 1}`
    const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
    const year = date.getFullYear()
    const newFilename = path.join(path.resolve(this.path), `${this.cacheId}_${year}${month}${day}.json`)
    fs.renameSync(filename, newFilename)
  }

  /**
   * @param {Object} payload
   */
  save (payload) {
    const content = JSON.stringify(payload)
    fs.writeFileSync(`${this.path}/${this.cacheId}.json`, content, 'utf8')
  }

  /**
   * @return {Object}
   */
  get () {
    try {
      const content = fs.readFileSync(`${this.path}/${this.cacheId}.json`, 'utf8')
      return JSON.parse(content)
    } catch (err) {
      console.log(`Cache file "${this.cacheId}" doesn't exist`)
      return {}
    }
  }

  checkEnv (cacheId = null) {
    if (cacheId) {
      return cacheId
      // use this id
    }

    if (process.env.THEEYE_JOB) {
      cacheId = JSON.parse(process.env.THEEYE_JOB).task_id
    } else {
      cacheId = new Date().getTime()
    }
    return cacheId
  }
}

module.exports = Cache
