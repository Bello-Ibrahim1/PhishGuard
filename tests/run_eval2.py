import json, urllib.request
from adversarial_eval_2 import CASES
API = "http://127.0.0.1:8000"
def score(sender, subject, body):
    payload = json.dumps({"subject": subject, "body": body, "sender": sender, "use_openai": False}).encode()
    req = urllib.request.Request(API + "/email/score", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())
def risk_to_pred(risk): return 0 if risk == "Low" else 1
def main():
    tp=fp=tn=fn=0; rows=[]
    for label, sender, subject, body in CASES:
        out = score(sender, subject, body)
        pred = risk_to_pred(out["risk"])
        if label==1 and pred==1: tp+=1
        elif label==0 and pred==1: fp+=1
        elif label==0 and pred==0: tn+=1
        elif label==1 and pred==0: fn+=1
        rows.append((label, pred, out["risk"], out.get("threat_pct"), sender[:35], subject[:45], pred==label))
    print(f"{'label':5} {'pred':5} {'risk':7} {'pct':4} {'sender':35} {'subject':45} ok")
    for r in rows:
        print(f"{r[0]:<5} {r[1]:<5} {r[2]:<7} {r[3]:<4} {r[4]:<35} {r[5]:<45} {'OK' if r[6] else '!! WRONG'}")
    n=len(rows); acc=(tp+tn)/n
    prec = tp/(tp+fp) if (tp+fp) else 0
    rec = tp/(tp+fn) if (tp+fn) else 0
    f1 = 2*prec*rec/(prec+rec) if (prec+rec) else 0
    print(f"\nN={n} TP={tp} FP={fp} TN={tn} FN={fn}")
    print(f"Accuracy={acc:.3f} Precision={prec:.3f} Recall={rec:.3f} F1={f1:.3f}")
if __name__=="__main__": main()
