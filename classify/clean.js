require('dotenv').config()

const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()

const main = module.exports = async () => {
  TheEyeIndicator.accessToken = config.api.accessToken
  const resp = await TheEyeIndicator.Fetch()
  const indicators = JSON.parse(resp.body)

  for (const data of indicators) {
    const indicator = new TheEyeIndicator(data.title, data.type)
    indicator.accessToken = TheEyeIndicator.accessToken
    await indicator.remove()
  }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
