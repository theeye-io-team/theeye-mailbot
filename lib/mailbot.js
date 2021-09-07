const { ImapFlow } = require('imapflow')
const rfc2047 = require('rfc2047')
const path = require('path')

const logger = {
  debug () {},
  info () {},
  warn () {},
  error () {}
}

class MailBot {
  constructor (config) {
    this.config = config
  }

  async connect () {
    const imapConfig = this.config.imap
    const config = {
      logger: (imapConfig.debug===true?null:logger),
      emitLogs: (imapConfig.emitLogs || false),
      host: imapConfig.host,
      port: (imapConfig.port || 993),
      secure: (imapConfig.tls || imapConfig.secure || true),
      auth: {
        user: (imapConfig.user || imapConfig.auth?.user),
        pass: (imapConfig.password || imapConfig.auth?.pass)
      }
    }

    const client = new ImapFlow(config)
    await client.connect()
    await client.getMailboxLock(this.config.folders.INBOX)

    this.connection = client
    return this
  }

  async searchMessages (searchCriteria = null) {
    searchCriteria || (searchCriteria = this.config.searchCriteria)

    const searchResult = await this.connection.search(searchCriteria)

    console.log('Fetched: ', searchResult.length, ' messages with the selected criteria\n')

    return searchResult
  }

  getFrom (message) {
    return message.from
  }

  getSubject (message) {
    return message.subject
  }

  getBody (message) {
    let body = null
    for (const part of message.parts) {
      if (part.which === 'HEADER') {
        body = part.body
      }
    }

    if (body === null) {
      throw new Error('no se encontro el body')
    }

    return body
  }

  /**
   * @param {Mail} message
   * @param {Array} types list to search by admited extensions
   * @return {Array}
   */
  searchAttachments (message, config) {
    const { allowed } = config
    const attachments = []
    const parts = imaps.getParts(message.attributes.struct)

    for (const part of parts) {
      if (
        part.disposition &&
        allowed.dispositions.indexOf(part.disposition.type.toLowerCase()) !== -1
      ) {
        const filename = this.getAttachmentFilename(part)
        let extension
        if (filename) {
          extension = path.extname(filename).replace('.','').toLowerCase()
        }

        //let mimeType = part.subtype
        if (extension && allowed.extensions.indexOf(extension) !== -1) {
          attachments.push(part)
        }
      }
    }

    return attachments
  }

  /**
   * @param {Mail}
   * @param {Array} attachments to download
   * @return {Array}
   */
  downloadAttachments (message, attachments) {
    const downloadPromises = []
    const parts = imaps.getParts(message.attributes.struct)

    for (const attachment of attachments) {
      const promise = this.connection
        .getPartData(message, attachment)
        .then(partData => {
          return {
            filename: this.getAttachmentFilename(attachment),
            data: partData
          }
        })

      downloadPromises.push(promise)
    }

    return Promise.all(downloadPromises)
  }

  getAttachmentFilename (attachment) {
    return rfc2047.decode(attachment.disposition.params.filename)
  }

  getDate (message) {
    const body = this.getBody(message)
    return new Date(body.date[0])
  }

  async moveMessage (message) {
    if (this.config.moveProcessedMessages !== true) {
      console.log(`moving message disabled by config`)
      return
    }

    const messageUid = message.attributes.uid
    console.log(`moving message ${messageUid}`)
    this.connection.moveMessage(messageUid, this.config.folders.processed)
  }

  closeConnection () {
    return this.connection.logout()
  }
}

module.exports = MailBot
