const { DateTime } = require('luxon')
const crypto = require('crypto')

const MailBot = require('../lib/mailbot-folder')
const Cache = require('../lib/cache')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()

const filters = require(process.env.CLASSIFICATION_RULEZ_PATH)

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

    const minFilterDate = getFormattedThresholdDate(filter.thresholdTimes.start)
    const maxFilterDate = getFormattedThresholdDate(filter.thresholdTimes.success)
    const criticalFilterDate = getFormattedThresholdDate(filter.thresholdTimes.critical)

    const currentDate = DateTime.now().setZone('America/Argentina/Buenos_Aires')
    const messages = await mailBot.searchMessages(searchCriteria)

    const indicator = new TheEyeIndicator(filter.indicatorTitle || filter.subject)
    indicator.accessToken = config.api.accessToken
    const indicatorDescription = filter.indicatorDescription

    if (messages.length > 0) {
      for (const message of messages) {
        const mailDate = adjustTimezone(mailBot.getDate(message))

        if (mailDate < maxFilterDate) {
          indicator.state = 'normal'
          indicator.setValue(currentDate, indicatorDescription, 'Arrived on time')
          await indicator.put()
          await mailBot.moveMessage(message)
          classificationCache.setProcessed(filterHash)
        //} else if (maxFilterDate <= mailDate) {
        } else {
          indicator.state = 'critical'
          indicator.setValue(currentDate, indicatorDescription, 'Arrived late')
          await indicator.put()
          await mailBot.moveMessage(message)
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
    .setZone('America/Argentina/Buenos_Aires')
  return date 
}

const getFormattedThresholdDate = (time, tz = 'America/Argentina/Buenos_Aires') => {
  if (!time) return null

  const date = DateTime.now().setZone(tz)
  const hours = time.substring(0, 2)
  const minutes = time.substring(3, 5)

  return date.set({ hours, minutes, seconds: 0 })
}

class ClassificationCache extends Cache {
  constructor (options) {
    super(options)
    // load cached data
    this.data = this.get()
  }

  alreadyProcessed (hash) {
    return this.data[hash] === true
  }

  setProcessed (hash) {
    console.log(`flagging processed hash ${hash}`)
    this.data[hash] = true
    this.save(this.data)
    return this
  }

  createHash (string) {
    const hash = crypto.createHash('sha1')
    hash.update(string)
    return hash.digest('hex')
  }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
