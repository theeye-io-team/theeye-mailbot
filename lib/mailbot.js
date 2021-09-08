const { ImapFlow } = require('imapflow')
const rfc2047 = require('rfc2047')
const path = require('path')
const { simpleParser } = require('mailparser')

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
    await client.getMailboxLock(this.config.folders.INBOX)

    this.connection = client
    return this
  }

  async searchMessages (searchCriteria = null) {
    searchCriteria || (searchCriteria = this.config.searchCriteria)

    const query = JSON.parse(JSON.stringify({
      body: searchCriteria.body,
      from: searchCriteria.from,
      subject: searchCriteria.subject
    }))

    console.log(`searching ${JSON.stringify(query)}`)

    const searchResult = await this.connection.search(query)

    console.log(`${searchResult.length} messages with the selected criteria`)

    return searchResult.map(seq => new Message(seq, this))
  }

  closeConnection () {
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

  move () {
    if (this.#mailbot.config.moveProcessedMessages !== true) {
      console.log(`moving message disabled by config`)
      return
    }

    console.log(`moving message ${this.seq}`)
    return this.#mailbot.connection.messageMove(this.seq, this.#mailbot.config.folders.processed)
  }

  /**
   * @param {Mail} message
   * @param {Array} types list to search by admited extensions
   * @return {Array}
   */
  async getContent () {
    const { meta, content } = await this.download()

    const rawData = await streamToString(content)

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

  get from () {
    return this.data.from.value.map(from => from.address)[0]
  }

  get subject () {
    return this.data.subject
  }

  get body () {
    return this.data.text
  }

  getAttachmentFilename (attachment) {
    return rfc2047.decode(attachment.disposition.params.filename)
  }
}

function streamToString (stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  })
}

module.exports = MailBot
