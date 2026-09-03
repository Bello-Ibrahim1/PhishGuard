# -*- coding: utf-8 -*-
"""
Hand-crafted adversarial/realistic evaluation set for PhishGuard.
Each case: (label, sender, subject, body)  label: 1=phish, 0=legit
Covers: classic phishing, spoofed trusted brands, modern tactics
(OAuth consent phishing, MFA fatigue, QR-code phishing, BEC/CEO fraud,
gift-card scams, tech-support scams), plus tricky legit emails
(newsletters, real transactional receipts, internal work email) that
should NOT be flagged.
"""

CASES = [
    # ---------- Classic / obvious phishing (should be Medium/High) ----------
    (1, "PayPal Support <support@paypal-verify-account.tk>", "Your account has been suspended",
     "Dear Customer, we detected unusual activity on your account. Verify your identity immediately or your account will be suspended. Click here to restore access: http://bit.ly/paypal-verify"),
    (1, "Apple <no-reply@appleid-secure.top>", "Your Apple ID has been locked",
     "Your Apple ID has been locked due to suspicious activity. Confirm your identity now to avoid permanent suspension. http://ow.ly/appleid-confirm"),
    (1, "IT Support <admin@corp-helpdesk.xyz>", "Password expired - action required",
     "Your password has expired. Click here to reset your password immediately or your account will be blocked within 24 hours. http://192.168.44.12/reset"),
    (1, "Unknown <winner@lottery-intl.click>", "CONGRATULATIONS! You have won $2,500,000",
     "Dear beneficiary, you have won the international lottery. To claim your prize please reply with your full name, address and bank details."),
    (1, "Chief Executive <ceo.office@company-exec.email>", "Urgent wire transfer needed",
     "I need you to process an urgent wire transfer of $48,500 to a new vendor account today. This is time-sensitive, please confirm you can action it now, I'm in meetings all day."),
    (1, "Microsoft Security <security@microsft-online.com>", "Unusual sign-in activity",
     "We noticed a new sign-in to your Microsoft account. If this wasn't you, verify now to secure your account: http://tinyurl.com/msft-verify"),

    # ---------- Modern tactics (harder, no classic buzzwords) ----------
    (1, "Google Docs <drive-share@docs-notify.com>", "A document has been shared with you: Q3 Budget.xlsx",
     "Kayla shared a spreadsheet with you. Open it here to view: http://docs-notify.com/d/8x2Kf. Requires you to sign in with your work email and password."),
    (1, "Okta <no-reply@0kta-mfa.com>", "Approve your sign-in request",
     "A new sign-in attempt requires approval. Please approve the push notification sent to your device or enter the 6-digit code shown at http://0kta-mfa.com/approve to continue."),
    (1, "Delivery Services <track@usps-redelivery.info>", "Package held at facility - reschedule delivery",
     "We attempted to deliver your package but no one was home. A small redelivery fee of $1.99 is required to reschedule. Pay here: http://usps-redelivery.info/pay?id=88213"),
    (1, "HR Department <hr@company-benefits-portal.net>", "Action needed: confirm your direct deposit details",
     "Due to a recent system migration, please confirm your bank routing and account number on our secure portal so your next paycheck is not delayed: http://company-benefits-portal.net/confirm"),
    (1, "Zoom <meetings@zoom-invite-secure.com>", "You missed a meeting",
     "You missed a scheduled meeting. Watch the recording: http://zoom-invite-secure.com/rec/9928. Sign in with your work email to view."),
    (1, "Vendor Billing <billing@vendor-invoices-pay.com>", "Invoice #48213 overdue - pay to avoid service interruption",
     "Your invoice is overdue. To avoid interruption of service, please remit payment via the link below within 24 hours: http://vendor-invoices-pay.com/inv/48213"),
    (1, "Support <help@amazon-order-issue.com>", "There was an issue with your recent order",
     "We could not process payment for your recent order. Update your payment method within 24 hours or your order will be cancelled: http://amazon-order-issue.com/update"),
    (1, "Netflix <billing@netflix-account-update.com>", "Your payment was declined",
     "We were unable to charge your card on file. Update your billing information now to keep watching: http://netflix-account-update.com/billing"),
    (1, "Bank Alert <alerts@wellsfargo-secure-login.com>", "Suspicious transaction on your account",
     "We flagged a $1,240 transaction on your debit card as suspicious. Log in to confirm or deny this transaction within 12 hours to avoid a hold on your account: http://wellsfargo-secure-login.com"),
    (1, "DocuSign <no-reply@docusign-esign.net>", "Please review and sign: Employment Agreement",
     "You have a document waiting for your signature. Review and sign here: http://docusign-esign.net/sign/7729x"),
    (1, "LinkedIn <messaging-noreply@linkedin-jobs-alert.com>", "You have 3 new job matches",
     "Based on your profile, recruiters want to connect. Confirm your profile to view your matches: http://linkedin-jobs-alert.com/matches"),

    # ---------- Legit emails that LOOK suspicious (should be Low, testing false positives) ----------
    (0, "PayPal <service@paypal.com>", "You sent a payment of $45.00 to Joe's Coffee",
     "Hi, you sent a payment of $45.00 USD to Joe's Coffee Shop. This transaction will appear on your statement as PAYPAL *JOESCOFFEE. View your activity in your PayPal account."),
    (0, "Uber Receipts <noreply@uber.com>", "Your Tuesday evening trip with Uber",
     "Thanks for riding with Uber. Total: $18.42. Trip from 5th Ave to Downtown. Rate your driver and view your full receipt in the app."),
    (0, "Amazon.com <auto-confirm@amazon.com>", "Your Amazon.com order has shipped",
     "Your package is on the way! Track your package for delivery updates. Order #112-4482910-2938471. Arriving Thursday."),
    (0, "The New York Times <nytdirect@nytimes.com>", "Your Morning Briefing: What to know today",
     "Good morning. Here's what's happening today. Read the full story on our site. You are receiving this newsletter because you subscribed. Unsubscribe or manage your email preferences at any time."),
    (0, "Chase <no.reply.alerts@chase.com>", "Your November statement is ready",
     "Your November statement for account ending in 4821 is now available online. Log in to chase.com to view your statement and manage autopay."),
    (0, "GitHub <notifications@github.com>", "[phishguard] New pull request opened by teammate",
     "teammate opened pull request #42 in phishguard: 'Improve heuristic scoring'. View the changes and leave a review."),
    (0, "Spotify <no-reply@spotify.com>", "Your 2025 Wrapped is here",
     "See your top artists, songs, and minutes listened this year. Share your Wrapped story with friends."),
    (0, "Sarah Johnson <sarah.johnson@ourcompany.com>", "Notes from today's standup",
     "Hi team, quick recap of standup: engineering is on track for the release Friday, marketing needs final copy by Wednesday, let me know if you have blockers. Thanks!"),
    (0, "DoorDash <no-reply@doordash.com>", "Your order from Chipotle is on the way",
     "Your order is being prepared and will arrive in about 25 minutes. Track your order live in the app."),
    (0, "Slack <feedback@slack.com>", "Your weekly workspace digest",
     "Here's what happened in your workspace this week: 214 messages sent, 3 new members joined. View the full digest in your dashboard."),
    (0, "Bank of America <onlinebanking@bankofamerica.com>", "Payment confirmation - Auto loan",
     "Your scheduled auto loan payment of $412.00 was successfully processed on 11/10. Thank you for banking with us."),
    (0, "Eventbrite <noreply@eventbrite.com>", "Reminder: Local Tech Meetup is tomorrow",
     "Don't forget! Local Tech Meetup starts tomorrow at 6:00 PM. Here are your ticket details and directions to the venue."),
    (0, "Dropbox <no-reply@dropbox.com>", "Your file was successfully backed up",
     "Good news! All your recent changes have been synced to the cloud. You now have 2GB of storage remaining."),
    (0, "Delta Air Lines <no.reply@delta.com>", "Check-in now open for your flight DL1423",
     "Check-in is now open for your upcoming flight to Atlanta. Choose your seat and get your boarding pass in the Fly Delta app."),
    (0, "Old Navy <email@oldnavy.com>", "Flash sale: 40% off everything, today only",
     "Don't miss out! Take 40% off your entire purchase online and in-store today only. Shop now before it's gone."),
]

if __name__ == "__main__":
    print(f"Total cases: {len(CASES)}  (phish={sum(1 for c in CASES if c[0]==1)}, legit={sum(1 for c in CASES if c[0]==0)})")
