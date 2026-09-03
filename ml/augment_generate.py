"""
Generates synthetic augmentation rows to fix two known model weaknesses found via
held-out adversarial evaluation (tests/adversarial_eval.py, NOT used here -> no leakage):
  1) False positives on modern legitimate newsletters / travel-transactional emails
     (old 2001-2008 training data under-represents these).
  2) Reinforces brand-impersonation / typosquat phishing patterns at the model level
     (char n-grams), complementing the rule-based fix in sentinel/main.py.
Companies and phrasing here are intentionally DIFFERENT from tests/adversarial_eval.py.
"""
import random
import pandas as pd

random.seed(7)

# ---------- Legit: modern newsletters (label 0) ----------
NEWSLETTER_BRANDS = ["The Wall Street Journal", "Morning Brew", "TechCrunch", "The Atlantic",
                      "Product Hunt", "Ars Technica", "The Hustle", "Axios", "Stratechery", "The Information"]
TOPICS = ["technology", "markets", "climate", "startups", "AI", "world news", "business", "science"]

def gen_newsletter_rows(n):
    rows = []
    for _ in range(n):
        brand = random.choice(NEWSLETTER_BRANDS)
        topic = random.choice(TOPICS)
        subject = random.choice([
            f"Your daily digest: {topic}",
            f"{topic.title()} - top stories today",
            f"This week in {topic}",
            f"5 things to know about {topic} today",
        ])
        body = (f"Good morning. Here are today's top stories in {topic}. Read the full stories on our site. "
                f"You are receiving this email because you subscribed to the {brand} newsletter. "
                f"Unsubscribe or manage your email preferences at any time. View this email in your browser.")
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows

# ---------- Legit: modern travel / transactional (label 0) ----------
TRAVEL_BRANDS = ["American Airlines", "United Airlines", "Southwest", "JetBlue", "Marriott",
                  "Hilton", "Airbnb", "Expedia", "Hertz", "Enterprise Rent-A-Car"]
CITIES = ["Chicago", "Denver", "Seattle", "Austin", "Miami", "Boston", "Phoenix", "Portland"]

def gen_travel_rows(n):
    rows = []
    for _ in range(n):
        brand = random.choice(TRAVEL_BRANDS)
        city = random.choice(CITIES)
        subject = random.choice([
            f"Check-in now open for your upcoming trip to {city}",
            "Your reservation is confirmed",
            "Your boarding pass is ready",
            f"Your itinerary for {city}",
        ])
        body = (f"Check-in is now open for your upcoming trip with {brand}. Choose your seat and get your "
                f"boarding pass in the app. Have a great trip to {city}! Manage your reservation online anytime.")
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows

# ---------- Legit: everyday order / receipt emails (label 0) ----------
STORE_BRANDS = ["Target", "Walgreens", "CVS", "Costco", "Home Depot", "IKEA", "Sephora", "Nike", "Best Buy", "Wayfair"]

def gen_receipt_rows(n):
    rows = []
    for _ in range(n):
        brand = random.choice(STORE_BRANDS)
        amount = round(random.uniform(8, 240), 2)
        subject = random.choice([
            "Your order has shipped", "Thanks for your order!", "Your receipt from " + brand,
            "Your order is on the way",
        ])
        body = (f"Thanks for shopping with {brand}. Your order total was ${amount:.2f}. "
                f"Track your package for delivery updates in the app or online. We hope you enjoy your purchase!")
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows

# ---------- Phish: brand impersonation / typosquat (label 1), different brands than eval set ----------
PHISH_BRANDS = [
    ("Chase", "chase-secure-login.com"), ("Bank of America", "bofa-alert-verify.com"),
    ("American Express", "amex-account-update.info"), ("Venmo", "venmo-payment-confirm.net"),
    ("Instagram", "instagram-security-team.com"), ("Facebook", "facebook-account-review.net"),
    ("Dropbox", "dropbox-file-shared.co"), ("Adobe", "adobe-license-renew.xyz"),
    ("Coinbase", "coinbase-wallet-verify.com"), ("FedEx", "fedex-redelivery-fee.com"),
    ("UPS", "ups-tracking-update.info"), ("Steam", "steam-community-gift.com"),
    ("Instacart", "instacart-refund-center.com"), ("Comcast Xfinity", "xfinity-billing-alert.net"),
    ("Verizon", "verizon-account-suspended.top"), ("Social Security Administration", "ssa-benefits-update.click"),
]
PHISH_SUBJECTS = [
    "Your account has been limited",
    "Verify your identity to continue",
    "Unusual login attempt detected",
    "Your payment method needs updating",
    "Confirm your recent transaction",
    "Your subscription will be cancelled",
    "Security alert: new device signed in",
    "Your package could not be delivered",
    "Reactivate your account now",
    "We could not verify your information",
]

def gen_phish_rows(n):
    rows = []
    for _ in range(n):
        brand, domain = random.choice(PHISH_BRANDS)
        subject = random.choice(PHISH_SUBJECTS)
        link = f"http://{domain}/{random.choice(['verify','confirm','update','secure'])}"
        body = (f"Dear customer, we detected unusual activity on your {brand} account. "
                f"To avoid suspension, please verify your identity immediately: {link} . "
                f"Failure to confirm within 24 hours will result in permanent account suspension.")
        rows.append({"text": f"{subject} {body}", "label": 1})
    return rows

def main():
    rows = (gen_newsletter_rows(70) + gen_travel_rows(60) + gen_receipt_rows(50) + gen_phish_rows(150))
    random.shuffle(rows)
    df = pd.DataFrame(rows)
    df.to_csv("ml/augment_synthetic.csv", index=False)
    print("Wrote ml/augment_synthetic.csv rows:", len(df), "label counts:", df.label.value_counts().to_dict())

if __name__ == "__main__":
    main()
