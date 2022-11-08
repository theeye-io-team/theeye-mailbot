const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
const { DateTime } = require('luxon')

TheEyeIndicator.accessToken = config.api.accessToken

const maxDiff = process.argv.KEEP || 5

const getDate = (dateString) => {
  return DateTime.fromISO(dateString)
}

const getDiffInDays = (date) => {
  const today = DateTime.now().setZone(config.timezone).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  const diff = (today - date) / 86400000
  console.log({
    indicatorDate: date.toISO(),
    today: today.toISO(),
    diff
  })

  return diff
}

const main = module.exports = async () => {
  const resp = await TheEyeIndicator.Fetch()
  const indicators = JSON.parse(resp.body)

  for (const data of indicators) {
    const indicatorDate = getDate(data.creation_date)
    const diffInDays = getDiffInDays(indicatorDate)

    if (diffInDays > maxDiff) {
      const indicator = new TheEyeIndicator(data.title, data.type)
      await indicator.remove()
    }
  }
}

if (require.main === module) {
  main().then(console.log).catch(console.error)
}
