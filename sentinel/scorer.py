import os, joblib
MODEL_PATH=os.path.join(os.path.dirname(__file__),'model.pkl')

def heuristic_score(feats):
    score,reasons=0,[]
    if feats.get('urgent'): score+=2; reasons.append('Urgent language detected')
    if feats.get('macro_attach'): score+=3; reasons.append('Macro-enabled attachment')
    if feats.get('has_shortener'): score+=1; reasons.append('URL shortener detected')
    if feats.get('num_links',0)>2: score+=1; reasons.append('Multiple links in message')
    while len(reasons)<3: reasons.append('No further suspicious pattern found.')
    return score,reasons

def ml_predict(feats):
    if os.path.exists(MODEL_PATH):
        model=joblib.load(MODEL_PATH)
        X=[[feats.get('urgent',0),feats.get('num_links',0),feats.get('has_shortener',0),feats.get('macro_attach',0),feats.get('num_attachments',0)]]
        pred=model.predict(X)[0]
        prob=max(model.predict_proba(X)[0])
        return int(pred), float(prob)
    return None,None
