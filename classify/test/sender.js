require('dotenv').config()
const crypto = require('crypto')

const CACHE_NAME = 'sender'
const DEFAULT_CACHE_NAME = 'classification'
const { DateTime } = require('luxon')
const sendmail = require('theeye-bot-sdk/core/mail/sender')

const ClassificationCache = require('../cache')
const Cache = require('../../lib/cache')
const Helpers = require('../../lib/helpers')
const config = require('../../lib/config').decrypt()
//const nodemailer = require('nodemailer')
const filters = require('../../filters')

const main = module.exports = async (dateParam) => {
  const cache = new Cache({ cacheId: CACHE_NAME })
  const cacheData = cache.get()

  const classificationCache = new ClassificationCache({ config })

  const { timezone } = config

  let currentDate
  if (process.env.CLASSIFICATION_CURRENT_ISODATE) {
    currentDate = DateTime
      .fromISO(process.env.CLASSIFICATION_CURRENT_ISODATE)
      .setZone(timezone)
  } else {
    currentDate = DateTime.now().setZone(timezone)
  }

  const runtimeDate = DateTime
    .fromISO(new Date(classificationCache.data.runtimeDate).toISOString())
    .setZone(timezone)
  console.log(`runtime date is set to ${runtimeDate}`)

  for (const filter of filters) {
    const hash = createHash(JSON.stringify(filter))
    const thresholds = filter.thresholdTimes
    const startDate = Helpers.getFormattedThresholdDate(
      thresholds.start,
      timezone,
      runtimeDate,
      config.startOfDay
    )

    console.log(`rule starting date is ${startDate}`)

    if (startDate > currentDate) {
      console.log(`waiting until ${startDate}`)
      continue
    }

    if (cacheData[hash] === true) {
      console.log(`already sent ${startDate}`)
      continue
    }

    if (!randomSend(10, 50)) {
      console.log('didnt pass chance check, wont send yet')
      continue
    }

    console.log(`sending ${startDate}`)

    //const transport = nodemailer.createTransport(config.sender.transport)
    console.log('sending email')
    await sendmail({
      subject: filter.subject,
      to: 'patricia-theeye@outlook.com',
      text: filter.body
    })

    cacheData[hash] = true
  }

  cache.save(cacheData)
}

const createHash = (string) => {
  const hash = crypto.createHash('sha1')
  hash.update(string)
  return hash.digest('hex')
}

const randomSend = (max, chance) => {
  const number = Math.floor(Math.random() * max)
  if (number < chance * max / 100) {
    return true
  }
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
