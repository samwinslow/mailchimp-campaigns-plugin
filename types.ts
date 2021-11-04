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
    total_items: number | null,
    emails: EmailActivityEvent[],
}

export type ResourceLoadingState = null | 'loading' | 'loaded' | 'error'

export type ReportAccumulator = {
    campaignId: string,
    campaignQueue: string[],
}
