const qs = require('qs')
const FormData = require('form-data')
const Readable = require('stream').Readable
const Request = require('./req')

class API {
  constructor (config) {
    if (config.api_tagger) {
      console.error('api_tagger config key is DEPRECATED. support will be removed')
    }
    this.config = (config.api_tagger || config.api)
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
    
    const formData = new FormData()
    formData.append('payload', JSON.stringify(payload))
    
    if(content) {
      const file = new Readable()
      // CONTENT
      file.push(content)
      // EOF
      file.push(null)
      formData.append('file', file, payload.attachment_filename)
    }

    const options = {
      url:`${this.config.url}/api/Mails/upload?access_token=${this.config.accessToken}`,
      method: 'POST',
      formData
    }

    return Request(options)
  }
}

module.exports = API
