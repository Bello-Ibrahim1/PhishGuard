import re
def extract_email_features(data):
    subj=(data.get('subject') or '').lower()
    body=(data.get('body_snippet') or '').lower()
    text=subj+' '+body
    links=data.get('links',[])
    attachments=data.get('attachments',[])
    feats={
        'urgent': int(bool(re.search(r'\b(urgent|immediately|verify now|final notice|overdue)\b', text))),
        'num_links': len(links),
        'has_shortener': int(any('bit.ly' in (l.get('href') or '') or 'tinyurl' in (l.get('href') or '') for l in links)),
        'macro_attach': int(any((a.get('filename','').lower().endswith('.docm') or a.get('filename','').lower().endswith('.xlsm')) for a in attachments)),
        'num_attachments': len(attachments),
    }
    return feats
