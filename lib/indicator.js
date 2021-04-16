const got = require('got')

class TheEyeIndicator {
  constructor (title, type) {
    this._title = title
    this._type = type || 'text'
  }

  get url () {
    const apiURL = JSON.parse(process.env.THEEYE_API_URL)
    const customer = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME)

    const titleURLEncoded = encodeURIComponent(this._title)
    return `${apiURL}/indicator/title/${titleURLEncoded}?access_token=${this.accessToken}&customer=${customer}`
  }

  set value (value) {
    this._value = value
  }

  set state (state) {
    this._state = state
  }

  /**
   * @prop {Luxon<DateTime>} date
   * @prop {String} description
   */
  setValue (date, description, message) {
    const time = date.toFormat('HH:mm')
    this._value = `${description}<br>${time} - ${message}`
    return this
  }

  async put () {
    const payload = {
      title: this._title,
      state: this._state,
      value: this._value,
      type: this._type
    }

    let response
    console.log(this.url)
    try {
      response = await got.put(this.url, {
        json: payload,
        responseType: 'json'
      })

    } catch (err) {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }

  async remove () {
    let response
    try {
      response = await got.delete(this.url)

    } catch (err) {
      console.log(err)
      const reqErr = new Error(`${err.response.statusCode}: ${err.response.body}`)
      console.error(reqErr)
    }

    return response
  }
}

module.exports = TheEyeIndicator
