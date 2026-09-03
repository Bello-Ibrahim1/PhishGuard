# -*- coding: utf-8 -*-
"""
SECOND, independent held-out eval set. Not used to design any fix — written after the
fixes were made, to check real generalization rather than overfitting to eval set #1.
Deliberately includes brands NOT in sentinel/main.py's _BRAND_DOMAINS map (Etsy, Airbnb,
Squarespace, Mailchimp, Notion, Figma, Canva, 1Password) to test the limits of the
brand-impersonation heuristic, plus homoglyph/unicode tricks and tricky legit edge cases.
"""
CASES = [
    # Phishing: brands NOT in the impersonation map (tests generalization beyond the hardcoded list)
    (1, "Etsy Support <support@etsy-order-issue.com>", "There's a problem with your recent Etsy order",
     "We were unable to process your payment for your recent order. Update your billing details within 24 hours or your order will be cancelled. http://etsy-order-issue.com/billing"),
    (1, "Airbnb <noreply@airbnb-reservation-alert.com>", "Your reservation has been put on hold",
     "Your upcoming reservation has been put on hold due to a payment issue. Confirm your payment method now to keep your booking: http://airbnb-reservation-alert.com/confirm"),
    (1, "Mailchimp <no-reply@mailchimp-billing-issue.net>", "Your account will be suspended",
     "We were unable to charge your card on file. Your Mailchimp account will be suspended in 24 hours unless you update your payment information: http://mailchimp-billing-issue.net/pay"),
    (1, "Notion <team@notion-workspace-alert.com>", "Your workspace storage is full",
     "Your Notion workspace has exceeded its storage limit. Upgrade now to avoid losing access to your pages: http://notion-workspace-alert.com/upgrade"),
    # Homoglyph / unicode / punycode-style tricks
    (1, "PayPal <service@paypaI.com>", "Confirm your recent login",
     "We noticed a login from a new device. If this was not you, secure your account immediately: http://paypaI-secure.com/login (capital i instead of l in domain)"),
    (1, "Apple Support <no-reply@apple.com.account-verify.net>", "Your Apple ID needs verification",
     "Your Apple ID needs verification due to unusual activity. Verify now to avoid suspension: http://apple.com.account-verify.net/verify"),
    # Classic scams without brand names
    (1, "Unknown <hr@job-offer-remote.click>", "Congratulations! You've been selected for a remote position",
     "We reviewed your resume and would like to offer you a work-from-home position paying $45/hr. To begin onboarding, send a copy of your ID and a voided check for direct deposit setup."),
    (1, "Support Team <recovery@crypto-wallet-restore.com>", "Your crypto wallet has been flagged",
     "Your wallet has been flagged for suspicious activity and will be frozen. Verify your recovery phrase immediately to prevent permanent loss of funds: http://crypto-wallet-restore.com"),
    (1, "Unknown Sender <billing@subscription-renewal-notice.info>", "Your subscription renews tomorrow for $499.99",
     "Your annual subscription will automatically renew tomorrow for $499.99. If you did not authorize this, call the number below immediately or click here to cancel: http://subscription-renewal-notice.info/cancel"),

    # ---- Tricky legit edge cases (should stay Low) ----
    (0, "Etsy <transaction@etsy.com>", "Your Etsy order has shipped",
     "Good news! Your order from CeramicStudioCo has shipped and is on its way. Track your package for delivery updates."),
    (0, "Airbnb <automated@airbnb.com>", "Your upcoming trip to Denver",
     "Your reservation is confirmed for your upcoming trip to Denver. Check-in instructions from your host will be available 48 hours before arrival."),
    (0, "Figma <notifications@figma.com>", "Your teammate commented on a file",
     "Alex left a comment on 'Landing Page v3'. Open Figma to view and reply to the comment."),
    (0, "Canva <hello@canva.com>", "Your design is ready to download",
     "Your design 'Q4 Social Assets' has finished rendering and is ready to download in your preferred format."),
    (0, "1Password <notify@1password.com>", "Your monthly security report is ready",
     "Here's your monthly security report: 2 weak passwords, 1 reused password, 0 breached accounts. Open the app to review and fix these."),
    (0, "Coworker <jamie.lee@ourcompany.com>", "Can you review this by EOD? kind of urgent",
     "Hey, sorry for the short notice but could you take a quick look at the attached deck before the client call at 4pm? Really appreciate it, thanks!"),
    (0, "Google <no-reply@accounts.google.com>", "Security alert: new sign-in on Windows",
     "We noticed a new sign-in to your Google Account on a Windows device. If this was you, you don't need to do anything. If not, we recommend you secure your account."),
    (0, "Calendly <notifications@calendly.com>", "New event scheduled: 30 Min Meeting with Priya",
     "Priya Patel scheduled a 30 Minute Meeting with you for Thursday at 2:00 PM. Add this event to your calendar."),
    (0, "American Express <alerts@americanexpress.com>", "Your statement is ready to view",
     "Your November statement for the card ending in 1004 is now available. Log in to americanexpress.com to view your balance and make a payment."),
    (0, "Twilio <no-reply@twilio.com>", "Your verification code is 482913",
     "Your one-time verification code is 482913. This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email."),
]

if __name__ == "__main__":
    print(f"Total: {len(CASES)}  phish={sum(1 for c in CASES if c[0]==1)}  legit={sum(1 for c in CASES if c[0]==0)}")
