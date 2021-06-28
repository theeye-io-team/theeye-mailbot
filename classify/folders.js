const { DateTime } = require('luxon')
const crypto = require('crypto')

const MailBot = require('../lib/mailbot-folder')
const ClassificationCache = require('./cache')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const filters = require(process.env.CLASSIFICATION_RULEZ_PATH)
const tz = 'America/Argentina/Buenos_Aires'

const main = module.exports = async () => {

  const classificationCache = new ClassificationCache({ cacheId: 'classification' })
  const mailBot = new MailBot(config)

  for (const filter of filters) {

    const filterHash = classificationCache.createHash(JSON.stringify(filter))
    if (classificationCache.alreadyProcessed(filterHash) === true) {
      console.log('rule check time ended.')
      continue
    }

    console.log(filter)

    const searchCriteria = [
      ['BODY', `${filter.body}`],
      ['FROM', `${filter.from}`],
      ['SUBJECT', `${filter.subject}`]
    ]

    //const lowTime = filter.thresholdTimes.low
    //const highTime = filter.thresholdTimes.high

    const minFilterDate = getFormattedThresholdDate(filter.thresholdTimes.start,tz, classificationCache.data['runtimeDate'])
    const maxFilterDate = getFormattedThresholdDate(filter.thresholdTimes.success,tz, classificationCache.data['runtimeDate'])
    const criticalFilterDate = getFormattedThresholdDate(filter.thresholdTimes.critical,tz, classificationCache.data['runtimeDate'])

    const currentDate = DateTime.now().setZone(tz)
    const messages = await mailBot.searchMessages(searchCriteria)

    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.api.accessToken
    const indicatorDescription = filter.indicatorDescription

    if (messages.length > 0) {
      for (const message of messages) {
        const mailDate = adjustTimezone(mailBot.getDate(message))

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
    .setZone(tz)
  return date 
}

const getFormattedThresholdDate = (time, tz, startingDate) => {
  if (!time) return null

  const date = DateTime.fromISO(startingDate.toISOString()).setZone(tz)
  const hours = time.substring(0, 2)
  const minutes = time.substring(3, 5)

  // Agregar al config  { ..., "startOfDay" : "14:00", ... }
  if(time < config.startOfDay) {
    date = date.plus({days:1})
  }

  return date.set({ hours, minutes, seconds: 0 })
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
