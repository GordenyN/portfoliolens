import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";


const INITIAL_NODES = [
  { id: "AAPL", sector: "Tech",    weight: 0.30, sentiment: 0.72, trend: +0.04, price: "189.42",  change: "+2.1%" },
  { id: "NVDA", sector: "Tech",    weight: 0.25, sentiment: 0.91, trend: +0.08, price: "924.17",  change: "+5.3%" },
  { id: "BTC",  sector: "Crypto",  weight: 0.20, sentiment: 0.88, trend: +0.06, price: "121,440", change: "+3.8%" },
  { id: "TSLA", sector: "Auto/EV", weight: 0.15, sentiment: 0.38, trend: -0.05, price: "241.89",  change: "-4.2%" },
  { id: "AMZN", sector: "Retail",  weight: 0.10, sentiment: 0.61, trend: +0.01, price: "198.77",  change: "+0.9%" },
];

const INITIAL_LINKS = [
  { source: "AAPL", target: "NVDA", strength: 0.82, reason: "AI chip supply chain" },
  { source: "AAPL", target: "AMZN", strength: 0.61, reason: "Cloud & services competition" },
  { source: "NVDA", target: "TSLA", strength: 0.54, reason: "Autonomous driving AI" },
  { source: "NVDA", target: "AMZN", strength: 0.71, reason: "AWS GPU infrastructure" },
  { source: "BTC",  target: "TSLA", strength: 0.48, reason: "Musk crypto sentiment" },
  { source: "AAPL", target: "TSLA", strength: 0.39, reason: "EV & consumer tech overlap" },
  { source: "BTC",  target: "AMZN", strength: 0.35, reason: "Digital payments macro" },
];

const SECTOR_COLORS = { "Tech": "#4e9fff", "Crypto": "#f7b731", "Auto/EV": "#ff6b9d", "Retail": "#a29bfe", "Energy": "#00d4aa", "Finance": "#fd79a8" };
const TICKER_PALETTE = ["#4e9fff", "#00d4aa", "#f7b731", "#ff6b9d", "#a29bfe", "#fd79a8", "#55efc4", "#fdcb6e"];
const SC = (s) => s >= 0.70 ? "#00d4aa" : s >= 0.50 ? "#f7b731" : "#ff4d6d";
const SL = (s) => s >= 0.70 ? "Bullish" : s >= 0.50 ? "Neutral" : "Bearish";
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const tickerColor = (id, nodes) => SECTOR_COLORS[nodes.find(n => n.id === id)?.sector] || "#7a8499";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050709; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #050709; }
  ::-webkit-scrollbar-thumb { background: #1a2235; border-radius: 2px; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideR   { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
  @keyframes spin     { to   { transform: rotate(360deg); } }
  @keyframes pulse-r  { 0%,100% { transform:scale(1); opacity:.35; } 50% { transform:scale(1.08); opacity:.15; } }
  @keyframes shimmer  { 0% { background-position:-400px 0; } 100% { background-position:400px 0; } }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .slide-r { animation: slideR 0.25s ease both; }
  .pulse-ring { animation: pulse-r 3s ease-in-out infinite; }
  .nav-tab { background:none; border:none; cursor:pointer; padding:0 4px; font-family:'DM Mono',monospace; font-size:11px; font-weight:700; letter-spacing:.08em; transition:all .15s; display:flex; align-items:center; gap:6px; height:100%; border-bottom:2px solid transparent; }
  .nav-tab:hover { color:#e8ecf5; }
  .nav-tab.active { border-bottom-color:#4e9fff; color:#e8ecf5; }
  .icon-btn { background:#0e1421; border:1px solid #1a2235; color:#7a8499; border-radius:6px; padding:0 12px; height:30px; cursor:pointer; font-size:11px; font-family:'DM Mono',monospace; transition:all .15s; display:flex; align-items:center; gap:5px; white-space:nowrap; }
  .icon-btn:hover { background:#1a2235; color:#e8ecf5; }
  .icon-btn.active { background:#4e9fff15; border-color:#4e9fff44; color:#4e9fff; }
  .ticker-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:5px; font-family:'DM Mono',monospace; font-size:11px; font-weight:700; cursor:pointer; transition:all .15s; }
  .add-input { background:#0c1018; border:1px solid #1a2235; color:#e8ecf5; border-radius:6px; padding:0 10px; height:30px; font-family:'DM Mono',monospace; font-size:11px; width:82px; outline:none; transition:border-color .15s; }
  .add-input:focus { border-color:#4e9fff55; }
  .add-input::placeholder { color:#2a3245; }
  .tab-btn { background:none; border:none; cursor:pointer; padding:6px 12px; border-radius:6px; font-family:'DM Mono',monospace; font-size:11px; font-weight:600; letter-spacing:.05em; transition:all .15s; }
  .tab-btn:hover { background:#1a2235; }
  input[type=range] { height:3px; border-radius:2px; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function SentimentBar({ score, width = "100%" }) {
  const pct = Math.round(score * 100);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ flex:1, height:3, background:"#1a2235", borderRadius:2, overflow:"hidden", width }}>
        <div style={{ width:`${pct}%`, height:"100%", background:SC(score), borderRadius:2, transition:"width .7s ease" }} />
      </div>
      <span style={{ fontSize:10, color:SC(score), fontFamily:"'DM Mono',monospace", minWidth:28 }}>{pct}%</span>
    </div>
  );
}

function NewsCard({ article, delay = 0 }) {
  const isPos = article.sentiment === "positive";
  const sc = isPos ? "#00d4aa" : "#ff4d6d";
  return (
    <div className="fade-up" style={{ animationDelay:`${delay}ms`, background:"#0b0f1a", border:"1px solid #1a2235", borderLeft:`3px solid ${sc}`, borderRadius:9, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, marginBottom:8 }}>
        <h4 style={{ margin:0, fontSize:13, fontWeight:600, color:"#e8ecf5", lineHeight:1.4, fontFamily:"'Sora',sans-serif" }}>{article.title}</h4>
        <span style={{ flexShrink:0, background:`${sc}15`, color:sc, borderRadius:4, padding:"2px 7px", fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
          {isPos ? "↑" : "↓"} {isPos ? "Bullish" : "Bearish"}
        </span>
      </div>
      <p style={{ margin:"0 0 10px", fontSize:12, color:"#6a7589", lineHeight:1.65 }}>{article.summary}</p>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#3a4868", fontFamily:"'DM Mono',monospace" }}>{article.source}</span>
          <span style={{ fontSize:10, color:"#3a4868" }}>·</span>
          <span style={{ fontSize:10, color:"#3a4868", fontFamily:"'DM Mono',monospace" }}>{article.date}</span>
        </div>
        <SentimentBar score={article.score} />
      </div>
    </div>
  );
}

function Spinner({ label = "QUERYING QDRANT..." }) {
  return (
    <div style={{ textAlign:"center", padding:"56px 0" }}>
      <div style={{ display:"inline-block", width:32, height:32, border:"2.5px solid #1a2235", borderTopColor:"#4e9fff", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
      <p style={{ color:"#3a4868", marginTop:14, fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:".1em" }}>{label}</p>
    </div>
  );
}

function DigestPanel({ digest, loading }) {
  if (loading) return <Spinner label="GEMINI GENERATING DIGEST..." />;
  if (!digest) return <p style={{ color:"#3a4868", fontSize:12, fontFamily:"'DM Mono',monospace" }}>Add tickers to generate digest</p>;
  return (
    <div className="fade-up">
      {digest.split("\n\n").map((para, i) => (
        <p key={i} style={{ margin:"0 0 13px", fontSize:13, color:"#8a93a8", lineHeight:1.75 }}>
          {para.split(/\*\*(.*?)\*\*/g).map((seg, j) =>
            j % 2 === 1 ? <strong key={j} style={{ color:"#e8ecf5", fontWeight:600 }}>{seg}</strong> : seg
          )}
        </p>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 1 — RISK VIBE MAP (D3 Force Graph)
// ═══════════════════════════════════════════════════════════════════════════════

function WeightEditor({ nodes, onUpdate }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {nodes.map(n => {
        const color = SECTOR_COLORS[n.sector] || "#7a8499";
        const pct = Math.round(n.weight * 100);
        return (
          <div key={n.id}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color, fontWeight:700 }}>{n.id}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#7a8499" }}>{pct}%</span>
            </div>
            <input type="range" min={0} max={50} value={pct}
              onChange={e => onUpdate(n.id, parseInt(e.target.value) / 100)}
              style={{ width:"100%", accentColor:color, cursor:"pointer" }} />
          </div>
        );
      })}
      <div style={{ marginTop:6, padding:"10px 12px", background:"#0e1421", borderRadius:7, border:"1px solid #1a2235" }}>
        <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".1em", marginBottom:6 }}>NODE SIZE = WEIGHT</div>
        <div style={{ fontSize:10, color:"#4a5568", lineHeight:1.6 }}>Drag sliders to simulate rebalancing. Graph updates live.</div>
      </div>
    </div>
  );
}

function GraphNewsSidebar({ ticker, nodes, newsData, onClose }) {
  if (!ticker) return null;
  const articles = newsData[ticker] || [];
  const color = tickerColor(ticker, nodes);
  return (
    <div className="slide-r" style={{ width:320, borderLeft:"1px solid #1a2235", display:"flex", flexDirection:"column", flexShrink:0, background:"#050709" }}>
      <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid #1a2235", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:17, fontWeight:700, color }}>{ticker}</div>
          <div style={{ fontSize:9, color:"#3a4868", letterSpacing:".1em", marginTop:2 }}>SEMANTIC NEWS · QDRANT</div>
        </div>
        <button onClick={onClose} className="icon-btn" style={{ width:26, height:26, padding:0, justifyContent:"center", fontSize:14 }}>×</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:10 }}>
        {articles.length === 0
          ? <p style={{ color:"#3a4868", fontSize:11, fontFamily:"'DM Mono',monospace", padding:"20px 0" }}>No articles indexed yet</p>
          : articles.map((a, i) => <NewsCard key={a.id} article={a} delay={i * 60} />)
        }
      </div>
    </div>
  );
}

function LinkTooltip({ link }) {
  if (!link) return null;
  const src = link.source?.id || link.source;
  const tgt = link.target?.id || link.target;
  return (
    <div style={{ position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", background:"#0b0f1a", border:"1px solid #1a2235", borderRadius:8, padding:"9px 16px", display:"flex", alignItems:"center", gap:12, pointerEvents:"none", zIndex:20, boxShadow:"0 8px 32px rgba(0,0,0,.55)" }} className="fade-up">
      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#4e9fff", fontWeight:700 }}>{src} ↔ {tgt}</span>
      <span style={{ width:1, height:12, background:"#1a2235" }} />
      <span style={{ fontSize:11, color:"#7a8499" }}>{link.reason}</span>
      <span style={{ width:1, height:12, background:"#1a2235" }} />
      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#4e9fff" }}>{Math.round((link.strength||0)*100)}% similar</span>
    </div>
  );
}

function ForceGraph({ nodes, links, onNodeClick, setHoveredLink }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const w = el.clientWidth || 800;
    const h = el.clientHeight || 600;
    const svg = d3.select(el);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    // Grid
    const pat = defs.append("pattern").attr("id","pl-grid").attr("width",44).attr("height",44).attr("patternUnits","userSpaceOnUse");
    pat.append("path").attr("d","M 44 0 L 0 0 0 44").attr("fill","none").attr("stroke","#0d1120").attr("stroke-width",1);
    svg.append("rect").attr("width",w).attr("height",h).attr("fill","url(#pl-grid)");
    // Glow
    const glow = defs.append("filter").attr("id","pl-glow");
    glow.append("feGaussianBlur").attr("stdDeviation","5").attr("result","blur");
    const fm = glow.append("feMerge"); fm.append("feMergeNode").attr("in","blur"); fm.append("feMergeNode").attr("in","SourceGraphic");

    const g = svg.append("g");
    const zoom = d3.zoom().scaleExtent([0.35, 3]).on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom);

    const ns = nodes.map(d => ({ ...d }));
    const ls = links.map(d => ({ ...d }));

    const sim = d3.forceSimulation(ns)
      .force("link", d3.forceLink(ls).id(d => d.id).distance(d => 200 - d.strength * 90).strength(d => d.strength * 0.55))
      .force("charge", d3.forceManyBody().strength(-480))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide(d => 38 + d.weight * 85));

    // Links
    const link = g.append("g").selectAll("line").data(ls).join("line")
      .attr("stroke-width", d => 1 + d.strength * 4.5)
      .attr("stroke", d => `rgba(78,159,255,${0.12 + d.strength * 0.38})`)
      .attr("stroke-dasharray", d => d.strength < 0.5 ? "5,5" : "none")
      .style("cursor","pointer")
      .on("mouseenter", (_, d) => setHoveredLink(d))
      .on("mouseleave", () => setHoveredLink(null));

    const linkLbl = g.append("g").selectAll("text").data(ls).join("text")
      .attr("text-anchor","middle").attr("font-family","'DM Mono',monospace").attr("font-size",9)
      .attr("fill","rgba(78,159,255,.45)").text(d => `${Math.round(d.strength*100)}%`);

    // Nodes
    const nodeG = g.append("g").selectAll("g").data(ns).join("g")
      .style("cursor","pointer")
      .call(d3.drag()
        .on("start",(e,d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on("drag", (e,d) => { d.fx=e.x; d.fy=e.y; })
        .on("end",  (e,d) => { if (!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }))
      .on("click",(e,d) => { e.stopPropagation(); onNodeClick(d.id); });

    // Rings
    nodeG.append("circle").attr("class","pulse-ring")
      .attr("r", d => 30 + d.weight * 75).attr("fill","none")
      .attr("stroke", d => SC(d.sentiment)).attr("stroke-width",1).attr("stroke-opacity",.25);
    // Sector halo
    nodeG.append("circle").attr("r", d => 22 + d.weight * 58)
      .attr("fill", d => `${SECTOR_COLORS[d.sector]||"#7a8499"}0e`)
      .attr("stroke", d => `${SECTOR_COLORS[d.sector]||"#7a8499"}28`).attr("stroke-width",1.5);
    // Main fill
    nodeG.append("circle").attr("r", d => 18 + d.weight * 44)
      .attr("fill", d => `${SC(d.sentiment)}14`)
      .attr("stroke", d => SC(d.sentiment)).attr("stroke-width",2.5)
      .attr("filter","url(#pl-glow)");
    // Sentiment arc
    nodeG.append("path").attr("d", d => {
      const r = 18 + d.weight * 44;
      const a = d.sentiment * 2 * Math.PI - Math.PI / 2;
      const lf = d.sentiment > .5 ? 1 : 0;
      return `M 0 ${-r} A ${r} ${r} 0 ${lf} 1 ${r*Math.cos(a)} ${r*Math.sin(a)}`;
    }).attr("fill","none").attr("stroke", d => SC(d.sentiment)).attr("stroke-width",3.5)
      .attr("stroke-linecap","round").attr("filter","url(#pl-glow)");
    // Ticker text
    nodeG.append("text").attr("text-anchor","middle").attr("dy",".35em")
      .attr("font-family","'DM Mono',monospace").attr("font-size", d => 10 + d.weight * 10)
      .attr("font-weight","700").attr("fill", d => SC(d.sentiment)).text(d => d.id);
    // Change badge
    nodeG.append("text").attr("text-anchor","middle").attr("dy", d => 16 + d.weight * 22)
      .attr("font-family","'DM Mono',monospace").attr("font-size",9).attr("font-weight","600")
      .attr("fill", d => d.trend >= 0 ? "#00d4aa" : "#ff4d6d").text(d => d.change);
    // Sector label
    nodeG.append("text").attr("text-anchor","middle").attr("dy", d => -(24 + d.weight * 42))
      .attr("font-family","'DM Mono',monospace").attr("font-size",8)
      .attr("fill", d => `${SECTOR_COLORS[d.sector]||"#7a8499"}bb`).text(d => d.sector.toUpperCase());

    sim.on("tick", () => {
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      linkLbl.attr("x",d=>(d.source.x+d.target.x)/2).attr("y",d=>(d.source.y+d.target.y)/2);
      nodeG.attr("transform",d=>`translate(${d.x},${d.y})`);
    });

    svg.on("click", () => onNodeClick(null));
    return () => sim.stop();
  }, [nodes, links]);

  return <svg ref={svgRef} style={{ width:"100%", height:"100%", background:"transparent" }} />;
}

function RiskVibeMapView({ nodes, links, onWeightUpdate, onAddTicker, onRemoveTicker, newsData }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredLink, setHoveredLink]   = useState(null);
  const [showWeights, setShowWeights]   = useState(false);
  const [addInput, setAddInput]         = useState("");

  const handleNodeClick = useCallback(id => setSelectedNode(prev => prev === id ? null : id), []);
  const stableSetHoveredLink = useCallback((link) => setHoveredLink(link), []);

  const handleAdd = () => {
    const t = addInput.trim().toUpperCase();
    if (t && !nodes.find(n => n.id === t)) { onAddTicker(t); setAddInput(""); }
  };

  const selNode = nodes.find(n => n.id === selectedNode);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Toolbar */}
      <div style={{ padding:"0 20px", height:46, borderBottom:"1px solid #1a2235", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          {/* Legend */}
          {[["#00d4aa","Bullish ≥70%"],["#f7b731","Neutral"],["#ff4d6d","Bearish <50%"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#4a5568" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:c, display:"block" }} />{l}
            </div>
          ))}
          <span style={{ width:1, height:14, background:"#1a2235" }} />
          {/* Add */}
          <input className="add-input" value={addInput} onChange={e=>setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&handleAdd()} placeholder="+ TICKER" maxLength={6} />
          <button className="icon-btn" onClick={handleAdd}>Add</button>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className={`icon-btn ${showWeights?"active":""}`} onClick={()=>setShowWeights(s=>!s)}>⊞ Weights</button>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#3a4868", fontFamily:"'DM Mono',monospace" }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"#4e9fff", animation:"pulse-r 2s infinite" }} />LIVE
          </div>
        </div>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        {/* Weights sidebar */}
        {showWeights && (
          <div className="slide-r" style={{ width:210, borderRight:"1px solid #1a2235", padding:"16px 14px", overflowY:"auto", flexShrink:0 }}>
            <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".12em", marginBottom:14 }}>PORTFOLIO WEIGHTS</div>
            <WeightEditor nodes={nodes} onUpdate={onWeightUpdate} />
          </div>
        )}

{/* Graph area */}
         <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
           <ForceGraph nodes={nodes} links={links} onNodeClick={handleNodeClick} setHoveredLink={stableSetHoveredLink} />
           <LinkTooltip link={hoveredLink} />

          {/* Hint bar */}
          {!selectedNode && !hoveredLink && (
            <div style={{ position:"absolute", bottom:18, left:"50%", transform:"translateX(-50%)", display:"flex", gap:24, pointerEvents:"none" }}>
              {[["Click node","Open news"],["Hover edge","See risk link"],["Drag node","Reposition"],["Scroll","Zoom"]].map(([a,d])=>(
                <div key={a} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#4e9fff", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{a}</div>
                  <div style={{ fontSize:9, color:"#3a4868", marginTop:2 }}>{d}</div>
                </div>
              ))}
            </div>
          )}

          {/* Selected node card */}
          {selNode && (
            <div className="fade-up" style={{ position:"absolute", bottom:18, left:18, background:"#070a10", border:`1px solid ${tickerColor(selNode.id,nodes)}44`, borderRadius:10, padding:"13px 16px", minWidth:260 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:16, fontWeight:700, color:tickerColor(selNode.id,nodes) }}>{selNode.id}</div>
                  <div style={{ fontSize:10, color:"#4a5568", marginTop:2 }}>{selNode.sector} · {Math.round(selNode.weight*100)}% weight</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#e8ecf5" }}>${selNode.price}</div>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:selNode.trend>=0?"#00d4aa":"#ff4d6d" }}>{selNode.change}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                {[
                  ["SENTIMENT", `${SL(selNode.sentiment)} · ${Math.round(selNode.sentiment*100)}%`, SC(selNode.sentiment)],
                  ["RISK LINKS", `${links.filter(l=>l.source===selNode.id||l.target===selNode.id||l.source.id===selNode.id||l.target.id===selNode.id).length} conn.`, "#4e9fff"],
                  ["NEWS", `${(newsData[selNode.id]||[]).length} articles`, "#e8ecf5"],
                ].map(([label, val, color], i) => (
                  <>
                    {i > 0 && <span key={`sep${i}`} style={{ width:1, height:28, background:"#1a2235" }} />}
                    <div key={label}>
                      <div style={{ fontSize:8, color:"#3a4868", fontFamily:"'DM Mono',monospace", marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:12, fontWeight:700, color }}>{val}</div>
                    </div>
                  </>
                ))}
                <button onClick={()=>onRemoveTicker(selNode.id)} className="icon-btn" style={{ marginLeft:"auto", fontSize:10, color:"#ff4d6d", borderColor:"#ff4d6d22" }}>Remove</button>
              </div>
            </div>
          )}
        </div>

        {/* News sidebar for selected node */}
        {selectedNode && <GraphNewsSidebar ticker={selectedNode} nodes={nodes} newsData={newsData} onClose={()=>setSelectedNode(null)} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW 2 — NEWS DASHBOARD + AI DIGEST
// ═══════════════════════════════════════════════════════════════════════════════

function PortfolioOverview({ nodes, newsData }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:10 }}>
      {nodes.map((n, i) => {
        const color = TICKER_PALETTE[i % TICKER_PALETTE.length];
        const sc = SC(n.sentiment);
        return (
          <div key={n.id} className="fade-up" style={{ animationDelay:`${i*60}ms`, background:"#0b0f1a", border:`1px solid ${color}28`, borderRadius:9, padding:"13px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:14, fontWeight:700, color }}>{n.id}</span>
              <span style={{ fontSize:16 }}>{n.sentiment>=.7?"📈":n.sentiment<.5?"📉":"📊"}</span>
            </div>
            <div style={{ fontSize:11, color:sc, fontWeight:600, marginBottom:6 }}>{SL(n.sentiment)}</div>
            <SentimentBar score={n.sentiment} />
            <div style={{ fontSize:10, color:"#3a4868", marginTop:7, fontFamily:"'DM Mono',monospace" }}>{(newsData[n.id]||[]).length} articles</div>
          </div>
        );
      })}
    </div>
  );
}

function NewsDashboardView({ nodes, onAddTicker, onRemoveTicker, newsData, digest, digestLoading }) {
  const [activeTab, setActiveTab] = useState("all");
  const [addInput, setAddInput]   = useState("");
  const tickers = nodes.map(n => n.id);

  const allNews = tickers.flatMap(t => (newsData[t]||[]).map(a => ({ ...a, ticker: t })));
  const displayNews = activeTab === "all" ? allNews : (newsData[activeTab]||[]).map(a => ({ ...a, ticker: activeTab }));
  const portfolioSentiment = avg(allNews.map(a => a.score));

  const handleAdd = () => {
    const t = addInput.trim().toUpperCase();
    if (t && !nodes.find(n => n.id === t)) { onAddTicker(t); setAddInput(""); }
  };

  const stats = [
    { label:"PORTFOLIO SIGNAL", value: SL(portfolioSentiment), color: SC(portfolioSentiment), sub:`${Math.round(portfolioSentiment*100)}% avg score` },
    { label:"TOTAL ARTICLES",  value: allNews.length, color:"#4e9fff", sub:"from Qdrant" },
    { label:"BULLISH",  value: allNews.filter(a=>a.sentiment==="positive").length, color:"#00d4aa", sub:`${allNews.length?Math.round(allNews.filter(a=>a.sentiment==="positive").length/allNews.length*100):0}% of flow` },
    { label:"BEARISH",  value: allNews.filter(a=>a.sentiment==="negative").length, color:"#ff4d6d", sub:`watch closely` },
  ];

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      {/* Ticker row */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {nodes.map((n, i) => {
          const color = TICKER_PALETTE[i % TICKER_PALETTE.length];
          return (
            <span key={n.id} style={{ display:"inline-flex", alignItems:"center", gap:5, background:`${color}14`, border:`1px solid ${color}44`, color, borderRadius:5, padding:"3px 9px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
              {n.id}
              <button onClick={()=>onRemoveTicker(n.id)} style={{ background:"none", border:"none", color:`${color}70`, cursor:"pointer", padding:0, fontSize:13, lineHeight:1 }}>×</button>
            </span>
          );
        })}
        <input className="add-input" value={addInput} onChange={e=>setAddInput(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&handleAdd()} placeholder="+ TICKER" maxLength={6} />
        <button className="icon-btn" onClick={handleAdd}>Add</button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:10, marginBottom:20 }}>
        {stats.map((s,i) => (
          <div key={i} className="fade-up" style={{ animationDelay:`${i*50}ms`, background:"#0b0f1a", border:"1px solid #1a2235", borderRadius:9, padding:"14px 16px" }}>
            <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".1em", marginBottom:7 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:s.color, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#4a5568", marginTop:5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:18, alignItems:"start" }}>

        {/* Left: news */}
        <div>
          <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".1em", marginBottom:12 }}>TICKER SENTIMENT</div>
          <div style={{ marginBottom:18 }}><PortfolioOverview nodes={nodes} newsData={newsData} /></div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:14, flexWrap:"wrap" }}>
            <button className="tab-btn" onClick={()=>setActiveTab("all")}
              style={{ color:activeTab==="all"?"#e8ecf5":"#4a5568", background:activeTab==="all"?"#1a2235":"none" }}>
              ALL ({allNews.length})
            </button>
            {tickers.map((t,i) => (
              <button key={t} className="tab-btn" onClick={()=>setActiveTab(t)}
                style={{ color:activeTab===t?TICKER_PALETTE[i%TICKER_PALETTE.length]:"#4a5568", background:activeTab===t?`${TICKER_PALETTE[i%TICKER_PALETTE.length]}15`:"none" }}>
                {t} ({(newsData[t]||[]).length})
              </button>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {displayNews.map((article, i) => (
              <div key={article.id}>
                {activeTab==="all" && (i===0||displayNews[i-1].ticker!==article.ticker) && (
                  <div style={{ fontSize:9, color:TICKER_PALETTE[tickers.indexOf(article.ticker)%TICKER_PALETTE.length], fontFamily:"'DM Mono',monospace", letterSpacing:".1em", marginBottom:5, marginTop:i>0?12:0 }}>
                    ── {article.ticker}
                  </div>
                )}
                <NewsCard article={article} color={TICKER_PALETTE[tickers.indexOf(article.ticker)%TICKER_PALETTE.length]} delay={i*40} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: digest + qdrant info */}
        <div style={{ position:"sticky", top:0, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"#0b0f1a", border:"1px solid #1a2235", borderRadius:11, padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <div style={{ width:26, height:26, background:"linear-gradient(135deg,#4e9fff,#00d4aa)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>✦</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#e8ecf5" }}>AI Portfolio Digest</div>
                <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace" }}>GEMINI · POWERED BY QDRANT</div>
              </div>
            </div>
            <DigestPanel digest={digest} loading={digestLoading} />
          </div>

          {/* Qdrant info */}
          <div style={{ background:"#070a10", border:"1px solid #1a2235", borderRadius:9, padding:"12px 14px" }}>
            <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".1em", marginBottom:10 }}>VECTOR SEARCH CONFIG</div>
            {[["Engine","Qdrant Cloud"],["Model","text-embedding-004"],["Collection","financial_news"],["Distance","Cosine"],["Dedup threshold","0.85"],["Orchestration","n8n"]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:10, color:"#4a5568" }}>{l}</span>
                <span style={{ fontSize:10, color:"#7a8499", fontFamily:"'DM Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — navigation shell + shared portfolio state
// ═══════════════════════════════════════════════════════════════════════════════

export default function PortfolioLens() {
  const [view, setView]       = useState("map");
  const [nodes, setNodes]     = useState(INITIAL_NODES);
  const [links]               = useState(INITIAL_LINKS);
  const [n8nUrl, setN8nUrl]   = useState("/api/proxy"); // Vercel proxy
  const [showCfg, setShowCfg] = useState(false);
  const [newsData, setNewsData] = useState({});
  const [digest, setDigest]     = useState("");
  const [digestLoading, setDigestLoading] = useState(false);
  const tickerKey = nodes.map(n => n.id).join(",");

  useEffect(() => {
    if (!tickerKey) return;
    setDigestLoading(true);
    fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nodes.map(n => n.id))
    })
      .then(r => r.json().catch(() => ({})))
      .then(data => {
        const newsMap = {};
        if (data.newsMap) {
          Object.entries(data.newsMap).forEach(([ticker, articles]) => {
            newsMap[ticker] = articles.map((a, i) => ({
              id: i,
              title: a.title || a.name,
              url: a.url || "#",
              date: a.date || new Date().toISOString().split("T")[0],
              sentiment: a.sentiment || a.tone || "neutral",
              score: a.score || a.sentiment_score || 0.5,
              summary: a.summary || a.text || "",
              source: a.source || (a.url ? a.url.split("//")[1]?.split("/")[0]?.replace("www.", "") || "Unknown" : "Unknown")
            }));
          });
        }
        setNewsData(newsMap);
        setDigest(data.digest || data.output || "");
      })
      .catch(() => { setNewsData({}); setDigest(""); })
      .finally(() => setDigestLoading(false));
  }, [tickerKey, n8nUrl]);

  const handleWeightUpdate = (id, w) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, weight: w } : n));

  const handleAddTicker = (id) => {
    if (nodes.find(n => n.id === id)) return;
    setNodes(prev => [...prev, { id, sector:"Tech", weight:0.10, sentiment:0.55, trend:0, price:"—", change:"±0%" }]);
  };

  const handleRemoveTicker = (id) =>
    setNodes(prev => prev.filter(n => n.id !== id));

  const portfolioSentiment = avg(nodes.map(n => n.sentiment));
  const sc = SC(portfolioSentiment);

  return (
    <div style={{ height:"100vh", background:"#050709", display:"flex", flexDirection:"column", fontFamily:"'Sora',sans-serif", color:"#e8ecf5", overflow:"hidden" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Top nav ── */}
      <div style={{ height:52, borderBottom:"1px solid #1a2235", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", flexShrink:0 }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="#4e9fff" strokeWidth="1.5"/>
            <circle cx="10" cy="10" r="4" fill="none" stroke="#4e9fff" strokeWidth="1"/>
            <circle cx="10" cy="10" r="1.5" fill="#4e9fff"/>
            {[[10,1,10,5],[10,15,10,19],[1,10,5,10],[15,10,19,10]].map((c,i)=>(
              <line key={i} x1={c[0]} y1={c[1]} x2={c[2]} y2={c[3]} stroke="#4e9fff" strokeWidth="1.5"/>
            ))}
          </svg>
          <div>
            <div style={{ fontSize:13, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1 }}>PortfolioLens</div>
            <div style={{ fontSize:9, color:"#3a4868", fontFamily:"'DM Mono',monospace", letterSpacing:".1em" }}>QDRANT · GEMINI · N8N</div>
          </div>

          {/* Nav tabs */}
          <div style={{ display:"flex", marginLeft:16, height:52 }}>
            {[["map","◈  Risk Vibe Map"],["news","⊞  News Dashboard"]].map(([v,label])=>(
              <button key={v} className={`nav-tab ${view===v?"active":""}`}
                onClick={()=>setView(v)}
                style={{ color:view===v?"#e8ecf5":"#4a5568", marginRight:4, paddingLeft:14, paddingRight:14 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: portfolio summary + controls */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* Portfolio signal pill */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:`${sc}10`, border:`1px solid ${sc}30`, borderRadius:7, padding:"5px 12px" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:sc, display:"block" }} />
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:sc, fontWeight:700 }}>{SL(portfolioSentiment)}</span>
            <span style={{ fontSize:11, color:`${sc}80`, fontFamily:"'DM Mono',monospace" }}>{Math.round(portfolioSentiment*100)}%</span>
          </div>
          {/* Ticker count */}
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#4a5568" }}>
            {nodes.length} positions
          </div>
          {/* n8n config */}
          <button className={`icon-btn ${showCfg?"active":""}`} onClick={()=>setShowCfg(s=>!s)}>⚙ n8n</button>
          {/* Live dot */}
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#00d4aa", display:"block", animation:"pulse-r 2s infinite" }} />
            <span style={{ fontSize:10, color:"#3a4868", fontFamily:"'DM Mono',monospace" }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* n8n config bar */}
      {showCfg && (
        <div className="fade-up" style={{ background:"#070a10", borderBottom:"1px solid #1a2235", padding:"10px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:10, color:"#3a4868", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>N8N WEBHOOK URL</span>
          <input value={n8nUrl} onChange={e=>setN8nUrl(e.target.value)}
            style={{ flex:1, background:"#0b0f1a", border:"1px solid #1a2235", color:"#7a8499", borderRadius:6, padding:"6px 12px", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none" }} />
          <span style={{ fontSize:10, color:"#3a4868", whiteSpace:"nowrap" }}>Live data from n8n webhook</span>
        </div>
      )}

      {/* View content */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
{view === "map"
           ? <RiskVibeMapView  nodes={nodes} links={links} onWeightUpdate={handleWeightUpdate} onAddTicker={handleAddTicker} onRemoveTicker={handleRemoveTicker} newsData={newsData} />
           : <NewsDashboardView nodes={nodes} onAddTicker={handleAddTicker} onRemoveTicker={handleRemoveTicker} newsData={newsData} digest={digest} digestLoading={digestLoading} />
         }
      </div>
    </div>
  );
}