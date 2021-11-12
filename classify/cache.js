const Cache = require('../lib/cache')
const crypto = require('crypto')

class ClassificationCache extends Cache {
  constructor (options) {
    super(options)
    // load cached data
    this.data = this.get()
    this.setRuntimeDate(options.runtimeDate)
  }

  isAlreadyProcessed (hash) {
    return this.data[hash].processed === true
  }

  createHash (string) {
    const hash = crypto.createHash('sha1')
    hash.update(string)
    return hash.digest('hex')
  }

  setRuntimeDate (date = null) {
    if (!this.data.runtimeDate) {
      this.data.runtimeDate = (date || new Date())
      this.save(this.data)
    }
    return this
  }

  setHashData (hash, data) {
    this.data[hash] = data
    this.save(this.data)
    return this
  }
}

module.exports = ClassificationCache
