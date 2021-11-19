require('dotenv').config()

const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const Cache = require('../lib/cache')

const main = module.exports = async () => {

  const cache = new Cache({ cacheId: 'classification' })
  cache.rotate()
  
  TheEyeIndicator.accessToken = config.api.accessToken
  const resp = await TheEyeIndicator.Fetch()
  const indicators = JSON.parse(resp.body)

  const titles = [
    config.indicator_titles.progress,
    config.indicator_titles.status,
    config.indicator_titles.progress_detail,
    config.indicator_titles.progress_detail_only_waiting
  ]

  for (const data of indicators) {
    for(const title of titles) {
      if(data.title === title) {
        const indicator = new TheEyeIndicator(title, data.type)
        indicator.accessToken = TheEyeIndicator.accessToken
        await indicator.remove()
      }
    }
  }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
