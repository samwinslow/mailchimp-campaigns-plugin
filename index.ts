import { Plugin } from '@posthog/plugin-scaffold'
import { Campaign, EmailActionEntry, EmailActivityEvent, Report, ReportAccumulator, ResourceLoadingState } from './types'

type MailchimpPluginInput = {
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
            items: Record<Campaign['id'], Report>,
            state: ResourceLoadingState,
        },
    },
}

enum MailchimpEventName {
    DELIVERED = 'Mailchimp email delivered',
    OPENED = 'Mailchimp email opened',
    CLICKED = 'Mailchimp email link clicked',
    BOUNCED = 'Mailchimp email bounced',
}

type PostHogMailchimpEvent = {
    event: MailchimpEventName
    timestamp: string
    properties: {
        distinct_id: string
        $email: string
        mc_recipient_email: string
        mc_email_id: string
        mc_list_id: string
        mc_campaign_id: string
        mc_campaign_title: string
        mc_subject_line: string
        mc_delivery_successful?: boolean
        mc_bounce_type?: string
        mc_click_url?: string
        $ip?: string
    }
}

type MailchimpPlugin = Plugin<MailchimpPluginInput>

export const setupPlugin: MailchimpPlugin['setupPlugin'] = async ({ config, global }) => {
    if (!config.api_key) {
        throw new Error("Please set the api_key config value")
    }
    const [, data_center] = config.api_key.match(/-([a-z]+\d+)$/) || []
    if (!data_center) {
        throw new Error("Invalid api_key. Please include the data center suffix in your key, e.g. `-us6`")
    }

    const baseUrl = `https://${data_center}.api.mailchimp.com/3.0/`
    const authString = 'user:' + config.api_key

    // Store Mailchimp credentials for use where needed
    global.mailchimp = {
        baseUrl,
        headers: {
            Accept: 'application/json',
            Authorization: 'Basic ' + Buffer.from(authString, 'utf8').toString('base64'),
        },
        resultsPerPage: 1000, // Request length for paginated endpoints
    }
    global.campaigns = {
        items: [],
        state: null,
        total_items: null,
    }
    global.reports = {
        items: {},
        state: null,
    }
}

export const jobs: MailchimpPlugin['jobs'] = {
    fetchCampaigns: async ({ global, jobs }) => {
        if (['error', 'loaded'].includes(global.campaigns.state)) {
            return
        }
        console.log('fetching campaigns...')
        const { headers, baseUrl, resultsPerPage } = global.mailchimp
        const fields = [
            'total_items',
            'campaigns.id',
            'campaigns.emails_sent',
            'campaigns.send_time',
            'campaigns.settings.subject_line',
            'campaigns.settings.title',
        ].join(',')
        const offset = global.campaigns.items.length
        const url = baseUrl + `/campaigns?count=${resultsPerPage}&offset=${offset}&status=sent&fields=${fields}`
        try {
            const response = await fetch(url, { headers })
            const { campaigns, total_items } = await response.json()
            if (!campaigns) {
                // Retry request
                console.error('Campaigns was expected in the response.')
                await jobs.fetchCampaigns().runIn(1, 'seconds')
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
    fetchReports: async ({ campaignId, campaignQueue }: ReportAccumulator, { global, jobs }) => {
        if (['error', 'loaded'].includes(global.reports.state)) {
            return
        }
        console.log(`fetching report for campaign ${campaignId}...`)
        if (!global.reports.items[campaignId]) [
            global.reports.items[campaignId] = {
                emails: [],
                total_items: null,
            }
        ]
        const { headers, baseUrl, resultsPerPage } = global.mailchimp
        const fields = [
            'campaign_id',
            'total_items',
            'emails.list_id',
            'emails.email_id',
            'emails.email_address',
            'emails.activity',
        ].join(',')
        const offset = global.reports.items[campaignId].emails.length
        const url = baseUrl + `/reports/${campaignId}/email-activity?count=${resultsPerPage}&offset=${offset}&fields=${fields}`
        try {
            const response = await fetch(url, { headers })
            const { emails, total_items } = await response.json()
            if (!emails) {
                // Retry request
                console.error('Emails was expected in the response.')
                await jobs.fetchReports({ campaignId, campaignQueue }).runIn(1, 'seconds')
            }
            console.log({ emails, total_items })
            global.reports.items[campaignId].emails.push(...emails)
            global.reports.items[campaignId].total_items = total_items
            if (global.reports.items[campaignId].emails.length >= total_items) {
                console.log(`Finished fetching report for campaign ${campaignId}.`)
                const next = campaignQueue.shift()
                if (next) {
                    // Move to the next campaign in the queue
                    await jobs.fetchReports({ campaignId: next, campaignQueue }).runIn(1, 'seconds')
                } else {
                    global.reports.state = 'loaded'
                    console.log('Finished fetching reports.')
                }
            } else {
                // Recurse to fetch all items for this campaign
                await jobs.fetchReports({ campaignId, campaignQueue }).runIn(1, 'seconds')
            }
        } catch (err) {
            global.reports.state = 'error'
            throw new Error(`API request failed: ${err.toString()}`)
        }
    },
}

const getEventNameForAction = (action: EmailActionEntry['action']): MailchimpEventName => {
    switch (action) {
        case 'open':
            return MailchimpEventName.OPENED
        case 'click':
            return MailchimpEventName.CLICKED
        case 'bounce':
            return MailchimpEventName.BOUNCED
    }
}

const getEventsFromReports = (
    reports: MailchimpPluginInput['global']['reports'],
    campaigns: MailchimpPluginInput['global']['campaigns']
): PostHogMailchimpEvent[] => {
    let posthogEvents: PostHogMailchimpEvent[] = []
    Object.entries(reports.items).forEach(([campaignId, report]) => {
        const { title, subject_line, send_time } = campaigns.items.find(({ id }) => id === campaignId) ?? {}
        report.emails.forEach((event: EmailActivityEvent) => {
            const commonProps: PostHogMailchimpEvent['properties'] = {
                distinct_id: event.email_address,
                $email: event.email_address,
                mc_recipient_email: event.email_address,
                mc_email_id: event.email_id,
                mc_list_id: event.list_id,
                mc_campaign_id: campaignId,
                mc_campaign_title: title,
                mc_subject_line: subject_line,
            }
            let mc_delivery_successful = true
            event.activity.forEach(entry => {
                if (entry.action === 'bounce') {
                    mc_delivery_successful = false
                }
                // Push event for each action performed
                posthogEvents.push({
                    event: getEventNameForAction(entry.action),
                    timestamp: entry.timestamp,
                    properties: {
                        ...commonProps,
                        mc_bounce_type: 'type' in entry ? entry.type : undefined,
                        mc_click_url: 'url' in entry ? entry.url : undefined,
                        $ip: 'ip' in entry ? entry.ip : undefined,
                        mc_delivery_successful,
                    }
                })
            })
            // Push event for the implied action of delivering the email
            posthogEvents.push({
                event: MailchimpEventName.DELIVERED,
                timestamp: send_time,
                properties: {
                    ...commonProps,
                    mc_delivery_successful,
                }
            })
        })
    })
    return posthogEvents
}

export const runEveryMinute: MailchimpPlugin['runEveryMinute'] = async ({ global, jobs }) => {
    const { campaigns, reports } = global
    if (campaigns.state === null) {
        await jobs.fetchCampaigns(undefined).runNow()
    }
    if (campaigns.state === 'loaded' && reports.state === null) {
        let campaignQueue = campaigns.items.map(({ id }) => id)
        const first = campaignQueue.shift()
        await jobs.fetchReports({ campaignId: first, campaignQueue }).runNow()
    }
    if (campaigns.state === 'loaded' && reports.state === 'loaded') {
        console.log('Steady state. Posting batch of events to PostHog...')
        const events = getEventsFromReports(reports, campaigns)
        console.log({ events: events?.slice(0, 100) }) // TEMP
        // TODO post batch to PostHog in reasonable chunks
    }
}
