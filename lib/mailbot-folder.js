const fs = require('fs')
const simpleParser = require('mailparser').simpleParser
const path = require('path')

class MailBotFolder {

  constructor (config) {
    this.config = config
  }

  async searchMessages (searchCriteria) {
    const searchDirs = this.config.folders.searchDirs
    
    const messages = []
    for (let searchDir of searchDirs) {
      const dirname = path.join(this.config.folders.local, searchDir)

      const files = fs.readdirSync(dirname, { withFileTypes: true })
      for (const file of files) {
        if (!file.isDirectory()) {
          const filename = path.join(dirname, file.name)
          const source = fs.readFileSync(filename, 'utf8')
          const message = await this.applySearchCriteria(searchCriteria, source)
          if (message !== null) {
            message.file = file
            message.filename = filename
            message.searchDir = searchDir
            messages.push(message)
          }
        }
      }
    }

    return messages
  }

  async applySearchCriteria (searchCriteria, source) {
    const search = searchCriteria || this.config.searchCriteria
    const message = await simpleParser(source)

    if (!Array.isArray(search) || search.length === 0) {
      return message
    }

    if (search.indexOf('ALL') !== -1) {
      return message
    }

    const gaveResult = (criteria) => {
      if (!Array.isArray(criteria)) {
        throw new Error(`unhandled search criteria`)
      }
      const [ name, pattern ] = criteria
      return Search[name](pattern, message)
    }

    if (search.every(gaveResult)) {
      const fMessage = new FolderMessage({ message })
      return fMessage
    }

    return null
  }

  getDate (message) {
    return message.date
  }

  deleteMessage (message) {
    if (this.config.deleteMessages === true) {
      fs.renameSync(message.filename, message.filename.concat(',T,S'))
    } else {
      console.log(`Delete messages disabled by config`)
      return
    }
  }

  moveMessage (message) {
    if (this.config.moveProcessedMessages === true) {
      const folders = this.config.folders
      const filename = path.basename(message.filename)
      const basename = path.basename(message.searchDir)

      const destinationPath = path.join(
        folders.local,
        folders.processed,
        basename
      )

      if ( !fs.existsSync(destinationPath) ) {
        fs.mkdirSync(destinationPath, { recursive: true })
      }

      fs.copyFileSync(message.filename, path.join(destinationPath, filename.replace(/,U=[1-9][0-9]*.*/,'')))
      fs.unlinkSync(message.filename)
    }
  }

  async connect () {
  }

  async closeConnection () {
  }
}

const Search = {
  BODY: (pattern, message) => {
    const regex = new RegExp(pattern)
    if (message.html === false) {
      return regex.test(message.text)
    }
    return regex.test(message.html)
  },
  FROM: (pattern, message) => {
    const regex = new RegExp(pattern)
    return regex.test(message.from.value[0].address)
  },
  SUBJECT: (pattern, message) => {
    const regex = new RegExp(pattern)
    return regex.test(message.subject)
  }
}

class FolderMessage {
  constructor (specs) {
    Object.assign(this, specs.message)
  }
}

module.exports = MailBotFolder
