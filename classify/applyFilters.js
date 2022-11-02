const Helpers = require('../lib/helpers')
const { DateTime } = require('luxon')
const MailBot = require('../lib/mailbot')
const TheEyeAlert = require('../lib/alert')
const EscapedRegExp = require('../lib/escaped-regexp')

const config = require('../lib/config').decrypt()

const main = module.exports = async (filters, classificationCache) => {
  const { timezone } = config

  const cacheData = classificationCache.data
  const runtimeDate = DateTime.fromISO(new Date(cacheData.runtimeDate).toISOString())
  console.log(`runtime date is set to ${runtimeDate}`)
  const mailBot = new MailBot(config)
  await mailBot.connect()
  const currentDateTime = DateTime.now().setZone(timezone)

  for (const filter of filters) {
    console.log('-------------------')
    console.log(`Classifying: ${filter.indicatorDescription}`)

    // si no tiene id no se completo el setup
    const filterHash = filter.id
    if (!filterHash) {
      console.log('Filter setup was not completed. This filter will be ignored.')
    } else {
      let filterCacheData = cacheData[filterHash]

      // inicializacion de datos en cache cuando comienza el día o nueva regla
      if (!filterCacheData) {
        filterCacheData = classificationCache.initHashData(filterHash, filter)
      }

      if (classificationCache.isAlreadyProcessed(filterHash) === true) {
        console.log('Skip this rule. Already checked.')
        continue
      }

      const thresholds = filter.thresholdTimes

      //
      // @TODO validar. el rango de las reglas de filtrado no pueden contener la hora de inicio del día. rompe la logica
      //
      const startFilterDate = Helpers.getFormattedThresholdDate(thresholds.start, timezone, runtimeDate, config.startOfDay)
      const lowFilterDate = Helpers.getFormattedThresholdDate(thresholds.low, timezone, runtimeDate, config.startOfDay)
      const highFilterDate = Helpers.getFormattedThresholdDate(thresholds.high, timezone, runtimeDate, config.startOfDay)
      const criticalFilterDate = Helpers.getFormattedThresholdDate(thresholds.critical, timezone, runtimeDate, config.startOfDay)

      //
      // ignore rules not inprogress. skip early checks
      //
      if (startFilterDate > currentDateTime) {
        console.log('Skip this rule. Not started yet')
        continue
      }

      const searchSinceModifier = (config.searchSince || 12)
      const since = new Date(
        DateTime.fromISO(
          Helpers.timeExpressionToDate(
            thresholds.start,
            timezone,
            runtimeDate
          ).toISOString()
        ).plus({ hours: -searchSinceModifier })
      ).toISOString()

      const messages = await mailBot.searchMessages(Object.assign({}, filter, { since }))

      let found = false

      if (messages.length > 0) {
        //
        // que pasa si hay mas de 1 con el mismo criterio ??
        //
        for (const message of messages) {
          try {
            await message.getContent()

            let bodyMatched
            let bodyText
            if (process.env.USE_IMAP_BODY_FILTER === "false") {
              if (filter.body) {
                bodyText = message.body.split(/[\n\s]/).join(' ')
                // filter by hand
                const pattern = new EscapedRegExp(filter.body.trim())
                bodyMatched = pattern.test(bodyText)
              }
            }

            if (bodyMatched === false) {
              console.log(`body not matched\n>> message body:\n${bodyText}\n>> search body:\n${filter.body}`)
            } else {
              const mailDate = getMessageDate({ message, filter, timezone })
              console.log(`mail date is ${mailDate}`)

              // ignore old messages
              if (mailDate > runtimeDate) {
                if (mailDate < lowFilterDate && config.earlyArrivedException === true) {
                  // a partir del horario de inicio del proceso
                  // horario usual de llegada del correo
                  console.log('message arrived early. won\'t be processed')
                } else {
                  // no importa si llega antes de tiempo.
                  found = true

                  const { state, severity } = Helpers.indicatorState(mailDate, lowFilterDate, highFilterDate, criticalFilterDate)

                  filterCacheData.data.solved = mailDate.toFormat('HH:mm')
                  filterCacheData.data.result.state = state
                  filterCacheData.data.result.severity = severity
                  filterCacheData.processed = true

                  await message.move()
                  classificationCache.replaceHashData(filterHash, filterCacheData)
                }
              } else {
                console.log('Old message')
              }
            }
          } catch (err) {
            console.error(err)
          }
        }
      }

      if (!found) {
        const { state, severity } = Helpers.indicatorState(currentDateTime, lowFilterDate, highFilterDate, criticalFilterDate)
        let sentAlert = filterCacheData.alert[severity]

        if (!sentAlert) {
          sentAlert = await sendAlert(filterCacheData, state, severity)
          filterCacheData.alert[severity] = sentAlert
        }

        filterCacheData.data.result.state = state
        filterCacheData.data.result.severity = severity

        classificationCache.replaceHashData(filterHash, filterCacheData)
      }
    }
  }

  await mailBot.closeConnection()
}

const getMessageDate = ({ message, filter, timezone }) => {
  const useReceivedDate = (
    process.env.USE_SERVER_RECEIVED_DATE === 'true' ||
    config.useReceivedDate ||
    filter.useReceivedDate
  )

  let messageDate
  if (useReceivedDate === true) {
    console.log('useReceivedDate: Using server "Received" date')
    messageDate = message.dateReceived
  } else {
    console.log('Using message "Sent" date')
    messageDate = message.date
  }

  const ignoreMessageTimezone = (
    process.env.IGNORE_MESSAGES_TIMEZONE === 'true' ||
    config.ignoreMessageTimezone ||
    filter.ignoreMessageTimezone
  )

  if (ignoreMessageTimezone === true) {
    console.log('ignoreMessageTimezone: Using timezone configuration')
    return ignoreOriginalTimezone(messageDate, timezone)
  } else {
    console.log('Using message timezone')
    return setTimezone(messageDate, timezone)
  }
}

/**
 * Keep the same date ignoring the original Timezone.
 * This is assuming that the original timezone is wrong
 * and it must be replaced by the real arrival time.
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const ignoreOriginalTimezone = (date, timezone) => {
  // use toISOString formatter in UTC/Zero timezone and remove the timezone part
  const trimmedDate = date.toISOString().replace(/\.[0-9]{3}Z$/, '')
  // create a new Date and initialize it using the desired timezone
  const tzDate = DateTime.fromISO(trimmedDate, { zone: timezone })
  return tzDate
}

/**
 * Change date to the timezone
 *
 * @param {Date} date
 * @param {String} timezone
 * @return {DateTime} luxon
 */
const setTimezone = (date, timezone) => {
  return DateTime
    .fromISO(date.toISOString())
    .setZone(timezone)
}

/**
 *
 * @param {Object} filter
 * @param {String} state
 * @param {String} severity
 * @returns {Boolean}
 */
const sendAlert = async (filter, state, severity) => {
  const recipients = Helpers.getAcls(config)
  if (!recipients) {
    console.log('Notification: no recipients defined')
    return true
  }

  const alerts = config?.api?.alert
  if (!alerts || !alerts.task || !alerts.secret) {
    console.log('Notification: api configuration is missing')
    return true
  }

  if (state === 'failure') {
    const subject = `Alerta de Retraso ${severity} correo ${filter.data.indicatorTitle}`
    const body = `
      <p>Estimado,</p> 
      <p>El siguiente correo se encuentra demorado con severidad <b>${severity}</b></p>
      <ul>
        <li><b>indicatorTitle: </b>${filter.data.indicatorTitle}</li>
        <li><b>From: </b>${filter.data.from}</li>
        <li><b>Subject: </b>${filter.data.subject}</li>
        <li><b>Body: </b>${filter.data.body}</li>
        <li><b>Start: </b>${filter.data.start}</li>
        <li><b>Low: </b>${filter.data.low}</li>
        <li><b>High: </b>${filter.data.high}</li>
        <li><b>Critical: </b>${filter.data.critical}</li>
      </ul>
    `

    const notification = new TheEyeAlert(
      alerts.task,
      alerts.secret,
      subject,
      body,
      recipients
    )

    await notification.post()
    return true
  }

  if (state === 'failure' && filter.alert) { return true }

  return false
}
