const Cache = require('../lib/cache')
const crypto = require('crypto')

class ClassificationCache extends Cache {
  constructor (options) {
    super(options)
    // load cached data
    this.data = this.get()
    this.setRuntimeDate(options.runtimeDate)
  }

  alreadyProcessed (hash) {
    return this.data[hash] === true
  }

  setProcessed (hash) {
    console.log(`flagging processed hash ${hash}`)
    this.data[hash] = true
    this.save(this.data)
    return this
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
}

module.exports = ClassificationCache
