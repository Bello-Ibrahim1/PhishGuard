import pandas as pd, sys, os, joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
features_csv=sys.argv[1]
model_out=sys.argv[2]
df=pd.read_csv(features_csv)
X=df[['urgent','num_links','has_shortener','macro_attach','num_attachments']].fillna(0)
y=df['label']
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,random_state=42)
model=RandomForestClassifier(n_estimators=120,random_state=42)
model.fit(Xtr,ytr)
pred=model.predict(Xte)
print(classification_report(yte,pred))
joblib.dump(model,model_out)
print('Saved model to',model_out)
