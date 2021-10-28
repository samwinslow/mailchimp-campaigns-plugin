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
- `Mailchimp email opened`
- `Mailchimp email link clicked`
- `Mailchimp email bounced`

Event properties are:

| Event property | Description | Example value | Applicable events |
| -------------- | ----------- | ------------- | ----------------- |
| `email` | Recipient's email address | `hey@posthog.com` | all |
| `timestamp` | ISO 8601 timestamp of the email activity event | `2020-11-11T11:45:00+00:00` | all |
| `mc_list_id` | List id associated with the email activity event | `01234abcdef` | all |
| `mc_email_id` | MD5-hashed value of the recipient's email address | `0123456789abcdef0123456789abcdef` | all |
| `mc_bounce_type` | Bounce event type: `hard \| soft` | `hard` | email bounced |
| `mc_click_url` | Destination URL for click events | `https://posthog.com/docs/` | email link clicked |
| `$ip` | IP address where the email activity event occurred | `2020-11-11T11:45:00+00:00` | email opened, email link clicked |

## Questions?

### [Join our Slack community.](https://join.slack.com/t/posthogusers/shared_invite/enQtOTY0MzU5NjAwMDY3LTc2MWQ0OTZlNjhkODk3ZDI3NDVjMDE1YjgxY2I4ZjI4MzJhZmVmNjJkN2NmMGJmMzc2N2U3Yjc3ZjI5NGFlZDQ)

We're here to help you with anything PostHog!
