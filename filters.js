if (!process.env.CLASSIFICATION_RULEZ_PATH) {
  throw new Error('CLASSIFICATION_RULEZ_PATH env not set')
}

const config = require(process.env.CLASSIFICATION_RULEZ_PATH)

module.exports = config
