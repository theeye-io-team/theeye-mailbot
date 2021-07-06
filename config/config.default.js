const path = require('path')

module.exports = {
  "startOfDay": "00:00",
  "imap": {
    "user": "",
    "password": "",
    "host": "",
    "port": 993,
    "tls": true,
    "authTimeout": 6000
  },
  "folders": {
    "INBOX": "AP",
    "processed": "AP_adjuntosDescargados",
    "notProcessed": "AP_adjuntosNoProcesados"
  },    
  "attachments": {
    "allowed": {
      "dispositions": ["inline", "attachment"],
      "extensions": ["pdf", "tiff", "tif"],
      "mime": ["pdf", "tiff", "tif", "octet-stream"]
    },
    "downloadsDirectory": "g:"
  },    
  "searchCriteria": ["ALL"],
  "api": {
    "protocol": "https",
    "hostname": "tagger-api-dev.theeye.io",
    "port": 443,
    "accessToken": ""
  }
}
