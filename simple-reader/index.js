require('dotenv').config()
const MailBot = require('theeye-bot-sdk/core/mail/client')
const config = require('theeye-bot-sdk/core/config').decrypt()

const main = module.exports = async () => {

  const mailBot = new MailBot(config)
  await mailBot.connect()

  const messages = await mailBot.searchMessages()

  let result
  if (messages.length > 0) {
    const message = messages[0]
    await message.getContent()

    let body
    if (message.body) {
      body = Buffer.from(message.body).toString('base64')
    }

    let destinatarios
    if (message.data.to) {
      destinatarios = message.data.to.value.map(el => el.address).join(',')
    }

    let destinatarioscc
    if (message.data.cc) {
      destinatarioscc = message.data.cc.value.map(el => el.address).join(',')
    }

    await message.move()

    result = {
      to: destinatarios,
      cc: destinatarioscc,
      subject: message.subject,
      from: message.from,
      body
    }
  } else {
    result = null
  }

  await mailBot.closeConnection()
  return result
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
