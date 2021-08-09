require('dotenv').config()

const TheEyeIndicator = require('../lib/indicator')
const Cache = require('../lib/cache')
const config = require('../lib/config').decrypt()

const main = module.exports = async () => {

  const cache = new Cache({ cacheId: 'classification' })
  cache.drop()

  TheEyeIndicator.accessToken = config.api.accessToken
  const resp = await TheEyeIndicator.Fetch() 
  const indicators = JSON.parse(resp.body)

  for (let data of indicators) {
    const indicator = new TheEyeIndicator(data.title, data.type)
    indicator.accessToken = TheEyeIndicator.accessToken
    await indicator.remove()
  }
}


if (require.main === module) {
  main().then(console.log).catch(console.error)
}
