require('dotenv').config()

const { DateTime } = require('luxon')
const Helpers = require('../lib/helpers')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()
TheEyeIndicator.accessToken = config.api.accessToken

// STYLES

const firstRowColor = '#1a2538'
const tableBaseTextColor = '#ffffff'
const innerRowColorDark = '#23324c'
const innerRowColorLight = '#304269'
const resultCritical = '#ff4d4d'
const resultHigh = '#ff8640'
const resultLow = '#ffe400'
const resultNormal = '#50d841'
const resultStandby = '#ffffff'

module.exports = {

  updateIndicators (classificationCache) {
    let acls = Helpers.getAcls(config)
    if (!acls) {
      acls = { 
        manager: [],
        operator: [],
        administrator: []
      }
    }

    const aclsAll = [].concat(acls.manager, acls.operator, acls.administrator)

    const orderedCache = Helpers.orderCache(
      classificationCache,
      config.timezone,
      DateTime.fromISO(classificationCache.data.runtimeDate),
      config.startOfDay
    )

    return Promise.all([
      this.handleProgressIndicator({
        cacheData: orderedCache.data,
        acl: aclsAll,
        indicator_title: config.indicator_titles?.progress,
        access_token: config.api.accessToken
      }).catch(err => console.log(err)),
      // Indicador de resumen
      this.handleSummaryIndicator(orderedCache, progressDetail = false, onlyWaiting = false, acls.administrator).catch(err => console.log(err)),
      // Indicador solo fallas
      this.handleSummaryIndicator(orderedCache, progressDetail = true, onlyWaiting = false, acls.operator).catch(err => console.log(err)),
      // Indicador de solo fallas (solo para waiting)
      this.handleSummaryIndicator(orderedCache, progressDetail = true, onlyWaiting = true, acls.manager).catch(err => console.log(err)),
      // Indicador estado (past-present-future)
      this.handleStatusIndicator(orderedCache, acls.administrator).catch(err => console.log(err))
    ])
  },

  handleProgressIndicator (input) {
    const { state, severity, progress } = this.progressIndicatorData(input.cacheData)

    const tit = this.prepareIndicatorTitle(
      input.indicator_title || 'Progress %DATE%',
      input.cacheData.runtimeDate
    )

    const indicator = new TheEyeIndicator(tit)
    indicator.order = 0
    indicator.accessToken = input.access_token

    // length -1 , descuenta 1 por el runtimeDate que esta en cache
    // progress === amount of solved rules
    indicator.value = Math.round(progress * 100 / (Object.keys(input.cacheData).length - 1))
    indicator.state = state
    indicator.severity = severity
    indicator.type = 'progress'
    indicator.acl = input.acl

    return indicator.put()
  },
  
  progressIndicatorData (cacheData) {
    const processedFilters = []
    //const failureFilters = []
    const delayedRules = []

    let progress = 0

    for (const filterHash in cacheData) {
      if (filterHash !== 'runtimeDate') {
        const filter = cacheData[filterHash]
        if (filter.data.solved || filter.processed === true) {
          progress++
        } else {
          delayedRules.push(filter)
        }

        //if (filter.processed) { // ya llego
        //  processedFilters.push(filter)
        //} else {
        //  // si tiene state y severidad , esta fallando.
        //  if (filter.data.result.state === 'failure') {
        //    failureFilters.push(filter)
        //  }
        //}
      }
    }

    let state = 'normal'
    let severity = 'low'

    if (delayedRules.length > 0) {
      state = 'failure'
      for (const filter of delayedRules) {
        if (
          this.transformSeverity(severity) <
          this.transformSeverity(filter.data.result.severity)
        ) {
          // set the new global severity
          severity = filter.data.result.severity
        }
      }
    }

    //const progress = failureFilters.length + processedFilters.length

    return { state, severity, progress }
  },

  prepareIndicatorTitle (text, runtimeDate) {
    let parsedTit = text
    if (/%DATE%/.test(parsedTit) === true) {
      const formattedDate = DateTime
        .fromJSDate(new Date(runtimeDate))
        .toFormat('dd-MM-yyyy')

      parsedTit = parsedTit.replace(/%DATE%/, formattedDate)
    }
    return parsedTit
  },

  /**
   *
   * @param {String} severity
   * @returns {Number} severity
   */
  transformSeverity (severity) {
    switch (severity) {
      case 'low': return 1
      case 'high': return 2
      case 'critical': return 3
      default: return 0
    }
  },

  async orderIndicators (tag) {
    let order = 1000
    const resp = await TheEyeIndicator.Fetch()
    const indicators = JSON.parse(resp.body)
    const taggedIndicators = indicators.filter(indicator => indicator.tags.indexOf(tag) !== -1)

    taggedIndicators.sort((elem1, elem2) => {
      const elem1Date = DateTime.fromISO(elem1.creation_date)
      const elem2Date = DateTime.fromISO(elem2.creation_date)
      if (elem1Date > elem2Date) {
        return -1
      }
      if (elem1Date < elem2Date) {
        return 1
      }
      return 0
    })

    for (const data of taggedIndicators) {
      const indicator = new TheEyeIndicator(data.title, data.type)
      indicator.accessToken = config.api.accessToken
      await indicator.patch({ order })
      order++
    }
  },

  async handleSummaryIndicator (classificationData, progressDetail, onlyWaiting, acl) {
    let elements = 1
  
    let value = `
    <table class="table" style="color:${tableBaseTextColor}">
      <thead>
        <tr>
          <th style="background-color:${firstRowColor}">${config.indicator_column_titles.indicatorTitle || 'Description'}</th>
          <th style="background-color:${firstRowColor}">From</th>
          <th style="background-color:${firstRowColor}">Subject</th>
          <th style="background-color:${firstRowColor}">Body</th>
          <th style="background-color:${firstRowColor}">Start</th>
          <th style="background-color:${firstRowColor}">Low</th>
          <th style="background-color:${firstRowColor}">High</th>
          <th style="background-color:${firstRowColor}">Critical</th>
          <th style="background-color:${firstRowColor}">Solved</th>`
  
    if (!progressDetail && !onlyWaiting) {
      value = `${value} <th style="background-color:${firstRowColor}">Resolve</th>`
    }
  
    value = `${value} <th style="background-color:${firstRowColor}">Result</th> </tr> </thead> <tbody>`
  
    for (const eachFilter of Object.keys(classificationData.data)) {
      let rowColor = innerRowColorDark
  
      if (!eachFilter.match(/(runtime)/gi)) {
        const filterData = classificationData.data[eachFilter].data
        const { resultStyle, resultData } = applyResultStyles(filterData)
  
        if (elements % 2) {
          rowColor = innerRowColorLight
        }
  
        let filterValue = `
          <tr>
            <td style="background-color:${rowColor}">${filterData.indicatorTitle}</td>
            <td style="background-color:${rowColor}">${filterData.from}</td>
            <td style="background-color:${rowColor}">${filterData.subject}</td>
            <td style="background-color:${rowColor}">${filterData.body}</td>
            <td style="background-color:${rowColor}">${filterData.start}</td>
            <td style="background-color:${rowColor}">${filterData.low}</td>
            <td style="background-color:${rowColor}">${filterData.high}</td>
            <td style="background-color:${rowColor}">${filterData.critical}</td>
            <td style="background-color:${rowColor}">${filterData.solved}</td>`
  
        // SUMMARY BUTTON ROW
  
        // Adding dismiss button
        if (!progressDetail && !onlyWaiting && !filterData.solved && filterData.result.state /*&& filterData.result.state !== 'normal'*/) {
          filterValue = `${filterValue} <td style="background-color:${rowColor}">
            <button data-hook="launch-task" data-task-id="${config.resolveTaskID || null}" 
            data-task-arguments='[{"value":"${eachFilter}"}, {"value":"${classificationData.data.runtimeDate}"}]' 
            class="${config.dismissButton.class || 'btn btn-primary'}">
            ${config.dismissButton.label || 'Dismiss'}&nbsp;
            <i class="${config.dismissButton.icon}">
            </i>
            </button>
            </td>`
        }
  
        // Adding blank space for white Waiting
        if (!progressDetail && !onlyWaiting && (
          (!filterData.solved && !filterData.result.state) ||
            (filterData.solved && 
              (!filterData.manuallyResolved ||
                (filterData.manuallyResolved && !config.manuallyResolvedAlarm.display)
              )
            ))) {
          filterValue = `${filterValue} <td style="background-color:${rowColor}">
            </td>`
        }
  
        //Check for manually resolved info enabled
        if (!progressDetail && !onlyWaiting && (
          (filterData.solved && filterData.manuallyResolved && config.manuallyResolvedAlarm.display))) {
          filterValue = `${filterValue} <td style="background-color:${rowColor};">
            <div style="color:${resultStyle}">
            ${config.manuallyResolvedAlarm.label || 'Manual'}&nbsp;
            <i style="color:${resultStyle}" class="${config.manuallyResolvedAlarm.icon}">
            </i>
            </div>
            </td>`
        }
  
        filterValue = `${filterValue} <td style="background-color:${rowColor};color:${resultStyle}">
          <b>${resultData}<b>
          </td>
          </tr>`
  
        if (progressDetail && !onlyWaiting && filterData.result.state && filterData.result.state !== 'normal') {
          elements++
          value = value + filterValue
        }
  
        if (!progressDetail && !onlyWaiting) {
          elements++
          value = value + filterValue
        }
  
        if (progressDetail && onlyWaiting && filterData.result.state && filterData.result.state !== 'normal' && !filterData.solved) {
          elements++
          value = value + filterValue
        }
      }
    }
  
    value = (elements <= 1 && progressDetail) ? `<span style="color:${resultNormal}; font-size:26px; font-weigth:bold"; font>Nothing to worry about<span>` : value + '</tbody> </table>'
  
    const titleDate = `${DateTime.fromJSDate(new Date(classificationData.data.runtimeDate)).toFormat('dd-MM-yyyy')}`
  
    const titleDefinition = (progressDetail && !onlyWaiting
      ? config.indicator_titles?.progress_detail || 'Progress Detail'
      : progressDetail && onlyWaiting
        ? config.indicator_titles?.progress_detail_only_waiting || 'Progress Detail 2'
        : (/%DATE%/gi).test(config.indicator_titles?.summary)
            ? config.indicator_titles?.summary.replace(/%DATE%/gi, titleDate)
            : `${config.indicator_titles?.summary} ${titleDate}`)
  
    const indicator = new TheEyeIndicator(titleDefinition)
    indicator.accessToken = config.api.accessToken
  
    let promise
    if (progressDetail && onlyWaiting && elements <= 1) {
      const resp = await TheEyeIndicator.Fetch()
      const indicators = JSON.parse(resp.body)
      for (const data of indicators) {
        if (data.title === titleDefinition) {
          promise = indicator.remove()
        }
      }
    } else {
      indicator.order = progressDetail ? 1 : 100
      indicator.value = value
      indicator.state = ''
      indicator.severity = 'low'
      indicator.tags = progressDetail ? [] : ['summary']
      indicator.acl = (elements <= 1 && progressDetail) ? [] : acl
      promise = indicator.put()
    }
  
    return promise
  },

  async handleStatusIndicator (classificationData, acl) {
    let elements = 1
    let runtimeDate
    const futureFilters = []
    const pastFilters = []
    const currentFilters = []
  
    let value = `
      <table class="table" style="color:${tableBaseTextColor}">
        <thead>
          <tr>
            <th style="background-color:${firstRowColor}">Estado</th>
            <th style="background-color:${firstRowColor}">${config.indicator_column_titles.indicatorTitle || 'Description'}</th>
            <th style="background-color:${firstRowColor}">From</th>
            <th style="background-color:${firstRowColor}">Subject</th>
            <th style="background-color:${firstRowColor}">Body</th>
            <th style="background-color:${firstRowColor}">Start</th>
            <th style="background-color:${firstRowColor}">Low</th>
            <th style="background-color:${firstRowColor}">High</th>
            <th style="background-color:${firstRowColor}">Critical</th>
            <th style="background-color:${firstRowColor}">Solved</th>
            <th style="background-color:${firstRowColor}">Result</th>
          </tr>
        </thead>
      <tbody>
      `
  
    const addRow = (filterData, status) => {
      let rowColor = innerRowColorDark
      const { resultStyle, resultData } = applyResultStyles(filterData)
  
      if (elements % 2) {
        rowColor = innerRowColorLight
      }
  
      const filterValue = `
        <tr>
          <td style="background-color:${rowColor}">${status}</td>
          <td style="background-color:${rowColor}">${filterData.indicatorTitle}</td>
          <td style="background-color:${rowColor}">${filterData.from}</td>
          <td style="background-color:${rowColor}">${filterData.subject}</td>
          <td style="background-color:${rowColor}">${filterData.body}</td>
          <td style="background-color:${rowColor}">${filterData.start}</td>
          <td style="background-color:${rowColor}">${filterData.low}</td>
          <td style="background-color:${rowColor}">${filterData.high}</td>
          <td style="background-color:${rowColor}">${filterData.critical}</td>
          <td style="background-color:${rowColor}">${filterData.solved}</td>
          <td style="background-color:${rowColor};color:${resultStyle}"><b>${resultData}<b></td>
        </tr>
        `
      elements++
      return filterValue
    }
  
    for (const eachFilter of Object.keys(classificationData.data)) {
      if (!eachFilter.match(/(runtime)/gi)) {
        const filterData = classificationData.data[eachFilter].data
        const dataToPush = { start: filterData.start, low: filterData.low, high: filterData.high, critical: filterData.critical, solved: filterData.solved, index: eachFilter }
  
        Helpers.getFormattedThresholdDate(dataToPush.start, config.timezone, runtimeDate, config.startOfDay) > DateTime.now()
          ? futureFilters.push(dataToPush)
          : filterData.solved
            ? pastFilters.push(dataToPush)
            : currentFilters.push(dataToPush)
      } else {
        runtimeDate = DateTime.fromISO(new Date(classificationData.data[eachFilter]).toISOString())
      }
    }
  
    for (let i = pastFilters.length - 1; i >= 0; i--) {
      const totalLength = pastFilters.length - 1
      if (i === totalLength) {
        value = value + addRow(classificationData.data[pastFilters[i].index].data, 'Anterior')
      } else {
        if (pastFilters[i].start === pastFilters[totalLength].start) {
          value = value + addRow(classificationData.data[pastFilters[i].index].data, 'Anterior')
        }
      }
    }
  
    for (const eachFilter of currentFilters) {
      value = value + addRow(classificationData.data[eachFilter.index].data, 'Actual')
    }
  
    for (let i = 0; i <= futureFilters.length - 1; i++) {
      if (i === 0) {
        value = value + addRow(classificationData.data[futureFilters[i].index].data, 'Próximo')
      } else {
        if (futureFilters[i].start === futureFilters[0].start) {
          value = value + addRow(classificationData.data[futureFilters[i].index].data, 'Próximo')
        }
      }
    }
  
    value = value + '</tbody> </table>'
  
    const indicator = new TheEyeIndicator(config.indicator_titles?.status || 'Estado')
    indicator.order = 2
    indicator.accessToken = config.api.accessToken
    indicator.value = value
    indicator.state = ''
    indicator.severity = 'low'
    indicator.acl = acl
  
    return indicator.put()
  }

}

const applyResultStyles = (filterData) => {
  let resultStyle = resultStandby
  let resultData = 'Waiting'

  if (filterData.result.severity === 'critical' && filterData.result.state === 'failure') {
    resultStyle = resultCritical
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.severity === 'high' && filterData.result.state === 'failure') {
    resultStyle = resultHigh
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.severity === 'low' && filterData.result.state === 'failure') {
    resultStyle = resultLow
    if (filterData.solved) {
      resultData = 'Late'
    }
  }

  if (filterData.result.state === 'normal') {
    resultStyle = resultNormal
    if (filterData.solved) {
      resultData = 'On Time'
    }
  }

  return { resultStyle, resultData }
}
