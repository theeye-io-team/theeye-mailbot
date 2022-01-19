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

    for(const key of Object.keys(array.data)) {
        let arrayRow = {
            key:null,
            start:null
        }

        if(key !== 'runtimeDate') {
            arrayRow.key = key
            arrayRow.start = this.getFormattedThresholdDate(array.data[key].data.start, timezone, runtimeDate, startOfDay)
            arrayDef.push(arrayRow)
        }
    }

    arrayDef.sort((elem1, elem2) => {
        const elem1Start = elem1.start
        const elem2Start = elem2.start
        if (elem1Start < elem2Start) {
          return -1;
        }
        if (elem1Start > elem2Start) {
          return 1;
        }
        return 0;
      });


    const newDefinition = {
        path: array.path,
        cacheId: array.cacheId,
        data: {
            runtimeDate: array.data.runtimeDate
        }
    }

    for(const elem of arrayDef) {
        newDefinition.data[elem.key] = array.data[elem.key]
    }

    return newDefinition

  }
}
