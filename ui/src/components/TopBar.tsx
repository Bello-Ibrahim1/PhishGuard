import hero from "../assets/hero.png";

export function TopBar() {
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px'}}>
      <img src={hero} alt="PhishGuard" style={{width:40, height:'auto'}} />
      <div>
        <div style={{fontWeight:800, fontSize:18}}>PhishGuard — Full Report</div>
        <div style={{opacity:.7, fontSize:12}}>Live summary of scanned emails</div>
      </div>
    </div>
  );
}