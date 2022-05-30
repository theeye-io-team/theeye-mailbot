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
   * Convert a time string in HH:mm format into a JS Date
   *
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
    return new Date(date)
  },

  /**
   * Convert a time string in HH:mm format into a Luxon Date
   *
   * @param {String} time format 'HH:mm'
   * @param {String} tz timezone string
   * @param {String} fromDate a date in ISO Format
   *
   * @return {Date}
   */
  timeExpressionToDateLuxon (time, tz, fromDate = null) {
    if (!time) { return null }

    fromDate || (fromDate = new Date())

    const hours = time.substring(0, 2)
    const minutes = time.substring(3, 5)

    return DateTime.fromJSDate(fromDate).setZone(tz).set({ hours, minutes, seconds: 0 })
  },

  /**
   * @param {String} time format 'HH:mm'
   * @param {String} tz timezone string
   * @param {DateTime} startingDate luxon object
   */
  getFormattedThresholdDate (time, tz, startingDate, startOfDay) {
    if (!time) { return null }

    let date = DateTime.fromISO(startingDate.toISO()).setZone(tz)
    const hours = time.substring(0, 2)
    const minutes = time.substring(3, 5)

    // Agregar al config  { ..., "startOfDay" : "14:00", ... }
    if (time < startOfDay) {
      date = date.plus({ days: 1 })
    }

    return date.set({ hours, minutes, seconds: 0 })
  },

  orderCache (array, timezone, runtimeDate, startOfDay) {
    const arrayDef = []

    for (const key of Object.keys(array.data)) {
      if (array.data[key].ignore) {
        continue
      }

      const arrayRow = {
        key: null,
        start: null
      }

      if (key !== 'runtimeDate') {
        arrayRow.key = key
        arrayRow.start = this.getFormattedThresholdDate(array.data[key].data.start, timezone, runtimeDate, startOfDay)
        arrayDef.push(arrayRow)
      }
    }

    arrayDef.sort((elem1, elem2) => {
      const elem1Start = elem1.start
      const elem2Start = elem2.start
      if (elem1Start < elem2Start) {
        return -1
      }
      if (elem1Start > elem2Start) {
        return 1
      }
      return 0
    })

    const newDefinition = {
      path: array.path,
      cacheId: array.cacheId,
      data: {
        runtimeDate: array.data.runtimeDate
      }
    }

    for (const elem of arrayDef) {
      newDefinition.data[elem.key] = array.data[elem.key]
    }

    return newDefinition
  },

  /**
    * Returns the classification cache date
    * @param {string} date OPTIONAL: string to force a runtime date format yyyyMMdd (ex: 20220318)
    * @param {Object} config object with mailbot configuration properties
    * @returns {string} date in yyyyMMdd format
    */

  buildCacheName (date, { startOfDay, timezone }) {
    const currentDate = date ? DateTime.fromISO(date).setZone(timezone) : DateTime.now().setZone(timezone)
    const startDate = this.timeExpressionToDateLuxon(startOfDay, timezone, currentDate.toJSDate())
    // console.log({ date, currentDate, startDate, isAfter: currentDate > startDate, isBefore: currentDate < startDate })

    if (currentDate >= startDate) {
      return currentDate.toFormat('yyyyMMdd')
    } else {
      return currentDate.plus({ days: -1 }).toFormat('yyyyMMdd')
    }
  },

  /**
    * Returns runtime date
    * @param {string} date OPTIONAL: string to force a runtime date format yyyyMMdd (ex: 20220318)
    * @param {Object} config object with mailbot configuration properties
    *
    * @return {Date} date object
    *
    */
  buildRuntimeDate (date, { startOfDay, timezone }) {
    const currentDate = date ? DateTime.fromISO(date).setZone(timezone) : DateTime.now().setZone(timezone)
    const runtimeDate = this.timeExpressionToDateLuxon(startOfDay, timezone, currentDate.toJSDate())

    if (currentDate >= runtimeDate) {
      return new Date(runtimeDate.toISO())
    } else {
      return new Date(runtimeDate.plus({ days: -1 }).toISO())
    }
  },

  /**
   * Ensure acls are initialized and in correct format.
   * Else initialize
   */
  getAcls ({ acls }) {
    if (!acls) { return null }

    const init = (key) => {
      if (!Array.isArray(acls[key])) {
        return []
      }
      return acls[key]
    }

    return {
      manager: init('manager'),
      operator: init('operator'),
      administrator: init('administrator')
    }
  },
  /**
 *
 * @param {DateTime} currentDate
 * @param {DateTime} lowFilterDate
 * @param {DateTime} highFilterDate
 * @param {DateTime} criticalFilterDate
 * @returns {Object} {state, severity}
 */
  indicatorState (date, lowFilterDate, highFilterDate, criticalFilterDate) {
    let state, severity

    if (lowFilterDate) {
      if (date < lowFilterDate) {
        state = 'normal'
        severity = 'low'
      }

      if (date > lowFilterDate) {
        state = 'failure'
        severity = 'low'
      }
    }

    if (highFilterDate) {
      if (!lowFilterDate && date < highFilterDate) {
        state = 'normal'
        severity = 'low'
      }

      if (date > highFilterDate) {
        state = 'failure'
        severity = 'high'
      }
    }

    if (criticalFilterDate) {
      if (!lowFilterDate && !highFilterDate && date < criticalFilterDate) {
        state = 'normal'
        severity = 'low'
      }

      if (date > criticalFilterDate) {
        state = 'failure'
        severity = 'critical'
      }
    }

    return { state, severity }
  }
}
