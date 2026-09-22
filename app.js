import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ใส่ Firebase Web App Config ของคุณตรงนี้ */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "iot-139.firebaseapp.com",
  databaseURL: "https://iot-139-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-139",
  storageBucket: "iot-139.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const $ = id => document.getElementById(id);
let historyData = [], latest = null, chart;
const fmt = (v,d=1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "--";
const timeText = ts => ts ? new Date(Number(ts)*1000).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"medium"}) : "ไม่ทราบเวลา";

function setConnection(online){
  const badge=$("connectionBadge");
  badge.className="status-badge "+(online?"online":"offline");
  badge.innerHTML=`<i></i> ${online?"Online":"Offline"}`;
  document.querySelector(".pulse").style.background=online?"#34d399":"#f87171";
}
function values(arr,key){return arr.map(x=>Number(x[key])).filter(Number.isFinite)}
function stats(arr,key){const v=values(arr,key);if(!v.length)return ["--","--","--"];return [fmt(v.reduce((a,b)=>a+b,0)/v.length),fmt(Math.min(...v)),fmt(Math.max(...v))]}
function updateStats(){
  [["temp","temp"],["humi","humi"],["light","light"]].forEach(([id,key])=>{
    const [a,min,max]=stats(historyData,key);
    $(id+"Avg").textContent=a;$(id+"Min").textContent=min;$(id+"Max").textContent=max;
  });
}
function updateAlerts(){
  if(!latest)return;
  const t=Number($("tempThreshold").value),h=Number($("humiThreshold").value),alerts=[];
  if(latest.temp>=t)alerts.push(`อุณหภูมิสูงเกินกำหนด: ${fmt(latest.temp)} °C`);
  if(latest.humi>=h)alerts.push(`ความชื้นสูงเกินกำหนด: ${fmt(latest.humi)} %`);
  $("alertCount").textContent=alerts.length;
  $("alertList").innerHTML=alerts.length?alerts.map(a=>`<div class="alert-item">⚠ ${a}</div>`).join(""):'<div class="empty-alert">✓ ค่าทั้งหมดอยู่ในเกณฑ์ที่กำหนด</div>';
}
function updateInsight(){
  if(!latest)return;
  const t=latest.temp,h=latest.humi,l=latest.light;
  let title="สภาพแวดล้อมอยู่ในเกณฑ์ปกติ",text="ค่าที่ตรวจวัดได้ยังไม่พบความผิดปกติที่สำคัญ";
  if(t>=Number($("tempThreshold").value)){title="อุณหภูมิสูง";text="ควรเพิ่มการระบายอากาศหรือปรับอุณหภูมิภายในห้อง";}
  else if(h>=Number($("humiThreshold").value)){title="ความชื้นสูง";text="ควรตรวจสอบการระบายอากาศและความชื้นสะสม";}
  else if(l<200){title="แสงค่อนข้างน้อย";text="หากกำลังทำงานหรืออ่านหนังสือ อาจเพิ่มแสงสว่างได้";}
  $("insightTitle").textContent=title;$("insightText").textContent=text;
}
function updateLatest(data){
  latest=data;
  $("tempValue").textContent=fmt(data.temp);$("humiValue").textContent=fmt(data.humi);$("lightValue").textContent=fmt(data.light,0);
  $("tempState").textContent=data.temp>=Number($("tempThreshold").value)?"Above threshold":"Current reading";
  $("humiState").textContent=data.humi>=Number($("humiThreshold").value)?"Above threshold":"Current reading";
  $("lightState").textContent=data.light<200?"Low light":"Current reading";
  $("lastUpdate").textContent=timeText(data.timestamp);
  updateAlerts();updateInsight();
}
function drawChart(){
  const selected=Number($("rangeSelect").value), rows=historyData.slice(-selected);
  $("chartEmpty").style.display=rows.length?"none":"grid";
  if(chart)chart.destroy();
  chart=new Chart($("historyChart"),{type:"line",data:{labels:rows.map(x=>new Date(Number(x.timestamp)*1000).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})),datasets:[
    {label:"Temperature",data:rows.map(x=>x.temp),borderColor:"#fb923c",backgroundColor:"#fb923c",tension:.35,pointRadius:0,yAxisID:"y"},
    {label:"Humidity",data:rows.map(x=>x.humi),borderColor:"#38bdf8",backgroundColor:"#38bdf8",tension:.35,pointRadius:0,yAxisID:"y"},
    {label:"Light / 20",data:rows.map(x=>Number(x.light)/20),borderColor:"#facc15",backgroundColor:"#facc15",tension:.35,pointRadius:0,yAxisID:"y"}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false}},scales:{x:{grid:{color:"#1c2939"},ticks:{color:"#64748b",maxTicksLimit:8}},y:{grid:{color:"#1c2939"},ticks:{color:"#64748b"}}}}});
}
function loadFirebase(){
  try{
    const app=initializeApp(firebaseConfig),db=getDatabase(app);
    onValue(ref(db,".info/connected"),snap=>setConnection(snap.val()===true));
    onValue(ref(db,"lab/esp32-01/latest"),snap=>{if(snap.exists())updateLatest(snap.val())});
    onValue(ref(db,"lab/esp32-01/history"),snap=>{
      const raw=snap.val()||{};
      historyData=Object.values(raw).filter(x=>x&&x.timestamp).sort((a,b)=>Number(a.timestamp)-Number(b.timestamp));
      updateStats();drawChart();
      if(historyData.length&&!latest)updateLatest(historyData.at(-1));
    },()=>setConnection(false));
  }catch(err){console.error(err);setConnection(false);$("insightTitle").textContent="ตรวจสอบ Firebase Config";$("insightText").textContent="กรุณาใส่ค่า Firebase Web App Config ในไฟล์ app.js";}
}
$("rangeSelect").addEventListener("change",drawChart);
$("tempThreshold").addEventListener("input",()=>{updateAlerts();updateInsight()});
$("humiThreshold").addEventListener("input",()=>{updateAlerts();updateInsight()});
$("refreshBtn").addEventListener("click",()=>location.reload());
drawChart();loadFirebase();
