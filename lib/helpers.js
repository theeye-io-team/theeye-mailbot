const crypto = require('crypto')

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
  }
}
