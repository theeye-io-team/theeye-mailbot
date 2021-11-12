const got = require('got')

const BASE_URL = JSON.parse(process.env.THEEYE_API_URL || '"https://supervisor.theeye.io"')

class TheEyeAlert {
  constructor (task, secret, subject, body, recipients) {
    this.apiURL = BASE_URL

    this._task = task
    this._secret = secret
    this._subject = (subject || '')
    this._body = (body || '')
    this._recipients = (recipients || '')
  }

  get url () {
    const url = `${this.apiURL}/task/${this.task}/secret/${this.secret}/job`
    return url
  }

  set task (task) {
    this._task = task
  }

  set secret (secret) {
    this._secret = secret
  }

  set subject (subject) {
    this._subject = subject
  }

  set body (body) {
    this._body = body
  }

  set recipients (recipients) {
    this._recipients = recipients
  }

  get task () {
    return this._task
  }

  get secret () {
    return this._secret
  }

  get subject () {
    return this._subject
  }

  get body () {
    return this._body
  }

  get recipients () {
    return this._recipients
  }

  async post () {
    const payload = {
      task_arguments: [this.subject, this.body, this.recipients]
    }

    let response

    try {
      response = await got.post(this.url, {
        json: payload,
        responseType: 'json'
      })
    } catch (err) {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${JSON.stringify(err.response.body)}`)
      console.error(reqErr)
    }

    return response
  }
}

module.exports = TheEyeAlert
