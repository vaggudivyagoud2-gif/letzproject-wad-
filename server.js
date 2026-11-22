const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
app.use(express.json({limit:'5mb'}));
app.use(express.static(path.join(__dirname,'public')));
function readDB(){ return JSON.parse(fs.readFileSync(DB_PATH,'utf8')); }
function writeDB(db){ fs.writeFileSync(DB_PATH, JSON.stringify(db,null,2)); }
function pct(r){ return r.held ? (r.attended/r.held)*100 : 0; }
function tier(p){ return p >= 75 ? 'safe' : p >= 65 ? 'warning' : 'critical'; }
function summary(db){
  return db.students.map(s=>{
    const rows=db.records.filter(r=>r.studentId===s.id);
    const held=rows.reduce((a,r)=>a+r.held,0), attended=rows.reduce((a,r)=>a+r.attended,0);
    const percentage=held ? attended/held*100 : 0;
    return {...s,held,attended,percentage:Number(percentage.toFixed(1)),risk:tier(percentage),
      subjects:rows.map(r=>({...r,percentage:Number(pct(r).toFixed(1)),risk:tier(pct(r))}))};
  });
}
app.get('/api/overview',(req,res)=>{
 const db=readDB(), all=summary(db);
 const counts={safe:all.filter(s=>s.risk==='safe').length,warning:all.filter(s=>s.risk==='warning').length,critical:all.filter(s=>s.risk==='critical').length};
 res.json({students:all,counts,totalStudents:all.length,subjects:db.subjects,sessions:db.sessions.slice(-10).reverse(),interventions:db.interventions.slice(-8).reverse(),leaves:db.leaves});
});
app.get('/api/students',(req,res)=>res.json(summary(readDB())));
app.post('/api/attendance',(req,res)=>{
 const {subject,date,entries}=req.body;
 if(!subject || !Array.isArray(entries) || !entries.length) return res.status(400).json({error:'Choose a subject and attendance entries.'});
 const db=readDB();
 entries.forEach(e=>{
   const row=db.records.find(r=>r.studentId===Number(e.studentId)&&r.subject===subject);
   if(row){ row.held+=1; if(e.status==='present'||e.status==='late') row.attended+=1; }
 });
 db.sessions.push({id:Date.now(),subject,date:date||new Date().toISOString().slice(0,10),marked:entries.length,createdAt:new Date().toISOString()});
 writeDB(db); res.json({ok:true,students:summary(db)});
});
app.post('/api/interventions',(req,res)=>{
 const {studentId,note,action}=req.body;
 if(!studentId||!note) return res.status(400).json({error:'Student and mentoring note are required.'});
 const db=readDB(); db.interventions.push({id:Date.now(),studentId:Number(studentId),note,action:action||'Counselling',date:new Date().toISOString()}); writeDB(db); res.json({ok:true});
});
app.post('/api/leave',(req,res)=>{
 const {studentId,subject,classes,reason}=req.body;
 if(!studentId||!subject||!classes) return res.status(400).json({error:'Complete all leave details.'});
 const db=readDB(); const row=db.records.find(r=>r.studentId===Number(studentId)&&r.subject===subject);
 if(!row) return res.status(404).json({error:'Attendance record not found.'});
 row.held=Math.max(0,row.held-Number(classes));
 db.leaves.push({id:Date.now(),studentId:Number(studentId),subject,classes:Number(classes),reason:reason||'Medical leave',status:'Approved (demo)',date:new Date().toISOString()});
 writeDB(db); res.json({ok:true,students:summary(db)});
});
app.post('/api/alerts',(req,res)=>{
 const {studentId}=req.body; const db=readDB(); const s=summary(db).find(x=>x.id===Number(studentId));
 if(!s) return res.status(404).json({error:'Student not found.'});
 const alert={id:Date.now(),studentId:s.id,student:s.name,percentage:s.percentage,risk:s.risk,message:`Attendance alert simulated for ${s.name} (${s.percentage}%).`,date:new Date().toISOString()};
 db.alerts.push(alert); writeDB(db); res.json({ok:true,alert});
});
app.post('/api/import',(req,res)=>{
 const {rows}=req.body; if(!Array.isArray(rows)) return res.status(400).json({error:'CSV rows missing.'});
 const db=readDB(); let added=0;
 rows.forEach(x=>{
   const id=Number(x.studentId||x.id); const s=db.students.find(a=>a.id===id || a.rollNo===String(x.rollNo||'').trim());
   if(!s) return;
   const subject=String(x.subject||'').trim(); const row=db.records.find(r=>r.studentId===s.id&&r.subject===subject);
   if(row){ if(x.held!==undefined) row.held=Number(x.held); if(x.attended!==undefined) row.attended=Number(x.attended); added++; }
 });
 writeDB(db); res.json({ok:true,updated:added,students:summary(db)});
});
app.get('/api/export',(req,res)=>{
 const db=readDB(); const rows=summary(db); let csv='Roll No,Student,Subject,Classes Held,Present,Percentage,Risk\n';
 rows.forEach(s=>s.subjects.forEach(r=>csv+=`"${s.rollNo}","${s.name}","${r.subject}",${r.held},${r.attended},${r.percentage},${r.risk}\n`));
 res.setHeader('Content-Type','text/csv'); res.setHeader('Content-Disposition','attachment; filename="attendalert-report.csv"'); res.send(csv);
});
app.listen(PORT,()=>console.log(`PresentSir running at http://localhost:${PORT}`));
