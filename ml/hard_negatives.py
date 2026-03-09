"""
Hard negative mining: generate realistic legitimate emails that look suspicious
(contain payment/invoice/verify language) but are NOT phishing.
These are added as label=0 to training data to reduce false positives.
"""
import random
import pandas as pd
from pathlib import Path

random.seed(42)

LEGIT_TEMPLATES = [
    # PayPal receipts
    ("PayPal payment confirmation",
     "Hi {name}, you sent a payment of ${amount} to {merchant}. "
     "Transaction ID: {txn}. This is a confirmation of your payment. "
     "If you did not make this payment, please visit paypal.com to review your account. "
     "Thank you for using PayPal. To unsubscribe from payment notifications, manage your preferences at paypal.com."),

    # Amazon order confirmation
    ("Your Amazon order #{order} has been placed",
     "Hello {name}, thank you for your purchase! Your order #{order} has been placed. "
     "Order total: ${amount}. Estimated delivery: {date}. "
     "Track your shipment at amazon.com. Your order confirmation is attached. "
     "View your order details or manage your account at amazon.com."),

    # Bank statement
    ("Your monthly statement is ready",
     "Dear {name}, your {month} account statement is now available. "
     "Account summary: Balance ${amount}. "
     "Log in at chase.com to view your full billing statement. "
     "If you have questions about your account, contact us at chase.com. "
     "This is an automated notification. To update your notification preferences, visit chase.com."),

    # Netflix billing
    ("Netflix — Your invoice for {month}",
     "Hi {name}, your Netflix payment of ${amount} was processed successfully. "
     "Plan: Standard. Next billing date: {date}. "
     "To update your payment method or manage your account, visit netflix.com. "
     "Questions? Visit netflix.com/help. To unsubscribe from billing emails, visit netflix.com/account."),

    # Uber receipt
    ("Your Uber trip receipt",
     "Hi {name}, thanks for riding with Uber! Here's your receipt for your trip on {date}. "
     "Total: ${amount}. Payment: Visa ending in {last4}. "
     "View or download your invoice at uber.com. "
     "If you have questions about this charge, visit help.uber.com."),

    # LinkedIn notification
    ("You have {count} new connection requests on LinkedIn",
     "Hi {name}, {count} people want to connect with you on LinkedIn. "
     "View your invitations and confirm connections at linkedin.com. "
     "This email was sent to you as part of your LinkedIn account notifications. "
     "Unsubscribe from connection request emails or manage your preferences at linkedin.com."),

    # Dropbox notification
    ("Dropbox: {name} shared a file with you",
     "Hi, {sender} shared '{filename}' with you on Dropbox. "
     "Click the link in your Dropbox account to view the document. "
     "Sign in at dropbox.com to access your files. "
     "This is an automated notification from Dropbox. To manage notifications, visit dropbox.com/account."),

    # Spotify billing
    ("Spotify Premium — Payment confirmed",
     "Hi {name}, your Spotify Premium subscription has been renewed. "
     "Amount charged: ${amount}. Next payment date: {date}. "
     "Manage your subscription or update your payment details at spotify.com/account. "
     "To unsubscribe from billing emails, visit spotify.com/account/notifications."),

    # Zoom meeting invite
    ("Zoom meeting invitation: {topic}",
     "Hi {name}, you are invited to a Zoom meeting. "
     "Topic: {topic}. Date: {date}. Host: {sender}. "
     "Join the meeting from your Zoom account at zoom.us. "
     "This is an automated notification from Zoom. Manage your notification preferences at zoom.us/profile."),

    # Google account
    ("Security notification for your Google account",
     "Hi {name}, a new sign-in to your Google account was detected. "
     "Device: Chrome on Windows. Location: {location}. Time: {date}. "
     "If this was you, no action is needed. If not, review your account activity at accounts.google.com. "
     "You received this email to keep your account secure. Manage notifications at myaccount.google.com."),

    # FedEx delivery
    ("FedEx: Your package is out for delivery",
     "Hi {name}, your FedEx package is out for delivery today. "
     "Tracking number: {txn}. Estimated delivery: by end of day. "
     "Track your shipment at fedex.com. "
     "Delivery notifications are sent automatically. Manage your FedEx preferences at fedex.com/profile."),

    # Apple receipt
    ("Your receipt from Apple",
     "Dear {name}, thank you for your purchase. "
     "App: {filename}. Amount billed: ${amount}. Apple ID: {name}@icloud.com. "
     "If you did not make this purchase, visit appleid.apple.com to review your account. "
     "You can also manage your subscriptions at appleid.apple.com."),

    # Microsoft 365
    ("Microsoft 365 — Your subscription renewal",
     "Hi {name}, your Microsoft 365 subscription has been renewed. "
     "Plan: Microsoft 365 Personal. Amount: ${amount}. Next renewal: {date}. "
     "Manage your subscription at account.microsoft.com. "
     "To update payment information or cancel, visit account.microsoft.com/billing."),

    # Generic newsletter
    ("Your weekly digest from {merchant}",
     "Hi {name}, here's your weekly newsletter from {merchant}. "
     "This week's top stories and updates are included below. "
     "View in browser if this email doesn't display correctly. "
     "You're receiving this because you subscribed at {merchant}. "
     "To unsubscribe or manage your email preferences, click the link below."),
]

NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Chris", "Morgan", "Casey", "Jamie", "Riley", "Drew"]
MERCHANTS = ["Amazon", "Nike", "Best Buy", "Target", "Walmart", "Etsy", "Shopify Store"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October"]
LOCATIONS = ["New York, US", "London, UK", "Los Angeles, US", "Chicago, US", "Toronto, CA"]
TOPICS = ["Q3 Planning Meeting", "Weekly Sync", "Project Kickoff", "Team Standup", "Product Review"]
FILENAMES = ["Q3 Report.pdf", "Budget 2024.xlsx", "Project Plan.docx", "Invoice.pdf", "Contract.pdf"]
SENDERS = ["John Smith", "Sarah Connor", "Mike Johnson", "Emily Davis", "David Lee"]


def _rand(lst):
    return random.choice(lst)


def generate(n: int = 500) -> list:
    rows = []
    for _ in range(n):
        subject_tpl, body_tpl = random.choice(LEGIT_TEMPLATES)
        vals = {
            "name": _rand(NAMES),
            "amount": round(random.uniform(4.99, 299.99), 2),
            "merchant": _rand(MERCHANTS),
            "txn": f"TXN{random.randint(100000, 999999)}",
            "order": f"{random.randint(100000, 999999)}",
            "date": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            "month": _rand(MONTHS),
            "last4": random.randint(1000, 9999),
            "count": random.randint(1, 12),
            "sender": _rand(SENDERS),
            "filename": _rand(FILENAMES),
            "location": _rand(LOCATIONS),
            "topic": _rand(TOPICS),
        }
        subject = subject_tpl.format(**vals)
        body = body_tpl.format(**vals)
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows


if __name__ == "__main__":
    out_path = Path("ml/processed/train.csv")
    df_orig = pd.read_csv(out_path)
    hard_negs = pd.DataFrame(generate(500))
    df_new = pd.concat([df_orig, hard_negs], ignore_index=True).sample(frac=1, random_state=42)
    df_new.to_csv(out_path, index=False)
    print(f"Added {len(hard_negs)} hard negatives. New total: {len(df_new)} rows.")
