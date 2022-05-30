const Request = require('./req')
const FormData = require('form-data')
const Readable = require('stream').Readable

const BASE_URL = JSON.parse(process.env.THEEYE_API_URL || '"https://supervisor.theeye.io"')
const CUSTOMER = JSON.parse(process.env.THEEYE_ORGANIZATION_NAME || '"hsbc"')

class TheEyeFiles {
  constructor ({ filename, description, contentType, content }) {
    if (!filename || !description || !contentType || !content) {
      throw new Error('Missing file params... try {filename, description, contentType, content}')
    }

    const filenameParts = filename.split('.')

    if (filenameParts.length < 2) {
      throw new Error('Extension is required in the filename')
    }

    const file = new Readable()
    // CONTENT
    file.push(content)
    // EOF
    file.push(null)

    this.formData = new FormData()
    this.formData.append('description', description)
    this.formData.append('extension', filenameParts[filenameParts.length - 1])
    this.formData.append('mimetype', contentType)
    this.formData.append('file', file, { filename, contentType })

    this.filename = filename
  }

  static async FetchAll () {
    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file?access_token=${TheEyeFiles.access_token}`,
      method: 'GET'
    }

    return await Request(options)
  }

  static async GetByName (name) {
    const files = await this.FetchAll()

    const foundFile = files.filter(file => file.filename === name)

    if (foundFile.length === 1) {
      return await this.GetById(foundFile[0].id)
    }

    if (foundFile.length > 1) {
      console.log('More than 1 file was found')
      return foundFile
    }

    console.log('No files found...')
    return false
  }

  static async GetById (id) {
    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file/${id}?access_token=${TheEyeFiles.access_token}`,
      method: 'GET'
    }

    return await Request(options)
  }

  static async Download ({ filename, id }) {
    if (!filename && !id) {
      throw new Error('No {id} or {filename} supplied...')
    }

    if (filename) {
      const file = await this.GetByName(filename)

      if(!file) {
        throw new Error('File not found...')
      }

      if (file.length) {
        return file
      }

      id = file.id
    }

    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file/${id}/download?access_token=${TheEyeFiles.access_token}`,
      method: 'GET'
    }

    return await Request(options)
  }

  static async Delete ({ filename, id }) {
    if (!filename && !id) {
      throw new Error('No {id} or {filename} supplied...')
    }

    if (filename) {
      const file = await this.GetByName(filename)

      if(!file) {
        throw new Error('File not found...')
      }

      if (file.length) {
        return file
      }

      id = file.id
    }

    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file/${id}?access_token=${TheEyeFiles.access_token}`,
      method: 'DELETE'
    }

    return await Request(options)
  }

  async create () {
    if (!this.formData) {
      throw new Error('File has no form data...')
    }

    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file?access_token=${TheEyeFiles.access_token}`,
      method: 'POST',
      headers: this.formData.getHeaders()
    }

    return await Request(options, { formData: this.formData })
  }

  async update (id) {
    if (!this.formData) {
      throw new Error('File has no form data...')
    }

    const options = {
      host: BASE_URL.split('https://')[1] || BASE_URL.split('http://')[1],
      port: (/https:\/\//gi).test(BASE_URL) ? 443 : 80,
      path: `/${CUSTOMER}/file/${id}?access_token=${TheEyeFiles.access_token}`,
      method: 'PUT',
      headers: this.formData.getHeaders()
    }

    return await Request(options, { formData: this.formData })
  }

  async upsert () {
    const file = await TheEyeFiles.GetByName(this.filename)
    if (file) {
      if (file.length > 1) {
        return file
      }
      return await this.update(file.id)
    } else {
      return await this.create()
    }
  }
}

module.exports = TheEyeFiles
