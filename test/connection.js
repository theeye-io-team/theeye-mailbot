const EncConfig = require('../lib/config')
const MailBot = require('../lib/mailbot')

const main = module.exports = async () => {

  const config = EncConfig.decrypt()

  const mailBot = new MailBot(config)

  console.log('connecting ..')
  await mailBot.connect()
  console.log('connected!')

  console.log(mailBot.connection.serverInfo)

  //console.log('fetching messages ..')
  //const messages = await mailBot.fetchMessages()

  console.log('closing connection..')
  await mailBot.closeConnection()
  return 'ok'
}

main().then(console.log).catch(console.error)
