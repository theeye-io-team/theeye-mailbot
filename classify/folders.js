require('dotenv').config()

// default values
const DEFAULT_CACHE_NAME = "classification"
//const tz = 'America/Argentina/Buenos_Aires'

const { DateTime } = require('luxon')

const MailBot = require('../lib/mailbot-folder')
const ClassificationCache = require('./cache')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const filters = require('../filters')

const main = module.exports = async () => {

  const classificationCache = new ClassificationCache({
    cacheId: (config.cacheName || DEFAULT_CACHE_NAME),
    runtimeDate: buildRuntimeDate(config)
  })

  const runtimeDate = DateTime.fromISO( new Date(classificationCache.data.runtimeDate).toISOString() )
  console.log(`runtime date is set to ${runtimeDate}`)

  console.log(classificationCache.data)

  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDate = DateTime.now().setZone(config.timezone)

  for (const filter of filters) {
    console.log(filter)

    const filterHash = classificationCache.createHash(JSON.stringify(filter))
    if (classificationCache.alreadyProcessed(filterHash) === true) {
      console.log('rule check already processed. time ended.')
      continue
    }

    const searchCriteria = [
      ['BODY', `${filter.body}`],
      ['FROM', `${filter.from}`],
      ['SUBJECT', `${filter.subject}`]
    ]

    const times = filter.thresholdTimes

    //
    // @TODO validar. el rango de las reglas de filtrado no pueden contener la hora de inicio del día. rompe la logica
    //
    const minFilterDate = getFormattedThresholdDate(times.start, config.timezone, runtimeDate)
    const maxFilterDate = getFormattedThresholdDate(times.success, config.timezone, runtimeDate)
    const criticalFilterDate = getFormattedThresholdDate(times.critical, config.timezone, runtimeDate)

    const messages = await mailBot.searchMessages(searchCriteria)

    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.api.accessToken
    const indicatorDescription = `<b>${filter.subject}</b> from <b>${filter.from}</b> should arrive between <b>${minFilterDate.toRFC2822()}</b> and <b>${maxFilterDate.toRFC2822()}</b>`

    console.log(`${messages.length} messages found with search criteria`)

    const waitingMessage = async () => {
      let indicatorValue
      if (currentDate < maxFilterDate) {
        indicatorValue = 'Waiting message...'
        state = 'normal'
      } else {
        if (criticalFilterDate !== null) {
          if (currentDate < criticalFilterDate) {
            indicatorValue = 'Waiting message...'
            state = 'failure'
          } else {
            indicatorValue = 'Timeout reach!'
            state = 'critical'
          }
        } else {
          indicatorValue = 'Timeout reach!'
          state = 'critical'
        }
      }

      indicator.setValue(currentDate, indicatorDescription, indicatorValue)
      indicator.state = state
      await indicator.put()
    }

    if (messages.length > 0) {
      for (const message of messages) {
        const mailDate = adjustTimezone(mailBot.getDate(message))
        console.log(`mail date is ${mailDate}`)

        // stop processing old messages
        if (mailDate > runtimeDate) {
          if (mailDate < maxFilterDate) {
            indicator.state = 'normal'
            indicator.setValue(mailDate, indicatorDescription, 'Arrived on time')
            await indicator.put()
            await mailBot.moveMessage(message)
            classificationCache.setProcessed(filterHash)
            //} else if (maxFilterDate <= mailDate) {
          } else {
            indicator.state = 'critical'
            indicator.setValue(mailDate, indicatorDescription, 'Arrived late')
            await indicator.put()
            await mailBot.moveMessage(message)
            classificationCache.setProcessed(filterHash)
          }
        } else {
          console.log(`the message was already processed`)
          await waitingMessage()
        }
      }
    } else {
      await waitingMessage()
    }
  }

  await mailBot.closeConnection()
}

const adjustTimezone = (date) => {
  const dateTime = DateTime
    .fromISO(date.toISOString())
    .setZone(config.timezone)
  return dateTime
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

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
