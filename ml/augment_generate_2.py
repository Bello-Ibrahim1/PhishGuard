"""
Round 2 augmentation, targeting gaps found by the SECOND independent eval set
(tests/adversarial_eval_2.py): fake job-offer scams (missed) and OTP/verification-code +
newer SaaS notification emails (false-positived). Brands/phrasing here are deliberately
DIFFERENT instances from adversarial_eval_2.py to keep that set a fair, unseen check.
"""
import random
import pandas as pd

random.seed(11)

# ---------- Phish: fake job offer / recruitment scams (label 1) ----------
JOB_TITLES = ["Data Entry Clerk", "Personal Assistant", "Customer Service Rep", "Administrative Assistant",
              "Virtual Assistant", "Payroll Coordinator", "Mystery Shopper", "Package Reshipper"]
def gen_job_scam_rows(n):
    rows = []
    for _ in range(n):
        title = random.choice(JOB_TITLES)
        pay = random.choice([28, 32, 35, 40, 45])
        subject = random.choice([
            f"You've been selected for our {title} position",
            "Job offer - immediate start, work from home",
            "Your application has been approved",
        ])
        body = (f"Congratulations! Based on your resume we are offering you the {title} position at ${pay}/hr, "
                f"fully remote, no experience required. To begin onboarding and set up direct deposit, please reply "
                f"with a copy of your government ID and a voided check. We will mail you a starter check to cover "
                f"home office equipment.")
        rows.append({"text": f"{subject} {body}", "label": 1})
    return rows

# ---------- Legit: OTP / verification code emails (label 0) ----------
OTP_SERVICES = ["GitHub", "Discord", "Dropbox", "Airbnb", "Robinhood", "Coinbase", "DoorDash", "Instacart",
                 "LinkedIn", "Reddit", "Notion", "Figma"]
def gen_otp_rows(n):
    rows = []
    for _ in range(n):
        svc = random.choice(OTP_SERVICES)
        code = random.randint(100000, 999999)
        subject = f"Your {svc} verification code"
        body = (f"Your one-time verification code is {code}. This code will expire in 10 minutes. "
                f"If you did not request this code, you can safely ignore this email.")
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows

# ---------- Legit: modern SaaS product notifications (label 0) ----------
SAAS = ["Notion", "Figma", "Canva", "1Password", "Asana", "Trello", "Airtable", "Miro", "Loom", "ClickUp"]
def gen_saas_rows(n):
    rows = []
    for _ in range(n):
        svc = random.choice(SAAS)
        subject = random.choice([
            "Your weekly summary is ready", "A teammate mentioned you", "Your export is ready to download",
            "Your workspace activity this week",
        ])
        body = (f"Here's your update from {svc}. A teammate left a comment on a shared item. "
                f"Open {svc} to view the latest changes and reply.")
        rows.append({"text": f"{subject} {body}", "label": 0})
    return rows

def main():
    rows = gen_job_scam_rows(80) + gen_otp_rows(80) + gen_saas_rows(60)
    random.shuffle(rows)
    df = pd.DataFrame(rows)
    df.to_csv("ml/augment_synthetic_2.csv", index=False)
    print("Wrote ml/augment_synthetic_2.csv rows:", len(df), df.label.value_counts().to_dict())

if __name__ == "__main__":
    main()
