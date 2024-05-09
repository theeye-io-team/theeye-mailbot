require('dotenv').config()

const EncConfig = require('theeye-bot-sdk/core/config')
const MailBot = require('theeye-bot-sdk/core/mail/client')

const main = module.exports = async () => {
  try {

    const config = EncConfig.decrypt()
    console.log(config)

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
  } catch (err) {
    console.error(err)
  }
}

main().then(console.log).catch(console.error)
