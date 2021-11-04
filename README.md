# Mailchimp Campaigns Plugin (WIP)

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

This plugin allows you to ingest data from Mailchimp Campaigns into PostHog.

## Installation

1. Open PostHog.
1. Go to the Plugins page from the sidebar.
1. Head to the Advanced tab.
1. "Install from GitHub, GitLab or npm" using this repository's URL.


## Configuration

You must provide your Mailchimp API key and data center shortcode to authenticate with the Mailchimp API.

For more details see [plugin.json](./plugin.json).


## Tracked events

1 event will be captured per user, per event. The event names as they will appear in PostHog are:

- `Mailchimp email delivered`
  - Sent for every email, including bounced deliveries.
  - If the result was a bounce, the property `mc_delivery_successful` will be false.
- `Mailchimp email opened`
- `Mailchimp email link clicked`
- `Mailchimp email bounced`

Event properties are:

| Event property | Description | Example value | Applicable events |
| -------------- | ----------- | ------------- | ----------------- |
| `timestamp` | ISO 8601 timestamp of the email activity event | `2020-11-11T11:45:00+00:00` | all |
| `$email` | Recipient's email address | `hey@posthog.com` | all |
| `mc_recipient_email` | Recipient's email address | `hey@posthog.com` | all |
| `mc_email_id` | MD5-hashed value of the recipient's email address | `0123456789abcdef0123456789abcdef` | all |
| `mc_list_id` | List id associated with the email activity event | `01234abcdef` | all |
| `mc_campaign_id` | Unique identifier for this campaign | `01234abcdef` | all |
| `mc_campaign_title` | Title of this campaign in Mailchimp | `Sales Campaign (Fall 2021)` | all |
| `mc_subject_line` | Subject line of the campaign email | `Hello human, how are you?` | all |
| `mc_delivery_successful` | Whether or not the campaign email was delivered successfully | true | `true` on all, but `false` on bounce events and on email delivered events where the result was a bounce |
| `mc_bounce_type` | Bounce event type: `hard \| soft` | `hard` | email bounced |
| `mc_click_url` | Destination URL for click events | `https://posthog.com/docs/` | email link clicked |
| `$ip` | Client IP address where the email activity event occurred | `123.456.78.90` | email opened, email link clicked |

Events will be sent to PostHog using the recipient's email address as the distinct ID.

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

We're here to help you with anything PostHog!
