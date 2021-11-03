export async function setupPlugin({ storage, config, global }) {
    const { data_center, api_key } = config
    if (!data_center || !api_key) {
        throw new Error("Please set the 'data_center' or 'api_key' config values")
    }

    const baseUrl = `https://${data_center}.api.mailchimp.com/3.0/`
    const authString = 'user:' + api_key
    const authorization = 'Basic ' + Buffer.from(authString, 'utf8').toString('base64')
    const resultsPerPage = 1000 // Request length for paginated endpoints

    // Store Mailchimp config globally
    global.mailchimp = { baseUrl, authorization, resultsPerPage }
    global.batchTimeout = 1800 // Timeout (seconds). Consider a batch lost if processing time is beyond this.
}

export async function teardownPlugin({ cache }) {
    cache.expire('batchId', 0)
}

async function loadAllCampaigns({ mailchimp: { baseUrl, authorization, resultsPerPage }}) {
    // Loads and returns all campaigns.

    const allCampaigns = []
    const fields = [
        'total_items',
        'campaigns.id',
        'campaigns.emails_sent',
        'campaigns.settings.subject_line',
        'campaigns.settings.title',
    ].join(',')
    let offset = 0
    let allCampaignsLoaded = false, apiErrorState = false

    while (!allCampaignsLoaded && !apiErrorState) {
        const url = baseUrl + `/campaigns?count=${resultsPerPage}&offset=${offset}&status=sent&fields=${fields}`
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    Authorization: authorization,
                }
            })
            const { campaigns, total_items } = await response.json()
            if (!campaigns) {
                throw new Error('Campaigns was expected in the response.')
            }
            allCampaigns.push(...campaigns)
            if (allCampaigns.length >= total_items) {
                allCampaignsLoaded = true
            } else {
                offset = allCampaigns.length
            }
        } catch (err) {
            apiErrorState = true
            throw new Error(`API request failed: ${err.toString()}`)
        }
    }

    return allCampaigns
}

// const fields = [
//     'campaign_id',
//     'total_items',
//     'emails.list_id',
//     'emails.email_id',
//     'emails.email_address',
//     'emails.activity',
// ].join(',')

// // Create batch operations for each campaign. Batched results will not be paginated.
// const batchOperations = campaigns.map(({ id: campaignId }) => ({
//     method: 'GET',
//     path: `reports/${campaignId}/email-activity`,
//     operation_id: `get_report_${campaignId}`,
//     params: {
//         fields,
//         since,
//     }
// }))


export async function runEveryMinute({ cache, global }) { // run every minute, but don't create new batch requests every minute
    const { mailchimp: { baseUrl, authorization }} = global

    const existingBatchId = await cache.get('batchId')
    if (existingBatchId) {

    } else {
        // Load all campaign metadata
        const campaigns = await loadAllCampaigns(global)

        // Create batch request for email activity reports
        const batchId = await batchRequestActivityReports(global, campaigns, null) // TODO add since
        if (!batchId) {
            throw new Error('Failed to create batch request.')
        }

        cache.set('batchId', batchId, global.batchTimeout)
    }

    // TODO: Set lastCapturedTime in storage and add `since` param to batch operation.
}
