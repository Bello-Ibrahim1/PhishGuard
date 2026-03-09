import pandas as pd, sys
from sentinel.features import extract_email_features
src,dst=sys.argv[1],sys.argv[2]
df=pd.read_csv(src)
rows=[]
for _,r in df.iterrows():
    feats=extract_email_features({'subject':r.get('subject',''),'body_snippet':r.get('body','')})
    feats['label']=int(r['label'])
    rows.append(feats)
pd.DataFrame(rows).to_csv(dst,index=False)
print('Saved',dst)
