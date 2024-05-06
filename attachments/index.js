require('dotenv').config()

const config = require('theeye-bot-sdk/core/config').decrypt()
const fs = require('fs')
const path = require('path')
const MailApi = require('theeye-bot-sdk/core/api/mail')
const mailApi = new MailApi(config.api)
const MailBot = require('theeye-bot-sdk/core/mail/client')
const mailBot = new MailBot(config)
const { createHash } = require('../lib/helpers')
const { DateTime } = require('luxon')

if (!process.env.DOWNLOAD_RULES_PATH) {
  throw new Error('env process.env.DOWNLOAD_RULES_PATH not defined.')
}

const attachmentDownloadRules = require(process.env.DOWNLOAD_RULES_PATH)

const main = module.exports = async (maxMessages) => {
  await mailBot.connect()
  console.log('connected')

  if (config.attachments.saveToDiskDir) {
    try {
      fs.accessSync(config.attachments.saveToDiskDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (err) {
      console.error(err)
      throw new Error(`cannot access download directory ${config.attachments.saveToDiskDir}`)
    }
  }

  for (const rule of attachmentDownloadRules) {
    let messages = await mailBot.searchMessages(rule.search)

    if (!isNaN(Number(maxMessages))) {
      messages = messages.slice(0, Number(maxMessages))
    } else {
      console.log('max messages threshold is not set or invalid')
    }

    await processMessagesAttachments(rule.downloads, messages)
  }

  console.log('-----------------------------------------------------')
  console.log('cerrando conexión')

  await mailBot.closeConnection()
}

const processMessagesAttachments = async (downloadRules, messages) => {
  if (!Array.isArray(downloadRules)) {
    throw new Error('invalid downloadRules definition')
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

      mailHash = createHash(`${mailFrom}${mailSubject}${mailDate}`)

      emailPayload.folder = config.folders.INBOX,
      emailPayload.from = mailFrom,
      emailPayload.subject = mailSubject,
      emailPayload.reception_date = mailDate,
      emailPayload.mail_hash = mailHash

      let attachments = []

      for (let index = 0; index < downloadRules.length; index++) {
        const rule = downloadRules[index]

        switch (rule.type) {
          case 'headers':
            emailPayload.headers = await message.searchHeaders(rule)
            break;
          case 'raw':
            emailPayload.raw = await message.rawData
            break;
          case 'body':
            emailPayload.body = await message.searchBody(rule)
            break;
          case 'attachments':
            attachments = [...attachments, ...await message.searchAttachments(rule)]
            break;
          case 'body_parser':
            attachments = [...attachments, ...await message.searchBodyAttachments(rule)]
            break;
          default:
            break;
        } 
      }

      if (attachments.length > 0) {
        await processAttachments(attachments, emailPayload)
        await message.move(config.folders.processed)
      } else {
        await mailApi.upload(emailPayload)
        await message.move(config.folders.notProcessed || config.folders.processed)
      }
    } catch (err) {
      console.error(err)
      try {
        if (mailHash) {
          emailPayload.lifecycle = 'message_error'
          emailPayload.lifecycle_error = err.message

          await mailApi.upload(emailPayload)
        }
        await message.move(config.folders.notProcessed)
      } catch (err) {
        console.error('unable to update mail api')
        console.error(err.message)
      }
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
      const attachmentHash = createHash(attachmentData)
      const attachmentExt = path.extname(attachment.filename)
      const attachmentRenamed = `${config.folders.INBOX}_${dateFormatted}_${emailPayload.mail_hash}_${attachmentHash}${attachmentExt}`

      console.log(`new attachment name is ${attachmentRenamed}`)

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
      console.error(err.message)
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

    console.log(attachmentPayload)
    console.log(res.body)
  }
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
