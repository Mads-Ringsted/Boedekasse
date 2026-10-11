# SMTP provider for login codes

Research for [#42](https://github.com/Mads-Ringsted/Boedekasse/issues/42). Researched 2026-10-11.

**The question.** Which email provider should send Supabase Auth's 6-digit login codes? The app serves one friend group: Danish users, a handful to about 30 people, a few logins per week.

**Known already** (from [`supabase-auth-and-rls.md`](./supabase-auth-and-rls.md)): custom SMTP is mandatory. The built-in sender only reaches members of the Supabase team.

**How the sources were read.** I read each provider's own pricing page, docs and privacy pages, plus the Supabase docs and the mailbox providers' sender rules. A few pages render their prices with JavaScript or sit behind a bot check. Those gaps are marked in the text. I did not bypass any bot check.

---

## 1. What the app needs

- **Volume is tiny.** A few logins per week is well under 100 emails per month.
- **The one burst is onboarding.** When the group first installs the app, up to 30 people ask for a code within an hour or so. Resends double that in the worst case.
- **Every code must arrive fast.** A login code that lands in spam, or comes 10 minutes late, blocks the user.
- **Nothing else is sent.** No marketing, no newsletters. Only auth emails.

So the free tier only has to cover about **100 emails per day** at peak, and the provider must be reliable for Gmail, iCloud and Outlook inboxes.

---

## 2. How a provider plugs into Supabase

### Facts

- **Custom SMTP** is the normal route. You enter host, port, username, password, a From address and a sender name under *Authentication > Email > SMTP Settings*, or set them with `PATCH /v1/projects/{ref}/config/auth` ([Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
- Supabase lists Resend, AWS SES, Postmark, Twilio SendGrid, ZeptoMail and Brevo as a "non-exhaustive list" ([same page](https://supabase.com/docs/guides/auth/auth-smtp)). All six offer SMTP.
- **Rate limit:** with custom SMTP, Supabase starts at **30 emails per hour** for the whole project. You can raise it under *Authentication > Rate Limits* ([same page](https://supabase.com/docs/guides/auth/auth-smtp)).
- **Send Email hook** is the other route. It "replaces Supabase's built-in email sending". When it is on, SMTP is not used. Supabase calls your HTTP endpoint (for example an Edge Function) with `email_data.token` (the 6-digit code) and `email_action_type`. Your code then calls the provider's API ([Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)). The hook is available on the Free plan ([Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks)).
- Supabase suggests the hook for "custom templating, queuing, failover between providers, or non-SMTP APIs" ([Custom SMTP, best practices](https://supabase.com/docs/guides/auth/auth-smtp)).

### What it means here

Custom SMTP is enough. It needs no code, and Supabase keeps rendering the email templates. The hook adds an Edge Function to write, deploy and monitor. It only pays off if we later want failover or a provider without SMTP. **Use custom SMTP.**

**Raise the Supabase email rate limit** from 30 to about 100 per hour before onboarding. Otherwise the 31st person in the first hour gets a 429 error.

---

## 3. Mailbox rules (Gmail, iCloud, Outlook)

### Facts

- **Gmail, all senders** (since 1 Feb 2024): SPF **or** DKIM, valid forward and reverse DNS, TLS, and a spam rate below 0.3%. **Bulk senders** (over 5,000 a day) need SPF **and** DKIM **and** DMARC ([Google: Email sender guidelines](https://support.google.com/a/answer/81126)).
- **iCloud:** asks bulk senders for SPF, DKIM and a published DMARC policy. iCloud honours the sending domain's DMARC policy ([Apple: Best practices for senders](https://support.apple.com/en-us/102322)).
- **Outlook.com** (since 5 May 2025): domains sending over 5,000 a day need SPF, DKIM and DMARC. Non-compliant mail goes to Junk first and may be rejected later ([Microsoft: Outlook's new requirements for high-volume senders](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730)).
- **A free-mail From address does not work.** Domains like `@gmail.com` can't be authenticated by a sending service ([Brevo help, via search](https://help.brevo.com/hc/en-us/articles/17286219877778)). Brevo replaces an unauthenticated From domain with `@brevosend.com` ([Brevo help, via search](https://help.brevo.com/hc/en-us/articles/12163873383186)).

### What it means here

We are far below the 5,000-a-day bulk line. Strictly, Gmail only needs SPF or DKIM. But all three providers grade reputation at every volume. So set up **SPF, DKIM and DMARC** anyway. It is three or four DNS records, done once.

**Every provider needs a domain we own.** That domain is decided in [#43](https://github.com/Mads-Ringsted/Boedekasse/issues/43).

---

## 4. The six providers

### Resend

- **Free plan, still offered in October 2026:** 3,000 emails per month, **100 per day**, 3 custom domains, 30 days of logs, SMTP relay included. Pro is $20/month for 50,000 ([Resend pricing](https://resend.com/pricing)).
- **Domain:** required. "You must add and verify at least one domain to send emails with Resend." Resend recommends a subdomain ([Domains](https://resend.com/docs/dashboard/domains/introduction)). Without a domain, the test sender `resend.dev` only delivers to your own account email ([403 error with resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)).
- **DNS:** an MX and an SPF TXT on `send.<subdomain>`, plus a DKIM TXT at `resend._domainkey` ([Cloudflare guide](https://resend.com/docs/knowledge-base/cloudflare)). DMARC is your own TXT at `_dmarc`, recommended after verifying ([Domains](https://resend.com/docs/dashboard/domains/introduction)).
- **Supabase:** host `smtp.resend.com`, port 465, user `resend`, password = API key ([Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)). The Supabase hook docs use Resend as their example ([Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)).
- **EU:** you can send from Ireland (`eu-west-1`), and multi-region is on the Free plan. But region "does not control where customer data is stored". All data stays in the US ([Regions](https://resend.com/docs/dashboard/domains/regions)). Transfers rely on Standard Contractual Clauses and the EU-US Data Privacy Framework. "There is no setting today that moves stored data to the EU" ([Resend GDPR](https://resend.com/security/gdpr)).
- **Approval:** none mentioned. You can send once the domain verifies.

### Brevo

- **Free plan, still offered in October 2026:** "Free forever". **300 emails per day**, SMTP and API included. "Once we approve your account for sending, you can start sending up to 300 emails per day" ([Brevo pricing](https://www.brevo.com/pricing/), [Free SMTP server](https://www.brevo.com/free-smtp-server/), [Transactional email](https://www.brevo.com/products/transactional-email/)).
- **Branding:** paid plans list "No Brevo logo: Remove the 'Sent with Brevo' footer" ([pricing](https://www.brevo.com/pricing/)). I could not confirm from Brevo's own pages whether that footer is added to *transactional* SMTP mail on Free. Brevo's help centre is behind a bot check.
- **Domain:** effectively required. Without one, the From address is rewritten to `@brevosend.com` (see section 3).
- **DNS:** a `brevo-code` TXT, DKIM and DMARC ([Authenticate your domain](https://help.brevo.com/hc/en-us/articles/12163873383186), title only, page not readable).
- **Supabase:** standard SMTP relay.
- **EU:** French company. "Data hosting: France and Germany (EU-based servers)" ([Transactional email](https://www.brevo.com/products/transactional-email/)). Its help article adds backups on Google Cloud in Belgium ([Data storage location](https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location), seen via search only).
- **Approval:** yes. An account must be approved before it can send.

### Postmark

- **Free plan, still offered in October 2026:** **100 emails per month**, never expires, "No overages allowed in this plan". Next step is Basic at $15/month for 10,000 ([Postmark pricing](https://postmarkapp.com/pricing)).
- **Domain:** required in practice. Until the account is approved, you can only send to domains you have verified ([Account approval](https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work)).
- **DNS:** a DKIM TXT and a Return-Path CNAME (`pm_bounces` → `pm.mtasv.net`) ([Verify a domain](https://postmarkapp.com/support/article/1046-how-do-i-verify-a-domain)). DMARC is your own record.
- **Supabase:** standard SMTP.
- **EU:** data is in the US, outside Chicago and on AWS. "We currently don't have plans to add servers in the EU." The DPA with SCCs is part of the Terms ([Postmark EU privacy](https://postmarkapp.com/euprivacy)).
- **Approval:** yes, a manual review, usually within a weekday.
- **Note:** Postmark is known for fast, reliable transactional delivery. But 100 a month is too tight for an onboarding burst plus normal use.

### AWS SES

- **Free tier:** no SES-specific free allowance on the pricing page now. New AWS accounts get "up to $200 in AWS Free Tier credits" usable on SES, for 6 months ([SES pricing](https://aws.amazon.com/ses/pricing/), [AWS Free Tier](https://aws.amazon.com/free/)). After that, sending costs $0.10 per 1,000 (à la carte) or $0.16 per 1,000 (Essentials, no monthly fee) ([SES pricing](https://aws.amazon.com/ses/pricing/)). At our volume that is cents per year, but it needs a card on an AWS account.
- **Sandbox:** new accounts can only send to verified addresses, 200 per day, 1 per second. You must request production access. AWS answers within 24 hours ([Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)).
- **Domain:** you must verify every From identity ([same page](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)). A domain identity with Easy DKIM (CNAMEs) is the normal setup. A custom MAIL FROM subdomain gives SPF alignment ([SES endpoints](https://docs.aws.amazon.com/general/latest/gr/ses.html)).
- **Supabase:** SMTP at `email-smtp.<region>.amazonaws.com`, ports 465/587 ([SMTP connect](https://docs.aws.amazon.com/ses/latest/dg/smtp-connect.html)). Needs separate SMTP credentials made in IAM.
- **EU:** SMTP endpoints exist in Frankfurt, Ireland, London, Paris and Stockholm (`eu-north-1`) ([SES endpoints](https://docs.aws.amazon.com/general/latest/gr/ses.html)). Data stays in the chosen region.
- **Note:** cheapest and most flexible, but the most setup: an AWS account, IAM, sandbox exit, DNS.

### ZeptoMail (Zoho)

- **Free tier:** one free credit of **10,000 emails**. "Email credits valid for 6 months" ([ZeptoMail pricing](https://www.zoho.com/zeptomail/pricing.html)). So the free tier ends after 6 months, and we then buy credits. The page loads the price with JavaScript, so I did not capture it.
- **Domain:** required. Verify with a DKIM TXT and a bounce CNAME. Zoho says SPF is not needed for verification ([Domains](https://www.zoho.com/zeptomail/help/domains.html)).
- **Supabase:** SMTP at `smtp.zeptomail.com`, ports 465/587, user `emailapikey` ([SMTP](https://www.zoho.com/zeptomail/help/smtp-home.html)).
- **EU:** yes. Accounts registered at `cpaas.zoho.eu` are hosted in the EU data centre ([ZeptoMail GDPR](https://www.zoho.com/zeptomail/gdpr.html)).
- **Approval:** an account review via a "Customer Validation" form ([Account review FAQ](https://help.zoho.com/portal/en/kb/zeptomail/faqs/getting-started/articles/how-can-i-review-my-account), seen via search).

### Twilio SendGrid

- **Free plan: gone.** "Twilio SendGrid will be retiring its Free Email API and Free Marketing Campaigns plan starting May 27, 2025" ([Twilio changelog](https://www.twilio.com/en-us/changelog/sendgrid-free-plan)). Today there is a one-time **60-day trial** with 100 emails per day. After it ends you must upgrade to keep sending ([Upgrading your plan](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/upgrading-your-plan)).
- **Domain:** required (domain authentication with SPF and DKIM).
- **Supabase:** standard SMTP.
- **EU:** only through an EU-pinned subuser on a paid Pro plan or higher ([How to send emails on EU servers](https://twilio.com/en-us/blog/send-emails-in-eu), seen via search).
- **Note:** ruled out. There is no free way to keep sending.

---

## 5. Side by side

| | Free quota (Oct 2026) | Free lasts | Custom domain | DNS records | Account review | Data location | Supabase setup |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Resend** | 3,000/month, 100/day | Ongoing | Yes | MX + SPF TXT on `send.`, DKIM TXT, own DMARC | No | US (sends from EU possible) | SMTP, 4 fields |
| **Brevo** | 300/day | Ongoing | Yes (else `@brevosend.com`) | `brevo-code` TXT, DKIM, DMARC | Yes | EU (France, Germany) | SMTP |
| **Postmark** | 100/month | Ongoing | Yes | DKIM TXT, Return-Path CNAME, own DMARC | Yes | US | SMTP |
| **AWS SES** | Credits only | 6 months, then ~$0.10/1,000 | Yes | Easy DKIM CNAMEs, MAIL FROM MX + SPF, own DMARC | Yes (sandbox exit) | EU region of choice | SMTP + IAM credentials |
| **ZeptoMail** | 10,000 once | 6 months | Yes | DKIM TXT, bounce CNAME, own DMARC | Yes | EU (if signed up at `.eu`) | SMTP |
| **SendGrid** | 100/day trial | 60 days, once | Yes | SPF + DKIM CNAMEs, own DMARC | No | EU on Pro+ only | SMTP |

All six reach Gmail, iCloud and Outlook fine once SPF, DKIM and DMARC pass. None publishes inbox-placement numbers for Danish mailboxes that I could check.

---

## 6. Recommendation

**Use Resend's Free plan through Supabase custom SMTP.**

Why:

1. **The free tier fits and does not expire.** 100 a day covers the onboarding burst. 3,000 a month is about 30 times our normal use.
2. **Least setup.** No account review, no sandbox. Verify the domain and paste four SMTP fields into Supabase.
3. **It is the path both doc sets show.** Supabase uses Resend as its hook example, and Resend has a Supabase SMTP guide.
4. **GDPR is acceptable.** The data is stored in the US, but under SCCs and the EU-US Data Privacy Framework. The data is only email addresses and login codes for friends.

**Runner-up: Brevo**, if EU-only data storage becomes a firm requirement. It has a larger free quota and EU hosting. The cost is an account approval and possibly a "Sent with Brevo" footer.

**Not chosen:** Postmark (100 a month is too tight), AWS SES (most setup for no gain at this size), ZeptoMail (free credit expires after 6 months), SendGrid (no free plan since 2025).

### Setup steps

```
        Vercel app                  Supabase Auth                 Resend (eu-west-1)          Inbox
   signInWithOtp(email) ──▶  renders template with {{ .Token }} ──SMTP 465──▶ signs with DKIM ──▶ Gmail / iCloud / Outlook
                                                                              From: login@auth.<domain>
```

1. In Resend, add the subdomain, for example `auth.<domain>` (domain chosen in #43). Pick region **Ireland (`eu-west-1`)**.
2. Add the DNS records Resend shows: MX and SPF TXT on `send.auth`, DKIM TXT at `resend._domainkey.auth`.
3. Add DMARC on the root domain: `_dmarc.<domain>` TXT `v=DMARC1; p=none; rua=mailto:<your address>`. Tighten to `p=quarantine` after a few weeks of clean reports.
4. Create a Resend API key with "sending access" only.
5. In Supabase, open *Authentication > Email > SMTP Settings*. Enter host `smtp.resend.com`, port `465`, user `resend`, password = the API key. Sender: `login@auth.<domain>`, name "Bødekasse".
6. In *Authentication > Rate Limits*, raise "emails sent" from 30 to about **100 per hour**.
7. Keep the auth templates plain: a short Danish subject, the code, no links, no images. This follows Supabase's best practices.
8. Send a test code to a Gmail, an iCloud and an Outlook address. Check that SPF, DKIM and DMARC all show "pass" in the message headers.

---

## Open questions and things not verified

- Whether Brevo adds the "Sent with Brevo" footer to transactional SMTP mail on Free. Its help centre was behind a bot check.
- ZeptoMail's price per credit after the free one. The page loads it with JavaScript.
- Brevo's DNS record names, and the ZeptoMail account-review details, were seen through search results, not read directly.
- The domain itself (and whether it is `.dk`) is decided in [#43](https://github.com/Mads-Ringsted/Boedekasse/issues/43).
- Whether a privacy note should tell Medlemmer that their email address is processed by a US-based sender. That is a product call, not a technical one.
