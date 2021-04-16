const fs = require('fs')

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
      console.log('File doesnt exist')
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
