export function StatCard({title, value, color}:{title:string; value:number; color?:string}){
  return (
    <div style={{background:'var(--pg-card)', borderRadius:16, padding:16}}>
      <div style={{fontSize:13, opacity:.8}}>{title}</div>
      <div style={{fontSize:32, fontWeight:800, color: color || 'var(--pg-primary)'}}>{value}</div>
    </div>
  );
}