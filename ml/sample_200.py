import pandas as pd, os
SRC=os.path.join(os.path.dirname(__file__),'raw.csv')
DST=os.path.join(os.path.dirname(__file__),'raw_200.csv')
df=pd.read_csv(SRC)
legit=df[df.label==0].head(100)
phish=df[df.label==1].head(100)
tiny=pd.concat([legit,phish]).sample(frac=1,random_state=42)
tiny.to_csv(DST,index=False)
print('Wrote',DST,'rows:',len(tiny))
