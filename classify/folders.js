const { DateTime } = require('luxon')

const MailBot = require('../lib/mailbot-folder')
const ClassificationCache = require('./cache')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const filters = require(process.env.CLASSIFICATION_RULEZ_PATH)
//const tz = 'America/Argentina/Buenos_Aires'

const main = module.exports = async () => {

  const classificationCache = new ClassificationCache({ cacheId: 'classification' })
  console.log(classificationCache.data)

  const mailBot = new MailBot(config)
  const currentDate = DateTime.now().setZone(config.timezone)
  const runtimeDate = new Date(classificationCache.data.runtimeDate)

  console.log(`runtime date is set to ${runtimeDate}`)

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

    const minFilterDate = getFormattedThresholdDate(times.start, config.timezone, runtimeDate)
    const maxFilterDate = getFormattedThresholdDate(times.success, config.timezone, runtimeDate)
    const criticalFilterDate = getFormattedThresholdDate(times.critical, config.timezone, runtimeDate)

    const messages = await mailBot.searchMessages(searchCriteria)

    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.api.accessToken
    const indicatorDescription = `<b>${filter.subject}</b> from <b>${filter.from}</b> should arrive between <b>${minFilterDate.toRFC2822()}</b> and <b>${maxFilterDate.toRFC2822()}</b>`

    console.log(`${messages.length} messages found with search criteria`)

    if (messages.length > 0) {
      for (const message of messages) {
        const mailDate = adjustTimezone(mailBot.getDate(message))
        console.log(`mail date is ${mailDate}`)

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
      }
    } else {

      if (currentDate < maxFilterDate) {
        message = 'Waiting message...'
        state = 'normal'
      } else {
        if (criticalFilterDate !== null) {
          if (currentDate < criticalFilterDate) {
            message = 'Waiting message...'
            state = 'failure'
          } else {
            message = 'Timeout reach!'
            state = 'critical'
          }
        } else {
          message = 'Timeout reach!'
          state = 'critical'
        }
      }

      indicator.setValue(currentDate, indicatorDescription, message)
      indicator.state = state
      await indicator.put()
    }
  }
}

const adjustTimezone = (mailDate) => {
  const date = DateTime
    .fromISO(mailDate.toISOString())
    .setZone(config.timezone)
  return date 
}

/**
 * @param {String} time format 'HH:mm'
 * @param {String} tz timezone string
 * @param {Date} startingDate
 */
const getFormattedThresholdDate = (time, tz, startingDate) => {
  if (!time) { return null }

  let date = DateTime.fromISO( startingDate.toISOString() ).setZone(tz)
  const hours = time.substring(0, 2)
  const minutes = time.substring(3, 5)

  // Agregar al config  { ..., "startOfDay" : "14:00", ... }
  if (time < config.startOfDay) {
    date = date.plus({ days: 1 })
  }

  return date.set({ hours, minutes, seconds: 0 })
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
