const crypto = require('crypto')
const { DateTime } = require('luxon')

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

  /**
   * Convert a time string in HH:mm format into a Luxon Date
   * @param {String} time format 'HH:mm'
   * @param {String} tz timezone string
   * @param {String} fromDate a date in ISO Format
   *
   * @return {Date}
   */
  timeExpressionToDate (time, tz, fromDate = null) {
    if (!time) { return null }

    fromDate || (fromDate = new Date().toISOString())

    const hours = time.substring(0, 2)
    const minutes = time.substring(3, 5)

    let date = DateTime.fromISO(fromDate).setZone(tz)
    date = date.set({ hours, minutes, seconds: 0 }).toISO()
    return new Date( date )
  }
}
