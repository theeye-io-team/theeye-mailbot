require('dotenv').config()

// default values
const DEFAULT_CACHE_NAME = "classification"
const Helpers = require('./lib/helpers')

const { DateTime } = require('luxon')

const MailBot = require('./lib/mailbot')
const config = require('./lib/config').decrypt()

const main = module.exports = async ([ from, subject, body, since ]) => {

  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDate = DateTime.now().setZone(config.timezone)

  const messages = await mailBot.searchMessages({ since, body, subject, from })

  //console.log(`${messages.length} messages found with search criteria`)

  for (let message of messages) {
    const data = await message.getContent()
    console.log(data)
  }

  await mailBot.closeConnection()
}

if (require.main === module) {
  main(process.argv.splice(2))
    .then(console.log)
    .catch(console.error)
}
