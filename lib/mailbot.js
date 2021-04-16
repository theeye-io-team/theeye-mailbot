const imaps = require('imap-simple')
const rfc2047 = require('rfc2047')
const path = require('path')

class MailBot {
  constructor (config) {
    this.config = config
  }

  async connect () {
    const connection = await imaps.connect({ imap: this.config.imap })
    await connection.openBox(this.config.folders.INBOX)
    this.connection = connection
    return this
  }

  async fetchMessages () {
    const fetchOptions = { bodies: [ 'HEADER', 'TEXT' ], struct: true }

    const searchResult = await this.connection.search(this.config.searchCriteria, fetchOptions)

    console.log('Fetched: ', searchResult.length, ' messages with the selected criteria\n')

    return searchResult
  }

  getFrom (message) {
    const body = this.getBody(message)
    return body.from[0]
  }

  getSubject (message) {
    const body = this.getBody(message)
    return body.subject[0]
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
    this.connection.moveMessage(messageUid, config.folders.processed)
  }

  closeConnection () {
    return this.connection.end()
  }
}

module.exports = MailBot
