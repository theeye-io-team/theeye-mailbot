const fs = require('fs')
const path = require('path')
const MailBot = require('./lib/mailbot')
const MailApi = require('./lib/api')
const helpers = require('./lib/helpers')
const EncConfig = require('./lib/config')

const main = module.exports = async () => {
  const config = EncConfig.decrypt()

  const mailApi = new MailApi(config)
  const mailBot = new MailBot(config)
  const connection = await mailBot.connect()
  const messages = await mailBot.fetchMessages()

  let movedMessages = 0
  let processedMessages = 0
  let attachmentsFound = 0
  let attachmentsProcessed = 0

  for (const message of messages) {
    // parse parts inside body
    const mailFrom = await mailBot.getFrom(message)
    console.log(mailFrom)
    const mailSubject = await mailBot.getSubject(message)
    console.log(mailSubject)
    const mailDate = await mailBot.getDate(message)
    console.log(mailDate)

    // const body = await mailBot.getBody(message)
    const attachments = await mailBot.searchAttachments(message, config.attachments)

    if (attachments.length > 0) {
      const attachmentsData = await mailBot.downloadAttachments(message, attachments)
      if (attachmentsData.length > 0) {

        processedMessages++

        const hashMail = helpers.createHash(`${mailFrom}${mailSubject}${mailDate}`)
        const dateFormatted = helpers.dateFormat(mailDate)
        const attachmentsPath = path.join(config.attachments.downloadsDirectory, dateFormatted, hashMail)

        console.log(`downlaods directory ${attachmentsPath}`)
        if (!fs.existsSync(attachmentsPath)) {
          console.log('creating downlaods directory')
          fs.mkdirSync(attachmentsPath, { recursive: true })
        }

        for (const index in attachmentsData) {
          attachmentsFound++

          const attachmentHash = helpers.createHash(attachmentsData[index].data)
          const fileExt = path.extname(attachmentsData[index].filename)
          const renamedFile = `${config.folders.INBOX}_${dateFormatted}_${hashMail}_${attachmentHash}${fileExt}`
          const attachmentPath = path.join(attachmentsPath, renamedFile)
          const attachmentData = attachmentsData[index].data

          console.log(`saving attachment into ${attachmentPath}`)
          fs.writeFileSync(attachmentPath, attachmentData)

          const payload = {
            folder: config.folders.INBOX,
            from: mailFrom,
            subject: mailSubject,
            reception_date: mailDate,
            mail_hash: hashMail,
            attachment_filename: attachmentsData[index].filename,
            attachment_hash: attachmentHash,
            attachment_renamed: renamedFile
          }

          // verifica si el attachment ya fue procesado.
          const checkResponse = await mailApi.checkExists(payload)
          console.log(checkResponse)

          const mailExists = JSON.parse(checkResponse)
          if (/not found/i.test(mailExists) === true) {
            attachmentsProcessed++
            console.log(`uploading attachment ${attachmentPath}`)
            const uploadResponse = await mailApi.upload(payload, attachmentPath)
            console.log(uploadResponse)
          } else {
            console.log('already processed')
          }
        }
      }
    }

    if (attachments.length === 0) {
      if (config.folders.notProcessed) {
        const messageUid = message.attributes.uid
        await connection.connection.moveMessage(messageUid, config.folders.notProcessed)
      } else {
        console.log('mensaje no procesado. no se mueve. carpeta destino no definida')
      }
    } else {
      if (config.folders.processed) {
        const messageUid = message.attributes.uid
        await connection.connection.moveMessage(messageUid, config.folders.processed)
      } else {
        console.log('mensaje procesado. no se mueve. carpeta destino no definida')
      }
    }

    movedMessages++
  }

  await mailBot.closeConnection()

  return { processedMessages, movedMessages, attachmentsFound, attachmentsProcessed }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
