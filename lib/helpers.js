const crypto = require('crypto')
const fs = require('fs')
const csv = require('neat-csv')

module.exports = {

  dateFormat (aDate) {
    const addZero = n => n < 10 ? '0' + n : '' + n
    const month = addZero(aDate.getMonth() + 1)
    const day = addZero(aDate.getDate())
    const year = aDate.getFullYear()
    return `${day}${month}${year}`
  },

  createHash (string) {
    const hash = crypto.createHash('sha1')
    hash.update(string)
    return hash.digest('hex')
  },

  buildSearchCriteria (data, criteria) {
    let filter = []
    for (let i in data) {
      filter.push([criteria[i], data[i]])
    }
    return filter
  },

  async buildFiltersFromCSV (csvPath, options) {
    const data = fs.readFileSync(csvPath)
    return await csv(data, options)
  }
}
