export async function setupPlugin({ storage, config }) {
    if (!config.data_center || !config.api_key) {
        throw new Error("Please set the 'data_center' or 'api_key' config values")
    }

    const baseUrl = `https://${data_center}.api.mailchimp.com/3.0/`
    const authString = 'user:' + config.api_key
    const authorization = Buffer.from(authString, 'utf8').toString('base64')

    // Load all campaigns via paginated endpoint
    const allCampaigns = []
    let allCampaignsLoaded = false
    let offset = 0

    while (!allCampaignsLoaded) {
        const url = baseUrl + `/campaigns?count=1000&offset=${offset}&status=sent&fields=campaigns.id,total_items`
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json',
                Authorization: authorization,
            }
        })
        const { campaigns, total_items } = await response.json()
        allCampaigns.push(...campaigns)
        if (allCampaigns.length >= total_items) {
            allCampaignsLoaded = true
        } else {
            offset = allCampaigns.length
        }
    }
    // TODO: Load campaigns into storage or cache.
    // TODO: Set lastCapturedTime in storage and add `since` param to batch operation.
}

// run every ten minutes
//
// PSEUDOCODE:
    // Batch email activity requests via POST /batches with body:
    // {
    //     "operations": [
    //         {
    //             "method": "GET",
    //             "path": "reports/${campaign_id}/email-activity",
    //             "operation_id": "get_report_${campaign_id}",
    //             "params": {
    //                 "count": 1000,
    //                 "offset": 0,
    //                 "fields": "emails.list_id,emails.email_id,emails.email_address,emails.activity,campaign_id,total_items"
    //             }
    //         }
    //     ]
    // }
    //
    // Once the batch id is known, call batch status via GET /batches/${batch_id} and exponentially back-off until status === 'finished'
    //
    // Un-gzip the response data and parse JSON
    //
    // Identify reports where total recipients exceeds 1000 (another paginated endpoint) and create more batch requests as necessary until every report is loaded
