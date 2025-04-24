require('dotenv').config()

const EncConfig = require('theeye-bot-sdk/core/config')
const MailBot = require('theeye-bot-sdk/core/mail/client')
const axios = require('axios')

const main = module.exports = async () => {
  try {
    const config = EncConfig.decrypt()
    console.log(config)

    const mailBot = new MailBot(config)

    console.log('connecting ..')
    await mailBot.connect()
    console.log('connected!')

    console.log(mailBot.connection.serverInfo)
    
    // Check app permissions if using Microsoft Graph
    if (mailBot.token && config.msGraph && config.msGraph.auth.clientId) {
      await checkAppPermissions(mailBot.token, config.msGraph.auth.clientId)
    }

    console.log('closing connection..')
    await mailBot.closeConnection()
    return 'ok'
  } catch (err) {
    console.error(err)
  }
}

const checkAppPermissions = async (token, clientId) => {
  try {
    console.log('\nChecking application permissions...')
    
    // First, get the service principal ID for the app
    const appResponse = await axios({
      method: 'GET',
      url: `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${clientId}'`,
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!appResponse.data.value || appResponse.data.value.length === 0) {
      console.log('Service principal not found')
      return
    }
    
    const servicePrincipalId = appResponse.data.value[0].id
    console.log(`Service Principal ID: ${servicePrincipalId}`)
    
    // Get app roles (application permissions)
    const rolesResponse = await axios({
      method: 'GET',
      url: `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/appRoleAssignments`,
      headers: { Authorization: `Bearer ${token}` }
    })
    
    console.log('\nGranted Application Permissions:')
    if (rolesResponse.data.value && rolesResponse.data.value.length > 0) {
      rolesResponse.data.value.forEach(role => {
        console.log(`- ${role.principalDisplayName || role.resourceDisplayName}: ${role.appRoleId}`)
      })
    } else {
      console.log('No application permissions found')
    }
    
    // Get OAuth2 permission grants (delegated permissions)
    const oauthResponse = await axios({
      method: 'GET',
      url: `https://graph.microsoft.com/v1.0/oauth2PermissionGrants?$filter=clientId eq '${servicePrincipalId}'`,
      headers: { Authorization: `Bearer ${token}` }
    })
    
    console.log('\nGranted Delegated Permissions:')
    if (oauthResponse.data.value && oauthResponse.data.value.length > 0) {
      oauthResponse.data.value.forEach(grant => {
        console.log(`- Scope: ${grant.scope}`)
      })
    } else {
      console.log('No delegated permissions found')
    }
    
    // Get specific Microsoft Graph permissions
    const graphResponse = await axios({
      method: 'GET',
      url: `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/appRoleAssignedTo`,
      headers: { Authorization: `Bearer ${token}` }
    })
    
    console.log('\nMicrosoft Graph Permissions:')
    if (graphResponse.data.value && graphResponse.data.value.length > 0) {
      graphResponse.data.value.forEach(role => {
        console.log(`- ${role.principalDisplayName || role.resourceDisplayName}: ${role.appRoleId}`)
      })
    } else {
      console.log('No Microsoft Graph permissions found')
    }
    
  } catch (error) {
    console.error('Error checking permissions:', error.response?.data || error.message)
  }
}


main().then(console.log).catch(console.error) 