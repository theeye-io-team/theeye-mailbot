require('dotenv').config()

const { DateTime } = require('luxon')
const Helpers = require('../lib/helpers')
const TheEyeIndicator = require('../lib/indicator')
const config = require('../lib/config').decrypt()

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
  handleProgressIndicator (progress, timezone, severity, state, acl) {
    const indicator = new TheEyeIndicator(config.indicator_titles?.progress || 'Progress')
    indicator.order = 0
    indicator.accessToken = config.api.accessToken
    indicator.value = Math.round(progress)
    indicator.state = state
    indicator.severity = severity
    indicator.type = 'progress'
    indicator.acl = acl

    return indicator.put()
  },

  handleSummaryIndicator (classificationData, progressDetail, onlyWaiting, acl) {
    let elements = 1

    let value = `
    <table class="table" style="color:${tableBaseTextColor}">
      <thead>
        <tr>
          <th style="background-color:${firstRowColor}">IndicatorTitle</th>
          <th style="background-color:${firstRowColor}">IndicatorDescription</th>
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

    for (const eachFilter of Object.keys(classificationData.data)) {
      let rowColor = innerRowColorDark

      if (!eachFilter.match(/(runtime)/gi)) {
        const filterData = classificationData.data[eachFilter].data
        const { resultStyle, resultData } = applyResultStyles(filterData)

        if (elements % 2) {
          rowColor = innerRowColorLight
        }

        const filterValue = `
          <tr>
            <td style="background-color:${rowColor}">${filterData.indicatorTitle}</td>
            <td style="background-color:${rowColor}">${filterData.indicatorDescription || ''}</td>
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

        if (progressDetail && !onlyWaiting && filterData.result.state && filterData.result.state !== 'normal') {
          elements++
          value = value + filterValue
        }

        if (!progressDetail && !onlyWaiting) {
          elements++
          value = value + filterValue
        }

        if(progressDetail && onlyWaiting && filterData.result.state && filterData.result.state != 'normal' && !filterData.solved) {
          elements++
          value = value + filterValue
        }
      }
    }

    value = (elements <= 1 && progressDetail) ? `<span style="color:${resultNormal}; font-size:26px; font-weigth:bold"; font>Nothing to worry about<span>` : value + '</tbody> </table>'

    const titleDate = `${DateTime.fromJSDate(new Date(classificationData.data.runtimeDate)).toFormat('dd-MM-yyyy')}`
    const indicatorOrder = `${DateTime.fromJSDate(new Date(classificationData.data.runtimeDate)).toFormat('yyyyMMdd')}`

    const indicator = new TheEyeIndicator(progressDetail && !onlyWaiting ? 
      config.indicator_titles.progress_detail || 'Progress Detail' : 
      progressDetail && onlyWaiting ?
        config.indicator_titles.progress_detail_only_waiting || 'Progress Detail 2' :
        (/%DATE%/gi).test(config.indicator_titles.summary) ? 
          config.indicator_titles.summary.replace(/%DATE%/gi, titleDate) :
          `${config.indicator_titles.summary} ${titleDate}`)
    
    if (progressDetail && onlyWaiting && elements <= 1) { 
      try {
        await indicator.remove()
      } catch(err) {
        return err.message
      }
    } else {
      indicator.order = progressDetail ? 1 : Number(indicatorOrder)
      indicator.accessToken = config.api.accessToken
      indicator.value = value
      indicator.state = ''
      indicator.severity = 'low'
      indicator.acl = (elements <= 1 && progressDetail) ? [] : acl
      return indicator.put()
    }
  },

  handleStatusIndicator (classificationData, acl) {
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
            <th style="background-color:${firstRowColor}">IndicatorTitle</th>
            <th style="background-color:${firstRowColor}">IndicatorDescription</th>
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
          <td style="background-color:${rowColor}">${filterData.indicatorDescription || ''}</td>
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

        Helpers.getFormattedThresholdDate(dataToPush.start, config.timezone, runtimeDate, config.startOfDay) > DateTime.now() ? 
          futureFilters.push(dataToPush) : 
            filterData.solved ?
              pastFilters.push(dataToPush) :
              currentFilters.push(dataToPush)

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
