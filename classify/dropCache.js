require('dotenv').config()

const Cache = require('../lib/cache')

const main = module.exports = async (cacheId) => {
  const cache = new Cache({ cacheId })
  return cache.drop()
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(console.error)
}
