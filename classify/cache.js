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
    return this.data[hash].processed === true
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

  setBaseFilterData(filterHash, filterData) {
    if(!this.data[filterHash]) {
      this.data[filterHash] = filterData
      this.save(this.data)
      return this
    }
  }

  updateIndicatorData (filterHash, filterData) {

    if(filterData.solved) {
      this.data[filterHash].data.solved = filterData.solved
    }

    if(filterData.result) {
      this.data[filterHash].data.result = filterData.result
    }

    if(filterData.processed) {
      this.data[filterHash].processed = filterData.processed
    }

    if(filterData.alert) {
      this.data[filterHash].alert[filterData.alert.severity] = filterData.alert.alert
    }

    this.save(this.data)
    return this
  }
}

module.exports = ClassificationCache
