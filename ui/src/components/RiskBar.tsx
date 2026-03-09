import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
export function RiskBar({data}:{data:{name:string; value:number}[]}){
  return (
    <div style={{background:'var(--pg-card)', borderRadius:16, padding:16}}>
      <h3 style={{margin:0, marginBottom:8}}>Risk Bars</h3>
      <div style={{width:'100%', height:260}}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--pg-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}