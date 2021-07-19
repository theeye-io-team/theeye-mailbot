const { DateTime } = require('luxon')
const MailBotFolder = require('lib/mailbot-folder')
const MailBot = require('lib/mailbot')
const ClassificationCache = require('lib/classify-cache')
const TheEyeIndicator = require('lib/indicator')
const config = require('lib/config').decrypt()
// const config = require('config/config.json')
const filters = require(process.env.CLASSIFICATION_RULEZ_PATH)
// const filters = require('config/classificationRulez.json')
const mbsync = require('lib/mbsync')
const tz = 'America/Argentina/Buenos_Aires'

const mailbotToggle = config.mbsync

const main = module.exports = async () => {

  const classificationCache = new ClassificationCache({ cacheId: 'classification' })
  const mailBot = await createMailbotInstance(mailbotToggle)

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

    const runtimeDate = new Date(classificationCache.data.runtimeDate)
    const times = filter.thresholdTimes

    //const minFilterDate = getFormattedThresholdDate(times.start, tz, runtimeDate)
    const maxFilterDate = getFormattedThresholdDate(times.success, tz, runtimeDate)
    const criticalFilterDate = getFormattedThresholdDate(times.critical, tz, runtimeDate)

    const currentDate = DateTime.now().setZone(tz)
    const messages = await mailBot.searchMessages(searchCriteria)

    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.api.accessToken
    const indicatorDescription = filter.indicatorDescription

    if (messages.length > 0) {
      for (const message of messages) {
        console.log(`Messages with matching filter: ${messages.length}`)
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
  
  if(mailbotToggle) await mbsync('push')
}

/**
 * @param {Date} mailDate
 */
const adjustTimezone = (mailDate) => {
  const date = DateTime
    .fromISO(mailDate.toISOString())
    .setZone(tz)
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

/**
 * @param {Boolean} mailbotToggle
 */
const createMailbotInstance = async (mailbotToggle) => {
  if(mailbotToggle) {
    await mbsync("pull")
    return new MailBotFolder(config)
  } else {
    const mailBot = new MailBot(config)
    await mailBot.connect()
    return mailBot
  }
}


if (require.main === module) {
  main().then(console.log).catch(console.error)
}
