require('dotenv').config()

const CACHE_NAME = "sender"
const { DateTime } = require('luxon')
const sendmail = require('theeye-bot-sdk/core/mail/sender')

const Cache = require('../../lib/cache')
const Helpers = require('../../lib/helpers')
const config = require('../../lib/config').decrypt()
const nodemailer = require('nodemailer')
const filters = require('../../filters')

const main = async () => {
  const cache = new Cache({ cacheId: CACHE_NAME })
  const cacheData = cache.get()

  const { timezone } = config
  const currentDate = DateTime.now().setZone(timezone)

  for (const filter of filters) {
    const thresholds = filter.thresholdTimes
    const startDate = DateTime.fromISO(
      Helpers.timeExpressionToDate(thresholds.start, timezone).toISOString()
    ).setZone(timezone)

    if (startDate > currentDate) {
      console.log(`waiting until ${startDate}`)
      continue
    }

    if (cacheData[thresholds.start] === true) {
      console.log(`already sent ${startDate}`)
      continue
    }

    console.log(`sending ${startDate}`)

    const transport = nodemailer.createTransport(config.sender.transport)
    console.log('sending email')
    await transport.sendMail({
      from: config.from,
      subject: filter.subject,
      to: 'patricia-theeye@outlook.com',
      html: filter.body
    })

    cacheData[thresholds.start] = true
  }

  cache.save(cacheData)
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
