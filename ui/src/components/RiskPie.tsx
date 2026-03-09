import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
export function RiskPie({data}:{data:{name:string; value:number}[]}){
  const COLORS = ['#22c55e','#eab308','#ef4444'];
  return (
    <div style={{background:'var(--pg-card)', borderRadius:16, padding:16}}>
      <h3 style={{margin:0, marginBottom:8}}>Risk Breakdown (Pie)</h3>
      <div style={{width:'100%', height:260}}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
              {data.map((_, i)=>(<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}