import { useEffect, useState } from "react";
import { fetchSummary, fetchReports, type Summary, type Report } from "./api";
import { TopBar } from "./components/TopBar";
import { StatCard } from "./components/Cards";
import { RiskPie } from "./components/RiskPie";
import { RiskBar } from "./components/RiskBar";
import { ReportsTable } from "./components/ReportsTable";
export default function App(){
  const [sum, setSum] = useState<Summary | null>(null);
  const [items, setItems] = useState<Report[]>([]);
  useEffect(()=>{
    const load = async () => {
      try{
        const [s, r] = await Promise.all([fetchSummary(), fetchReports()]);
        setSum(s); setItems(r);
      }catch(_){}
    };
    load();
    const h = setInterval(load, 2500);
    return ()=> clearInterval(h);
  },[]);
  const data = sum ? [
    { name:"Low", value: sum.by_risk.Low },
    { name:"Medium", value: sum.by_risk.Medium },
    { name:"High", value: sum.by_risk.High },
  ] : [];
  return (
    <div style={{minHeight:'100vh', display:'flex', flexDirection:'column'}}>
      <TopBar />
      <div style={{padding:16, display:'grid', gridTemplateColumns:'repeat(12, minmax(0,1fr))', gap:16}}>
        <div style={{gridColumn:'span 4'}}><StatCard title="Total Scanned" value={sum?.total ?? 0} /></div>
        <div style={{gridColumn:'span 4'}}><StatCard title="Medium Risk" value={sum?.by_risk.Medium ?? 0} color="#eab308" /></div>
        <div style={{gridColumn:'span 4'}}><StatCard title="High Risk" value={sum?.by_risk.High ?? 0} color="#ef4444" /></div>
        <div style={{gridColumn:'span 6'}}><RiskPie data={data} /></div>
        <div style={{gridColumn:'span 6'}}><RiskBar data={data} /></div>
        <div style={{gridColumn:'span 12'}}><ReportsTable items={items} /></div>
      </div>
    </div>
  );
}