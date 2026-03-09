import type { Report } from '../api';
export function ReportsTable({items}:{items:Report[]}){
  return (
    <div style={{background:'var(--pg-card)', borderRadius:16, padding:16}}>
      <h3 style={{marginTop:0}}>Recent Reports ({items.length})</h3>
      <div style={{overflow:'auto', maxHeight:'60vh'}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead style={{position:'sticky', top:0, background:'var(--pg-card)', zIndex:1}}>
            <tr style={{textAlign:'left', opacity:.8}}>
              <th style={{padding:'8px'}}>Time</th>
              <th style={{padding:'8px'}}>Risk</th>
              <th style={{padding:'8px'}}>Sender</th>
              <th style={{padding:'8px'}}>Subject</th>
              <th style={{padding:'8px'}}>Reasons</th>
            </tr>
          </thead>
          <tbody>
            {items.slice().reverse().map((r, idx)=>(
              <tr key={idx} style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                <td style={{padding:'8px', whiteSpace:'nowrap'}}>{r.timestamp?.replace('T',' ').split('.')[0] || ''}</td>
                <td style={{padding:'8px', fontWeight:700, color: r.risk==='High' ? '#ef4444' : r.risk==='Medium' ? '#eab308' : '#22c55e'}}>{r.risk}</td>
                <td style={{padding:'8px'}}>{r.sender || ''}</td>
                <td style={{padding:'8px', maxWidth:380, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.email_subject || ''}</td>
                <td style={{padding:'8px'}}>{(r.reasons||[]).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}