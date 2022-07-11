const qs = require('qs')
const FormData = require('form-data')
const Readable = require('stream').Readable
const Request = require('./req')

class API {
  constructor (config) {
    this.config = config.api_tagger
  }

  /**
   * @param {Object} payload
   * @prop {String} payload.from
   * @prop {String} payload.subject
   * @prop {String} payload.reception_date
   * @prop {String} payload.attachment_filename
   * @prop {String} payload.attachment_hash
   * @prop {String} payload.mail_hash
   * @prop {String} payload.attachment_renamed
   *
   * @return Promise
   */
  checkExists (payload) {
    const query = qs.stringify(payload)

    const options = {
      url:`${this.config.url}/api/Mails/check?${query}&access_token=${this.config.accessToken}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    }

    return Request(options)
  }

  /**
   *
   * @param {Object} payload
   * @prop {String} payload.from
   * @prop {String} payload.subject
   * @prop {String} payload.reception_date
   * @prop {String} payload.attachment_filename
   * @prop {String} payload.attachment_hash
   * @prop {String} payload.mail_hash
   * @prop {String} payload.attachment_renamed
   * @param {Buffer} content attachment content buffer
   *
   * @return Promise
   *
   */
  upload (payload, content) {
    
    const file = new Readable()
    // CONTENT
    file.push(content)
    // EOF
    file.push(null)

    const formData = new FormData()
    formData.append('payload', JSON.stringify(payload))
    formData.append('file', file, { filename:payload.filename, mimetype:'application/pdf' })

    const options = {
      url:`${this.config.url}/api/Mails/upload?access_token=${this.config.accessToken}`,
      method: 'POST',
      formData
    }

    return Request(options)
  }
}

module.exports = API
