export type Campaign = {
    id: string
    emails_sent: number
    send_time: string
    subject_line: string
    title: string
}

export type EmailActionEntry = {
    action: 'open' | 'click' | 'bounce'
    timestamp: string
    url?: string // for action: click
    ip?: string // for action: click | open
    type?: 'hard' | 'soft' // for action: bounce
}

export type EmailActivityEvent = {
    list_id: string
    email_id: string
    email_address: string
    activity: EmailActionEntry[]
}

export type Report = {
    total_items: number | null
    emails: EmailActivityEvent[]
}

export type ResourceLoadingState = null | 'loading' | 'loaded' | 'error'

export type ReportAccumulator = {
    campaignId: string
    campaignQueue: string[]
}
