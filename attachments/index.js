require('dotenv').config()
const config = require('../lib/config').decrypt()
const fs = require('fs')
const path = require('path')
const MailApi = require('../lib/api')
const mailApi = new MailApi(config)
const MailBot = require('../lib/mailbot')
const mailBot = new MailBot(config)
const Helpers = require('../lib/helpers')
const { DateTime } = require('luxon')

if (!process.env.DOWNLOAD_RULES_PATH) {
  throw new Error('env process.env.CLASSIFICATION_RULEZ_PATH not defined.')
}

const attachmentDownloadRules = require(process.env.DOWNLOAD_RULES_PATH)

const main = module.exports = async (maxMessages) => {
  await mailBot.connect()

  for (const rule of attachmentDownloadRules) {
    let messages = await mailBot.searchMessages(rule.search)

    if (maxMessages) {
      messages = messages.slice(0, Number(maxMessages))
    }

    await processMessagesAttachments(rule.downloads, messages)
  }

  console.log('-----------------------------------------------------')
  console.log('cerrando conexión')

  await mailBot.closeConnection()
}

const processMessagesAttachments = async (downloads, messages) => {
  if (!Array.isArray(downloads)) {
    throw new Error('invalid downloads definition')
  }
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    console.log('-----------------------------------------------------')
    console.log(`procesando mensaje ${message.seq}`)

    const emailPayload = {}
    let mailHash

    try {
      await message.getContent()

      // parse parts inside body
      const mailFrom = message.from
      const mailSubject = message.subject
      const mailDate = message.date

      mailHash = Helpers.createHash(`${mailFrom}${mailSubject}${mailDate}`)

      emailPayload.folder = config.folders.INBOX,
      emailPayload.from = mailFrom,
      emailPayload.subject = mailSubject,
      emailPayload.reception_date = mailDate,
      emailPayload.mail_hash = mailHash

      let attachments = []

      for (let index = 0; index < downloads.length; index++) {
        const download = downloads[index]

        switch (download.type) {
          case 'attachments':
            attachments = [...attachments, ...await message.searchAttachments(download)]
            break;
          case 'body_parser':
            attachments = [...attachments, ...await message.searchBodyAttachments(download)]
            break;
          default:
            break;
        } 
      }

      if (attachments.length > 0) {
        await processAttachments(attachments, emailPayload)
      } else {
        await mailApi.upload(emailPayload)
      }
      await message.move(config.folders.processed)
    } catch (err) {
      console.error(err)

      if (mailHash) {
        emailPayload.lifecycle = 'message_error'
        emailPayload.lifecycle_error = err.message

        await mailApi.upload(emailPayload)
      }
      await message.move(config.folders.notProcessed)
    }
  }
}

const processAttachments = async (attachments, emailPayload) => {
  console.log(`processing ${attachments.length} attachments`)
  for (const attachment of attachments) {
    const attachmentPayload = Object.assign({}, emailPayload)

    try {
      const dateFormatted = DateTime.fromJSDate(emailPayload.reception_date).toFormat(config.attachments.dateFormat)
      const attachmentData = attachment.content
      const attachmentHash = Helpers.createHash(attachmentData)
      const attachmentExt = path.extname(attachment.filename)
      const attachmentRenamed = `${config.folders.INBOX}_${dateFormatted}_${emailPayload.mail_hash}_${attachmentHash}${attachmentExt}`

      attachmentPayload.attachment_filename = attachment.filename
      attachmentPayload.attachment_hash = attachmentHash
      attachmentPayload.attachment_renamed = attachmentRenamed

      if (config.attachments.saveToDiskDir) {
        const attachmentsPath = path.join(config.attachments.saveToDiskDir, dateFormatted, emailPayload.mail_hash)

        if (!fs.existsSync(attachmentsPath)) {
          console.log(`creating attachments download folder ${attachmentsPath}`)
          fs.mkdirSync(attachmentsPath, { recursive: true })
        }

        const attachmentPath = path.join(attachmentsPath, attachmentRenamed)

        fs.writeFileSync(attachmentPath, attachmentData)
      }

      attachmentPayload.lifecycle = 'success'
      await uploadAttachment(attachmentPayload, attachmentData)
    } catch (err) {
      attachmentPayload.lifecycle = 'attachment_error'
      attachmentPayload.lifecycle_error = err.message
      await mailApi.upload(attachmentPayload)
    }
  }
}

const uploadAttachment = async (attachmentPayload, attachmentData) => {
  const res = await mailApi.checkExists(attachmentPayload)
  if (/not found/i.test(res.body)) {
    return mailApi.upload(attachmentPayload, attachmentData)
  } else {
    console.log('attachment already uploaded')
  }
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
