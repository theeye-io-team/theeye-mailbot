require('dotenv').config()

const puppeteer = require('puppeteer')
const Files = require('../lib/file')
const { DateTime } = require('luxon')
const fs = require('fs')
const config = require('../lib/config').decrypt()

Files.access_token = config.api.accessToken

const baseUrl = config.feriados.baseUrl
const browserOptions = {
  headless: true,
  handleSIGINT: false,
  handleSIGTERM: false,
  handleSIGHUP: false,
  // executablePath: '/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--disable-features=site-per-process',
    '--disable-gpu',
    '--window-size=1920,1024'
  ]
}

const main = module.exports = async (year) => {
  if (!year) {
    year = DateTime.now().toFormat('yyyy')
  }

  const url = `${baseUrl}${year}`

  const browser = await puppeteer.launch(browserOptions)
  const page = await browser.newPage()
  await page.goto(url)

  const feriados = await page.evaluate((year)=> {
    const eles=[]

    document.getElementById('calendar-container')
      .querySelectorAll('div.cont').forEach( (ccc, index) => { 
        ccc.querySelectorAll('p').forEach(p => {
          const text = p.innerText
          if (/\([a|b|c]\)$/.test(text) === false) {
            const day = Number(text.split('.')[0])
            if(text || day!==0) {
              const month = String(index + 1)
              eles.push(`${String(day).length === 1 ? `0${day}` : day}-${month.length === 1 ? `0${month}` : month}-${year}`)
            }
          }
        })
      })

    return eles
  }, year)


  const fileData = {
    filename: config.feriados.filename || 'feriados.json',
    description: `Automatically generated on ${new Date().toISOString()}`,
    contentType: 'application/json',
    content: JSON.stringify(feriados, null, 2)
  }

  return Files.Upsert(fileData)
}

if (require.main === module) {
  main(process.argv[2]).then(console.log).catch(err => console.error(err))
}
