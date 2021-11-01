import zlib from 'zlib'

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

async function batchRequestActivityReports({ mailchimp: { baseUrl, authorization }}, campaigns, since) {
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
            since,
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

async function getBatchResult({ mailchimp: { baseUrl, authorization }}, batchId) {
    const url = baseUrl + `/batches/${batchId}`
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            Authorization: authorization,
        }
    })
    const result = await response.json()
    return result
}

async function extractBatchResult(archiveUrl) {
    // Fetch Gzip archive located on Mailchimp S3
    const response = await fetch(archiveUrl, {
        headers: {
            Accept: '*/*',
            'Accept-Encoding': 'gzip',
        }
    })

    const buffer = await response.text()
    // save buffer to memfs
    zlib.unzip(buffer, (err, result) => {
        if (err) {
            throw new Error(`Failed to decompress gzip: ${err}`)
        }
        return result
    })
}

export async function runEveryMinute({ cache, global }) { // run every minute, but don't create new batch requests every minute
    const { mailchimp: { baseUrl, authorization }} = global

    const existingBatchId = await cache.get('batchId')
    if (existingBatchId) {
        // If batch in progress, try to fetch its status
        // status: enum "pending", "preprocessing", "started", "finalizing", "finished"
        try {
            const { status, response_body_url, errored_operations } = await getBatchResult(global, existingBatchId)
            if (errored_operations && errored_operations > 0) {
                throw new Error('Error in remote server while processing batch operations.')
            }
            if (status !== 'finished') {
                return
            }

            // Get gzipped result
            const batchResult = await extractBatchResult(response_body_url)

            // Remove batchId from cache as the batch is complete
            cache.expire('batchId', 0)

        } catch (err) {
            if (err.status === 429) {
                console.error('Received 429 Too Many Requests. Retrying...')
                return
            }
            throw new Error(`API request failed: ${err.toString()}`)
        }
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
