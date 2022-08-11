const { ImapFlow } = require('imapflow')
const rfc2047 = require('rfc2047')
const path = require('path')
const got = require('got')
const { simpleParser } = require('mailparser')

const crypto = require('crypto')

class MailBot {
  constructor (config) {
    this.config = config
  }

  async connect () {
    const imapConfig = this.config.imap
    const config = {
      logger: (imapConfig.debug===true?null:noopLogger),
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
    this.mailboxLock = await client.getMailboxLock(this.config.folders.INBOX)

    this.connection = client

    client.on('error', err => {
      console.log(`Error occurred: ${err.message}`)
    })
    client.on('close', evnt => {
      console.log(`Connection closed`)
    })

    return this
  }

  async searchMessages (searchCriteria = null) {
    searchCriteria || (searchCriteria = this.config.searchCriteria)

    // https://imapflow.com/global.html#SearchObject link to all ImapFlow available options.
    // WARNING: searchCriteria could contain garbage data, should include mappings.
    const search = {
      body: searchCriteria.body,
      from: searchCriteria.from,
      subject: searchCriteria.subject,
      seen: searchCriteria.seen,
      since: searchCriteria.since
    }

    const query = JSON.parse(JSON.stringify(search))

    console.log(`searching ${JSON.stringify(query)}`)

    const searchResult = await this.connection.search(query)

    console.log(`${searchResult.length} messages with the selected criteria`)

    return searchResult.map(seq => new Message(seq, this))
  }

  closeConnection () {
    if (this.mailboxLock) {
      this.mailboxLock.release()
    }
    return this.connection.logout()
  }
}

const noopLogger = {
  debug () {},
  info () {},
  warn () {},
  error () {}
}

class Message {
  // private
  #mailbot
  data
  meta
  id
  uid
  seq

  constructor (seq, mailbot) {
    this.#mailbot = mailbot
    this.seq = seq
  }

  async move (folder) {
    if (this.#mailbot.config.moveProcessedMessages !== true) {
      console.log(`message will not be moved. moving is disabled by config`)
      return
    }

    folder || (folder = this.#mailbot.config.folders.processed)

    if (!folder) {
      throw new Error(`A folder to move messages to is needed`)
    }
    
    console.log(`moving message to ${folder}`)
    return this.#mailbot.connection.messageMove(this.seq, folder)
  }

  /**
   * @param {Mail} message
   * @param {Array} types list to search by admited extensions
   * @return {Array}
   */
  async getContent () {
    const { meta, content } = await this.download()

    if (!content) {
      throw new Error('cannot get mail content')
    }

    const rawData = await streamToString(content)

    this.rawData = rawData
    this.meta = meta
    this.data = await simpleParser(rawData)

    return this.data
  }

  async getId () {
    const uid = await this.#mailbot.connection.fetchOne(this.seq, { uid: true })
    Object.assign(this, uid)
    return uid
  }

  /**
   * @return {Promise}
   */
  download () {
    return this.#mailbot.connection.download(this.seq)
  }

  get date () {
    return this.data.date
  }

  /**
   * It takes the closest registered received date
   */
  get dateReceived () {
    const last = this.data.headers.get("received")[0]
    const parts = last.split(';')
    const date = new Date(parts[ parts.length - 1 ])
    return date
  }

  get from () {
    return this.data.from.value.map(from => from.address)[0]
  }

  get subject () {
    return this.data.subject
  }

  get body () {
    return this.data.text
  }

  searchAttachments (rule) {
    const allowed = rule || this.#mailbot.config.attachments.allowed
    const attachments = []

    if(this.data.attachments.length) {
      for(const attachment of this.data.attachments) {
        if(allowed.dispositions.indexOf(attachment.contentDisposition) !== -1) {
          //const extension = path.extname(attachment.filename).replace(/[^\w\-. ]/g, '').toLowerCase()
          const extension = path.extname(attachment.filename).replace('.','').toLowerCase()

          if (extension && allowed.extensions.indexOf(extension) !== -1) {
            attachments.push(attachment)
          }
        }
      }
    }

    return attachments
  }

  async searchBodyAttachments (rules) {
    const text = this.data.text
    const attachments = []

    if (rules.url_patterns) {
      for (const urlPattern of rules.url_patterns) {
        const foundAttachments = text.match(new RegExp(urlPattern.pattern, urlPattern.flags))

        if (foundAttachments?.length) {
          for (let url of foundAttachments) {
            if (urlPattern.filters) {
              url = urlPattern.filters.reduce( (url, filter) => {
                if (filter.type == 'replace') {
                  const pattern = new RegExp(filter.pattern, filter.flags)
                  return url.replace(pattern, filter.replacement)
                } else {
                  console.log('filter not implemented')
                  return url
                }
              }, url)
            }

            const fileData = await got(url)

            const matched = fileData.headers['content-disposition'].match(/filename=(.*)/)

            let filename
            if (
              matched !== null &&
              Array.isArray(matched) &&
              matched[1]
            ) {
              filename = matched[1]
                .split(';')[0]
                .split('"')
                .join('')
                .replace(/[^\w\-.]/,'_')
            } else {
              filename ='noname'
            }

            const shasum = crypto.createHash('md5')
            shasum.update(fileData.rawBody)
            const checksum = shasum.digest('hex')

            attachments.push({
              type: 'inline_url',
              content: Buffer.from(fileData.rawBody),
              contentType: fileData.headers['content-type'],
              filename,
              checksum,
              headers: fileData.headers,
            })
          }
        }
      }
    }

    return attachments
  }

  // getAttachmentFilename (attachment) {
  //   return rfc2047.decode(attachment.disposition.params.filename)
  // }
}

const streamToString = (stream) => {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    stream.on('error', (err) => reject(err))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

module.exports = MailBot
