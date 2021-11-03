export interface MailchimpPluginMeta {
    config: {
        data_center: string,
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
}

export type Campaign = {
    id: string,
    emails_sent: number,
    subject_line: string,
    title: string,
}

type EmailActivity = any //TODO

export type EmailActivityEvent = {
    list_id: string,
    email_id: string,
    email_address: string,
    activity: EmailActivity,
}

export type Report = {
    campaign_id: string,
    total_items: number,
    emails: EmailActivityEvent[],
}

export type ResourceLoadingState = null | 'loading' | 'loaded' | 'error'
