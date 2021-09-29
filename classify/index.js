require('dotenv').config()

// default values
const DEFAULT_CACHE_NAME = "classification"
//const tz = 'America/Argentina/Buenos_Aires'

const { DateTime } = require('luxon')

const Helpers = require('../lib/helpers')
const MailBot = require('../lib/mailbot')
const ClassificationCache = require('./cache')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const filters = require('../filters')

const main = module.exports = async () => {

  const { timezone } = config

  const classificationCache = new ClassificationCache({
    cacheId: (config.cacheName || DEFAULT_CACHE_NAME),
    runtimeDate: buildRuntimeDate(config)
  })

  const runtimeDate = DateTime.fromISO( new Date(classificationCache.data.runtimeDate).toISOString() )
  console.log(`runtime date is set to ${runtimeDate}`)

  console.log(classificationCache.data)

  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDate = DateTime.now().setZone(timezone)

  let index = 0, progress = 0
  for (const filter of filters) {
    console.log(filter)

    const filterHash = classificationCache.createHash(JSON.stringify(filter))
    if (classificationCache.alreadyProcessed(filterHash) === true) {
      progress++
      console.log('Skip this rule. Already checked.')
      continue
    }

    const thresholds = filter.thresholdTimes

    //
    // @TODO validar. el rango de las reglas de filtrado no pueden contener la hora de inicio del día. rompe la logica
    //
    const minFilterDate = getFormattedThresholdDate(thresholds.start, timezone, runtimeDate)
    const maxFilterDate = getFormattedThresholdDate(thresholds.success, timezone, runtimeDate)
    const criticalFilterDate = getFormattedThresholdDate(thresholds.critical, timezone, runtimeDate)

    //
    // ignore rules not inprogress. skip early checks
    //
    if (minFilterDate > currentDate) {
      console.log('Skip this rule. Not started yet')
      continue
    }

    progress++

    const messages = await mailBot.searchMessages(
      Object.assign({}, filter, {
        since: Helpers.timeExpressionToDate(thresholds.start, timezone).toISOString()
      })
    )

    console.log(`${messages.length} messages found with search criteria`)

    const indicatorState = () => {
      if (currentDate < maxFilterDate) {
        state = ''
      } else {
        if (criticalFilterDate !== null) {
          if (currentDate < criticalFilterDate) {
            state = 'failure'
          } else {
            state = 'critical'
          }
        } else {
          state = 'critical'
        }
      }
      return state
    }

    let found = false
    if (messages.length > 0) {
      for (const message of messages) {
        await message.getContent()

        const mailDate = setTimezone(message.date, timezone)
        console.log(`mail date is ${mailDate}`)

        // ignore old messages
        if (mailDate > runtimeDate) {
          found = true
          if (mailDate < maxFilterDate) {
            await handleIndicator({
              order: filters.length - index,
              date: mailDate,
              label: 'On Time',
              state: 'normal',
              filter,
              minDate: minFilterDate,
              maxDate: maxFilterDate
            })
            await message.move()
            classificationCache.setProcessed(filterHash)
          } else {
            await handleIndicator({
              order: filters.length - index,
              date: mailDate,
              label: 'Late',
              state: 'critical',
              filter,
              minDate: minFilterDate,
              maxDate: maxFilterDate
            })
            await message.move()
            classificationCache.setProcessed(filterHash)
          }
        } else {
          console.log(`Old message`)
        }
      }
    }

    if (!found) {
      const state = indicatorState()

      await handleIndicator({
        order: filters.length - index,
        date: currentDate ,
        label: 'Waiting',
        state,
        filter,
        minDate: minFilterDate,
        maxDate: maxFilterDate
      })
    }

    index++
  }

  await handleProgressIndicator(progress*100/filters.length, timezone)

  await mailBot.closeConnection()
}

/**
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const setTimezone = (date, timezone) => {
  return DateTime
    .fromISO(date.toISOString())
    .setZone(timezone)
}

/**
 * @param {String} time format 'HH:mm'
 * @param {String} tz timezone string
 * @param {DateTime} startingDate luxon object
 */
const getFormattedThresholdDate = (time, tz, startingDate) => {
  if (!time) { return null }

  let date = DateTime.fromISO( startingDate.toISO() ).setZone(tz)
  const hours = time.substring(0, 2)
  const minutes = time.substring(3, 5)

  // Agregar al config  { ..., "startOfDay" : "14:00", ... }
  if (time < config.startOfDay) {
    date = date.plus({ days: 1 })
  }

  return date.set({ hours, minutes, seconds: 0 })
}

/**
 *
 * @param {Object} config object with mailbot configuration properties
 * @prop {String} startOfDay HH:mm
 * @prop {String} timezone
 *
 * @return {Date} date object
 *
 */
const buildRuntimeDate = ({ startOfDay, timezone }) => {
  const runtimeDate = DateTime.now().setZone(timezone)

  const hours = startOfDay.substring(0, 2)
  const minutes = startOfDay.substring(3, 5)

  const isoString = runtimeDate.set({ hours, minutes, seconds: 0 }).toISO()
  return new Date(isoString)
}

const handleProgressIndicator = (progress, timezone) => {
  const date = DateTime.now().setZone(timezone).toFormat('HH:mm')

  const indicator = new TheEyeIndicator(config.classify?.progress_title||'Progress')
  indicator.order = 0
  indicator.accessToken = config.api.accessToken
  indicator.value = progress
  indicator.state = 'normal'
  indicator.type = 'progress'

  return indicator.put()
}

const handleIndicator = ({ order, state, date, label, filter, minDate, maxDate }) => {
  const time = date.toFormat('HH:mm')

  const value = `
    <table class="table">
      <tr><th>From</th><td>${filter.from}</td></tr>
      <tr><th>Subject</th><td>${filter.subject}</td></tr>
      <tr><th>Body</th><td>${filter.body}</td></tr>
      <tr><th>Start</th><td>${minDate.toRFC2822()}</td></tr>
      <tr><th>End</th><td>${maxDate.toRFC2822()}</td></tr>
      <tr><th><b>Result</b></th><td><b>${time} - ${label}</b></td></tr>
    </table>
    `

  const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
  indicator.order = order
  indicator.accessToken = config.api.accessToken
  indicator.value = value
  indicator.state = state

  return indicator.put()
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
