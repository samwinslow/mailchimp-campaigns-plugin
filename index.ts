import { Plugin } from '@posthog/plugin-scaffold'
import { Campaign, Report, ResourceLoadingState } from './types'

type MailchimpPlugin = Plugin<{
    config: {
        api_key: string,
    },
    global: {
        mailchimp: {
            baseUrl: string,
            headers: Record<string, string>,
            resultsPerPage: number,
        },
        campaigns: {
            items: Campaign[],
            state: ResourceLoadingState,
            total_items: number | null,
        },
        reports: {
            items: Report[],
            state: ResourceLoadingState,
            total_items: number | null,
        },
    },
}>

export const setupPlugin: MailchimpPlugin['setupPlugin'] = async ({ config, global }) => {
    if (!config.api_key) {
        throw new Error("Please set the api_key config value")
    }
    const [, data_center] = config.api_key.match(/(-)([a-z0-9]+)$/) || []
    if (!data_center) {
        throw new Error("Invalid api_key. Please include the data center suffix in your key, e.g. `-us6`")
    }

    const baseUrl = `https://${data_center}.api.mailchimp.com/3.0/`
    const authString = 'user:' + config.api_key

    global = {
        mailchimp: { // Store Mailchimp credentials for use where needed
            baseUrl,
            headers: {
                Accept: 'application/json',
                Authorization: 'Basic ' + Buffer.from(authString, 'utf8').toString('base64'),
            },
            resultsPerPage: 1000, // Request length for paginated endpoints
        },
        campaigns: {
            items: [],
            state: null,
            total_items: null,
        },
        reports: {
            items: [],
            state: null,
            total_items: null,
        }
    }
}

export const jobs: MailchimpPlugin['jobs'] = {
    fetchCampaigns: async ({ global, jobs }) => {
        console.log('determining if we should run...')
        if (['error', 'loaded'].includes(global.campaigns.state)) {
            return
        }
        console.log('fetching campaigns...')
        const { headers, baseUrl, resultsPerPage } = global.mailchimp
        const fields = [
            'total_items',
            'campaigns.id',
            'campaigns.emails_sent',
            'campaigns.settings.subject_line',
            'campaigns.settings.title',
        ].join(',')
        const offset = global.campaigns.items.length
        const url = baseUrl + `/campaigns?count=${resultsPerPage}&offset=${offset}&status=sent&fields=${fields}`
        try {
            const response = await fetch(url, { headers })
            const { campaigns, total_items } = await response.json()
            if (!campaigns) {
                throw new Error('Campaigns was expected in the response.')
            }
            console.log({ total_items })
            global.campaigns.items.push(...campaigns)
            global.campaigns.total_items = total_items
            if (global.campaigns.items.length >= total_items) {
                global.campaigns.state = 'loaded'
                console.log('Finished fetching campaigns.')
            } else {
                await jobs.fetchCampaigns().runIn(1, 'seconds') // Recurse to fetch all
            }
        } catch (err) {
            global.campaigns.state = 'error'
            throw new Error(`API request failed: ${err.toString()}`)
        }
    },
}

export const runEveryMinute: MailchimpPlugin['runEveryMinute'] = async ({ global, jobs }) => {
    if (global.campaigns.state === null) {
        await jobs.fetchCampaigns({})
    }
}

// For campaign report query

// const fields = [
//     'campaign_id',
//     'total_items',
//     'emails.list_id',
//     'emails.email_id',
//     'emails.email_address',
//     'emails.activity',
// ].join(',')

// {
//     method: 'GET',
//     path: `reports/${campaignId}/email-activity`,
//     params: {
//         fields,
//         since,
//     }
// }
