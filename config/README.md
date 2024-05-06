

# Bots configuration setup


## All bots

### Config File

```json
{
  "imap": {
    "user": "email",
    "password": "password",
    "host": "outlook.office365.com",
    "port": 993,
    "tls": true,
    "authTimeout": 3000
  },
  "folders": {
    "INBOX": "INBOX",
    "processed": "Procesados"
  },
  "moveProcessedMessages": true, // move to "processed" folder after process
  "searchCriteria": {}, // default search if none provided
  "api": {
    "url": "https://digitize-api.theeye.io", // the mailbot api
    "accessToken": ""
  }
```

If the sender is activated the "sender" key must be added and configured

```
  "sender": {
    "from": "email", // in some cases the SMTP server admit to use a different from to the one used to authenticate
    "transport": {
      "host": "smtp.gmail.com",
      "port": 587,
      "auth": {
        "user": "el email",
        "pass": "la password"
      },
      "secureConnection": false,
      "tls": {
        "ciphers": "SSLv3"
      },
      "requireTLS": true
    }
  },
```

### Environment

CONFIG_FILE_PATH


## Attachments

### Environment

DOWNLOAD_RULES_PATH


### Config File

### Rules File

## Classification

### Environment

### Config File

### Rules File

## Reader

### Environment

### Config File
