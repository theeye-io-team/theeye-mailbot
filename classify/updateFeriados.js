const MailBot = require('theeye-bot-sdk/core/mail/client')
const Files = require('theeye-bot-sdk/core/api/file')
const config = require('theeye-bot-sdk/core/config').decrypt()

Files.access_token = config.api.accessToken

const main = module.exports = async ( ) => {
  const mailBot = new MailBot(config)
  await mailBot.connect()

  const messages = await mailBot.searchMessages({subject: config.feriados.emailSubject})

  for(const message of messages) {
    const content = await message.getContent()

    const fileData = {
      filename: config.feriados.filename || 'feriados.json',
      description: `Automatically generated on ${new Date().toISOString()}`,
      contentType: 'application/json',
      content: JSON.stringify(JSON.parse(content.text), null, 2)
    }

    await Files.Upsert(fileData)
    await message.move()
  }

  return messages
}

if (require.main === module) {
  main().then(console.log).catch(console.log)
}
