const config = require('../lib/config').decrypt()
const MailBot = require('../lib/mailbot')

const main = module.exports = async () => {

  const mailBot = new MailBot(config)

  console.log('connecting...')
  await mailBot.connect()
  console.log('connected!')

  console.log('fetching messages...')
  const messages = await mailBot.searchMessages([['UID',102]])

  console.log(`fetched ${messages.length} messages`)
  console.log(messages.forEach(message=>console.log(message.attributes.uid)))

  console.log('closing connection...')
  await mailBot.disconnect()
  return true
}

main().then(console.log).catch(console.error)
