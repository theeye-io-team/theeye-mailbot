require('dotenv').config()

const Cache = require('../lib/cache')

const main = module.exports = async () => {
  const cache = new Cache({ cacheId: 'classification' })
  cache.rotate()
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
