export type Campaign = {
    id: string
    emails_sent: number
    subject_line: string
    title: string
}

type EmailAction = {
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
    activity: EmailAction[]
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

export enum MailchimpEventName {
    DELIVERED = 'Mailchimp email delivered',
    OPENED = 'Mailchimp email opened',
    CLICKED = 'Mailchimp email link clicked',
    BOUNCED = 'Mailchimp email bounced',
}

export type PostHogMailchimpEvent = {
    event: MailchimpEventName
    properties: {
        timestamp: string
        $email: string
        mc_recipient_email: string
        mc_email_id: string
        mc_list_id: string
        mc_campaign_id: string
        mc_campaign_title: string
        mc_subject_line: string
        mc_bounce_type?: string
        mc_click_url?: string
        $ip?: string
    }
}
