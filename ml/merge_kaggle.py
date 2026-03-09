import os, glob, pandas as pd
IN_DIR=os.path.join(os.path.dirname(__file__),'..','datasets')
OUT_CSV=os.path.join(os.path.dirname(__file__),'raw.csv')

def normalize_df(df):
    cols={c.lower():c for c in df.columns}
    subject=df[cols.get('subject')] if 'subject' in cols else pd.Series(['']*len(df))
    body=df[cols.get('body')] if 'body' in cols else pd.Series(['']*len(df))
    label=None
    for cand in ['label','spam','is_phishing','phishing']:
        if cand in cols:
            label=df[cols[cand]]; break
    if label is None: label=pd.Series([None]*len(df))
    out=pd.DataFrame({'subject':subject.fillna('').astype(str),'body':body.fillna('').astype(str),'label':label})
    out=out[out['label'].isin([0,1])]
    return out

def main():
    parts=[]
    for p in glob.glob(os.path.join(IN_DIR,'*.csv')):
        try:
            df=pd.read_csv(p)
        except Exception:
            try:
                df=pd.read_csv(p,encoding='latin-1')
            except Exception:
                print('Skip unreadable:',p);continue
        clean=normalize_df(df)
        if len(clean): parts.append(clean)
        print(os.path.basename(p),'->',len(clean))
    if not parts:
        print('No usable CSVs'); return
    out=pd.concat(parts,ignore_index=True)
    out.to_csv(OUT_CSV,index=False); print('Wrote',OUT_CSV,'rows:',len(out))

if __name__=='__main__': main()
