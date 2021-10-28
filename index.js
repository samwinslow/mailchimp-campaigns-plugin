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

async function batchRequestActivityReports({ mailchimp: { baseUrl, authorization, resultsPerPage }}, campaigns) {
    // Given a list of campaigns, create a batch request for email activity report details.
    // Returns batchId (string): id of the batch request if successfully submitted

    if (!campaigns) {
        throw new Error('Campaigns must be provided (did an API call fail upstream?)')
    }

    const fields = [
        'campaign_id',
        'total_items',
        'emails.list_id',
        'emails.email_id',
        'emails.email_address',
        'emails.activity',
    ].join(',')

    // Create batch operations for each campaign. Batched results will not be paginated.
    const batchOperations = campaigns.map(({ id: campaignId }) => ({
        method: 'GET',
        path: `reports/${campaignId}/email-activity`,
        operation_id: `get_report_${campaignId}`,
        params: {
            fields,
            since: null, // TODO
        }
    }))

    // Submit the batch request
    const url = baseUrl + '/batches'
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: authorization,
        },
        body: JSON.stringify({ operations: batchOperations }),
    })
    const { id: batchId, status } = await response.json()
    if (status >= 400) {
        throw new Error(`API request failed with status ${status}`)
    }

    return batchId
}

export async function runEveryHour({ storage, global }) {
    // Load all campaign metadata
    const campaigns = await loadAllCampaigns(global)

    // Batch requests for email activity reports
    const batchId = await batchRequestActivityReports(global, campaigns)
    if (!batchId) {
        throw new Error('Failed to create batch request.')
    }

    // TODO: Set lastCapturedTime in storage and add `since` param to batch operation.
}
