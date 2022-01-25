const { DateTime } = require('luxon')
const config = require('../lib/config').decrypt()
const holidays = require(process.env.HOLIDAYS || '../config/feriados.json')

const getTimeArray = (time) => {
  return {
    hour: Number(time.substring(0, 2)),
    min: Number(time.substring(3, 5))
  }
}

const currentTime = DateTime.now().setZone(config.timezone)
const currentDate = currentTime.startOf('day')
const yesterdayDate = DateTime.now().setZone(config.timezone).plus({ days: -1 }).startOf('day')
const timeArray = getTimeArray(config.startOfDay)
const startTime = DateTime.now().setZone(config.timezone).set({ hour: timeArray.hour, minute: timeArray.min })

const checkWeekend = () => {
  console.log('checkWeekend')
  const def = {
    currentTime: currentTime.toISO(),
    startTime: startTime.toISO(),
    dayOfWeek: currentTime.weekdayLong,
    startOfDay: {
      time: config.startOfDay,
      timeArray
    }
  }

  console.log(def)

  if (def.dayOfWeek === 'Saturday') {
    if (currentTime >= startTime) {
      throw new Error('Weekend: Saturday')
    }
  }

  if (def.dayOfWeek === 'Sunday') {
    throw new Error('Weekend: Sunday')
  }

  if (def.dayOfWeek === 'Monday') {
    if (currentTime <= startTime) {
      throw new Error('Weekend: Sunday')
    }
  }

  console.log('Not a weekend')
}

const checkHoliday = () => {
  console.log('checkHoliday')

  const def = {
    currentTime: currentTime.toISO(),
    startTime: startTime.toISO(),
    dayOfWeek: currentTime.weekdayLong,
    startOfDay: {
      time: config.startOfDay,
      timeArray
    }
  }

  console.log(def)

  for (const holiday of holidays) {
    const holidayDate = DateTime.fromFormat(holiday, 'dd-MM-yyyy', { zone: config.timezone })
    const holidayTime = holidayDate.set({ hour: timeArray.hour, minute: timeArray.min })

    console.log({ holidayDate: holidayDate.toISO(), currentDate: currentDate.toISO(), yesterdayDate: yesterdayDate.toISO() })

    if (currentDate.equals(holidayDate)) {
      if (currentTime > holidayTime) {
        throw new Error(`Holiday: ${holiday}`)
      }
    }

    if (yesterdayDate.equals(holidayDate)) {
      if (currentTime < startTime) {
        throw new Error(`Holiday: ${holiday}`)
      }
    }
  }

  console.log('Not a holiday')
}

const main = module.exports = async () => {
  checkWeekend()
  checkHoliday()

  return { data: true }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
