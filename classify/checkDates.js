require('dotenv').config()

const { DateTime } = require('luxon')
const config = require('../lib/config').decrypt()
const Files = require('../lib/file')

Files.access_token = config.api.accessToken

const getTimeArray = (time) => {
  return {
    hour: Number(time.substring(0, 2)),
    min: Number(time.substring(3, 5))
  }
}

const checkWeekend = (def) => {
  console.log('checkWeekend')

  console.log(def.dayOfWeek)

  if (def.dayOfWeek === 'Saturday') {
    if (def.currentTime >= def.startTime) {
      throw new Error('Weekend: Saturday')
    }
  }

  if (def.dayOfWeek === 'Sunday') {
    throw new Error('Weekend: Sunday')
  }

  if (def.dayOfWeek === 'Monday') {
    if (def.currentTime <= def.startTime) {
      throw new Error('Weekend: Sunday')
    }
  }

  console.log('Not a weekend day')
}

const checkHoliday = async (def) => {
  console.log('checkHoliday')

  const file = await Files.GetByFilename(config.feriados.filename || 'feriados.json')
  const holidays = await Files.Download(file[0].id)

  console.log(holidays)

  for (const holiday of holidays) {
    const holidayDate = DateTime.fromFormat(holiday, 'dd-MM-yyyy', { zone: config.timezone })
    const holidayTime = holidayDate.set({ hour: def.startOfDay.timeArray.hour, minute: def.startOfDay.timeArray.min })

    console.log({ holidayDate: holidayDate.toISO(), currentDate: def.currentDate.toISO(), yesterdayDate: def.yesterdayDate.toISO() })

    if (def.currentDate.equals(holidayDate)) {
      if (def.currentTime >= holidayTime) {
        throw new Error(`Holiday: ${holiday}`)
      }
    }

    if (def.yesterdayDate.equals(holidayDate)) {
      if (def.currentTime <= def.startTime) {
        throw new Error(`Holiday: ${holiday}`)
      }
    }
  }

  console.log('Not a holiday')
}

const main = module.exports = async (datetime = null) => {
  console.log({ datetime })

  const isValidDateString = function (datestr) {
    return (datestr && new Date(datestr).toString() !== 'Invalid Date')
  }
  const getCurrentTime = function (datestr) {
    if (isValidDateString(datestr)) {
      return DateTime.fromISO(datestr).setZone(config.timezone)
    } else {
      return DateTime.now().setZone(config.timezone)
    }
  }
  const currentTime = getCurrentTime(datetime)
  const timeArray = getTimeArray(config.startOfDay)

  const def = {
    currentTime,
    currentDate: currentTime.startOf('day'),
    yesterdayDate: currentTime.plus({ days: -1 }).startOf('day'),
    startTime: currentTime.set({ hour: timeArray.hour, minute: timeArray.min }),
    dayOfWeek: currentTime.weekdayLong,
    startOfDay: {
      time: config.startOfDay,
      timeArray
    }
  }

  console.log({
    currentTime: def.currentTime.toISO(),
    currentDate: def.currentDate.toISO(),
    yesterdayDate: def.yesterdayDate.toISO(),
    startTime: def.startTime.toISO(),
    dayOfWeek: currentTime.weekdayLong,
    startOfDay: {
      time: config.startOfDay,
      timeArray
    }
  })

  checkWeekend(def)
  await checkHoliday(def)

  return { data: true }
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
