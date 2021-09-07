require('dotenv').config()

const config = require('../lib/config').decrypt()
const MailBot = require('../lib/mailbot')

const main = module.exports = async () => {

  const mailBot = new MailBot(config)
  await mailBot.connect()

  console.log(mailBot.connection.serverInfo)

  await mailBot.closeConnection()

  return 'ok'
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
