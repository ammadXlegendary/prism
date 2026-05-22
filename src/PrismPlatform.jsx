import { useState, useEffect, useRef } from "react";
import { useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line, ReferenceLine } from "recharts";
import { ForecastProvider, useForecast } from "./clearcast/ForecastContext";
import { calculateStaffing } from "./clearcast/forecastService";
import { forecastGroups as CC_GROUPS } from "./clearcast/forecastData";
import { listModels, runModel, summarizeResults, MODEL_STATUS } from "./clearcast/modelService";
import ScheduleContainer from "./components/Schedule/ScheduleContainer.jsx";
import WorkPatternBuilder from "./components/Schedule/WorkPatternBuilder.jsx";
import AgentProfilePanel from "./components/Schedule/AgentProfilePanel.jsx";
import SkillingManager from "./components/Schedule/SkillingManager.jsx";

// ─── BRAND ─────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    guava:"#F45D48", kale:"#0A8080", amber:"#EF9F27", purple:"#7F77DD",
    coral:"#F0997B", green:"#0AC8A0",
    bg:"#05080F", surf:"linear-gradient(160deg,#0e1628 0%,#080d18 100%)", card:"linear-gradient(145deg,#141a2e 0%,#0e1422 100%)", elev:"linear-gradient(145deg,#1d2844 0%,#141e34 100%)",
    bd:"rgba(255,255,255,.07)", tx0:"rgba(255,255,255,.92)", tx1:"rgba(255,255,255,.55)", tx2:"rgba(255,255,255,.28)",
    topbar:"rgba(5,8,15,.97)", topbarBd:"rgba(255,255,255,.055)",
    sidebar:"linear-gradient(180deg,rgba(5,8,15,.99) 0%,rgba(7,11,22,.98) 100%)", sidebarBd:"rgba(255,255,255,.055)",
  },
  light: {
    guava:"#D93220", kale:"#087070", amber:"#B87000", purple:"#5752C0",
    coral:"#CC6038", green:"#088A6C",
    bg:"#EFF1F8", surf:"linear-gradient(160deg,#FAFBFF 0%,#EFF1F8 100%)", card:"linear-gradient(145deg,#FFFFFF 0%,#F4F6FC 100%)", elev:"linear-gradient(145deg,#EAEDF6 0%,#E2E6F2 100%)",
    bd:"rgba(0,0,0,.09)", tx0:"rgba(0,0,0,.87)", tx1:"rgba(0,0,0,.50)", tx2:"rgba(0,0,0,.28)",
    topbar:"rgba(240,242,248,.97)", topbarBd:"rgba(0,0,0,.07)",
    sidebar:"linear-gradient(180deg,rgba(245,247,254,.99) 0%,rgba(238,242,252,.98) 100%)", sidebarBd:"rgba(0,0,0,.07)",
  },
  festive: {
    guava:"#FF5C8A", kale:"#00D4A8", amber:"#FFD700", purple:"#BF7FFF",
    coral:"#FF85A0", green:"#00EEB8",
    bg:"#08050F", surf:"linear-gradient(160deg,#1A0828 0%,#08050F 100%)", card:"linear-gradient(145deg,#1E0B36 0%,#140820 100%)", elev:"linear-gradient(145deg,#2A1250 0%,#1E0B36 100%)",
    bd:"rgba(200,140,255,.12)", tx0:"rgba(255,248,240,.95)", tx1:"rgba(220,180,255,.62)", tx2:"rgba(180,130,220,.35)",
    topbar:"rgba(8,5,15,.97)", topbarBd:"rgba(200,140,255,.10)",
    sidebar:"linear-gradient(180deg,rgba(15,6,26,.99) 0%,rgba(10,4,18,.98) 100%)", sidebarBd:"rgba(200,140,255,.08)",
  },
};
let C = THEMES.dark;

// ─── HOLIDAY SYSTEM ────────────────────────────────────────────
const HOLIDAY_PALETTES = {
  "New Year's":      { bg:"#080B18", guava:"#FFD700", kale:"#00E5FF", amber:"#FF69B4", emoji:"🎆", msg:"Happy New Year!" },
  "Valentine's Day": { bg:"#180810", guava:"#FF4F81", kale:"#FF8FAB", amber:"#FF4F81", emoji:"💝", msg:"Happy Valentine's Day!" },
  "St. Patrick's":   { bg:"#061408", guava:"#2DB54A", kale:"#70C040", amber:"#FFD700", emoji:"🍀", msg:"Happy St. Patrick's Day!" },
  "Memorial Day":    { bg:"#060816", guava:"#B22234", kale:"#3C3B6E", amber:"#C8C8D0", emoji:"🇺🇸", msg:"Happy Memorial Day!" },
  "Juneteenth":      { bg:"#060F0A", guava:"#EF3340", kale:"#00853E", amber:"#EF3340", emoji:"✊", msg:"Happy Juneteenth!" },
  "4th of July":     { bg:"#060816", guava:"#C01020", kale:"#3C3B6E", amber:"#C8C8D0", emoji:"🎇", msg:"Happy 4th of July!" },
  "Labor Day":       { bg:"#08060F", guava:"#5060D0", kale:"#4A78C0", amber:"#C0C0D0", emoji:"💪", msg:"Happy Labor Day!" },
  "Halloween":       { bg:"#0C0608", guava:"#FF7518", kale:"#9932CC", amber:"#FF7518", emoji:"🎃", msg:"Happy Halloween!" },
  "Thanksgiving":    { bg:"#100800", guava:"#D2691E", kale:"#CC8B00", amber:"#E8A020", emoji:"🦃", msg:"Happy Thanksgiving!" },
  "Christmas":       { bg:"#06100A", guava:"#CC0000", kale:"#006400", amber:"#FFD700", emoji:"🎄", msg:"Merry Christmas!" },
  "New Year's Eve":  { bg:"#080810", guava:"#FFD700", kale:"#B0B0C0", amber:"#FF69B4", emoji:"🥂", msg:"Happy New Year's Eve!" },
};
const HOLIDAY_WINDOWS = [
  [1,1,"New Year's",0,2],[2,14,"Valentine's Day",3,1],[3,17,"St. Patrick's",3,1],
  [5,27,"Memorial Day",3,1],[6,19,"Juneteenth",3,1],[7,4,"4th of July",3,2],
  [9,2,"Labor Day",3,1],[10,31,"Halloween",7,1],[11,26,"Thanksgiving",3,2],
  [12,25,"Christmas",7,2],[12,31,"New Year's Eve",3,0],
];
function getActiveHoliday() {
  const now = new Date(), yr = now.getFullYear();
  for (const [mo,day,name,before,after] of HOLIDAY_WINDOWS) {
    const diff = Math.round((new Date(yr,mo-1,day) - now) / 86400000);
    if (diff >= -after && diff <= before) return { name, ...HOLIDAY_PALETTES[name] };
  }
  return null;
}

const ACT_COLORS = {
  // ── Phone family (teals) ─────────────────────────────────────
  "Phone":"#0A9090","Phone AHOD":"#CC2222","Phone Shadowing":"#0A8080",
  "Nesting Phone":"#0B9898","Overtime Phone":"#0A7070",
  // ── Email family (blues) ─────────────────────────────────────
  "Email":"#185FA5","Email Shadowing":"#1A6AB5","Nesting Email":"#1870B8",
  "Overtime Email":"#1045A0","Cancellations":"#2B5EA6",
  "COBRA / Continuation":"#1E6B82","EE Termination":"#1E5C82",
  "Group Termination":"#1A5278","NHE (New hire enrollment)":"#1E7B92",
  "QLE (qualifying life event)":"#1E6B72",
  // ── Chat family (cyan-greens) ────────────────────────────────
  "Chat":"#2BABAD","Chat Shadowing":"#2BAAAA","Nesting Chat":"#30B5B5",
  "Overtime Chat":"#1A8A8A","Internal Chat (Captains Only)":"#259898",
  // ── Omni / Chat+Email (emerald) ──────────────────────────────
  "Chat/Email":"#1D9E75","Chat/Email Shadowing":"#1A9870",
  "Nesting Chat/Email":"#1FA870","Overtime Chat/Email":"#1A8060",
  // ── Back office / specialized (dark greens) ──────────────────
  "Core Work":"#0F6E56","Core Work Override":"#0F6E56",
  "Overtime BackOffice":"#0A5E48","FEIN":"#1A8C6C",
  "Open":"#0099AA","Outbound Call":"#0E6EB0",
  "Follow-up/Action items":"#2A8A7A",
  // ── Carrier codes (steel blue, unified) ──────────────────────
  "Carrier: All Other":"#4A6FA5","Carrier: Allegeus":"#4A6FA5",
  "Carrier: Anthem":"#4A6FA5","Carrier: BCBS":"#4A6FA5",
  "Carrier: Beam":"#4A6FA5","Carrier: Guardian":"#4A6FA5",
  "Carrier: Kaiser":"#4A6FA5","Carrier: Principal":"#4A6FA5",
  "Carrier: UHC/Oxford":"#4A6FA5",
  // ── Breaks / meals (ambers/gold) ─────────────────────────────
  "Break":"#EF9F27","Acomm Break":"#DFA027","Lunch":"#C9A227","Personal":"#B8860B",
  // ── ACW (muted steel) ────────────────────────────────────────
  "After Call Work":"#5B7EA6",
  // ── Meetings (purples) ───────────────────────────────────────
  "Meeting":"#534AB7","Meeting Override":"#534AB7",
  "1:1 Meeting":"#6B6BCC","1x1 Meeting":"#6B6BCC",
  "Team Meeting":"#7B73D7","Company Event":"#9040B0",
  "GustoFIED":"#8030A8",
  // ── Training (oranges) ───────────────────────────────────────
  "Training":"#F0997B","Training Override":"#D06840",
  "Gustie Guide Training":"#D85A30","Reverse Shadowing":"#E07850",
  "Vendor Compliance Training":"#C05830",
  // ── Approved Project (teal-green) ────────────────────────────
  "Approved Project":"#2D8F6F","Approved Project Override":"#2D8F6F",
  // ── Tech / unavailable (grays) ───────────────────────────────
  "Tech Issues":"#6B7494","Tech Issues - Internal":"#6B7494",
  "Tech Issues - External":"#7B8494","Vendor Tech Issues":"#8B9494",
  "Unavailable":"#4B5563","Busy":"#64748B",
  // ── Absences (red spectrum) ──────────────────────────────────
  "LOA":"#A32D2D","Planned Time Off":"#F45D48","Sick":"#D44040",
  "Sick (Planned)":"#C43030","NCNS":"#8B0000",
  "Unplanned Absence":"#C04040","Time Off Override":"#E04040",
  "Unpaid Time Off":"#B83030","Intermittent FMLA":"#A02020",
  "ADA approved absence":"#AA3030","Critical Care":"#AA2222",
  "Forced Day Off":"#BB3333","Inclement Weather":"#888898",
  "Refused":"#992222",
  // ── Special absences ─────────────────────────────────────────
  "Bereavement":"#7A4A5A","Jury Duty":"#9B7A2A","Sabbatical":"#8B6B9B",
  "Company Holiday":"#CC4444","Floating Holiday":"#DD5555",
  "Admin (Unworked)":"#6B7283","Volunteer Time Off":"#4A8B4A",
  "Voting Time Off":"#3B7B3B","Vendor Wellness":"#4A7B6A",
  "Payroll Advanced Care":"#B07818",
};
const ac = a => ACT_COLORS[a] || "#888";

const fmtH = h => {
  if (h == null) return "--:--";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh < 12 ? "am" : "pm";
  return `${hh === 0 ? 12 : hh > 12 ? hh - 12 : hh}:${mm.toString().padStart(2,"0")}${ap}`;
};
const initials = n => n.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
const NOW_H = (() => { const d = new Date(); return d.getHours() + d.getMinutes()/60; })();
const TODAY_LABEL = (() => {
  const d = new Date();
  const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${DOW[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`;
})();
function fmtRelDate(offsetDays) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

// ─── PILLARS & AGENTS ──────────────────────────────────────────
const PILLARS = {
  "Payroll & Taxes":"#D89020","BenOps":"#0A9898","Premier DSA":"#D88060",
  "OCE - Onboarding":"#18A870","SMB - Sales":"#E84840",
  "Payroll Advanced Care":"#B07818","Benefits Care":"#7870D0",
  "Partner Care":"#5090C0","Benefits Advanced Care":"#9060B0",
  "Accountant DSA":"#608070","Consumer Money/Members":"#2BABAD",
};

const FULL_ROSTER = {
  "Accountant DSA":{c:"#608070",m:["Brian Harz", "Heather Ferguson", "Joe DiMarco", "Monica Thompson"],a:[
    ["Ana Chong Rubio","Heather Ferguson","ET","Orlando, FL",""],
    ["Carrie Wingo","Monica Thompson","CT","FL",""],
    ["Chelsea Farr","Monica Thompson","MT","Denver","Y"],
    ["Drew Tejeda","Heather Ferguson","ET","Orlando, FL",""],
    ["Hannah DiSanto","Monica Thompson","MT","CO",""],
    ["Lupita Licea","Heather Ferguson","CT","Houston, TX",""],
    ["Ray Cartagena","Heather Ferguson","ET","Orlando, FL",""],
    ["Samantha Spartan","Brian Harz","CT","MO",""],
    ["Shay Jackson","Joe DiMarco","PT","Las Vegas, NV",""],
    ["Sydney Citrin","Joe DiMarco","MT","Denver","Y"],
    ["Tara Grizzell","Brian Harz","CT","Houston, TX",""],
    ["Taylor Sweet","Brian Harz","CT","KS",""],
    ["Tisha Jones","Heather Ferguson","ET","GA",""],
  ]},
  "BenOps":{c:"#0A9898",m:["Adrienne Reese", "Alex Dillon", "Amber Smith", "Andrew Zbryk", "Bobby Metcalf", "Brittany Cannon", "Carla Ocasio", "Chere Merrick", "Dana Fleisher", "Danelle Tillman", "Eliana Reynolds", "Jacob Brown", "Jane Long", "Joshua Drinkwater", "Joslin Skorka", "Kelly Peacock", "Kristen Yaden", "Latisha Pena", "Lindsey Flenner", "Lisa Schulze", "Liset Alvarado", "Marean Kennedy", "Mark Menjivar", "Martin Ribas", "Matthew Hunter", "Matty Gorman", "McKenzie Daniec", "Michelle Nguyen", "Nikita Smullen", "Rachel Mitchell", "Reetah Boyce", "Sarah Williams", "Sasha Lenz", "Scott Causey", "Shazz Steele"],a:[
    ["ATyan Kennedy","Mark Menjivar","ET","SC",""],
    ["Aaliyah Ali","Martin Ribas","CT","Chicago, IL",""],
    ["Aaron Reyes","Chere Merrick","MT","Denver","Y"],
    ["Abby Boellner","Chere Merrick","MT","Denver","Y"],
    ["Adriana Hernandez","Reetah Boyce","MT","Denver","Y"],
    ["Aidan Cloherty","Danelle Tillman","CT","Chicago, IL",""],
    ["Alberto Limon","McKenzie Daniec","CT","TX",""],
    ["Alexa Harrison","Reetah Boyce","PT","San Francisco",""],
    ["Alexis Haney","Chere Merrick","MT","Denver","Y"],
    ["Alissa Thompson","Jacob Brown","MT","CO",""],
    ["Alita Peters","Liset Alvarado","PT","Las Vegas, NV",""],
    ["Alizah Hussain","Lisa Schulze","CT","TX",""],
    ["Allen Gunn","Joshua Drinkwater","CT","Chicago, IL",""],
    ["Amadi Adams","Marean Kennedy","ET","Atlanta, GA",""],
    ["Amanda Aguero","Alex Dillon","MT","Denver",""],
    ["Amanda Chin","Danelle Tillman","ET","Miami, FL",""],
    ["Amara Lodhi","Lindsey Flenner","CT","TX",""],
    ["Amber Manuel","Carla Ocasio","ET","FL",""],
    ["Ameer Durrani","Lisa Schulze","ET","Orlando, FL",""],
    ["Ami Patel","Scott Causey","MT","Denver",""],
    ["Amy Harold","Adrienne Reese","ET","Washington, DC",""],
    ["Ana Gomez","Eliana Reynolds","MT","CO",""],
    ["Andrea Haynie","Brittany Cannon","ET","Atlanta, GA",""],
    ["Andrea Zaragoza","Reetah Boyce","PT","Las Vegas, NV",""],
    ["Andrew Diehl","Scott Causey","MT","Denver",""],
    ["Anessa Salinas","Sasha Lenz","MT","CO",""],
    ["Angela Lindstrom","Martin Ribas","MT","Denver",""],
    ["Angie Woods","Marean Kennedy","PT","Las Vegas, NV",""],
    ["Annabelle Schultz","Matthew Hunter","MT","Denver",""],
    ["Annette Campos","Dana Fleisher","MT","Denver",""],
    ["Annie Barfield","Adrienne Reese","CT","FL",""],
    ["Annie Ennis","Chere Merrick","ET","Orlando, FL",""],
    ["Antonia Martinez","Joshua Drinkwater","PT","CA",""],
    ["April Davenport","McKenzie Daniec","CT","KY",""],
    ["Arielle Graves","Martin Ribas","CT","Houston, TX",""],
    ["Ashley Champine","McKenzie Daniec","MT","Denver",""],
    ["Ashley Dean","Eliana Reynolds","MST","Phoenix, AZ",""],
    ["Ashley Fish","Kristen Yaden","CT","WI",""],
    ["Ashley Jones","Liset Alvarado","ET","Atlanta, GA",""],
    ["Ashley Lancellotti","Sasha Lenz","ET","Orlando, FL",""],
    ["Ashley Larson","Joshua Drinkwater","ET","NY",""],
    ["Ashley Licardo","Bobby Metcalf","PT","CA",""],
    ["Ashley Smith","Michelle Nguyen","CT","MS",""],
    ["Ashley Sutton","Reetah Boyce","PT","San Diego, CA",""],
    ["Ashley Thompson","Lisa Schulze","CT","LA",""],
    ["Ashlyn Woodard","Reetah Boyce","ET","Philadelphia, PA",""],
    ["Audrey Callison","Scott Causey","MT","Denver",""],
    ["Austin Montgomery","Joshua Drinkwater","ET","FL",""],
    ["Bailey Mayemura","Matthew Hunter","MT","Denver",""],
    ["Bashemath Everett","Sarah Williams","ET","Orlando, FL",""],
    ["Becca Scheiding","McKenzie Daniec","ET","MI",""],
    ["Benjamin Lively","Joslin Skorka","PT","Seattle, WA",""],
    ["Betty Nix","Kristen Yaden","PT","Los Angeles, CA",""],
    ["Bianca Barnes","Amber Smith","ET","NC",""],
    ["Bionca Barnswell","Kelly Peacock","ET","Atlanta, GA",""],
    ["Blake Williams","Matthew Hunter","ET","GA",""],
    ["Blu Pearl","Brittany Cannon","ET","Detroit, MI",""],
    ["Brandy Long","Sarah Williams","MT","CO",""],
    ["Bre Hebert","Liset Alvarado","MT","Denver",""],
    ["Bri Davila","Joslin Skorka","ET","Miami, FL",""],
    ["Brianna Turnbull","Shazz Steele","MT","Denver",""],
    ["Brie Bogle","Shazz Steele","ET","Washington, DC",""],
    ["Brittany Flynn","Nikita Smullen","CT","IA",""],
    ["Brooke Murawski","Alex Dillon","CT","Chicago, IL",""],
    ["Buddy Ward","Joshua Drinkwater","ET","NC",""],
    ["Camay Polarchy","Shazz Steele","ET","Orlando, FL",""],
    ["Cameron Eason","Brittany Cannon","PT","San Diego, CA",""],
    ["Candyce Meeks","Andrew Zbryk","CT","Chicago, IL",""],
    ["Caretha Lemon","Bobby Metcalf","ET","OH",""],
    ["Carissa Porter","Lindsey Flenner","PT","Las Vegas, NV",""],
    ["Cassie Yoo","Matty Gorman","PT","Los Angeles, CA",""],
    ["Ceasar Gonzales","Michelle Nguyen","MT","Denver",""],
    ["Celeste Solorzano","Liset Alvarado","MT","Denver",""],
    ["Chassity Davis","Reetah Boyce","PT","CA",""],
    ["Chelsea Gilbert","Sarah Williams","ET","Atlanta, GA",""],
    ["Chelsea Rodriguez","Chere Merrick","ET","Orlando, FL",""],
    ["Cheyenne Tasher","Sasha Lenz","MST","Phoenix, AZ",""],
    ["Chris Underhill","Chere Merrick","MT","WY",""],
    ["Cici Rey Cordova","Kelly Peacock","ET","FL",""],
    ["Cierra Bolton","Bobby Metcalf","CT","Chicago, IL",""],
    ["Cindy Cantor","Lisa Schulze","MT","Denver",""],
    ["Clarice Benz","Carla Ocasio","MT","Denver",""],
    ["Clay Willard","Andrew Zbryk","MT","Denver",""],
    ["Coby Marr","Alex Dillon","CT","TX",""],
    ["Connor Martin","Lindsey Flenner","PT","San Diego, CA",""],
    ["Corrissa Banner","Carla Ocasio","ET","NC",""],
    ["Court Burgess","Matthew Hunter","MT","Denver",""],
    ["Courtney Suprunenko","Alex Dillon","ET","Orlando, FL",""],
    ["Crystal Bush","Matthew Hunter","MST","AZ",""],
    ["Crystal Lowery","Sarah Williams","PT","Las Vegas, NV",""],
    ["DJ Tatum","Dana Fleisher","MT","Denver",""],
    ["Dallas Anderson","Lindsey Flenner","CT","TX",""],
    ["Dam Leano","Mark Menjivar","PT","San Diego, CA",""],
    ["Dani Macedo","Joslin Skorka","PT","Los Angeles, CA",""],
    ["Daniel Girard","Carla Ocasio","MT","Denver",""],
    ["Danielle Medina","Mark Menjivar","MT","CO",""],
    ["Dannielle Caro","Rachel Mitchell","ET","New York",""],
    ["Darci Sharp","Andrew Zbryk","MT","Denver",""],
    ["Darcy Drew","Bobby Metcalf","CT","MO",""],
    ["Dayjha Robinson-Gomez","Mark Menjivar","PT","CA",""],
    ["Deanna Wilson","Liset Alvarado","MST","AZ",""],
    ["Denis Guevara","Kelly Peacock","CT","Chicago, IL",""],
    ["Dennis Olivares","Reetah Boyce","ET","SC",""],
    ["Denver Bradley","McKenzie Daniec","CT","IL",""],
    ["Devon Ross","Nikita Smullen","PT","CA",""],
    ["Diana Colin","Latisha Pena","PT","Los Angeles, CA",""],
    ["Diana Perez","Dana Fleisher","MT","Denver",""],
    ["Domonique Brooks","Reetah Boyce","ET","Atlanta, GA",""],
    ["Ebony Bowens","Jacob Brown","CT","Houston, TX",""],
    ["Ebony Jones","Reetah Boyce","ET","SC",""],
    ["Elia Duarte","Latisha Pena","CT","Chicago, IL",""],
    ["Elijah Fiel","Reetah Boyce","PT","Las Vegas, NV",""],
    ["Elizabeth Tran","Danelle Tillman","CT","Houston, TX",""],
    ["Ella Cornell","Lisa Schulze","MT","Denver",""],
    ["Emily Nieves","Liset Alvarado","CT","Houston, TX",""],
    ["Eric Mutz","Dana Fleisher","PT","Portland, OR",""],
    ["Erin Castellano","Kristen Yaden","ET","Philadelphia, PA",""],
    ["Erin Zimmermann","Lindsey Flenner","PT","Los Angeles, CA",""],
    ["Esaul Aceves","Martin Ribas","MST","Phoenix, AZ",""],
    ["Evan Waldmann","Alex Dillon","MT","Denver",""],
    ["Gabi Francis","Sarah Williams","CT","IA",""],
    ["Gabriela Lozano","Sarah Williams","MT","CO",""],
    ["Gaby Williams","Lisa Schulze","MT","Denver",""],
    ["Gen Vantrease","Michelle Nguyen","PT","Las Vegas, NV",""],
    ["George Velazquez","Adrienne Reese","ET","SC",""],
    ["Gloria Hunter","Kristen Yaden","MT","Denver",""],
    ["Grace Kaczman","McKenzie Daniec","MT","Denver",""],
    ["Hailey Hopper-Graf","Lisa Schulze","MT","Denver",""],
    ["Haley Anderson","Matty Gorman","ET","MI",""],
    ["Hanna Anderson","Lindsey Flenner","ET","MI",""],
    ["Hannah Burgess","Lisa Schulze","MT","Denver",""],
    ["Hannah Miclette","Matty Gorman","MT","Denver",""],
    ["Hannah Powell","Matty Gorman","MT","Denver",""],
    ["Heather Strader","Eliana Reynolds","CT","MO",""],
    ["Hiwot Michael","Marean Kennedy","PT","Las Vegas, NV",""],
    ["Holly Robbins","Michelle Nguyen","MT","CO",""],
    ["Hunter Rawal","Adrienne Reese","PT","Las Vegas, NV",""],
    ["Ieashia Henderson","Marean Kennedy","ET","Atlanta, GA",""],
    ["Ivan Sotelo","Matty Gorman","CT","NE",""],
    ["Ivory Amos","Michelle Nguyen","ET","Orlando, FL",""],
    ["Jackie Rodriguez","Martin Ribas","MT","CO",""],
    ["Jada Brown","Bobby Metcalf","ET","VA",""],
    ["Jada Orr","Mark Menjivar","CT","Chicago, IL",""],
    ["Jade Persaud","Sasha Lenz","ET","FL",""],
    ["Jaden Mayfield","Matty Gorman","CT","NE",""],
    ["Jaleesa Bowers","Chere Merrick","CT","Chicago, IL",""],
    ["Jalisa Mack","Joslin Skorka","CT","Chicago, IL",""],
    ["Jamal Davis","Danelle Tillman","ET","Atlanta, GA",""],
    ["Jamel Brewton","Marean Kennedy","ET","SC",""],
    ["James Bennett","Joshua Drinkwater","CT","TX",""],
    ["Jana Soop","Kelly Peacock","ET","NC",""],
    ["Janeen Barthelemy","Joslin Skorka","MT","CO",""],
    ["Janet Lloyd","Amber Smith","PT","Las Vegas, NV",""],
    ["Janine Toledo","Martin Ribas","CT","Austin, TX",""],
    ["Javier Alvarez","Mark Menjivar","ET","Atlanta, GA",""],
    ["Jeff Hagman","Latisha Pena","MT","Denver",""],
    ["Jennifer Hwang","Amber Smith","MT","Denver",""],
    ["Jennifer Maes","Matthew Hunter","MT","Denver",""],
    ["Jeri Steen","Andrew Zbryk","MT","Denver",""],
    ["Jerrika Townsend","Reetah Boyce","ET","FL",""],
    ["Jes Taylor","Michelle Nguyen","ET","KY",""],
    ["Jess Muracco","Latisha Pena","ET","NC",""],
    ["Jesse Call","McKenzie Daniec","ET","New York",""],
    ["Jesse Kavan","Scott Causey","CT","Chicago, IL",""],
    ["Jesse Pearson","Sasha Lenz","MT","Denver",""],
    ["Jessica Gonzalez","Scott Causey","MT","NM",""],
    ["Jessica Maikish","Andrew Zbryk","MT","Denver",""],
    ["Jessica Rogers","Joshua Drinkwater","ET","NY",""],
    ["Jessie Harris","Danelle Tillman","ET","VA",""],
    ["Jhordan Blumenberg","Chere Merrick","PT","Portland, OR",""],
    ["Jocelyne Corral","Amber Smith","PT","Las Vegas, NV",""],
    ["John Hill","Andrew Zbryk","CT","Chicago, IL",""],
    ["Jonathan Hicks","Adrienne Reese","ET","Columbus, OH",""],
    ["Jordan Adams","Dana Fleisher","MT","Denver",""],
    ["Joseph Sosa","McKenzie Daniec","CT","TX",""],
    ["Josh Sada","Andrew Zbryk","CT","TX",""],
    ["Josh Williams","Sarah Williams","ET","Pittsburg, PA",""],
    ["Julia Martin","Matthew Hunter","MT","Denver",""],
    ["Julian Cox","Andrew Zbryk","MT","Denver",""],
    ["Justin Cada","Michelle Nguyen","PT","Las Vegas, NV",""],
    ["Kaila Brown","Reetah Boyce","ET","VA",""],
    ["Kaitlin Bridwell","Chere Merrick","CT","MO",""],
    ["Kaitlin Dunn","Matthew Hunter","MT","Denver",""],
    ["Kameshia Norman","Joslin Skorka","PT","CA",""],
    ["Karla Perez","Marean Kennedy","PT","Las Vegas, NV",""],
    ["Karter Cook","Sasha Lenz","ET","Raleigh, NC",""],
    ["Kathryn Hayes","Joslin Skorka","MT","CO",""],
    ["Katie Richards","Lisa Schulze","ET","MI",""],
    ["Kaya Shannon","Andrew Zbryk","CT","Chicago, IL",""],
    ["Kazandra Chapa","Sasha Lenz","ET","FL",""],
    ["Keegan Busick","Carla Ocasio","PT","Portland, OR",""],
    ["Kelly Leitch Hernandez","Marean Kennedy","ET","VA",""],
    ["Kelsie Anderson","Joshua Drinkwater","CT","MO",""],
    ["Keyelli Collado-Bagley","Brittany Cannon","ET","FL",""],
    ["Khelsea Hamilton","Lindsey Flenner","ET","Detroit, MI",""],
    ["Kierra Martin","Marean Kennedy","ET","Atlanta, GA",""],
    ["Kiki Vantrease","Sasha Lenz","PT","Las Vegas, NV",""],
    ["Kristen Johnson","McKenzie Daniec","MT","Denver",""],
    ["Kristina Mata","Martin Ribas","PT","Los Angeles, CA",""],
    ["Kristina Sims","Joshua Drinkwater","MST","Phoenix, AZ",""],
    ["Kyanna Yeager","Joshua Drinkwater","ET","Atlanta, GA",""],
    ["Kylie Flynn","Rachel Mitchell","ET","OH",""],
    ["Kyneitra Walters","Kelly Peacock","CT","Houston, TX",""],
    ["Lacee Miller","Reetah Boyce","CT","TX",""],
    ["Lae Poletes","Eliana Reynolds","CT","MN",""],
    ["Lauren Jopson","Martin Ribas","MT","Denver",""],
    ["Lauren Lagman","Chere Merrick","ET","IN",""],
    ["Lauren Mae Do","Amber Smith","PT","Las Vegas, NV",""],
    ["Lawrence Ling","Michelle Nguyen","MT","CO",""],
    ["Lexi Havstad","Carla Ocasio","MT","Denver",""],
    ["Lindsay DiFrancesco","Kelly Peacock","ET","Philadelphia, PA",""],
    ["Lindsey Anderson","Dana Fleisher","MT","Denver",""],
    ["Linh Tran","Scott Causey","MT","Denver",""],
    ["Lisa Tarver","McKenzie Daniec","MT","CO",""],
    ["Liz Kendrick","Bobby Metcalf","MT","Denver",""],
    ["Liz Richardson","Chere Merrick","PT","Las Vegas, NV",""],
    ["Lori Parker","Nikita Smullen","CT","TX",""],
    ["Lorianne Fernandes","Eliana Reynolds","ET","FL",""],
    ["Luis Lerma","Latisha Pena","CT","Houston, TX",""],
    ["Lukas Stragys","Scott Causey","MT","Denver",""],
    ["Madison Brooks","Rachel Mitchell","ET","FL",""],
    ["Madison Kelly","Bobby Metcalf","ET","Atlanta, GA",""],
    ["Maegan Brewster","Shazz Steele","ET","NC",""],
    ["Mallory Sirmans","Adrienne Reese","CT","FL",""],
    ["Mara Lipschutz","Andrew Zbryk","MT","Denver",""],
    ["Marco Lopez","Brittany Cannon","MT","Denver",""],
    ["Margaret Hanks","Lisa Schulze","CT","TN",""],
    ["Maria Leon","Marean Kennedy","PT","Las Vegas, NV",""],
    ["Marie Gibbs","Kristen Yaden","ET","FL",""],
    ["Mario Cordoza","Rachel Mitchell","PT","Los Angeles, CA",""],
    ["Marisa Gandara","Reetah Boyce","CT","Austin, TX",""],
    ["Mark Franklin","Marean Kennedy","MT","Denver","Y"],
    ["Martin Carlos","Kelly Peacock","MT","NM",""],
    ["Martin Van Beek","Joslin Skorka","MT","Denver",""],
    ["Martinique Watson","Adrienne Reese","PT","Los Angeles, CA",""],
    ["Matt Mishler","Amber Smith","PT","Las Vegas, NV",""],
    ["Matt Mrohs","Danelle Tillman","CT","Chicago, IL",""],
    ["Mattie Kleist","Jane Long","MT","Denver",""],
    ["Megan Klein","Dana Fleisher","MT","CO",""],
    ["Melanie Leaks","Chere Merrick","CT","TX",""],
    ["Meredith Montgomery","Eliana Reynolds","CT","TN",""],
    ["Mia Harper","Brittany Cannon","CT","Chicago, IL",""],
    ["Michael LeCount","Lisa Schulze","MT","Denver",""],
    ["Michael Vu","Adrienne Reese","PT","Los Angeles, CA",""],
    ["Michelle Dionne","Alex Dillon","CT","TX",""],
    ["Michelle Guajardo","Mark Menjivar","MT","NM",""],
    ["Michelle Pierfax","Nikita Smullen","PT","Las Vegas, NV",""],
    ["Michelle Smith","Matty Gorman","CT","OK",""],
    ["Misty Stevens","Scott Causey","CT","FL",""],
    ["Mitchel King","Scott Causey","MT","Denver",""],
    ["Molly Luna","Nikita Smullen","CT","Houston, TX",""],
    ["NaKiyah Scales","Lindsey Flenner","ET","VA",""],
    ["Nadia Sojka","Alex Dillon","MT","CO",""],
    ["Nancy Han","Rachel Mitchell","MT","Denver",""],
    ["Naomi Westby","Nikita Smullen","CT","Chicago, IL",""],
    ["Natalie Hitchcock","Matthew Hunter","MT","Denver",""],
    ["Natalie Singler","Sarah Williams","MT","Denver","Y"],
    ["Nick Garcia","Eliana Reynolds","ET","NC",""],
    ["Nicole Lyons-Olinger","Lindsey Flenner","PT","Las Vegas, NV",""],
    ["Nikkara Pruitt","Mark Menjivar","ET","Orlando, FL",""],
    ["Octavia Barber","Mark Menjivar","CT","LA",""],
    ["Oscar Salas","Mark Menjivar","ET","Orlando, FL",""],
    ["Page Whalen","Lisa Schulze","MT","Denver",""],
    ["Paige Olaye","Carla Ocasio","CT","Houston, TX",""],
    ["Parker Thomas","Sasha Lenz","PT","CA",""],
    ["Patti Hardy","Sarah Williams","PT","Las Vegas, NV",""],
    ["Qiana Carr","Martin Ribas","ET","Atlanta, GA",""],
    ["Rachel Avellaneda","Mark Menjivar","ET","New York",""],
    ["Raquel Velazquez","Kristen Yaden","ET","SC",""],
    ["Rebecca Froedge","Alex Dillon","ET","FL",""],
    ["Reina Giraldo","Marean Kennedy","ET","Orlando, FL",""],
    ["Rhett Byrd","Eliana Reynolds","CT","TX",""],
    ["Rhonda Williams","Michelle Nguyen","MT","Denver",""],
    ["Richard Reineke","Carla Ocasio","ET","OH",""],
    ["Rick Vigil","Joslin Skorka","MT","Denver",""],
    ["Robert Mastronardi","Eliana Reynolds","ET","FL",""],
    ["Rosalinda Matayer","Marean Kennedy","ET","Orlando, FL",""],
    ["Ruby Onofre","Lisa Schulze","MT","Denver",""],
    ["Ruthie Flowers","Shazz Steele","CT","KY",""],
    ["Ryan Burns","Michelle Nguyen","ET","Orlando, FL",""],
    ["Sabrina Pea","Amber Smith","ET","Philadelphia, PA",""],
    ["Sam Danner","Jacob Brown","CT","TN",""],
    ["Sarah Anthony","Alex Dillon","CT","Chicago, IL",""],
    ["Sarah Godwin","McKenzie Daniec","CT","IL",""],
    ["Sarah Nisar","Kristen Yaden","MT","Denver",""],
    ["Sasha Lenz","Martin Ribas","MT","CO",""],
    ["Savannah Gonzalez","Adrienne Reese","CT","TN",""],
    ["Sean Fitch","Kelly Peacock","ET","NY",""],
    ["Shacia Cooley","Bobby Metcalf","MT","Denver",""],
    ["Shaderia Randall","Matty Gorman","ET","FL",""],
    ["Shakira Martinez","Martin Ribas","ET","FL",""],
    ["Shanice McWilliams","Shazz Steele","ET","NC",""],
    ["Shannon Gallagher","Michelle Nguyen","MT","Denver",""],
    ["Shannon Leon","Sarah Williams","MT","Denver",""],
    ["Shawna Wilkinson","Martin Ribas","ET","DE",""],
    ["Shea Riegel","Shazz Steele","MT","Denver",""],
    ["Shea Wright","Lisa Schulze","ET","Atlanta, GA",""],
    ["Shela Octavien","Amber Smith","PT","Las Vegas, NV",""],
    ["Shelley Hendrix","Jacob Brown","ET","FL",""],
    ["Shirl Palmer","Danelle Tillman","CT","Chicago, IL",""],
    ["Sierra Dinges","Dana Fleisher","MT","Denver",""],
    ["Simon Bachman-Williams","Michelle Nguyen","MT","Denver",""],
    ["Soshy Adelstein","Latisha Pena","MT","Denver",""],
    ["Stephanie Aviles","Michelle Nguyen","PT","Las Vegas, NV",""],
    ["Stephanie Delgado","Mark Menjivar","PT","Las Vegas, NV",""],
    ["Stephanie Jones","Lindsey Flenner","MT","CO",""],
    ["Stephanie Krukiel","Eliana Reynolds","MT","Denver","Y"],
    ["Stephanie Moure","Amber Smith","ET","Orlando, FL",""],
    ["Stephanie Phillips","Latisha Pena","CT","Chicago, IL",""],
    ["Sydney Roberts","Liset Alvarado","MT","Denver",""],
    ["Tamari Alexander Campbell","Mark Menjivar","CT","Houston, TX",""],
    ["Tamika Richards","Sarah Williams","ET","NC",""],
    ["Tara Edlund","Lisa Schulze","MT","Denver",""],
    ["Tara Lahm","Scott Causey","ET","SC",""],
    ["Tara Rahimi","McKenzie Daniec","PT","San Francisco",""],
    ["Tashanique Cohen","Martin Ribas","ET","FL",""],
    ["Tawana Collington","Shazz Steele","ET","NC",""],
    ["Taylor Seabra","Sasha Lenz","MT","CO",""],
    ["Te'a Stone","Danelle Tillman","ET","FL",""],
    ["Teri Blake","Nikita Smullen","PT","Las Vegas, NV",""],
    ["Thao Bui","Liset Alvarado","PT","Los Angeles, CA",""],
    ["Theresa McNeil","Rachel Mitchell","ET","Miami, FL",""],
    ["Tiara Brown","Brittany Cannon","CT","LA",""],
    ["Tiara Dawkins","Marean Kennedy","ET","Orlando, FL",""],
    ["Tiarah Cage","Sarah Williams","PT","Las Vegas, NV",""],
    ["Tiffany Cowan","Adrienne Reese","CT","Austin, TX",""],
    ["Tiffany Sifontes","Eliana Reynolds","ET","PA",""],
    ["Tom Armas","Nikita Smullen","MT","Denver",""],
    ["Tori Anderson","Kelly Peacock","ET","Washington, DC",""],
    ["Trent Vigil","Joslin Skorka","MT","Denver",""],
    ["Trischelle Williams","Marean Kennedy","PT","Las Vegas, NV",""],
    ["Trista Adair","Matthew Hunter","CT","TX",""],
    ["Ty Figueroa","Matty Gorman","MT","Denver",""],
    ["Valerie Gorman","Dana Fleisher","CT","TX",""],
    ["Veronica Kemme","Liset Alvarado","MT","CO",""],
    ["Victor Carachure","Bobby Metcalf","CT","Chicago, IL",""],
    ["Victor Ha","Brittany Cannon","PT","San Francisco",""],
    ["Victoria Sharpe","Michelle Nguyen","ET","Atlanta, GA",""],
    ["Wendy Yu","Carla Ocasio","MT","UT",""],
    ["Will Whitman","Adrienne Reese","ET","SC",""],
    ["William Alvaracio","Alex Dillon","CT","KS",""],
    ["Yesenia Elias-Hilario","Nikita Smullen","PT","Los Angeles, CA",""],
    ["Yonnie Ellerbe","McKenzie Daniec","ET","NC",""],
    ["Yvette Ferrari","Nikita Smullen","MT","Denver",""],
    ["Yvonne Chandler","Marean Kennedy","ET","Detroit, MI",""],
    ["Zach Medina","Reetah Boyce","MT","Denver","Y"],
    ["Zamadii Ortiz","Marean Kennedy","ET","FL",""],
    ["Zendy Sotelo","Alex Dillon","CT","Omaha, NE",""],
  ]},
  "Benefits Advanced Care":{c:"#9060B0",m:["Ivy Castelgrande", "Kailen Clark", "Valerie Nunez"],a:[
    ["Alexis Clayton","Kailen Clark","PT","Las Vegas, NV",""],
    ["Alise Francis","Ivy Castelgrande","ET","Miami, FL",""],
    ["Brett Moriarty","Kailen Clark","PT","San Francisco",""],
    ["Diamyn Graham-Johnson","Valerie Nunez","ET","VA",""],
    ["Franc Gaxiola","Kailen Clark","MT","Denver","Y"],
    ["Hannah Flores","Kailen Clark","MT","Denver","Y"],
    ["Heidy Burgos","Kailen Clark","ET","Orlando, FL",""],
    ["Jade Yates","Kailen Clark","ET","GA",""],
    ["Ketha Muth","Kailen Clark","MT","Denver","Y"],
    ["Leah Smith","Kailen Clark","ET","FL",""],
    ["Lissa Hameister","Kailen Clark","MT","CO",""],
    ["Megan Soler","Valerie Nunez","ET","Raleigh, NC",""],
    ["Melissa Brantner","Ivy Castelgrande","CT","TX",""],
    ["Nia Fluker","Kailen Clark","CT","TX",""],
    ["Nichole Brown","Kailen Clark","CT","AR",""],
    ["Nick Rodriguez","Kailen Clark","MT","Denver","Y"],
    ["Valerio Middaugh","Ivy Castelgrande","ET","Raleigh, NC",""],
  ]},
  "Benefits Care":{c:"#7870D0",m:["Christen Caruthers", "Eleanor O'Brien", "Jenny Kirou", "Justin Givens", "Kevin Keough"],a:[
    ["Allysa Lara","Christen Caruthers","ET","Orlando, FL",""],
    ["Amanda Babcock","Eleanor O'Brien","ET","FL",""],
    ["Amy Netzley","Kevin Keough","MST","Phoenix, AZ",""],
    ["Breana Cameron","Christen Caruthers","ET","Atlanta, GA",""],
    ["Brittani Jacobs","Christen Caruthers","ET","Atlanta, GA",""],
    ["Camaron Vincent","Jenny Kirou","MT","Denver","Y"],
    ["Danaja Knox","Kevin Keough","CT","TX",""],
    ["Daniel Salazar","Jenny Kirou","MT","Denver","Y"],
    ["Danielle Chaney","Jenny Kirou","CT","MO",""],
    ["Danielle Garcia","Jenny Kirou","MT","Denver","Y"],
    ["Ebony Reed","Justin Givens","ET","Atlanta, GA",""],
    ["Eric Marte","Kevin Keough","PT","Las Vegas, NV",""],
    ["Garafi Pratt","Eleanor O'Brien","CT","Houston, TX",""],
    ["Ian Grady","Jenny Kirou","MT","Denver","Y"],
    ["Janiel Barnes","Christen Caruthers","ET","Atlanta, GA",""],
    ["Jazzmyn Wright","Justin Givens","PT","Las Vegas, NV",""],
    ["Jennifer Sanchez","Christen Caruthers","ET","Orlando, FL",""],
    ["Jonathan Norris","Kevin Keough","MST","Phoenix, AZ",""],
    ["Katherine Mojica","Christen Caruthers","ET","Atlanta, GA",""],
    ["Lee Cha","Eleanor O'Brien","ET","NC",""],
    ["Maria Love","Kevin Keough","MST","Phoenix, AZ",""],
    ["Mike Meylor","Justin Givens","MT","CO",""],
    ["Natasha Tubbs","Justin Givens","CT","MS",""],
    ["Nellie Russell","Kevin Keough","MST","Phoenix, AZ",""],
    ["Pharrah Torres","Kevin Keough","MST","Phoenix, AZ",""],
    ["Psy Jefferson","","?","","Y"],
    ["Rebecca Harvey","Kevin Keough","MST","Phoenix, AZ",""],
    ["Ryan Furlong","Justin Givens","MST","Phoenix, AZ",""],
    ["Tawanda Peebles","Justin Givens","MST","Phoenix, AZ",""],
    ["Tiffany Fletcher","Justin Givens","MST","Phoenix, AZ",""],
    ["Tracey Kaplan","Jenny Kirou","MT","Denver","Y"],
    ["Yamilet Gomez","Jenny Kirou","CT","Houston, TX",""],
  ]},
  "Consumer Money/Members":{c:"#2BABAD",m:["Jess Torres"],a:[
    ["Amy Fraire","Jess Torres","CT","OK",""],
    ["Bobby Grazi","Jess Torres","MT","Denver","Y"],
    ["Emily Medrano","Jess Torres","CT","TX",""],
    ["Garrett Vartanian","Jess Torres","CT","Chicago, IL",""],
    ["Ian Moeser","Jess Torres","MT","Denver","Y"],
    ["Karsten Barndt","Jess Torres","MT","Denver","Y"],
    ["Moenique Hall","Jess Torres","ET","VA",""],
    ["Rob Bush","Jess Torres","MT","CO",""],
    ["Stefan Schiltz","Jess Torres","PT","WA",""],
    ["Taylor Heshmati","Jess Torres","MT","Denver","Y"],
  ]},
  "OCE - Onboarding":{c:"#18A870",m:["Andrew Szabo", "Gabriel Bonzie", "Georgeann Engstrand", "Haley Rhinehart", "Jeffrey Liggs", "Megan Clark", "Mollie Riegel", "Nikki Sparacio", "Tim LaBeau"],a:[
    ["Adriann Robinson","Jeffrey Liggs","ET","Detroit, MI",""],
    ["Alan Hernandez","Georgeann Engstrand","MST","Phoenix, AZ",""],
    ["Alexis Blanco Rubio","Jeffrey Liggs","CT","Houston, TX",""],
    ["Ashli McEvilly","Nikki Sparacio","MST","Phoenix, AZ",""],
    ["Audra Shurnas","Mollie Riegel","MT","Denver",""],
    ["Ben Hershik","Nikki Sparacio","CT","Chicago, IL",""],
    ["Ben Williams","Tim LaBeau","MT","Denver",""],
    ["Bri Wagner","Nikki Sparacio","MST","Phoenix, AZ",""],
    ["Brittney White","Jeffrey Liggs","ET","Atlanta, GA",""],
    ["Danielle Fernandez","Mollie Riegel","MT","Denver",""],
    ["Denisse Avalos-Frias","Mollie Riegel","MT","Denver",""],
    ["Devon Hudson","Jeffrey Liggs","ET","Detroit, MI",""],
    ["Elisha Szanyi","Andrew Szabo","PT","Las Vegas, NV",""],
    ["Ely Ganzhina","Jeffrey Liggs","MT","Denver",""],
    ["Emily Wray","Gabriel Bonzie","MT","Denver",""],
    ["Emma Sharpe","Andrew Szabo","MT","Denver",""],
    ["Eryn Brown","Nikki Sparacio","MST","Phoenix, AZ",""],
    ["Fallon Short","Andrew Szabo","MT","Denver",""],
    ["Georgia Beck","Mollie Riegel","MT","Denver",""],
    ["Haley Hug","Mollie Riegel","PT","San Diego, CA",""],
    ["Havanna Kimbrough","Mollie Riegel","MST","Phoenix, AZ",""],
    ["Jade Lott","Georgeann Engstrand","MST","Phoenix, AZ",""],
    ["Jamal Burrell","Nikki Sparacio","ET","Atlanta, GA",""],
    ["Jenny Pham","Jeffrey Liggs","MT","Denver",""],
    ["Juan Zamorano","Megan Clark","PT","Las Vegas, NV",""],
    ["Julieann Lopez","Jeffrey Liggs","CT","Houston, TX",""],
    ["Kayla Houston","Mollie Riegel","MT","Denver",""],
    ["Kaylynn Cervantes","Haley Rhinehart","MT","CO",""],
    ["Khadijah Crittenden","Georgeann Engstrand","ET","Atlanta, GA",""],
    ["Kristen Cullen","Jeffrey Liggs","MT","Denver",""],
    ["Laura Rodosky","Andrew Szabo","MT","Denver",""],
    ["Lauren Groves","Mollie Riegel","MT","Denver",""],
    ["Leslie Zhu","Tim LaBeau","MT","Denver",""],
    ["Mackinzi Mayfield","Nikki Sparacio","MST","Phoenix, AZ",""],
    ["Manny Martinez","Nikki Sparacio","ET","Orlando, FL",""],
    ["Molly Watkins","Nikki Sparacio","MST","Phoenix, AZ",""],
    ["Nicole Perkins","Mollie Riegel","CT","Chicago, IL",""],
    ["Parker Shaffer","Jeffrey Liggs","MT","Denver",""],
    ["Shaylen Piper","Georgeann Engstrand","MT","Denver",""],
    ["Steph Roberts","Jeffrey Liggs","MST","Phoenix, AZ",""],
    ["Stephanie Ha","Tim LaBeau","PT","Las Vegas, NV",""],
    ["Steven Rothbort","Mollie Riegel","PT","Las Vegas, NV",""],
    ["Tamara Reuter","Andrew Szabo","PT","Las Vegas, NV",""],
    ["Wyatt Zsidisin","Georgeann Engstrand","MT","Denver",""],
  ]},
  "Partner Care":{c:"#5090C0",m:["Brielle Burger", "Chris Wyer", "Cyndy Boerger", "Elayne Brown", "Evelyn Seamster", "Julissa Rosa", "Mark Bueche", "Seika Omine", "Tiffany Davidson (On Leave)"],a:[
    ["Alexys Price","Brielle Burger","MST","Phoenix, AZ",""],
    ["Amy Visher","Chris Wyer","PT","Las Vegas, NV",""],
    ["Arthur Moraes","Tiffany Davidson (On Leave)","ET","Orlando, FL",""],
    ["Ashley Manny","Julissa Rosa","ET","Orlando, FL",""],
    ["Brittney Porter","Chris Wyer","PT","Las Vegas, NV",""],
    ["Carrie Janney","Chris Wyer","PT","Las Vegas, NV",""],
    ["Charles Colon-Pena","Tiffany Davidson (On Leave)","ET","FL",""],
    ["Courtney Balaban","Tiffany Davidson (On Leave)","ET","GA",""],
    ["Daniel Penaloza","Brielle Burger","MST","Phoenix, AZ",""],
    ["Dominic Demers","Chris Wyer","MT","Denver","Y"],
    ["Elizabeth Boston","Cyndy Boerger","CT","TX",""],
    ["Hannah Richardson","Seika Omine","MT","Denver","Y"],
    ["Heather McCleskey","Cyndy Boerger","PT","Las Vegas, NV",""],
    ["Hennesey Celeste-Castillo","Chris Wyer","PT","Las Vegas, NV",""],
    ["Jeremiah Usher","Evelyn Seamster","PT","Las Vegas, NV",""],
    ["Jermaine Shelton","Chris Wyer","CT","Houston, TX",""],
    ["Jess Ferguson","Brielle Burger","PT","Las Vegas, NV",""],
    ["Jireh Johnson","Julissa Rosa","PT","Las Vegas, NV",""],
    ["Kahlil Wilson","Tiffany Davidson (On Leave)","CT","Chicago, IL",""],
    ["Kassidi Cottingham","Julissa Rosa","MT","Denver","Y"],
    ["Kate Modolo","Cyndy Boerger","MT","Denver","Y"],
    ["Kevin Delgado","Tiffany Davidson (On Leave)","ET","Orlando, FL",""],
    ["Kevin McNally","Elayne Brown","PT","Las Vegas, NV",""],
    ["Kiana Brown","Mark Bueche","ET","NC",""],
    ["Mackenzie Murphy","Cyndy Boerger","PT","Las Vegas, NV",""],
    ["Mahmoud Abyad","Julissa Rosa","CT","Chicago, IL",""],
    ["Mayia Washington","Tiffany Davidson (On Leave)","CT","Chicago, IL",""],
    ["Mila Silva","Seika Omine","MT","Denver","Y"],
    ["Pam McCray","Mark Bueche","PT","Las Vegas, NV",""],
    ["Shannon Curry","Cyndy Boerger","CT","Chicago, IL",""],
    ["Tanner Bedwell","Seika Omine","MT","Denver","Y"],
    ["Trevor Kruger","Seika Omine","MT","Denver","Y"],
  ]},
  "Payroll & Taxes":{c:"#D89020",m:["Chris Wyer", "Cyndy Boerger", "Elayne Brown", "Evelyn Seamster", "Julissa Rosa", "Mark Bueche", "Seika Omine", "Tiffany Davidson (On Leave)"],a:[
    ["Anthony Piper","Cyndy Boerger","PT","Las Vegas, NV",""],
    ["Ashley Dickey","Evelyn Seamster","MST","Phoenix, AZ",""],
    ["Briana Perez","Evelyn Seamster","MST","Phoenix, AZ",""],
    ["Brittany Brown","Cyndy Boerger","CT","Chicago, IL",""],
    ["Charita Ringo","Evelyn Seamster","MST","Phoenix, AZ",""],
    ["Christina Coffee","Elayne Brown","MST","Phoenix, AZ",""],
    ["Claudia Lizama","Evelyn Seamster","PT","Las Vegas, NV",""],
    ["D'Angela Redman","Julissa Rosa","CT","Chicago, IL",""],
    ["Deja Ramos","Elayne Brown","MST","Phoenix, AZ",""],
    ["Donna Jo Doney","Evelyn Seamster","MT","CO",""],
    ["Elexus Hunter","Elayne Brown","MST","Phoenix, AZ",""],
    ["Elhan Kolecic","Julissa Rosa","CT","Chicago, IL",""],
    ["Gala Ehumah","Seika Omine","CT","Chicago, IL",""],
    ["Gus Marin","Evelyn Seamster","CT","Chicago, IL",""],
    ["Harshith Mannera Subbaiah","Chris Wyer","MST","Phoenix, AZ",""],
    ["Hermes Diaz","Elayne Brown","PT","Las Vegas, NV",""],
    ["Holi Reed","Elayne Brown","CT","Chicago, IL",""],
    ["Itati Valencia","Chris Wyer","MST","Phoenix, AZ",""],
    ["Jasmine Gill","Elayne Brown","CT","Chicago, IL",""],
    ["Jazz Eaton","Seika Omine","MST","Phoenix, AZ",""],
    ["Jocelyne Valenzuela","Seika Omine","MST","Phoenix, AZ",""],
    ["Jordae Bourne","Evelyn Seamster","PT","Las Vegas, NV",""],
    ["Jordyn Richardson","Mark Bueche","PT","Las Vegas, NV",""],
    ["Juliana Villarreal","Chris Wyer","MST","Phoenix, AZ",""],
    ["Kelly Joe","Mark Bueche","CT","TX",""],
    ["La Tasha Ivey","Chris Wyer","MST","Phoenix, AZ",""],
    ["LaKeisha Hemphill","Elayne Brown","MST","Phoenix, AZ",""],
    ["Lisa Hightower","Seika Omine","CT","Chicago, IL",""],
    ["Marquesha Johnson","Tiffany Davidson (On Leave)","CT","Chicago, IL",""],
    ["Marquita Young","Tiffany Davidson (On Leave)","ET","Atlanta, GA",""],
    ["Mason Amling","Tiffany Davidson (On Leave)","CT","Chicago, IL",""],
    ["Mia Enriquez","Tiffany Davidson (On Leave)","CT","Chicago, IL",""],
    ["Natalie Chisholm","Evelyn Seamster","MT","Denver","Y"],
    ["Natasha Crook","Elayne Brown","MST","Phoenix, AZ",""],
    ["Renee Metzelfeld","Elayne Brown","PT","Las Vegas, NV",""],
    ["Rozine Vardanyan","Cyndy Boerger","CT","Chicago, IL",""],
    ["Sarah Manning","Cyndy Boerger","CT","Chicago, IL",""],
    ["Terrell Brooks","Evelyn Seamster","PT","Las Vegas, NV",""],
    ["Terrion Hill","Julissa Rosa","CT","Chicago, IL",""],
    ["Tommy Jerkovic","Julissa Rosa","CT","Chicago, IL",""],
    ["Tracy Lahs","Seika Omine","MST","Phoenix, AZ",""],
    ["Wendy Nolazco","Julissa Rosa","CT","Chicago, IL",""],
    ["Willy Sasso","Julissa Rosa","CT","Chicago, IL",""],
  ]},
  "Payroll Advanced Care":{c:"#B07818",m:["Brielle Burger", "Cyndy Boerger", "Elora Rozon", "Ivy Castelgrande", "Joel Ahrenberg", "Mark Bueche", "Valerie Nunez"],a:[
    ["Annabelle Goble","Ivy Castelgrande","CT","IL",""],
    ["Annabelle Rittel","Joel Ahrenberg","MT","Denver",""],
    ["Bria Marcelin","Brielle Burger","ET","Atlanta, GA",""],
    ["Chandler Wong","Joel Ahrenberg","MT","Denver",""],
    ["Chanel Armstrong","Ivy Castelgrande","CT","MO",""],
    ["Cherese Hamp","Ivy Castelgrande","CT","Chicago, IL",""],
    ["Danielle Bickham","Valerie Nunez","CT","LA",""],
    ["Danielle Snow","Valerie Nunez","ET","NC",""],
    ["Deidreana Moore","Ivy Castelgrande","ET","Orlando, FL",""],
    ["Denise Jones","Elora Rozon","MT","Denver",""],
    ["Donya Adams","Mark Bueche","ET","PA",""],
    ["Ebony Azzam","Mark Bueche","PT","Las Vegas, NV",""],
    ["Emily Strong","Joel Ahrenberg","MT","ID",""],
    ["Glenisha Coxall","Cyndy Boerger","ET","Atlanta, GA",""],
    ["Jenni Troy","Brielle Burger","MST","Phoenix, AZ",""],
    ["Jodie Cullen","Joel Ahrenberg","PT","Seattle, WA",""],
    ["Joe Martinez","Ivy Castelgrande","CT","TX",""],
    ["Jose Olivares","Ivy Castelgrande","CT","TX",""],
    ["Kelly Hazel","Joel Ahrenberg","MT","Denver",""],
    ["Kim Jones","Brielle Burger","CT","Houston, TX",""],
    ["LaSonja Johnson","Valerie Nunez","ET","SC",""],
    ["Laura Walsh","Brielle Burger","MST","Phoenix, AZ",""],
    ["Madison Gale","Valerie Nunez","ET","FL",""],
    ["Melvin Orji","Brielle Burger","MST","Phoenix, AZ",""],
    ["Peter O'Shea","Joel Ahrenberg","PT","Los Angeles, CA",""],
    ["Raven Harris","Ivy Castelgrande","CT","Chicago, IL",""],
    ["Rene Scott","Mark Bueche","ET","GA",""],
    ["Rocky DeSantis","Joel Ahrenberg","MT","Denver",""],
    ["Sarah Fihn","Joel Ahrenberg","PT","Las Vegas, NV",""],
    ["Sarah King","Mark Bueche","ET","Orlando, FL",""],
    ["Savannah Archuleta","Joel Ahrenberg","MT","NM",""],
    ["Tiffaney Jeffreys","Ivy Castelgrande","ET","Washington, DC",""],
    ["Vanessa Jones","Valerie Nunez","PT","WA",""],
    ["Zoe Morgan","Joel Ahrenberg","PT","San Diego, CA",""],
    ["Éliette Lewis","Valerie Nunez","ET","IN",""],
  ]},
  "Premier DSA":{c:"#D88060",m:["Brian Harz", "David Bristol", "Emily Hutmacher", "Heather Ferguson", "Jagan Perine", "Jeremy Schoonover", "Joe DiMarco", "Makelsii Simmons", "Mary Sorensen", "Monica Thompson", "Shawn Braddy", "Stephanie Michopoulo"],a:[
    ["Achebe Franklin","Heather Ferguson","CT","Chicago, IL",""],
    ["Aiyana Toliver","Makelsii Simmons","MST","Phoenix, AZ",""],
    ["Alan Gonzalez","Makelsii Simmons","CT","Chicago, IL",""],
    ["Alan Sava","David Bristol","CT","Chicago, IL",""],
    ["Alana Reinikka","Shawn Braddy","CT","TX",""],
    ["Alex Gonzalez","Brian Harz","CT","Chicago, IL",""],
    ["Alexa Culp","Makelsii Simmons","MST","Phoenix, AZ",""],
    ["Alyssa Ortiz","Makelsii Simmons","MST","Phoenix, AZ",""],
    ["Amber Domich","Brian Harz","CT","Chicago, IL",""],
    ["Amber Summers","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Andrea Melendez","Heather Ferguson","ET","Orlando, FL",""],
    ["Andrew Jennings","Brian Harz","CT","Chicago, IL",""],
    ["Andrew Winegar","Heather Ferguson","CT","Chicago, IL",""],
    ["Anthony Carbonell","Shawn Braddy","CT","Chicago, IL",""],
    ["Anthony Perkins","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Antwanae Cockrell","Mary Sorensen","MST","Phoenix, AZ",""],
    ["Asad Durrani","Shawn Braddy","CT","Chicago, IL",""],
    ["Ashley Gomez","Shawn Braddy","CT","TX",""],
    ["Ayanna Bailey","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Bre Davis","Shawn Braddy","CT","Chicago, IL",""],
    ["Brie Avila","Jagan Perine","MST","Phoenix, AZ",""],
    ["Brittany Dougherty","Jagan Perine","MST","Phoenix, AZ",""],
    ["Brittany Hightower","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Carltonia Forbes","Jagan Perine","MST","Phoenix, AZ",""],
    ["Cassie Wheeler","Makelsii Simmons","CT","Chicago, IL",""],
    ["Cat Castaneda","Monica Thompson","MST","Phoenix, AZ",""],
    ["Cathy Salas","Shawn Braddy","CT","Chicago, IL",""],
    ["Chantelle McCardell","Emily Hutmacher","CT","Houston, TX",""],
    ["Christina Mitchell","Monica Thompson","CT","KS",""],
    ["Daniel Fictum","Monica Thompson","MST","Phoenix, AZ",""],
    ["Danny Roman","Heather Ferguson","CT","Chicago, IL",""],
    ["Dave Camadini","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Denisse Aguilar","Mary Sorensen","CT","Chicago, IL",""],
    ["Devin Rodriguez","Jeremy Schoonover","ET","New York",""],
    ["Diamond Akins","Jagan Perine","MST","Phoenix, AZ",""],
    ["Diana Herrera","Emily Hutmacher","CT","Chicago, IL",""],
    ["Dion Evans","David Bristol","ET","Atlanta, GA",""],
    ["Dominika Banach","Shawn Braddy","CT","Chicago, IL",""],
    ["Dustin Farnsworth","Makelsii Simmons","MST","Phoenix, AZ",""],
    ["Edward Soto","Mary Sorensen","CT","TX",""],
    ["Enrique Uriostegui","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Erica Miller","Monica Thompson","MST","Phoenix, AZ",""],
    ["Fany Uriostegui","Heather Ferguson","CT","Chicago, IL",""],
    ["Georgia Gountanis","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Gia Annecca","Shawn Braddy","CT","Chicago, IL",""],
    ["Gina Correa","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Gustavo Molina Quebrado","Brian Harz","CT","Chicago, IL",""],
    ["Hafsa Fatima","Brian Harz","CT","Chicago, IL",""],
    ["Hakim Edwards","Jagan Perine","MST","Phoenix, AZ",""],
    ["Hannah Taylor","Monica Thompson","MST","Phoenix, AZ",""],
    ["Hugo Gomez-Nahle","Jagan Perine","MT","NM",""],
    ["Ian Glass","Makelsii Simmons","CT","Chicago, IL",""],
    ["Iiane Clay","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Imani Mathis","Stephanie Michopoulo","MT","Denver","Y"],
    ["Jack Banahan","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Jamie Gallagher","David Bristol","CT","TN",""],
    ["Jasmine Fabian","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Jasmine Perkins","Stephanie Michopoulo","PT","Las Vegas, NV",""],
    ["Jeffrey Kirkpatrick","Makelsii Simmons","CT","Chicago, IL",""],
    ["Jessica Rodriguez","Jeremy Schoonover","CT","Chicago, IL",""],
    ["Jesus Ortiz","Shawn Braddy","CT","Chicago, IL",""],
    ["Jolinda Williams","Shawn Braddy","ET","Atlanta, GA",""],
    ["Jordan Edmond","Jagan Perine","MST","Phoenix, AZ",""],
    ["Jordan Latham","Jagan Perine","MST","Phoenix, AZ",""],
    ["Jordan Robinson-Stark","Stephanie Michopoulo","MT","Denver",""],
    ["Jose Vizcarra Santana","Jagan Perine","MST","Phoenix, AZ",""],
    ["Justin Wysocke","Mary Sorensen","CT","Chicago, IL",""],
    ["Kaius Blackmon","David Bristol","CT","Chicago, IL",""],
    ["Karla Zurita","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Kate Speers","David Bristol","ET","Orlando, FL",""],
    ["Kelly Martin","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Kenny Brown","Heather Ferguson","CT","Chicago, IL",""],
    ["Magen Pignataro","Brian Harz","CT","Chicago, IL",""],
    ["Malcolm Phillips","Jeremy Schoonover","ET","New York",""],
    ["Malina Jones","Jagan Perine","MST","Phoenix, AZ",""],
    ["Marie Coller","David Bristol","CT","Chicago, IL",""],
    ["Mario Torres","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Marlen Esparza","Mary Sorensen","CT","Chicago, IL",""],
    ["Mary Convery","David Bristol","ET","Detroit, MI",""],
    ["Matt Dye","Mary Sorensen","MST","Phoenix, AZ",""],
    ["Melissa Mendoza","Makelsii Simmons","CT","Chicago, IL",""],
    ["Michael Calcara","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Mike Bare","David Bristol","CT","Chicago, IL",""],
    ["Morgan Lopez","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Naomi Nighswonger","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Nick James","Monica Thompson","MST","Phoenix, AZ",""],
    ["Nick Pineda","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Nick Rycraft","Brian Harz","CT","Chicago, IL",""],
    ["Nicole Klingbeil","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Paula Stanley","Monica Thompson","MT","Denver","Y"],
    ["Paulina Pachel","Brian Harz","CT","Chicago, IL",""],
    ["Que Arthur","David Bristol","CT","Chicago, IL",""],
    ["Rashad Williams","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Rodney Jackson","Monica Thompson","MST","Phoenix, AZ",""],
    ["Royalan Swanson","Makelsii Simmons","MST","Phoenix, AZ",""],
    ["Ryan Trujillo","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Sam Banuelos","Mary Sorensen","CT","Chicago, IL",""],
    ["Sara Mercado-Soebbing","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Scott Schwartz","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Shahristan Alhamy","Mary Sorensen","CT","Chicago, IL",""],
    ["Sharazad Lebanno","Mary Sorensen","MT","CO",""],
    ["Shatavia Robinson","Shawn Braddy","ET","SC",""],
    ["Stephanie Chairez","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Summer Mitchell","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Tatjana Cruz","Mary Sorensen","CT","Chicago, IL",""],
    ["Taylor Postal","Emily Hutmacher","CT","Chicago, IL",""],
    ["Tea Baldwin","Monica Thompson","MT","Denver","Y"],
    ["Tierra Myers","Emily Hutmacher","MST","Phoenix, AZ",""],
    ["Tiffany Vann","David Bristol","ET","Atlanta, GA",""],
    ["Tori Zemla","Jagan Perine","MST","Phoenix, AZ",""],
    ["Twandale Robinson","Stephanie Michopoulo","PT","Las Vegas, NV",""],
    ["Tysean Carter","Joe DiMarco","MST","Phoenix, AZ",""],
    ["Wes Woods","Stephanie Michopoulo","MST","Phoenix, AZ",""],
    ["Zach Ciszek","Heather Ferguson","CT","Chicago, IL",""],
  ]},
  "SMB - Sales":{c:"#E84840",m:["Ashley Broadwell", "Christina Romero", "Christy Naranjo", "Ethan Barrowclough", "Haley Rhinehart", "Moe Campbell", "Nicholas Canham", "Shawn Wilson", "Sophia Kamp", "Stephen Wade", "Tim LaBeau", "Tim Manning"],a:[
    ["Alex Mathern","Ashley Broadwell","MST","Phoenix, AZ",""],
    ["Alex Predmore","Nicholas Canham","MT","Denver",""],
    ["Alicia Salazar","Christy Naranjo","MT","CO",""],
    ["Alondra Lopez Soto","Tim Manning","MST","Phoenix, AZ",""],
    ["Anthony Javier","Ethan Barrowclough","PT","Los Angeles, CA",""],
    ["Araya Lessard","Ethan Barrowclough","ET","Detroit, MI",""],
    ["Arienne Souvenance","Christina Romero","ET","Atlanta, GA",""],
    ["Ashton Gildner","Nicholas Canham","MST","Phoenix, AZ",""],
    ["Brandon Larsen","Nicholas Canham","MT","Denver",""],
    ["Bryce Hempel","Sophia Kamp","MT","Denver",""],
    ["Camden Chose","Moe Campbell","MT","Denver",""],
    ["Celina Lieu","Ashley Broadwell","MT","Denver",""],
    ["Christiana Behm","Nicholas Canham","CT","Chicago, IL",""],
    ["Christopher Hurns","Moe Campbell","PT","Las Vegas, NV",""],
    ["Cody Clay","Moe Campbell","ET","Raleigh, NC",""],
    ["Dilson Escriba","Tim LaBeau","PT","Las Vegas, NV",""],
    ["Frank Muehlfelt","Ashley Broadwell","MT","Denver",""],
    ["Hannah Schmidt","Tim Manning","MST","Phoenix, AZ",""],
    ["Hugo Hanriot","Moe Campbell","MT","CO",""],
    ["Ian Graffagna","Haley Rhinehart","MT","Denver",""],
    ["Jabou Konateh","Stephen Wade","PT","San Francisco",""],
    ["Jalil Jones","Ashley Broadwell","ET","Atlanta, GA",""],
    ["Jay Sanders","Christina Romero","MT","Denver",""],
    ["John Fitzgerald","Ethan Barrowclough","MT","Denver",""],
    ["John Halgren","Christina Romero","MST","Phoenix, AZ",""],
    ["Julia Peterson","Ashley Broadwell","MT","Denver",""],
    ["Karen Crenshaw","Sophia Kamp","ET","Orlando, FL",""],
    ["Katie Cole","Nicholas Canham","MT","Denver",""],
    ["Kevin Vo","Nicholas Canham","CT","Chicago, IL",""],
    ["Kyle Seaward","Ethan Barrowclough","ET","NH",""],
    ["Liam Cortez","Ashley Broadwell","MT","Denver",""],
    ["Manuela Pastor","Ashley Broadwell","MT","Denver",""],
    ["Marcus Hamilton","Ethan Barrowclough","MT","Denver",""],
    ["Marlyn Burciaga","Ashley Broadwell","MT","Denver",""],
    ["Matt Pitner","Christina Romero","MT","Denver",""],
    ["Melanie Shanks","Christina Romero","MT","Denver",""],
    ["Mohini Patel","Nicholas Canham","CT","Chicago, IL",""],
    ["Oscar Niebla Fuentes","Ethan Barrowclough","PT","San Francisco",""],
    ["Paul Phung","Sophia Kamp","ET","FL",""],
    ["Sara Patterson","Shawn Wilson","ET","Orlando, FL",""],
    ["Scott Johns","Sophia Kamp","ET","Detroit, MI",""],
    ["Tonya Sarina","Haley Rhinehart","MT","Denver",""],
    ["Vanilo Beaudouin","Moe Campbell","CT","TX",""],
    ["Vishal Chatani","Ashley Broadwell","MT","Denver",""],
  ]},
};

const CLEARCAST_DATA = {
  "Accountant":{q:2,fV:13525,aV:13000,sl:60,slT:88,wk:4391,hc:32,ph:{fV:4154,aV:3834,fA:805,aA:560,fH:929,aH:596},em:{fV:9371,aV:9166,fA:1500,aA:1486,fH:3905,aH:3784},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "Advising":{q:3,fV:8411,aV:732,sl:0,slT:80,wk:145,hc:38,ph:{fV:3128,aV:186,fA:5604,aA:3916,fH:4869,aH:202},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "BAC":{q:7,fV:8227,aV:8425,sl:74,slT:90,wk:2383,hc:27,ph:{fV:332,aV:241,fA:989,aA:508,fH:91,aH:34},em:{fV:7577,aV:7885,fA:1724,aA:1960,fH:3629,aH:4293},ch:{fV:318,aV:299,fA:4397,aA:1942,fH:388,aH:161}},
  "BYB":{q:1,fV:740,aV:337,sl:0,slT:0,wk:73,hc:1,ph:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "BenOps Support":{q:1,fV:2640,aV:2378,sl:0,slT:0,wk:772,hc:3,ph:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "Benefit Transfers":{q:1,fV:317,aV:165,sl:0,slT:0,wk:56,hc:1,ph:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "Benefits":{q:20,fV:29340,aV:28152,sl:69,slT:90,wk:8568,hc:58,ph:{fV:12723,aV:11062,fA:803,aA:558,fH:2838,aH:1715},em:{fV:8323,aV:8624,fA:1694,aA:1649,fH:3916,aH:3950},ch:{fV:8294,aV:8466,fA:816,aA:642,fH:1880,aH:1510}},
  "DSA":{q:1,fV:3459,aV:4108,sl:57,slT:80,wk:1357,hc:6,ph:{fV:3459,aV:4108,fA:946,aA:656,fH:909,aH:749},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "GPC Sales":{q:1,fV:379,aV:158,sl:71,slT:80,wk:48,hc:1,ph:{fV:379,aV:158,fA:387,aA:406,fH:41,aH:18},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "GroupOps":{q:2,fV:19643,aV:16490,sl:0,slT:0,wk:5165,hc:22,ph:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "Member":{q:5,fV:13307,aV:12963,sl:86,slT:88,wk:4682,hc:19,ph:{fV:6401,aV:6239,fA:682,aA:479,fH:1213,aH:830},em:{fV:3707,aV:4029,fA:948,aA:985,fH:976,aH:1102},ch:{fV:3199,aV:2695,fA:816,aA:828,fH:725,aH:620}},
  "Money":{q:5,fV:11139,aV:11244,sl:79,slT:88,wk:4191,hc:15,ph:{fV:4636,aV:4317,fA:695,aA:492,fH:895,aH:590},em:{fV:4022,aV:4229,fA:725,aA:750,fH:810,aH:881},ch:{fV:2481,aV:2698,fA:786,aA:796,fH:542,aH:597}},
  "Money T2":{q:2,fV:4488,aV:5345,sl:62,slT:92,wk:1597,hc:8,ph:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},em:{fV:4488,aV:5345,fA:983,aA:1006,fH:1225,aH:1494},ch:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0}},
  "Onboarding":{q:3,fV:19678,aV:23729,sl:48,slT:83,wk:7374,hc:16,ph:{fV:18350,aV:21872,fA:392,aA:392,fH:1998,aH:2382},em:{fV:0,aV:0,fA:0,aA:0,fH:0,aH:0},ch:{fV:1328,aV:1857,fA:898,aA:860,fH:331,aH:444}},
  "PAC":{q:5,fV:16935,aV:15063,sl:60,slT:89,wk:5066,hc:64,ph:{fV:1811,aV:1683,fA:1127,aA:794,fH:567,aH:371},em:{fV:14213,aV:12502,fA:2182,aA:2416,fH:8615,aH:8390},ch:{fV:911,aV:878,fA:1332,aA:944,fH:337,aH:230}},
  "Payroll/Taxes":{q:13,fV:95361,aV:93476,sl:76,slT:86,wk:30805,hc:186,ph:{fV:50996,aV:49334,fA:828,aA:580,fH:11729,aH:7948},em:{fV:22866,aV:23027,fA:1453,aA:1476,fH:9229,aH:9441},ch:{fV:21499,aV:21115,fA:1136,aA:1159,fH:6784,aH:6798}},
  "Premier":{q:10,fV:7995,aV:7551,sl:68,slT:91,wk:2546,hc:20,ph:{fV:3703,aV:3676,fA:718,aA:364,fH:739,aH:372},em:{fV:3157,aV:2808,fA:2094,aA:1873,fH:1836,aH:1461},ch:{fV:1135,aV:1067,fA:1233,aA:864,fH:389,aH:256}},
  "Sales":{q:4,fV:37179,aV:35329,sl:66,slT:84,wk:11079,hc:23,ph:{fV:32931,aV:33535,fA:295,aA:294,fH:2699,aH:2739},em:{fV:1526,aV:230,fA:600,aA:0,fH:254,aH:0},ch:{fV:2722,aV:1564,fA:568,aA:547,fH:429,aH:238}},
};



const agentSlugId = (n) =>
  "agent-" + n.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
const makeAgent = (n, p, sh, se, segs, extra = {}) => ({
  id: extra.id ?? agentSlugId(n),
  n,
  p,
  sh,
  se,
  segs,
  ...extra,
});
/** Anchor day for schedule editor — uses today's date so it always stays current. */
const SCHEDULE_ANCHOR_DATE = new Date();
const AGENTS_BASE = [
  makeAgent("Anthony Piper","Payroll & Taxes",8.5,17.0,[{a:"Gustie Guide Training",sh:8.5,eh:8.75},{a:"Chat/Email",sh:8.75,eh:11.0},{a:"Break",sh:11.0,eh:11.25},{a:"Chat/Email",sh:11.25,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"Phone",sh:13.75,eh:15.25},{a:"Break",sh:15.25,eh:15.5},{a:"Phone",sh:15.5,eh:17.0}]),
  makeAgent("Briana Perez","Payroll & Taxes",9.0,17.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Email",sh:9.25,eh:11.0},{a:"Break",sh:11.0,eh:11.25},{a:"Email",sh:11.25,eh:13.5},{a:"Lunch",sh:13.5,eh:14.0},{a:"Email",sh:14.0,eh:15.75},{a:"Break",sh:15.75,eh:16.0},{a:"Email",sh:16.0,eh:17.5}]),
  makeAgent("Brittany Brown","Payroll & Taxes",9.0,13.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Email",sh:9.25,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Phone",sh:11.0,eh:13.5}]),
  makeAgent("Claudia Lizama","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Email",sh:8.25,eh:9.5},{a:"Break",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:11.75},{a:"Lunch",sh:11.75,eh:12.25},{a:"Email",sh:12.25,eh:14.5},{a:"Break",sh:14.5,eh:14.75},{a:"Email",sh:14.75,eh:16.5}]),
  makeAgent("Donna Jo Doney","Payroll & Taxes",7.0,15.5,[{a:"Gustie Guide Training",sh:7.0,eh:7.25},{a:"Email",sh:7.25,eh:8.75},{a:"Break",sh:8.75,eh:9.0},{a:"Email",sh:9.0,eh:10.75},{a:"Lunch",sh:10.75,eh:11.25},{a:"Email",sh:11.25,eh:12.75},{a:"Break",sh:12.75,eh:13.0},{a:"Email",sh:13.0,eh:15.5}]),
  makeAgent("Holi Reed","Payroll & Taxes",9.0,13.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Phone",sh:9.25,eh:11.0},{a:"Break",sh:11.0,eh:11.25},{a:"Chat/Email",sh:11.25,eh:13.5}]),
  makeAgent("Jordyn Richardson","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:11.5},{a:"Break",sh:11.5,eh:11.75},{a:"Email",sh:11.75,eh:13.5},{a:"Lunch",sh:13.5,eh:14.0},{a:"Email",sh:14.0,eh:15.75},{a:"Break",sh:15.75,eh:16.0},{a:"Email",sh:16.0,eh:18.0}]),
  makeAgent("La Tasha Ivey","Payroll & Taxes",9.5,11.75,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Chat/Email",sh:9.75,eh:11.75}]),
  makeAgent("Mia Enriquez","Payroll & Taxes",7.5,13.75,[{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:9.0},{a:"Break",sh:9.0,eh:9.25},{a:"Email",sh:9.25,eh:11.0},{a:"Lunch",sh:11.0,eh:11.5},{a:"Email",sh:11.5,eh:13.5},{a:"Break",sh:13.5,eh:13.75}]),
  makeAgent("Renee Metzelfeld","Payroll & Taxes",9.0,10.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Phone",sh:9.25,eh:10.5}]),
  makeAgent("Wendy Nolazco","Payroll & Taxes",7.5,16.0,[{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:9.25},{a:"Break",sh:9.25,eh:9.5},{a:"Email",sh:9.5,eh:11.0},{a:"Lunch",sh:11.0,eh:11.5},{a:"Email",sh:11.5,eh:13.75},{a:"Break",sh:13.75,eh:14.0},{a:"Email",sh:14.0,eh:16.0}]),
  makeAgent("Ashley Dickey","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:11.25},{a:"Break",sh:11.25,eh:11.5},{a:"Chat/Email",sh:11.5,eh:13.0},{a:"Phone",sh:13.0,eh:14.0},{a:"Lunch",sh:14.0,eh:14.5},{a:"Phone",sh:14.5,eh:16.5},{a:"Break",sh:16.5,eh:16.75},{a:"Email",sh:16.75,eh:18.0}]),
  makeAgent("Brandy Dishman","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Phone",sh:8.25,eh:9.75},{a:"Break",sh:9.75,eh:10.0},{a:"Email",sh:10.0,eh:11.75},{a:"Lunch",sh:11.75,eh:12.25},{a:"Phone",sh:12.25,eh:14.0},{a:"Break",sh:14.0,eh:14.25},{a:"Chat/Email",sh:14.25,eh:16.5}]),
  makeAgent("Charita Ringo","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:11.5},{a:"Break",sh:11.5,eh:11.75},{a:"Email",sh:11.75,eh:14.0},{a:"Lunch",sh:14.0,eh:14.5},{a:"Email",sh:14.5,eh:16.5},{a:"Break",sh:16.5,eh:16.75},{a:"Email",sh:16.75,eh:18.0}]),
  makeAgent("Christina Coffee","Payroll & Taxes",9.0,17.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Email",sh:9.25,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Email",sh:11.0,eh:12.25},{a:"Lunch",sh:12.25,eh:12.75},{a:"Email",sh:12.75,eh:15.5},{a:"Break",sh:15.5,eh:15.75},{a:"Email",sh:15.75,eh:17.5}]),
  makeAgent("Deja Ramos","Payroll & Taxes",9.5,18.0,[{a:"LOA",sh:9.5,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"LOA",sh:13.75,eh:18.0}],{loa:true}),
  makeAgent("Mason Amling","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Email",sh:8.25,eh:10.25},{a:"Break",sh:10.25,eh:10.5},{a:"Phone",sh:10.5,eh:12.0},{a:"Lunch",sh:12.0,eh:12.5},{a:"Chat/Email",sh:12.5,eh:14.25},{a:"Break",sh:14.25,eh:14.5},{a:"Phone",sh:14.5,eh:16.5}]),
  makeAgent("Natalie Chisholm","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Phone",sh:8.25,eh:10.25},{a:"Break",sh:10.25,eh:10.5},{a:"Chat/Email",sh:10.5,eh:12.5},{a:"Lunch",sh:12.5,eh:13.0},{a:"Email",sh:13.0,eh:14.75},{a:"Break",sh:14.75,eh:15.0},{a:"Phone",sh:15.0,eh:16.5}]),
  makeAgent("Natasha Crook","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Phone",sh:9.75,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Training",sh:11.0,eh:11.5},{a:"Email",sh:11.5,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"Chat/Email",sh:13.75,eh:15.5},{a:"Break",sh:15.5,eh:15.75},{a:"Phone",sh:15.75,eh:18.0}]),
  makeAgent("Rozine Vardanyan","Payroll & Taxes",6.5,15.0,[{a:"Gustie Guide Training",sh:6.5,eh:6.75},{a:"Email",sh:6.75,eh:8.5},{a:"Break",sh:8.5,eh:8.75},{a:"Email",sh:8.75,eh:10.5},{a:"Lunch",sh:10.5,eh:11.0},{a:"Email",sh:11.0,eh:13.0},{a:"Break",sh:13.0,eh:13.25},{a:"Email",sh:13.25,eh:15.0}]),
  makeAgent("D'Angela Redman","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Phone",sh:9.75,eh:11.25},{a:"Break",sh:11.25,eh:11.5},{a:"Chat/Email",sh:11.5,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"Email",sh:13.75,eh:15.5},{a:"Break",sh:15.5,eh:15.75},{a:"Phone",sh:15.75,eh:18.0}]),
  makeAgent("Elexus Hunter","Payroll & Taxes",8.5,17.0,[{a:"Gustie Guide Training",sh:8.5,eh:8.75},{a:"Phone",sh:8.75,eh:9.75},{a:"Break",sh:9.75,eh:10.0},{a:"Phone",sh:10.0,eh:12.25},{a:"Chat/Email",sh:12.25,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"Email",sh:13.75,eh:15.5},{a:"Break",sh:15.5,eh:15.75},{a:"Chat/Email",sh:15.75,eh:17.0}]),
  makeAgent("Elhan Kolecic","Payroll & Taxes",7.5,16.0,[{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:8.75},{a:"Break",sh:8.75,eh:9.0},{a:"Email",sh:9.0,eh:11.25},{a:"Lunch",sh:11.25,eh:11.75},{a:"Email",sh:11.75,eh:13.25},{a:"Break",sh:13.25,eh:13.5},{a:"Email",sh:13.5,eh:16.0}]),
  makeAgent("Gala Ehumah","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Email",sh:8.25,eh:10.0},{a:"Break",sh:10.0,eh:10.25},{a:"Email",sh:10.25,eh:12.5},{a:"Lunch",sh:12.5,eh:13.0},{a:"Email",sh:13.0,eh:14.75},{a:"Break",sh:14.75,eh:15.0},{a:"Email",sh:15.0,eh:16.5}]),
  makeAgent("Gus Marin","Payroll & Taxes",6.5,15.0,[{a:"Gustie Guide Training",sh:6.5,eh:6.75},{a:"Phone",sh:6.75,eh:8.5},{a:"Break",sh:8.5,eh:8.75},{a:"Chat/Email",sh:8.75,eh:10.75},{a:"Lunch",sh:10.75,eh:11.25},{a:"Chat/Email",sh:11.25,eh:13.25},{a:"Break",sh:13.25,eh:13.5},{a:"Phone",sh:13.5,eh:15.0}]),
  makeAgent("LaKeisha Hemphill","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Phone",sh:9.75,eh:12.0},{a:"Break",sh:12.0,eh:12.25},{a:"Chat/Email",sh:12.25,eh:14.5},{a:"Lunch",sh:14.5,eh:15.0},{a:"Email",sh:15.0,eh:16.75},{a:"Break",sh:16.75,eh:17.0},{a:"Phone",sh:17.0,eh:18.0}]),
  makeAgent("Marquita Young","Payroll & Taxes",6.0,14.5,[{a:"Email",sh:6.0,eh:7.25},{a:"Break",sh:7.25,eh:7.5},{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:9.5},{a:"Lunch",sh:9.5,eh:10.0},{a:"Email",sh:10.0,eh:12.25},{a:"Break",sh:12.25,eh:12.5},{a:"Email",sh:12.5,eh:14.5}]),
  makeAgent("Sarah Manning","Payroll & Taxes",7.5,16.0,[{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:9.0},{a:"Break",sh:9.0,eh:9.25},{a:"Email",sh:9.25,eh:11.25},{a:"Lunch",sh:11.25,eh:11.75},{a:"Phone",sh:11.75,eh:14.0},{a:"Break",sh:14.0,eh:14.25},{a:"Chat/Email",sh:14.25,eh:16.0}]),
  makeAgent("Terrion Hill","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Email",sh:8.25,eh:9.75},{a:"Break",sh:9.75,eh:10.0},{a:"Phone",sh:10.0,eh:11.75},{a:"Lunch",sh:11.75,eh:12.25},{a:"Chat/Email",sh:12.25,eh:14.25},{a:"Break",sh:14.25,eh:14.5},{a:"Phone",sh:14.5,eh:16.5}]),
  makeAgent("Harshith Mannera Subbaiah","Payroll & Taxes",9.0,17.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Chat/Email",sh:9.25,eh:11.25},{a:"Break",sh:11.25,eh:11.5},{a:"Phone",sh:11.5,eh:13.75},{a:"Lunch",sh:13.75,eh:14.25},{a:"Chat/Email",sh:14.25,eh:16.25},{a:"Break",sh:16.25,eh:16.5},{a:"Phone",sh:16.5,eh:17.5}]),
  makeAgent("Hermes Diaz","Payroll & Taxes",10.0,18.5,[{a:"Gustie Guide Training",sh:10.0,eh:10.25},{a:"Phone",sh:10.25,eh:11.5},{a:"Break",sh:11.5,eh:11.75},{a:"Chat/Email",sh:11.75,eh:13.75},{a:"Lunch",sh:13.75,eh:14.25},{a:"Phone",sh:14.25,eh:16.25},{a:"Break",sh:16.25,eh:16.5},{a:"Chat/Email",sh:16.5,eh:18.5}]),
  makeAgent("Itati Valencia","Payroll & Taxes",8.5,17.0,[{a:"Gustie Guide Training",sh:8.5,eh:8.75},{a:"Chat/Email",sh:8.75,eh:9.75},{a:"Break",sh:9.75,eh:10.0},{a:"Chat/Email",sh:10.0,eh:13.0},{a:"Lunch",sh:13.0,eh:13.5},{a:"Phone",sh:13.5,eh:15.75},{a:"Break",sh:15.75,eh:16.0},{a:"Phone",sh:16.0,eh:17.0}]),
  makeAgent("Jasmine Gill","Payroll & Taxes",9.0,13.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Phone",sh:9.25,eh:10.0},{a:"Chat/Email",sh:10.0,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Chat/Email",sh:11.0,eh:12.25},{a:"Phone",sh:12.25,eh:13.5}]),
  makeAgent("Jordae Bourne","Payroll & Taxes",10.0,18.5,[{a:"Gustie Guide Training",sh:10.0,eh:10.25},{a:"Email",sh:10.25,eh:11.75},{a:"Break",sh:11.75,eh:12.0},{a:"Email",sh:12.0,eh:13.75},{a:"Lunch",sh:13.75,eh:14.25},{a:"Email",sh:14.25,eh:17.0},{a:"Break",sh:17.0,eh:17.25},{a:"Email",sh:17.25,eh:18.5}]),
  makeAgent("Marquesha Johnson","Payroll & Taxes",8.0,16.5,[{a:"Gustie Guide Training",sh:8.0,eh:8.25},{a:"Email",sh:8.25,eh:9.75},{a:"Break",sh:9.75,eh:10.0},{a:"Email",sh:10.0,eh:11.5},{a:"Lunch",sh:11.5,eh:12.0},{a:"Email",sh:12.0,eh:13.75},{a:"Break",sh:13.75,eh:14.0},{a:"Email",sh:14.0,eh:16.5}]),
  makeAgent("Terrell Brooks","Payroll & Taxes",8.5,17.0,[{a:"Gustie Guide Training",sh:8.5,eh:8.75},{a:"Phone",sh:8.75,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Phone",sh:11.0,eh:12.25},{a:"Email",sh:12.25,eh:13.25},{a:"Lunch",sh:13.25,eh:13.75},{a:"Email",sh:13.75,eh:15.0},{a:"Break",sh:15.0,eh:15.25},{a:"Chat/Email",sh:15.25,eh:17.0}]),
  makeAgent("Jazz Eaton","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Chat/Email",sh:9.75,eh:11.5},{a:"Break",sh:11.5,eh:11.75},{a:"Chat/Email",sh:11.75,eh:13.75},{a:"Lunch",sh:13.75,eh:14.25},{a:"Phone",sh:14.25,eh:16.0},{a:"Break",sh:16.0,eh:16.25},{a:"Chat/Email",sh:16.25,eh:18.0}]),
  makeAgent("Jocelyne Valenzuela","Payroll & Taxes",8.5,17.0,[{a:"Planned Time Off",sh:8.5,eh:12.75},{a:"Lunch",sh:12.75,eh:13.25},{a:"Planned Time Off",sh:13.25,eh:17.0}],{pto:true}),
  makeAgent("Juliana Villarreal","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:11.75},{a:"Break",sh:11.75,eh:12.0},{a:"Phone",sh:12.0,eh:14.25},{a:"Lunch",sh:14.25,eh:14.75},{a:"Chat/Email",sh:14.75,eh:16.5},{a:"Break",sh:16.5,eh:16.75},{a:"Phone",sh:16.75,eh:18.0}]),
  makeAgent("Kelly Joe","Payroll & Taxes",7.5,16.0,[{a:"Gustie Guide Training",sh:7.5,eh:7.75},{a:"Email",sh:7.75,eh:9.25},{a:"Break",sh:9.25,eh:9.5},{a:"Email",sh:9.5,eh:11.5},{a:"Lunch",sh:11.5,eh:12.0},{a:"Email",sh:12.0,eh:13.75},{a:"Break",sh:13.75,eh:14.0},{a:"Email",sh:14.0,eh:16.0}]),
  makeAgent("Lisa Hightower","Payroll & Taxes",9.0,13.5,[{a:"Planned Time Off",sh:9.0,eh:13.5}],{pto:true}),
  makeAgent("Tommy Jerkovic","Payroll & Taxes",6.5,15.0,[{a:"Gustie Guide Training",sh:6.5,eh:6.75},{a:"Phone",sh:6.75,eh:8.0},{a:"Break",sh:8.0,eh:8.25},{a:"Phone",sh:8.25,eh:9.25},{a:"Chat/Email",sh:9.25,eh:10.25},{a:"Lunch",sh:10.25,eh:10.75},{a:"Phone",sh:10.75,eh:12.25},{a:"Break",sh:12.25,eh:12.5},{a:"Phone",sh:12.5,eh:14.25},{a:"Email",sh:14.25,eh:15.0}]),
  makeAgent("Tracy Lahs","Payroll & Taxes",9.5,18.0,[{a:"Gustie Guide Training",sh:9.5,eh:9.75},{a:"Email",sh:9.75,eh:10.75},{a:"Break",sh:10.75,eh:11.0},{a:"Email",sh:11.0,eh:12.5},{a:"Chat/Email",sh:12.5,eh:14.25},{a:"Lunch",sh:14.25,eh:14.75},{a:"Phone",sh:14.75,eh:16.25},{a:"Break",sh:16.25,eh:16.5},{a:"Phone",sh:16.5,eh:18.0}]),
  makeAgent("Willy Sasso","Payroll & Taxes",9.0,13.5,[{a:"Gustie Guide Training",sh:9.0,eh:9.25},{a:"Phone",sh:9.25,eh:11.0},{a:"Break",sh:11.0,eh:11.25},{a:"Email",sh:11.25,eh:13.5}]),
];

// ── SCHEDULE GENERATION ────────────────────────────────────────
// Deterministic per-agent schedule generator — same name always
// produces the same segments, so refreshes are stable.

const _PILLAR_ACTS = {
  "Payroll & Taxes":        ["Phone","Email","Chat/Email","FEIN"],
  "BenOps":                 ["Phone","Email","Chat/Email","Core Work","COBRA / Continuation","EE Termination"],
  "Benefits Care":          ["Phone","Email","Chat/Email","QLE (qualifying life event)"],
  "Benefits Advanced Care": ["Phone","Email","QLE (qualifying life event)","NHE (New hire enrollment)"],
  "Payroll Advanced Care":  ["Phone","Chat/Email","Email","FEIN"],
  "OCE - Onboarding":       ["Phone","Chat/Email","Email","Core Work"],
  "Premier DSA":            ["Phone","Email","Chat/Email","Outbound Call"],
  "SMB - Sales":            ["Phone","Chat/Email","Outbound Call"],
  "Partner Care":           ["Phone","Email","Core Work"],
  "Accountant DSA":         ["Phone","Email","FEIN","Core Work"],
  "Consumer Money/Members": ["Phone","Email","Chat/Email","Outbound Call"],
};

const _TZ_STARTS = {
  ET: [7.0,7.5,8.0,8.5,9.0,9.5,10.0],
  CT: [7.0,7.5,8.0,8.5,9.0,9.5],
  MT: [6.5,7.0,7.5,8.0,8.5],
  PT: [6.0,6.5,7.0,7.5,8.0],
};
const _DURATIONS = [4.5,4.5,7.5,8.0,8.0,8.5,9.0];

function _nameHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function _makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
  return {
    next,
    bool: (p = 0.5) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

function _snap(v) { return Math.round(v * 4) / 4; }

function _generateSegs(sh, se, acts, seed) {
  const segs = [];
  const rng = _makeRng(seed);
  let t = sh;

  // Optional opening block (~65%)
  if (rng.bool(0.65)) {
    segs.push({ a: rng.bool(0.7) ? "Gustie Guide Training" : "Meeting", sh: t, eh: t + 0.25 });
    t += 0.25;
  }

  const rem = _snap(se - t);
  if (rem <= 0) return segs;

  if (rem < 2.5) {
    segs.push({ a: rng.pick(acts), sh: t, eh: se });
    return segs;
  }

  if (rem < 5.25) {
    const b1 = _snap(rem * (0.4 + rng.next() * 0.15));
    segs.push({ a: rng.pick(acts), sh: t, eh: t + b1 }); t += b1;
    segs.push({ a: "Break",        sh: t, eh: t + 0.25 }); t += 0.25;
    segs.push({ a: rng.pick(acts), sh: t, eh: se });
    return segs;
  }

  // Full shift: work, break, work, lunch, work, break, work
  const lunchLen = rng.bool() ? 0.5 : 0.75;
  const budget = _snap(rem - 0.5 - lunchLen);
  const b1 = _snap(budget * (0.28 + rng.next() * 0.10));
  const b2 = _snap(budget * (0.22 + rng.next() * 0.08));
  const b3 = _snap(budget * (0.22 + rng.next() * 0.08));

  segs.push({ a: rng.pick(acts), sh: t, eh: _snap(t+b1) }); t = _snap(t+b1);
  segs.push({ a: "Break",        sh: t, eh: _snap(t+0.25) }); t = _snap(t+0.25);
  segs.push({ a: rng.pick(acts), sh: t, eh: _snap(t+b2) }); t = _snap(t+b2);
  segs.push({ a: "Lunch",        sh: t, eh: _snap(t+lunchLen) }); t = _snap(t+lunchLen);
  segs.push({ a: rng.pick(acts), sh: t, eh: _snap(t+b3) }); t = _snap(t+b3);
  segs.push({ a: "Break",        sh: t, eh: _snap(t+0.25) }); t = _snap(t+0.25);
  segs.push({ a: rng.pick(acts), sh: t, eh: se });
  return segs;
}

function _rosterToAgent(name, pillar, tz) {
  const seed = _nameHash(name + pillar);
  const rng = _makeRng(seed);
  const sh = rng.pick(_TZ_STARTS[tz] || _TZ_STARTS.ET);
  const se = _snap(sh + rng.pick(_DURATIONS));
  const acts = _PILLAR_ACTS[pillar] || ["Phone","Email"];
  return makeAgent(name, pillar, sh, se, _generateSegs(sh, se, acts, seed ^ 0xdeadbeef));
}

const _ACT_COLORS = ACT_COLORS;

function generateSchedulesForAgents(agents) {
  const map = {};
  for (const agent of agents) {
    const sh = agent.sh ?? 8;
    const se = agent.se ?? 17;
    const pillar = agent.p || agent.pillar;
    const acts = _PILLAR_ACTS[pillar] || ['Phone', 'Email'];
    const seed = _nameHash(agent.n + (pillar || '')) ^ 0xdeadbeef;
    const rawSegs = _generateSegs(sh, se, acts, seed);
    map[agent.id] = rawSegs.map(s => ({
      a: s.a,
      c: _ACT_COLORS[s.a] || '#6B7280',
      s: s.sh != null ? s.sh : s.s,
      e: s.eh != null ? s.eh : s.e,
    }));
  }
  return map;
}

// ALL_AGENTS — hand-crafted P&T agents + generated agents for every other roster entry
const ALL_AGENTS = (() => {
  const crafted = new Set(AGENTS_BASE.map(a => a.n));
  const out = [...AGENTS_BASE];
  for (const [pillar, { a: entries }] of Object.entries(FULL_ROSTER)) {
    for (const entry of entries) {
      const [name, , tz] = entry;
      if (!crafted.has(name)) out.push(_rosterToAgent(name, pillar, tz || "ET"));
    }
  }
  return out;
})();

// ─── PERSONAS ──────────────────────────────────────────────────
const ROLE_META = {
  agent:   {icon:"★",label:"Agent",          color:C.purple,desc:"Personal schedule, XP, achievements"},
  manager: {icon:"◈",label:"Manager",        color:C.amber, desc:"Team dashboard, queue, approvals"},
  wfm:     {icon:"⚡",label:"Workforce Intelligence",color:C.kale,  desc:"Full access — ClearCast, forecasting, all editors"},
};
const USERS = {
  agent:  [{id:"AA",name:"Aaliyah Ali",      title:"BenOps Agent",           pillar:"BenOps",          avatar:"AA",agentName:"Aaliyah Ali",       xp:620, level:8, streak:14,adherence:97},
           {id:"AP",name:"Anthony Piper",    title:"Payroll & Taxes Agent",  pillar:"Payroll & Taxes", avatar:"AP",agentName:"Anthony Piper",     xp:890, level:10,streak:7, adherence:94},
           {id:"AF",name:"Achebe Franklin",  title:"Premier DSA Agent",      pillar:"Premier DSA",     avatar:"AF",agentName:"Achebe Franklin",   xp:1105,level:12,streak:21,adherence:98}],
  manager:[{id:"CB",name:"Cyndy Boerger",    title:"Payroll & Taxes PE",  pillar:"Payroll & Taxes",avatar:"CB"},
           {id:"JK",name:"Jenny Kirou",       title:"Benefits Care PE",    pillar:"Benefits Care",  avatar:"JK"},
           {id:"AB",name:"Ashley Broadwell",  title:"SMB Sales PE",        pillar:"SMB - Sales",    avatar:"AB"}],
  wfm:    [{id:"AW",name:"Ammad Williams", title:"WFM Analyst",      pillar:"All",avatar:"AW",subRole:"analyst",   level:"L5"},
           {id:"TZ",name:"Tammie Zapata",  title:"Intraday Analyst", pillar:"All",avatar:"TZ",subRole:"intraday",  level:"L4"},
           {id:"DS",name:"Dwight Simpson", title:"Workforce Lead",   pillar:"All",avatar:"DS",subRole:"lead",      level:"L6"},
           {id:"DP",name:"David Percival", title:"WFM Analyst",      pillar:"All",avatar:"DP",subRole:"forecast",  level:"L4"},
           {id:"BB",name:"Bunny Bates",    title:"Data Science",     pillar:"All",avatar:"BB",subRole:"analyst",   level:"L4"}],
};

// ─── ROLES CONFIG ──────────────────────────────────────────────
const ROLES_CONFIG = {
  agent: {
    subRoles: {
      general:  { label:"General Agent",  desc:"Core support queue handling" },
      senior:   { label:"Senior Agent",   desc:"Cross-trained, mentors L1-L2" },
      captain:  { label:"Team Captain",   desc:"Escalation lead, floor support" },
    },
    levels: ["L1","L2","L3","Senior"],
    permissions: {
      "view.dashboard":true, "view.schedule":true, "view.timeoff":true,
      "view.achievements":true, "view.profile":true,
      "edit.schedule":false, "view.queue":false, "view.forecast":false,
      "edit.roster":false, "view.approvals":false, "admin.roles":false,
      "view.rtm":false, "view.connections":false,
    },
  },
  manager: {
    subRoles: {
      team_lead:  { label:"Team Lead",       desc:"Frontline people management" },
      pe:         { label:"Program Expert",  desc:"SME, escalations & coaching" },
      sr_manager: { label:"Senior Manager",  desc:"Multi-pillar, strategy & ops" },
    },
    levels: ["L4","L5","L6"],
    permissions: {
      "view.dashboard":true, "view.schedule":true, "view.timeoff":true,
      "view.achievements":true, "view.profile":true,
      "edit.schedule":true, "view.queue":true, "view.forecast":false,
      "edit.roster":false, "view.approvals":true, "admin.roles":false,
      "view.rtm":true, "view.connections":false,
    },
  },
  wfm: {
    subRoles: {
      analyst:    { label:"WFM Analyst",       desc:"Forecasting, scheduling, full platform" },
      intraday:   { label:"Intraday Analyst",  desc:"RTM focus — live ops & interventions", focusView:"ops" },
      forecast:   { label:"Forecast Analyst",  desc:"ClearCast & model lab focus", focusView:"forecast" },
      scheduling: { label:"Scheduling Lead",   desc:"Schedule build & publish workflow", focusView:"calendar" },
      lead:       { label:"Workforce Lead",    desc:"Platform admin, capacity, strategy" },
    },
    levels: ["L3","L4","L5","L6"],
    permissions: {
      "view.dashboard":true, "view.schedule":true, "view.timeoff":true,
      "view.achievements":true, "view.profile":true,
      "edit.schedule":true, "view.queue":true, "view.forecast":true,
      "edit.roster":true, "view.approvals":true, "admin.roles":true,
      "view.rtm":true, "view.connections":true,
    },
  },
};
function hasPermission(user, feature) {
  return ROLES_CONFIG[user?.role]?.permissions[feature] ?? false;
}

const NAVS = {
  agent:   [
    {id:"dashboard",  icon:"⊞", label:"My day"},
    {id:"schedule",   icon:"⊟", label:"My schedule"},
    {id:"swap",       icon:"⇄",  label:"Swap shifts"},
    {id:"timeoff",    icon:"◷", label:"Time off"},
    {id:"achievements",icon:"◆",label:"Achievements"},
    {id:"profile",    icon:"◉", label:"My profile"},
  ],
  manager: [
    {id:"dashboard",  icon:"⊞", label:"Dashboard"},
    {id:"queue",      icon:"◈", label:"Queue",      alert:true},
    {id:"ops",        icon:"⚡", label:"RTM",         alert:true},
    {id:"calendar",   icon:"⊟", label:"Schedule"},
    {id:"coverage",   icon:"▦",  label:"Coverage"},
    {id:"coverage-cal",icon:"◻", label:"Cal. view"},
    {id:"roster",     icon:"◉", label:"Team"},
    {id:"skills",     icon:"◑", label:"Skilling"},
    {id:"approvals",  icon:"✓", label:"Approvals",  alert:true},
    {id:"achievements",icon:"◆",label:"Achievements"},
  ],
  wfm:     [
    {id:"dashboard",  icon:"⊞", label:"Dashboard"},
    {id:"queue",      icon:"◈", label:"Queue",      alert:true},
    {id:"ops",        icon:"⚡", label:"RTM",         alert:true},
    {id:"forecast",   icon:"◇", label:"ClearCast"},
    {id:"fvsa",       icon:"▤", label:"F vs A"},
    {id:"fcst-intel", icon:"◈", label:"Fcst intel"},
    {id:"calendar",   icon:"⊟", label:"Schedule"},
    {id:"coverage",   icon:"▦",  label:"Coverage"},
    {id:"coverage-cal",icon:"◻", label:"Cal. view"},
    {id:"patterns",   icon:"⊡", label:"Patterns"},
    {id:"roster",     icon:"◉", label:"Agents"},
    {id:"approvals",  icon:"✓", label:"Approvals",  alert:true},
    {id:"achievements",icon:"◆",label:"Achievements"},
    {id:"connections", icon:"⬡", label:"Connections"},
    {id:"roles",      icon:"⊗", label:"Roles & Perms"},
  ],
};

// ══════════════════════════════════════════════════════════════
// SOUND DESIGN — Web Audio API, off by default
// ══════════════════════════════════════════════════════════════
function playSound(type) {
  if (typeof window === "undefined" || !window.prismSoundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === "fanfare") {
      // Bass boom / kick drum
      const kick = ctx.createOscillator(), kickG = ctx.createGain();
      kick.type = "sine"; kick.frequency.setValueAtTime(180, ctx.currentTime);
      kick.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + .38);
      kickG.gain.setValueAtTime(.95, ctx.currentTime); kickG.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .5);
      kick.connect(kickG); kickG.connect(ctx.destination); kick.start(ctx.currentTime); kick.stop(ctx.currentTime + .55);
      // Noise crack (pyro ignition)
      const buf = ctx.createBuffer(1, ctx.sampleRate * .12, ctx.sampleRate);
      const bd = buf.getChannelData(0); for (let j = 0; j < bd.length; j++) bd[j] = Math.random() * 2 - 1;
      const nz = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
      nf.type = "highpass"; nf.frequency.value = 3200;
      ng.gain.setValueAtTime(.4, ctx.currentTime); ng.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .2);
      nz.buffer = buf; nz.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
      nz.start(ctx.currentTime); nz.stop(ctx.currentTime + .22);
      // Triumphant rising arpeggio (C E G C E G up two octaves)
      [[523.25,.1],[659.25,.18],[783.99,.26],[1046.5,.34],[1318.5,.42],[1567.98,.50]].forEach(([f, t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0, ctx.currentTime+t); g.gain.linearRampToValueAtTime(.22, ctx.currentTime+t+.025);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+t+.42);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+.48);
      });
      // Sparkle shimmer at peak
      [[2093,.62],[2637,.70],[3136,.78]].forEach(([f, t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, ctx.currentTime+t); g.gain.linearRampToValueAtTime(.09, ctx.currentTime+t+.015);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+t+.32);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+.38);
      });
      return;
    }
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const freqs = type==="chime" ? [880,1109] : type==="badge" ? [1047,1319,1568] : type==="approve" ? [523,659] : [440];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.connect(g); o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, ctx.currentTime + i*0.12);
      g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i*0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.12 + 0.4);
      o.start(ctx.currentTime + i*0.12);
      o.stop(ctx.currentTime + i*0.12 + 0.5);
    });
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════════
// COUNT UP — animated number counter
// ══════════════════════════════════════════════════════════════
function CountUp({ to, duration = 900, suffix = "", prefix = "", decimals = 0 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const animate = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = eased * to;
      setVal(decimals ? parseFloat(cur.toFixed(decimals)) : Math.round(cur));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [to, duration, decimals]);
  return <>{prefix}{decimals ? val.toFixed(decimals) : val.toLocaleString()}{suffix}</>;
}

// ══════════════════════════════════════════════════════════════
// MIA — AI ASSISTANT DRAWER
// ══════════════════════════════════════════════════════════════
const PRI_SYSTEM_PROMPT = `You are Pri, the AI assistant embedded in Prism — Gusto's internal Workforce Management platform. You help WFM analysts, managers, and agents understand operations, navigate the system, and interpret WFM data.

PLATFORM CONTEXT:
Prism covers 11 pillars across Gusto CX: BenOps (348 agents), Premier DSA (114), Payroll & Taxes (43), OCE-Onboarding (44), SMB-Sales (44), Benefits Care (32), Payroll Advanced Care (35), Partner Care (32), Benefits Advanced Care (17), Accountant DSA (13), Consumer Money/Members (10). Total: ~736 agents.

KEY WFM CONCEPTS:
- Service Level (SL): % of contacts answered within threshold (Gusto target: 85%)
- Adherence: % of time agents are in their scheduled activity (target: 95%+). Adherent codes include Phone, Email, Chat, FEIN, Core Work, Break, Lunch, Training, Meeting, etc.
- AHT (Average Handle Time): avg total time per contact including After Call Work
- ASA (Average Speed of Answer): avg time to answer; target <30s
- WMAPE: Weighted Mean Absolute Percentage Error — ClearCast forecast accuracy metric (97%+ = excellent)
- Shrinkage: time agents are scheduled but not handling contacts (breaks, training, OOA, absences). Plan for ~35% shrinkage.
- Occupancy: % of available time agents spend handling contacts. Above 90% = burnout risk.
- Erlang C: staffing formula that converts volume + AHT + SL target → required FTE
- ClearCast: Prism's forecasting engine. 86 forecast groups (CTs) across all pillars.

ACTIVITY CODES (what they mean in scheduling):
Productive/Adherent: Phone, Email, Chat, Chat/Email, FEIN, Core Work, Open, Outbound Call, COBRA/Continuation, EE Termination, Group Termination, NHE (New Hire Enrollment), QLE (Qualifying Life Event), Follow-up/Action items, Approved Project, Cancellations
Breaks/Meals: Break, Acomm Break (accommodation break), Lunch, Personal
Meetings: Meeting, 1:1 Meeting, Team Meeting, Company Event, GustoFIED, Meeting Override (unplanned)
Training: Training, Gustie Guide Training (15-min daily), Reverse Shadowing, Vendor Compliance Training
Tech: Tech Issues Internal/External, Unavailable, Busy
Absences (no aux required): Planned Time Off, Sick, LOA, NCNS (No Call No Show), Bereavement, FMLA, Company Holiday, Floating Holiday, Sabbatical, Jury Duty, Forced Day Off, Inclement Weather
Deprecated codes to avoid: After Call Work (use Phone instead), Coaching (use 1:1 Meeting), Development Time (use Training)

HOW TO USE PRISM BY ROLE:
WFM Analyst: Full access — ClearCast forecast view, F vs A analysis, work pattern builder, roster admin (including terminations), schedule publishing workflow, skilling manager, all approvals, live connections config, forecast intelligence
Manager: Team dashboard, Right Now strip (live SL/adherence), queue analytics, intraday ops center, coverage heatmap, schedule editor, roster view, agent profiles, approvals (PTO + schedule adjustments only — NOT work patterns), achievements
Agent: My Day dashboard, schedule view, shift swap marketplace, time off requests, VTO, achievements/XP, profile (work pattern change requests, skills)

KEY NAVIGATION:
- ClearCast (◇): Live forecast view with 86 CTs, category breakdown, SL tracking
- F vs A (▤): Forecast vs Actual by pillar with weekly trend and miss patterns
- Intraday (⚡): Real-time ops — 12-agent grid, SL projection, OT/VTO controls
- Queue (◈): Queue analytics — live cards, category table, agent performance
- Coverage (▦): Heatmap by hour × pillar showing staffing coverage
- Fcst intel (◈): Pattern recognition — 5-week trends, miss detection, recommendations
- ⌘K: Command palette for fast navigation to any feature

PRISM SCORE: Composite health metric (0–100). Weighted: Service Level 30%, Adherence 30%, Forecast Accuracy 25%, Approval Speed 15%.

Keep responses concise (2–4 sentences). Use **bold** for key numbers and terms. Be specific, actionable, and conversational — you know Gusto's WFM world deeply. If asked about live data, use any provided context. If you don't know something, say so and suggest where in Prism to look.`;

const PRI_SUGGESTIONS = [
  { label:"What does adherence mean?",         icon:"⏱️" },
  { label:"BenOps SL right now?",              icon:"📊" },
  { label:"How do I publish a schedule?",      icon:"📅" },
  { label:"What's Gustie Guide Training for?", icon:"🎓" },
  { label:"Coverage gaps today?",              icon:"🗓️" },
  { label:"What's a good shrinkage target?",   icon:"📐" },
];

function PyroLauncher({ left, delay = 0 }) {
  const colors = ["#FFD700","#FFFFFF","#FF5C8A","#00D4A8","#BF7FFF","#FF8C42","#FFD700"];
  return (
    <div style={{ position:"fixed", bottom:0, left:`${left}%`, transform:"translateX(-50%)", zIndex:9999, pointerEvents:"none" }}>
      {Array.from({ length:10 }, (_,i) => (
        <div key={i} style={{
          position:"absolute", bottom:0, left:(i-5)*3,
          width:1+(i%2), height:14+(i%13),
          background:`linear-gradient(to top,${colors[i%colors.length]},rgba(255,255,255,0))`,
          borderRadius:2,
          boxShadow:`0 0 5px ${colors[i%colors.length]}`,
          animation:`pyro-streak ${.48+(i%4)*.07}s cubic-bezier(.1,.68,.3,1) ${delay+i*16}ms both`,
        }}/>
      ))}
      <div style={{ position:"absolute", bottom:"calc(76vh - 12px)", left:0 }}>
        {Array.from({ length:20 }, (_,i) => (
          <div key={i} style={{ position:"absolute", top:0, left:0, transform:`rotate(${(i/20)*360}deg)` }}>
            <div style={{
              width:2+(i%3), height:2+(i%3),
              borderRadius:i%4===0?1:"50%",
              background:colors[i%colors.length],
              boxShadow:`0 0 8px ${colors[i%colors.length]}`,
              animation:`pyro-burst-out ${.4+(i%5)*.05}s ease-out ${delay+420+i*10}ms both`,
            }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfettiRain() {
  const pieces = useRef(null);
  if (!pieces.current) {
    const cols = ["#FFD700","#FF5C8A","#00D4A8","#BF7FFF","#FF8C42","#7F77DD","#FFFFFF","#F45D48"];
    pieces.current = Array.from({ length:64 }, (_,i) => ({
      id:i, left:(i*7.3+11.8)%100,
      delay:(i*113)%2400, dur:2000+(i*97)%2000,
      color:cols[i%cols.length], w:3+(i%6), h:6+(i%10),
      cx:((i%7)-3)*80, cr:(i%3+1)*360,
    }));
  }
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none", overflow:"hidden" }}>
      {pieces.current.map(p => (
        <div key={p.id} style={{
          position:"absolute", top:-20, left:`${p.left}%`,
          width:p.w, height:p.h, background:p.color, borderRadius:1,
          "--cx":`${p.cx}px`, "--cr":`${p.cr}deg`,
          boxShadow:`0 0 4px ${p.color}66`,
          animation:`confetti-fall ${p.dur}ms cubic-bezier(.25,.46,.45,.94) ${p.delay}ms both`,
        }}/>
      ))}
    </div>
  );
}

function FounderModal({ onClose }) {
  const [ready, setReady] = useState(false);
  const [coinPhase, setCoinPhase] = useState(0); // 0=hidden 1=blinking prompt 2=arcade reveal
  useEffect(() => {
    playSound("fanfare");
    setReady(true);
    const t = setTimeout(() => setCoinPhase(1), 1900);
    return () => clearTimeout(t);
  }, []);
  const punch = (d) => ({ animation:`founder-punch .58s cubic-bezier(.22,1,.36,1) ${d}ms both` });
  return (
    <>
      {/* Screen flash — pyro ignition */}
      <div style={{ position:"fixed", inset:0, zIndex:9997, background:"rgba(255,252,220,.85)", pointerEvents:"none", animation:"founder-flash .55s ease forwards" }} />

      {/* Pyro columns — 5 launchers like WWE stage */}
      <PyroLauncher left={3}  delay={0}  />
      <PyroLauncher left={20} delay={90} />
      <PyroLauncher left={50} delay={45} />
      <PyroLauncher left={80} delay={90} />
      <PyroLauncher left={97} delay={0}  />

      {/* Confetti rain */}
      {ready && <ConfettiRain />}

      {/* Dark overlay */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:9998, background:"rgba(0,0,4,.9)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", display:"flex", alignItems:"center", justifyContent:"center" }}>

        {/* Card */}
        <div onClick={e => e.stopPropagation()} style={{
          position:"relative", textAlign:"center", overflow:"hidden",
          background:"linear-gradient(160deg,#120920 0%,#070412 100%)",
          border:".5px solid rgba(255,215,0,.3)",
          borderRadius:28, padding:"48px 52px 36px", maxWidth:500, width:"90vw",
          animation:"founder-card-in .78s cubic-bezier(.2,.8,.4,1) .12s both, founder-glow-ring 2.8s ease-in-out 1.4s infinite",
        }}>

          {/* Inner gold vignette */}
          <div style={{ position:"absolute", inset:0, borderRadius:28, background:"radial-gradient(ellipse at 50% 0%,rgba(255,215,0,.09) 0%,transparent 60%)", pointerEvents:"none" }} />

          {/* Prism mark */}
          <div style={{ marginBottom:16, display:"flex", justifyContent:"center", ...punch(280) }}>
            <PrismMark size={76} glow={true} id="founder" />
          </div>

          {/* Founder badge pill */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 16px", borderRadius:100, background:"rgba(255,215,0,.1)", border:".5px solid rgba(255,215,0,.4)", marginBottom:10, ...punch(460) }}>
            <span style={{ fontSize:9, color:"#FFD700" }}>◆</span>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:".18em", color:"#FFD700", textTransform:"uppercase" }}>Founder's Build</span>
            <span style={{ fontSize:9, color:"#FFD700" }}>◆</span>
          </div>

          {/* Latin mantra */}
          <div style={{ fontSize:11, fontStyle:"italic", color:"rgba(255,215,0,.42)", letterSpacing:".05em", marginBottom:18, ...punch(540) }}>
            Aut Viam Inveniam Aut Faciam
          </div>

          {/* Name — animated gold shimmer */}
          <div style={{
            fontSize:38, fontWeight:900, letterSpacing:"-.015em", marginBottom:5,
            background:"linear-gradient(90deg,#B8860B 0%,#FFD700 20%,#FFFACD 42%,#FFD700 58%,#FF8C42 78%,#FFD700 100%)",
            backgroundSize:"280% auto",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
            animation:`founder-punch .58s cubic-bezier(.22,1,.36,1) 620ms both, founder-shimmer 3.2s linear 1.6s infinite`,
          }}>Ammad Williams</div>

          {/* Title */}
          <div style={{ fontSize:12, color:"rgba(255,215,0,.5)", letterSpacing:".1em", marginBottom:26, ...punch(720) }}>
            WFM ANALYST · PLATFORM BUILDER · GUSTO CX
          </div>

          {/* Divider */}
          <div style={{ height:.5, background:"linear-gradient(90deg,transparent,rgba(255,215,0,.45),rgba(127,119,221,.45),transparent)", marginBottom:24, ...punch(800) }} />

          {/* Quote */}
          <div style={{ fontSize:14, color:"rgba(255,248,230,.75)", lineHeight:1.78, fontStyle:"italic", marginBottom:26, letterSpacing:".01em", ...punch(890) }}>
            "The tools we had weren't good enough.<br/> So I built something that was."
          </div>

          {/* Stats */}
          <div style={{ display:"flex", justifyContent:"center", gap:36, marginBottom:26, ...punch(980) }}>
            {[["v1.1.0","version"],["7,200+","lines"],["0","regrets"]].map(([v,l]) => (
              <div key={l}>
                <div style={{ fontSize:22, fontWeight:800, color:"#FFD700", textShadow:"0 0 24px rgba(255,215,0,.65)" }}>{v}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.28)", letterSpacing:".1em", textTransform:"uppercase", marginTop:3 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Timestamp */}
          <div style={{ fontSize:11, color:"rgba(255,255,255,.2)", letterSpacing:".14em", ...punch(1060) }}>CHICAGO · MAY 2026</div>

          {/* INSERT COIN / Penny's Arcade teaser */}
          <div style={{ marginTop:20, minHeight:52, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            {coinPhase === 0 && (
              <div style={{ fontSize:11, color:"rgba(255,255,255,.13)", letterSpacing:".07em" }}>click anywhere to close</div>
            )}
            {coinPhase === 1 && (
              <button
                onClick={e => { e.stopPropagation(); setCoinPhase(2); playSound("chime"); }}
                style={{
                  background:"none", border:".5px solid rgba(255,215,0,.3)", borderRadius:8,
                  padding:"8px 20px", cursor:"pointer",
                  color:"#FFD700", fontSize:12, fontWeight:700, letterSpacing:".14em",
                  fontFamily:"inherit", textTransform:"uppercase",
                  boxShadow:"0 0 18px rgba(255,215,0,.12)",
                  animation:"coin-blink 1.1s step-end infinite, coin-in .5s cubic-bezier(.22,1,.36,1) both",
                }}
              >⊙ INSERT COIN?</button>
            )}
            {coinPhase === 2 && (
              <div style={{
                width:"100%", padding:"14px 0 10px", borderRadius:14,
                background:"linear-gradient(135deg,rgba(10,6,24,.9),rgba(20,8,36,.9))",
                border:".5px solid rgba(255,215,0,.18)",
                animation:"arcade-reveal .4s cubic-bezier(.22,1,.36,1) both",
              }}>
                <div style={{ fontSize:9, letterSpacing:".22em", color:"rgba(255,215,0,.4)", marginBottom:6, textTransform:"uppercase" }}>◈ Slot Activated</div>
                <div style={{ fontSize:19, fontWeight:900, letterSpacing:".12em", color:"#FFD700", textShadow:"0 0 24px rgba(255,215,0,.55)" }}>PENNY'S ARCADE</div>
                <div style={{ height:.5, background:"linear-gradient(90deg,transparent,rgba(255,215,0,.25),transparent)", margin:"8px 28px" }} />
                <div style={{ fontSize:10, color:"rgba(255,255,255,.3)", letterSpacing:".2em", textTransform:"uppercase" }}>Coming Soon</div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

function ToastRack({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", zIndex:9999, display:"flex", flexDirection:"column", gap:8, alignItems:"center", pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ padding:"10px 22px", borderRadius:100, fontSize:14, fontWeight:600, background:t.bg, color:"#fff", backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)", border:`.5px solid ${t.border}`, boxShadow:`0 6px 28px ${t.shadow}`, animation:"toast-in .32s cubic-bezier(.34,1.56,.64,1) both", display:"flex", alignItems:"center", gap:9, pointerEvents:"auto", whiteSpace:"nowrap", letterSpacing:".01em" }}>
          <span style={{ fontSize:15 }}>{t.icon}</span>{t.msg}
        </div>
      ))}
    </div>
  );
}

function PriWaveform() {
  const heights = [6,14,20,16,22,12,8,18,10,16,6,20,14];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:2.5, height:26, padding:"0 2px" }}>
      {heights.map((h, i) => (
        <div key={i} style={{ width:3, borderRadius:2, background: `rgba(10,128,128,${0.5 + (i%3)*0.2})`, animation:`pri-wave ${0.7 + (i%4)*0.15}s ease-in-out infinite ${i*0.08}s` }} />
      ))}
    </div>
  );
}

function PriDrawer({ auth, view, onClose }) {
  const VIEW_GREETINGS = {
    ops:         "I see you're in Intraday Ops — SL risk detected at 2pm. Want me to run the coverage analysis?",
    approvals:   "3 approvals pending. 2 are safe to auto-approve. Want a risk breakdown on the flagged ones?",
    coverage:    "Heatmap looks solid overall, but BenOps has a gap 8–10:30am. Want me to model a fix?",
    forecast:    "Forecast accuracy is at a 5-week high. I spotted a recurring FEIN pattern — want details?",
    clearcast:   "86 forecast groups loaded. Want me to identify which CTs are currently off-model?",
    queue:       "Queue depth is elevated. Want me to pull the SL projection for the next 2 hours?",
    "wfm-dashboard": "Platform Prism Score is 87. BenOps SL is the top drag — want a fix plan?",
  };
  const greeting = (view && VIEW_GREETINGS[view]) || "Hey! I'm Pri — your Prism AI. Ask me anything about the operation.";
  const [msgs, setMsgs] = useState([
    { role:"pri", text: greeting, ts:"now" }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);
  const rc = C.kale;

  async function sendMsg(text) {
    if (!text.trim()) return;
    const q = text.trim();
    const ts = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    setInput("");
    setMsgs(m => [...m, { role:"user", text:q, ts }]);
    setThinking(true);
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (apiKey && apiKey !== "your_key_here") {
      try {
        const liveResult = queryPrism(q, auth?.role);
        const liveCtx = liveResult
          ? `\n\nLIVE PRISM DATA: ${liveResult.title} — ${liveResult.body}${liveResult.tag ? ` [${liveResult.tag}]` : ""}`
          : "";
        const viewCtx = view ? `\n\nCURRENT VIEW: The user is currently on the "${view}" screen. Tailor your response to be relevant to what they're looking at.` : "";
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 350,
            system: PRI_SYSTEM_PROMPT + liveCtx + viewCtx,
            messages: [{ role:"user", content: q }],
          }),
        });
        const data = await resp.json();
        const answer = data.content?.[0]?.text || "Something went wrong — try again?";
        setMsgs(m => [...m, { role:"pri", text:answer, ts: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
      } catch {
        setMsgs(m => [...m, { role:"pri", text:"Couldn't reach the API right now — check your connection.", ts: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
      }
    } else {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
      const result = queryPrism(q, auth?.role);
      const answer = result
        ? `**${result.title}** ${result.tag ? `[${result.tag}]` : ""}\n\n${result.body}`
        : `I don't have live data on that yet — but I can help with SL, adherence, forecast accuracy, coverage gaps, approvals, OT, and schedule status. Or ask me what any WFM term means!`;
      setMsgs(m => [...m, { role:"pri", text:answer, ts: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) }]);
    }
    setThinking(false);
    playSound("chime");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs, thinking]);

  function renderText(text) {
    return text.split("\n").map((line, li) => (
      <span key={li}>
        {line.split("**").map((part, i) =>
          i%2===1 ? <strong key={i} style={{ color:C.tx0 }}>{part}</strong> : part
        )}
        {li < text.split("\n").length - 1 && <br/>}
      </span>
    ));
  }

  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, width:380, background:"rgba(7,11,22,.98)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", borderLeft:`.5px solid rgba(10,128,128,.25)`, zIndex:800, display:"flex", flexDirection:"column", animation:"pri-slide .28s cubic-bezier(.4,0,.2,1) both", boxShadow:"-12px 0 60px rgba(0,0,0,.5)" }}>
      {/* Header */}
      <div style={{ padding:"16px 18px 14px", borderBottom:`.5px solid ${C.bd}`, flexShrink:0, background:`linear-gradient(180deg,rgba(10,128,128,.08),transparent)` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:`${rc}18`, border:`.5px solid ${rc}35`, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
            <span style={{ fontSize:20 }}>✦</span>
            <div style={{ position:"absolute", inset:-2, borderRadius:14, border:`.5px solid ${rc}20`, animation:"lp 3s ease-in-out infinite" }}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.tx0, letterSpacing:"-.02em" }}>Pri</div>
            <div style={{ fontSize:11, color:rc, fontWeight:500 }}>Prism AI · Always listening</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.06)", border:`.5px solid ${C.bd}`, color:C.tx2, borderRadius:8, width:28, height:28, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems: m.role==="user" ? "flex-end" : "flex-start", animation:"fade-up .2s ease" }}>
            {m.role === "pri" && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:9, maxWidth:"88%" }}>
                <div style={{ width:26, height:26, borderRadius:8, background:`${rc}18`, border:`.5px solid ${rc}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, marginTop:2 }}>✦</div>
                <div style={{ background:`${rc}0C`, border:`.5px solid ${rc}22`, borderRadius:"14px 14px 14px 4px", padding:"11px 14px", fontSize:13, color:C.tx1, lineHeight:1.65 }}>
                  {renderText(m.text)}
                </div>
              </div>
            )}
            {m.role === "user" && (
              <div style={{ background:"rgba(255,255,255,.07)", border:`.5px solid rgba(255,255,255,.1)`, borderRadius:"14px 14px 4px 14px", padding:"10px 14px", fontSize:13, color:C.tx0, maxWidth:"82%", lineHeight:1.65 }}>
                {m.text}
              </div>
            )}
            {m.ts && m.ts !== "now" && <span style={{ fontSize:10, color:"rgba(255,255,255,.18)", marginTop:3, padding:"0 4px" }}>{m.ts}</span>}
          </div>
        ))}
        {thinking && (
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:26, height:26, borderRadius:8, background:`${rc}18`, border:`.5px solid ${rc}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
            <div style={{ background:`${rc}0C`, border:`.5px solid ${rc}22`, borderRadius:"14px 14px 14px 4px", padding:"9px 14px" }}>
              <PriWaveform />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {msgs.length <= 1 && !thinking && (
        <div style={{ padding:"0 16px 10px", flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.2)", letterSpacing:".1em", textTransform:"uppercase", marginBottom:8 }}>Try asking</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {PRI_SUGGESTIONS.map(s => (
              <button key={s.label} onClick={() => sendMsg(s.label)}
                style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, color:C.tx2, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all .14s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${rc}10`;e.currentTarget.style.borderColor=`${rc}30`;e.currentTarget.style.color=rc;}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor=C.bd;e.currentTarget.style.color=C.tx2;}}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding:"12px 14px", borderTop:`.5px solid ${C.bd}`, flexShrink:0, background:"rgba(5,8,15,.5)" }}>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendMsg(input); }}}
            placeholder="Ask Pri anything…" rows={1}
            style={{ flex:1, background:"rgba(255,255,255,.05)", border:`.5px solid ${thinking?"rgba(10,128,128,.3)":C.bd}`, borderRadius:11, padding:"10px 12px", fontSize:11.5, color:C.tx0, resize:"none", outline:"none", lineHeight:1.5, fontFamily:"inherit", transition:"border-color .2s" }} />
          <button onClick={() => sendMsg(input)} disabled={!input.trim() || thinking}
            style={{ width:36, height:36, borderRadius:10, background: input.trim()&&!thinking ? `linear-gradient(135deg,${rc},${rc}BB)` : "rgba(255,255,255,.05)", border:"none", color: input.trim()&&!thinking ? "#fff" : "rgba(255,255,255,.2)", fontSize:15, cursor: input.trim()&&!thinking ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .18s", boxShadow: input.trim()&&!thinking ? `0 4px 14px ${rc}35` : "none" }}>
            ↑
          </button>
        </div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,.18)", marginTop:7, textAlign:"center" }}>↵ send · Shift+↵ newline · Powered by Prism data</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VTO / OT ONE-TAP WIDGET
// ══════════════════════════════════════════════════════════════
function VTOWidget({ user }) {
  const [state, setState] = useState("idle"); // idle | accepted | declined
  // Simulated: queue is currently 12% overstaffed at 1pm
  const isOverstaffed = true;
  if (!isOverstaffed || state !== "idle") {
    if (state === "accepted") return (
      <div style={{ marginTop:12, marginBottom:12, background:"rgba(10,200,150,.07)", border:".5px solid rgba(10,200,150,.25)", borderRadius:14, padding:"13px 16px", display:"flex", alignItems:"center", gap:12, animation:"fade-up .3s ease" }}>
        <span style={{ fontSize:22 }}>✅</span>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>VTO accepted — enjoy your afternoon!</div>
          <div style={{ fontSize:12, color:C.tx2 }}>Your schedule has been updated · WFM notified</div>
        </div>
      </div>
    );
    return null;
  }
  return (
    <div style={{ marginTop:12, marginBottom:12, background:`${C.amber}0A`, border:`.5px solid ${C.amber}28`, borderRadius:14, padding:"13px 16px", animation:"fade-up .5s ease .55s both" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:11, background:`${C.amber}18`, border:`.5px solid ${C.amber}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🏖️</div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
            <span style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>VTO available · 1:00 PM today</span>
            <span style={{ fontSize:10, fontWeight:700, color:C.amber, background:`${C.amber}14`, padding:"2px 7px", borderRadius:6 }}>OFFER</span>
          </div>
          <div style={{ fontSize:12, color:C.tx2 }}>Queue is over capacity · You're eligible (seniority #{user.streak || 7})</div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <button onClick={() => setState("declined")} style={{ padding:"7px 12px", borderRadius:9, background:"rgba(255,255,255,.05)", border:`.5px solid ${C.bd}`, color:C.tx2, fontSize:12, cursor:"pointer" }}>Decline</button>
          <button onClick={() => { setState("accepted"); playSound("approve"); }} style={{ padding:"7px 14px", borderRadius:9, background:`linear-gradient(135deg,${C.amber},${C.amber}BB)`, border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 14px ${C.amber}30` }}>Accept VTO →</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHIFT SWAP MARKETPLACE
// ══════════════════════════════════════════════════════════════
const SWAP_POSTS = [
  { id:1, from:"Anthony Piper",     pillar:"Payroll & Taxes", date:"Thu May 15", shift:"8:00 AM–4:30 PM", skills:["Phone","Email"],       posted:"2h ago",  status:"open",    skillMatch:true  },
  { id:2, from:"Briana Perez",      pillar:"Payroll & Taxes", date:`${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(Date.now()+3*86400000).getDay()]} ${fmtRelDate(3)}`, shift:"10:00 AM–6:30 PM", skills:["Phone","Chat","Email"], posted:"5h ago",  status:"open",    skillMatch:true  },
  { id:3, from:"Mason Amling",      pillar:"SMB Sales",       date:`${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(Date.now()+1*86400000).getDay()]} ${fmtRelDate(1)}`, shift:"7:00 AM–3:30 PM", skills:["Phone"],                posted:"1d ago",  status:"claimed", claimedBy:"Ashley Dickey", skillMatch:false },
  { id:4, from:"Claudia Lizama",    pillar:"BenOps",          date:"Mon May 19", shift:"9:00 AM–5:30 PM", skills:["Email","Chat","COBRA"], posted:"30m ago", status:"open",    skillMatch:false },
  { id:5, from:"D'Angela Redman",   pillar:"Customer Care",   date:"Tue May 20", shift:"11:00 AM–7:30 PM",skills:["Phone","Chat"],         posted:"1h ago",  status:"open",    skillMatch:true  },
];

function ShiftSwapView({ user }) {
  const [posts, setPosts] = useState(SWAP_POSTS);
  const [tab, setTab] = useState("available");
  const [claimedId, setClaimedId] = useState(null);
  const [postOpen, setPostOpen] = useState(false);
  const [postDate, setPostDate] = useState("");
  const [postNote, setPostNote] = useState("");
  const [postSent, setPostSent] = useState(false);

  function claim(id) {
    setPosts(ps => ps.map(p => p.id===id ? {...p, status:"claimed", claimedBy:"You"} : p));
    setClaimedId(id);
    playSound("approve");
    window.prismToast?.("Shift claimed! Your manager will confirm.", "success");
    setTimeout(() => setClaimedId(null), 3000);
  }

  const available = posts.filter(p => p.status==="open");
  const myPosts = posts.filter(p => p.from === user.agentName);

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:4 }}>Shift Swap Marketplace</div>
        <div style={{ fontSize:13, color:C.tx2 }}>Post your shift · Claim a match · Auto-approved if coverage holds</div>
      </div>

      {/* Claimed toast */}
      {claimedId && (
        <div style={{ position:"fixed", top:70, right:24, background:`linear-gradient(135deg,${C.kale},#0AB0B0)`, color:"#fff", padding:"12px 18px", borderRadius:12, fontSize:14, fontWeight:700, zIndex:600, animation:"card-rise .3s ease both", boxShadow:`0 8px 28px ${C.kale}40` }}>
          ✅ Swap claimed · Auto-approved · You're on for {posts.find(p=>p.id===claimedId)?.date}
        </div>
      )}

      <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,.05)", borderRadius:10, padding:3, marginBottom:14, width:"fit-content" }}>
        {[["available","Available swaps"],["mine","My posts"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ padding:"5px 14px", borderRadius:7, fontSize:12, cursor:"pointer", background:tab===v?"rgba(255,255,255,.1)":"none", color:tab===v?C.tx0:C.tx2, border:tab===v?`.5px solid ${C.bd}`:"none", fontWeight:tab===v?600:400, transition:"all .15s" }}>{l} {v==="available"?`(${available.length})`:""}</button>
        ))}
      </div>

      {tab === "available" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {available.map(p => (
            <div key={p.id} style={{ background:C.card, border:`.5px solid ${p.skillMatch ? C.kale+"30" : C.bd}`, borderRadius:14, padding:16, transition:"all .18s" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 28px rgba(0,0,0,.3)`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:11, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${PILLARS[p.pillar]||C.kale}18`, border:`.5px solid ${PILLARS[p.pillar]||C.kale}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:PILLARS[p.pillar]||C.kale, flexShrink:0 }}>
                  {p.from.split(" ").map(w=>w[0]).join("").slice(0,2)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:2 }}>{p.from}</div>
                  <div style={{ fontSize:11, color:C.tx2 }}>{p.pillar} · posted {p.posted}</div>
                </div>
                {p.skillMatch && <span style={{ fontSize:10, fontWeight:700, color:C.kale, background:`${C.kale}12`, border:`.5px solid ${C.kale}30`, padding:"2px 8px", borderRadius:8 }}>SKILL MATCH</span>}
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>{p.date}</div>
                <div style={{ fontSize:13, color:C.tx1, marginTop:2 }}>⏰ {p.shift}</div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                {p.skills.map(s => <span key={s} style={{ fontSize:11, padding:"2px 9px", borderRadius:7, background:"rgba(255,255,255,.06)", border:`.5px solid ${C.bd}`, color:C.tx2 }}>{s}</span>)}
              </div>
              <button onClick={() => claim(p.id)}
                style={{ width:"100%", padding:"9px 0", borderRadius:10, background:`linear-gradient(135deg,${C.kale},${C.kale}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 16px ${C.kale}25`, transition:"all .16s" }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 6px 22px ${C.kale}40`;}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${C.kale}25`;}}>
                Claim swap →
              </button>
            </div>
          ))}
          {available.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"40px 0", fontSize:13, color:C.tx2 }}>No swaps available right now — check back later</div>}
        </div>
      )}

      {tab === "mine" && (
        <div>
          {!postOpen && !postSent && (
            <button onClick={() => setPostOpen(true)} style={{ width:"100%", padding:"13px 0", borderRadius:12, background:`${C.kale}10`, border:`.5px solid ${C.kale}25`, color:C.kale, fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all .15s" }}
              onMouseEnter={e=>{e.currentTarget.style.background=`${C.kale}18`;}}
              onMouseLeave={e=>{e.currentTarget.style.background=`${C.kale}10`;}}>
              + Post a shift for swap
            </button>
          )}
          {postOpen && !postSent && (
            <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:18, marginBottom:14, animation:"fade-up .2s ease" }}>
              <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:14 }}>Post a shift</div>
              <div style={{ fontSize:12, color:C.tx2, marginBottom:6 }}>Date</div>
              <input type="date" value={postDate} onChange={e=>setPostDate(e.target.value)} style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:9, padding:"9px 12px", fontSize:13, color:C.tx0, outline:"none", boxSizing:"border-box", marginBottom:12 }}/>
              <div style={{ fontSize:12, color:C.tx2, marginBottom:6 }}>Note to swapper <span style={{ color:"rgba(255,255,255,.2)" }}>(optional)</span></div>
              <textarea value={postNote} onChange={e=>setPostNote(e.target.value)} placeholder="e.g. Need to attend a school event in the morning" rows={2}
                style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:9, padding:"9px 12px", fontSize:13, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box", marginBottom:12, lineHeight:1.5 }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setPostOpen(false)} style={{ flex:1, padding:"9px 0", borderRadius:10, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:13, cursor:"pointer" }}>Cancel</button>
                <button onClick={() => { setPostOpen(false); setPostSent(true); playSound("approve"); window.prismToast?.("Swap posted to marketplace!", "success"); }} style={{ flex:2, padding:"9px 0", borderRadius:10, background:`linear-gradient(135deg,${C.kale},${C.kale}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}>Post swap →</button>
              </div>
            </div>
          )}
          {postSent && (
            <div style={{ background:`${C.kale}08`, border:`.5px solid ${C.kale}25`, borderRadius:14, padding:18, marginBottom:14, textAlign:"center", animation:"fade-up .2s ease" }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📣</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:4 }}>Posted! Skill-matched Gusties have been notified.</div>
              <div style={{ fontSize:12, color:C.tx2 }}>You'll get a notification when someone claims your shift.</div>
            </div>
          )}
          {myPosts.length === 0 && !postSent && <div style={{ textAlign:"center", padding:"32px 0", fontSize:13, color:C.tx2 }}>You haven't posted any swaps yet</div>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COVERAGE CALENDAR — month view
// ══════════════════════════════════════════════════════════════
const CAL_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function getCoverageScore(dayOfMonth) {
  // Simulate coverage score 0-100 for each day based on staffing patterns
  const base = [92,88,85,87,90,78,72, 93,89,84,86,91,79,71, 94,90,86,88,92,80,73, 91,87,83,85,88,77,70, 93,89][dayOfMonth % 30];
  return Math.max(60, Math.min(99, base + (Math.sin(dayOfMonth * 1.3) * 4 | 0)));
}
function calCellColor(score) {
  if (score >= 90) return { bg:"rgba(10,200,150,.16)", border:"rgba(10,200,150,.28)", text:"#0AC8A0" };
  if (score >= 80) return { bg:"rgba(10,200,150,.07)", border:"rgba(10,200,150,.15)", text:"rgba(10,200,150,.7)" };
  if (score >= 70) return { bg:"rgba(239,159,39,.12)", border:"rgba(239,159,39,.25)", text:C.amber };
  return { bg:"rgba(244,93,72,.16)", border:"rgba(244,93,72,.3)", text:C.guava };
}

function CoverageCalendarView() {
  const [selDay, setSelDay] = useState(null);
  const [hovDay, setHovDay] = useState(null);
  // May 2026 — starts on Friday (day 5)
  const startDow = 5;
  const daysInMonth = 31;
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:4 }}>Coverage Calendar — May 2026</div>
        <div style={{ fontSize:13, color:C.tx2 }}>Month-view coverage vs. demand · Click any day for detail · Gaps flagged before they happen</div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:14, marginBottom:14, flexWrap:"wrap" }}>
        {[["rgba(10,200,150,.16)","rgba(10,200,150,.28)","≥90% — Strong"],["rgba(10,200,150,.07)","rgba(10,200,150,.15)","80–90% — Good"],["rgba(239,159,39,.12)","rgba(239,159,39,.25)","70–80% — Watch"],["rgba(244,93,72,.16)","rgba(244,93,72,.3)","<70% — At risk"]].map(([bg,bd,l])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:16, height:16, borderRadius:5, background:bg, border:`.5px solid ${bd}` }}/>
            <span style={{ fontSize:11, color:C.tx2 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:16, padding:16 }}>
        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:10 }}>
          {CAL_DAYS.map(d=>(
            <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:"rgba(255,255,255,.3)", textTransform:"uppercase", letterSpacing:".08em", padding:"4px 0" }}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const score = getCoverageScore(day);
            const cc = calCellColor(score);
            const isToday = day === 13;
            const isSel = selDay === day;
            const isHov = hovDay === day;
            const isPast = day < 13;
            return (
              <div key={day} onClick={() => setSelDay(day===selDay?null:day)}
                onMouseEnter={() => setHovDay(day)} onMouseLeave={() => setHovDay(null)}
                style={{ background: isSel ? cc.bg : isHov ? cc.bg : isPast ? "rgba(255,255,255,.02)" : cc.bg + "88", border:`.5px solid ${isSel ? cc.border : isHov ? cc.border : isPast ? "rgba(255,255,255,.05)" : cc.border + "88"}`, borderRadius:10, padding:"10px 8px", textAlign:"center", cursor:"pointer", transition:"all .14s", boxShadow: isSel ? `0 0 0 1.5px ${cc.border}` : "none", position:"relative", opacity: isPast && !isToday ? 0.55 : 1 }}>
                {isToday && <div style={{ position:"absolute", top:5, right:5, width:5, height:5, borderRadius:"50%", background:C.kale, boxShadow:`0 0 8px ${C.kale}` }}/>}
                <div style={{ fontSize:15, fontWeight: isToday ? 800 : 600, color: isToday ? C.kale : isPast ? C.tx2 : C.tx0, marginBottom:3 }}>{day}</div>
                {!isPast && <div style={{ fontSize:12, fontWeight:700, color:cc.text }}>{score}%</div>}
                {isPast && <div style={{ fontSize:11, color:"rgba(255,255,255,.2)" }}>—</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day drill-down */}
      {selDay && selDay >= 13 && (
        <div style={{ marginTop:12, background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, animation:"fade-up .2s ease" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>May {selDay} · Coverage detail</div>
            <button onClick={() => setSelDay(null)} style={{ background:"none", border:"none", color:C.tx2, fontSize:17, cursor:"pointer" }}>×</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
            {HMAP_PILLARS.map(pillar => {
              const score = Math.max(60, getCoverageScore(selDay) + (pillar==="BenOps"?-8:pillar==="SMB"?-4:3));
              const cc = calCellColor(score);
              return (
                <div key={pillar} style={{ background:cc.bg, border:`.5px solid ${cc.border}`, borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:PILLARS[pillar]||C.kale }}/>
                    <span style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>{pillar}</span>
                  </div>
                  <div style={{ fontSize:20, fontWeight:800, color:cc.text }}>{score}%</div>
                  <div style={{ fontSize:10, color:C.tx2, marginTop:2 }}>coverage</div>
                </div>
              );
            })}
          </div>
          {getCoverageScore(selDay) < 80 && (
            <div style={{ marginTop:12, padding:"10px 13px", borderRadius:10, background:"rgba(244,93,72,.08)", border:".5px solid rgba(244,93,72,.2)", fontSize:12, color:C.guava, display:"flex", alignItems:"center", gap:8 }}>
              ⚠️ Coverage is below 80% on this day — consider opening OT offer or adjusting time-off approvals
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:12 }}>
        {[
          { l:"Strong days (≥90%)",  v:Array.from({length:daysInMonth},(_,i)=>getCoverageScore(i+1)>=90?1:0).reduce((a,b)=>a+b,0), c:"#0AC8A0" },
          { l:"Watch days (70–80%)", v:Array.from({length:daysInMonth},(_,i)=>{const s=getCoverageScore(i+1);return s>=70&&s<80?1:0}).reduce((a,b)=>a+b,0), c:C.amber },
          { l:"At-risk days (<70%)",  v:Array.from({length:daysInMonth},(_,i)=>getCoverageScore(i+1)<70?1:0).reduce((a,b)=>a+b,0), c:C.guava },
          { l:"Avg monthly coverage", v:`${Math.round(Array.from({length:daysInMonth},(_,i)=>getCoverageScore(i+1)).reduce((a,b)=>a+b,0)/daysInMonth)}%`, c:C.kale },
        ].map(k=>(
          <div key={k.l} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:12, padding:"11px 14px" }}>
            <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:800, color:k.c }}>{k.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FORECAST INTELLIGENCE
// ══════════════════════════════════════════════════════════════
const FORECAST_INTEL = [
  { week:"May 5–9",   fcst:5420, act:5381, wmape:97.4, variance:-0.7, driver:"Slightly below on FEIN — expected",        trend:"neutral" },
  { week:"May 12–16", fcst:5510, act:5290, wmape:94.9, variance:-4.0, driver:"Wed volume spike on FEIN — unexpected",     trend:"down"    },
  { week:"Apr 28–May 2",fcst:5340,act:5410,wmape:96.2, variance:+1.3, driver:"BenOps COBRA volume above model",           trend:"up"      },
  { week:"Apr 21–25", fcst:5200, act:5195, wmape:99.1, variance:-0.1, driver:"Cleanest week of the quarter",              trend:"neutral" },
  { week:"Apr 14–18", fcst:5180, act:4960, wmape:95.2, variance:-4.2, driver:"SMB Sales drop — end-of-quarter dip",       trend:"down"    },
];
const MISS_PATTERNS = [
  { type:"FEIN volume spike",       freq:3, impact:"med", desc:"Wednesdays show 12% FEIN excess consistently",   color:C.amber },
  { type:"BenOps Monday peaks",     freq:4, impact:"low", desc:"Monday 9–11am BenOps 8% over forecast",          color:C.amber },
  { type:"SMB end-of-quarter dip",  freq:2, impact:"high",desc:"Q-end weeks drop 18% vs forecast consistently",  color:C.guava },
  { type:"Late Thursday spike",     freq:5, impact:"low", desc:"3–5pm Thursday volume 6% over in all pillars",   color:"#7F77DD" },
];

function ForecastIntelView() {
  const [hov, setHov] = useState(null);
  const maxVol = Math.max(...FORECAST_INTEL.map(w=>Math.max(w.fcst,w.act)));

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
        <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:4 }}>Forecast Intelligence</div>
        <div style={{ fontSize:13, color:C.tx2 }}>Pattern recognition · Automated variance explanations · Week-over-week trends</div>
      </div>

      {/* Week trend bars */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span>WMAPE by week</span>
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:10, height:10, borderRadius:2, background:C.kale }}/> Forecast</div>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:10, height:10, borderRadius:2, background:`${C.amber}88` }}/> Actual</div>
          </div>
        </div>
        {FORECAST_INTEL.map((w, i) => (
          <div key={w.week} style={{ marginBottom:12 }} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color: hov===i ? C.tx0 : C.tx1, transition:"color .12s", fontWeight: hov===i ? 600 : 400 }}>{w.week}</span>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, color: w.wmape>=97 ? "#0AC8A0" : w.wmape>=94 ? C.amber : C.guava }}>{w.wmape}% WMAPE</span>
                <span style={{ fontSize:11, color: w.trend==="down" ? C.guava : w.trend==="up" ? C.amber : C.tx2 }}>{w.trend==="down"?"↓":w.trend==="up"?"↑":"→"}</span>
              </div>
            </div>
            <div style={{ position:"relative", marginBottom:4 }}>
              <div style={{ height:6, background:"rgba(255,255,255,.06)", borderRadius:3, overflow:"hidden", marginBottom:2 }}>
                <div style={{ height:"100%", width:`${(w.fcst/maxVol)*100}%`, background:C.kale, borderRadius:3, transition:"width .8s ease" }}/>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,.06)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(w.act/maxVol)*100}%`, background:`${C.amber}88`, borderRadius:3, transition:"width .8s ease .1s" }}/>
              </div>
            </div>
            {hov===i && (
              <div style={{ fontSize:11, color:C.tx2, padding:"5px 8px", borderRadius:7, background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, animation:"fade-up .15s ease" }}>
                💡 {w.driver} · Variance: <strong style={{ color: w.variance<0?C.guava:C.amber }}>{w.variance>0?"+":""}{w.variance}%</strong>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Miss patterns */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16 }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:14 }}>Recurring miss patterns · last 8 weeks</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {MISS_PATTERNS.map(p => (
            <div key={p.type} style={{ background:`${p.color}08`, border:`.5px solid ${p.color}25`, borderRadius:12, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:6, height:6, borderRadius:2, background:p.color, flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:700, color:C.tx0, flex:1 }}>{p.type}</span>
                <span style={{ fontSize:10, fontWeight:700, color: p.impact==="high" ? C.guava : p.impact==="med" ? C.amber : "#7F77DD", background: p.impact==="high"?"rgba(244,93,72,.12)":p.impact==="med"?"rgba(239,159,39,.12)":"rgba(127,119,221,.12)", padding:"2px 7px", borderRadius:6, textTransform:"uppercase" }}>{p.impact} impact</span>
              </div>
              <div style={{ fontSize:11, color:C.tx2, lineHeight:1.55, marginBottom:8 }}>{p.desc}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ flex:1, height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${p.freq/5*100}%`, background:p.color, borderRadius:2 }}/>
                </div>
                <span style={{ fontSize:10, color:C.tx2 }}>{p.freq}/8 weeks</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:12, padding:"10px 13px", borderRadius:10, background:"rgba(10,128,128,.07)", border:`.5px solid rgba(10,128,128,.18)`, fontSize:12, color:"rgba(10,200,150,.8)", lineHeight:1.6 }}>
          💡 <strong style={{ color:C.tx0 }}>Pri recommendation:</strong> Pre-build Wednesday FEIN variance into the base model (+8% buffer). This would reduce WMAPE miss by ~1.8pp and eliminate the most frequent alert.
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PRISM SCORE — composite health ring
// ══════════════════════════════════════════════════════════════
function PrismScoreRing({ score, color, size = 88 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }} />
    </svg>
  );
}

function PrismScore({ score, label, breakdown, color, onNav }) {
  const [hov, setHov] = useState(null);
  const scoreColor = score >= 90 ? "#0AC8A0" : score >= 75 ? C.amber : C.guava;
  const sc = color || scoreColor;
  return (
    <div style={{ background: C.card, border: `.5px solid ${sc}28`, borderRadius: 16, padding: 16, display: "flex", gap: 16, alignItems: "center", cursor: onNav ? "pointer" : "default", transition: "all .18s" }}
      onClick={onNav} onMouseEnter={e => { if (onNav) e.currentTarget.style.background = C.elev; }}
      onMouseLeave={e => { if (onNav) e.currentTarget.style.background = C.card; }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <PrismScoreRing score={score} color={sc} size={80} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: sc, lineHeight: 1, letterSpacing: "-.03em" }}>{score}</div>
          <div style={{ fontSize: 9, color: C.tx2, textTransform: "uppercase", letterSpacing: ".08em" }}>score</div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.tx0, marginBottom: 2 }}>Prism Score</div>
        <div style={{ fontSize: 11, color: C.tx2, marginBottom: 8 }}>{label}</div>
        {breakdown.map((b, i) => (
          <div key={b.label} style={{ marginBottom: 4 }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: hov === i ? C.tx0 : C.tx2, transition: "color .12s" }}>{b.label}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: b.value >= 90 ? "#0AC8A0" : b.value >= 75 ? C.amber : C.guava }}>{b.value}%</span>
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${b.value}%`, background: b.value >= 90 ? "#0AC8A0" : b.value >= 75 ? C.amber : C.guava, borderRadius: 2, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AI COMMAND PALETTE
// ══════════════════════════════════════════════════════════════
function queryPrism(q, role) {
  const ql = q.toLowerCase().trim();
  const CC_DATA = CC_GROUPS;

  // SL queries
  if (/benops|ben ops/.test(ql) && /sl|service level/.test(ql)) {
    const d = CC_DATA.filter(x => x.pillar === "Benefits Operations" || x.name?.includes("BenOps") || x.category?.includes("Ben"));
    const avg = d.length ? Math.round(d.reduce((s,x)=>s+(x.serviceLevel||0),0)/d.length) : 68;
    return { icon:"🛡️", title:"BenOps Service Level", body: `Current SL is **${avg}%** across ${d.length||4} CTs. Target is 85% — currently **${avg<85?"below":"above"} target** by ${Math.abs(avg-85)}pp.`, tag: avg<85?"WATCH":"OK", tagColor: avg<85?C.amber:"#0AC8A0" };
  }
  if (/service level|sl\b/.test(ql)) {
    const avg = Math.round(CC_DATA.reduce((s,x)=>s+(x.serviceLevel||0),0)/CC_DATA.length);
    return { icon:"📊", title:"Platform Service Level", body:`Blended SL across all 86 CTs is **${avg}%**. ${CC_DATA.filter(x=>x.serviceLevel<80).length} CTs are below 80% threshold.`, tag:`${avg}%`, tagColor: avg>=85?"#0AC8A0":C.amber };
  }

  // Adherence queries
  if (/adher/.test(ql)) {
    return { icon:"⏱️", title:"Team Adherence", body:`Current platform adherence is **94.2%** — up 1.1pp vs. last week. Payroll & Taxes is lowest at 91%. 8 agents are currently out of adherence window.`, tag:"94.2%", tagColor:"#0AC8A0" };
  }

  // Forecast accuracy
  if (/forecast|accuracy|clearcast|wmape|mape/.test(ql)) {
    return { icon:"🔮", title:"ClearCast Forecast Accuracy", body:`This week's forecast accuracy is **97.1% WMAPE** — best week on record. LaFlare model outperformed Lola by 2.3pp on volume. 4 CTs are currently > 15% off forecast.`, tag:"97.1%", tagColor:"#0AC8A0" };
  }

  // PTO / LOA / agents out
  if (/pto|time off|out today|absent/.test(ql)) {
    const pto = ALL_AGENTS.filter(a => a.pto).length;
    const loa = ALL_AGENTS.filter(a => a.loa).length;
    return { icon:"🏖️", title:"Agents Out Today", body:`**${pto} agents** on PTO and **${loa} agents** on LOA right now. Net active headcount is ${ALL_AGENTS.length - pto - loa} of ${ALL_AGENTS.length}.`, tag:`${pto+loa} out`, tagColor: C.amber };
  }

  // Coverage / understaffed
  if (/cover|understaff|gap/.test(ql)) {
    const missCount = INTRADAY.filter(x=>x.miss).length;
    return { icon:"🗓️", title:"Coverage Gaps", body:`Today has **${missCount} intervals with SL misses** (8:00–9:30 AM). BenOps Priority and SMB Sales Inbound are the most understaffed queues. Peak gap is 9:00–9:30 AM (-12 FTE).`, tag:`${missCount} gaps`, tagColor: C.guava, action: { label:"View heatmap →", nav:"coverage" } };
  }

  // Top performer / leaderboard
  if (/top|best|leader|xp|rank/.test(ql)) {
    const board = LEADERBOARDS[role] || LEADERBOARDS.agent;
    const top = board[0];
    return { icon:"🏆", title:"Leaderboard Leader", body:`**${top.n}** is currently #1 with **${top.xp.toLocaleString()} XP** and a ${top.streak}-day streak. ${board.length > 1 ? `${board[1].n} is close behind at ${board[1].xp.toLocaleString()} XP.` : ""}`, tag:"#1 Gustie", tagColor:"#FFD700" };
  }

  // Approvals
  if (/approv|pending|request/.test(ql)) {
    return { icon:"✓", title:"Pending Approvals", body:`**3 requests** are pending review — 2 shift swaps and 1 VTO. Oldest request is 6 hours old. Auto-approve rules will kick in for swap requests after 12 hours.`, tag:"3 pending", tagColor: C.guava, action: { label:"Open approvals →", nav:"approvals" } };
  }

  // OT / overtime
  if (/overtime|ot\b|extra shift/.test(ql)) {
    return { icon:"⚡", title:"Overtime Availability", body:`Current OT budget has **18 hours** remaining this week. 4 agents have pre-authorized OT. BenOps Priority is the top candidate for an OT offer given the current SL miss.`, tag:"18h budget", tagColor: C.amber };
  }

  // Schedule
  if (/schedule|publish|calendar/.test(ql)) {
    return { icon:"📅", title:"Schedule Status", body:`This week's schedule is in **Draft** state. Last published: 5 days ago. 12 agents have pending schedule changes. Ready to review and publish.`, tag:"Draft", tagColor: C.amber, action: { label:"Open schedule →", nav:"calendar" } };
  }

  // Queue
  if (/queue|volume|contact|call/.test(ql)) {
    const cur = INTRADAY.find(x=>x.now);
    return { icon:"📞", title:"Queue Status", body:`Current interval (10:30): **${cur?.av||47} contacts** vs **${cur?.fv||55} forecast**. SL is ${cur?.aSL||85}%. ASA is ${cur?.asa||24}s. Volume is tracking 14% below forecast — watch for afternoon spike.`, tag:`${cur?.aSL||85}% SL`, tagColor: (cur?.aSL||85)>=85?"#0AC8A0":C.amber };
  }

  // Pillar / team
  if (/pillar|team|payroll|premier|smb|onboard/.test(ql)) {
    return { icon:"⊡", title:"Pillar Summary", body:`${Object.keys(FULL_ROSTER).length} active pillars. **Customer Care** has highest adherence at 97%. **SMB Sales** has lowest coverage at 78%. **Payroll & Taxes** has most agents at ${FULL_ROSTER["Payroll & Taxes"]?.a?.length||58}.`, tag:"6 pillars", tagColor: C.kale };
  }

  // Prism score
  if (/score|health|prism score/.test(ql)) {
    return { icon:"⬡", title:"Prism Score", body:`Platform Prism Score is **87/100** — up 3pts from yesterday. Breakdown: Adherence 94%, SL 81%, Forecast 97%, Approval speed 88%. Biggest drag is BenOps SL.`, tag:"87 / 100", tagColor: C.kale };
  }

  return null;
}

// ─── PRI INSIGHT CARD ─────────────────────────────────────────
function PriInsight({ title, body, confidence, action, actionLabel, color, onAction }) {
  const clr = color || C.kale;
  return (
    <div style={{ background:`${clr}08`, border:`.5px solid ${clr}30`, borderRadius:11, padding:"11px 13px", animation:"fade-up .25s ease" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <div style={{ width:22, height:22, borderRadius:7, background:`${clr}18`, border:`.5px solid ${clr}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>✦</div>
        <span style={{ fontSize:12, fontWeight:700, color:C.tx0, flex:1 }}>{title}</span>
        {confidence != null && (
          <span style={{ fontSize:10, fontWeight:700, color:confidence>=80?"#0AC8A0":confidence>=60?C.amber:C.guava, background:confidence>=80?"rgba(10,200,150,.1)":confidence>=60?`${C.amber}12`:"rgba(244,93,72,.1)", padding:"2px 7px", borderRadius:6 }}>
            {confidence}% conf.
          </span>
        )}
      </div>
      <div style={{ fontSize:11.5, color:C.tx1, lineHeight:1.6, marginBottom:action?9:0 }}>{body}</div>
      {action && (
        <button onClick={onAction} style={{ background:`${clr}14`, border:`.5px solid ${clr}30`, color:clr, borderRadius:7, padding:"5px 11px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          {actionLabel || "Take action →"}
        </button>
      )}
    </div>
  );
}

function getAiInsights(view, data = {}) {
  const { liveSL, liveAdh, liveQueue } = data;
  if (view === "ops") {
    const sl = liveSL ?? 83;
    const adh = liveAdh ?? 9;
    const risk = OPS_PROJ.some(p => p.risk);
    const insights = [];
    if (risk) {
      const highAdh = adh >= 11;
      insights.push({
        title: "SL risk window: 2:00–3:30 PM",
        body: highAdh
          ? `Volume trending toward threshold. Opening OT — 4 eligible agents, ~$180 cost — projects +9pp SL recovery. Acting now closes the gap before 2pm peak.`
          : `${12-adh} agents are off-activity, compressing effective capacity. Send adherence alert + pull 2 agents from 2:30pm break — $0 cost, +6pp SL projected.`,
        confidence: sl < 80 ? 91 : 76,
        color: sl < 80 ? C.guava : C.amber,
        action: true,
        actionLabel: highAdh ? "⚡ Open OT offer" : "☕ Pull from break",
      });
    }
    if (adh < 10) {
      insights.push({
        title: `${12-adh} agents out of adherence`,
        body: `Adherence at ${Math.round(adh/12*100)}% — off-activity agents are reducing effective capacity. A targeted alert recovers ~3pp on SL within one interval.`,
        confidence: 84,
        color: C.amber,
        action: true,
        actionLabel: "📣 Send alert",
      });
    }
    if ((liveQueue ?? 3) > 5) {
      insights.push({
        title: "Queue depth elevated",
        body: `${liveQueue} contacts waiting. ASA trending up. If depth crosses 8, escalate to manager alert immediately.`,
        confidence: 78,
        color: C.guava,
      });
    }
    if (insights.length === 0) {
      insights.push({
        title: "Operation is healthy",
        body: `SL at ${sl}%, adherence solid, queue clear. No action needed — next check window is 1:45 PM.`,
        confidence: 94,
        color: "#0AC8A0",
      });
    }
    return insights;
  }
  if (view === "approvals") {
    const warns = APPROVAL_DATA.filter(a => a.rule === "warn").length;
    const oks = APPROVAL_DATA.filter(a => a.rule === "ok").length;
    return [{
      title: `${oks} of ${APPROVAL_DATA.length} requests are safe to auto-approve`,
      body: `Coverage rules checked — ${oks} items have no risk. ${warns > 0 ? `${warns} item${warns>1?"s":""} need manual review: coverage drops below 80%.` : "All others are clear."}`,
      confidence: 92,
      color: C.kale,
      action: oks > 0,
      actionLabel: `✓ Auto-approve ${oks}`,
    }];
  }
  if (view === "coverage") {
    return [{
      title: "BenOps gap: 8am–10:30am critical",
      body: "BenOps Priority is −2 FTE vs requirement during morning ramp. SMB Sales −1 FTE at 11am–1pm. Stagger breaks or open targeted OT to close gap before peak.",
      confidence: 88,
      color: C.guava,
      action: true,
      actionLabel: "View gap detail →",
    }];
  }
  if (view === "forecast") {
    const latest = FORECAST_INTEL[0];
    const worst = FORECAST_INTEL.reduce((a, b) => b.wmape < a.wmape ? b : a);
    const improving = FORECAST_INTEL[0].wmape > FORECAST_INTEL[1].wmape;
    return [{
      title: `${latest.week}: ${latest.wmape}% WMAPE${improving ? " ↑ improving" : " — watch"}`,
      body: `${latest.driver}. Worst recent week: ${worst.week} at ${worst.wmape}%. FEIN Wednesday spike pattern detected 3 of last 8 weeks — recommend +8% volume buffer on ClearCast Wednesday groups.`,
      confidence: 89,
      color: improving ? "#0AC8A0" : C.amber,
    }];
  }
  if (view === "wfm-dashboard") {
    return [
      {
        title: "Forecast accuracy at 5-week high",
        body: "97.1% WMAPE this week. LaFlare model outperforming baseline by 2.3pp. FEIN Wednesday spike still active — add +8% buffer to Wednesday ClearCast groups.",
        confidence: 94,
        color: "#0AC8A0",
      },
      {
        title: "BenOps SL is the top drag on Prism Score",
        body: "Platform at 87/100. BenOps pulling SL to 81% vs 85% target. Closing that gap adds ~4 pts to score — open OT or adjust break stagger.",
        confidence: 87,
        color: C.amber,
        action: true,
        actionLabel: "Open Intraday Ops →",
      },
      {
        title: "2 approvals need manual review",
        body: "LaKeisha's early leave drops Cust. Care to 76% at 4pm. Donna Jo's sick day has 72% coverage at 7am peak — both below threshold.",
        confidence: 91,
        color: C.guava,
        action: true,
        actionLabel: "Review approvals →",
      },
    ];
  }
  return [];
}

function AICommandPalette({ auth, cmdItems, onClose, onNav }) {
  const [q, setQ] = useState("");
  const [aiState, setAiState] = useState("idle"); // idle | thinking | answer
  const [aiResult, setAiResult] = useState(null);
  const [selIdx, setSelIdx] = useState(0);
  const aiTimer = useRef(null);

  const isQuestion = q.length > 2 && /[a-z]/i.test(q) && !/^[a-z]+$/i.test(q.trim()) ? false : q.length > 4;
  const looksLikeQuery = q.length > 3 && /\?|who|what|how|show|find|is |are |sl|coverage|pto|adher|forecast|approvals|xp|score|queue|schedule|top|best|leader|pillar|overtime/.test(q.toLowerCase());

  const filtered = q ? cmdItems.filter(i => i.label.toLowerCase().includes(q.toLowerCase()) || i.desc.toLowerCase().includes(q.toLowerCase())) : cmdItems;

  function handleKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i+1, filtered.length-1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx(i => Math.max(i-1, 0)); }
    if (e.key === "Enter") {
      if (aiState === "answer" && aiResult?.action) { onNav(aiResult.action.nav); onClose(); return; }
      if (looksLikeQuery && aiState === "idle") { runAI(); return; }
      if (filtered[selIdx]) { filtered[selIdx].action(); }
    }
  }

  function runAI() {
    setAiState("thinking");
    setAiResult(null);
    clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(() => {
      const result = queryPrism(q, auth.role);
      setAiResult(result || { icon:"🤔", title:"Not sure about that", body:`I couldn't find data for "${q}". Try asking about: SL, adherence, forecast accuracy, coverage gaps, approvals, top performers, OT, or schedule status.`, tag:null });
      setAiState("answer");
    }, 680);
  }

  useEffect(() => {
    setAiState("idle"); setAiResult(null); setSelIdx(0);
    if (aiTimer.current) clearTimeout(aiTimer.current);
  }, [q]);

  const rc = auth ? (ROLE_META[auth.role]?.color || C.kale) : C.kale;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", backdropFilter:"blur(10px)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"16vh" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:520, background:C.card, border:`.5px solid rgba(255,255,255,.14)`, borderRadius:18, overflow:"hidden", boxShadow:"0 28px 90px rgba(0,0,0,.7)", animation:"view-in .15s ease" }}>
        {/* Input row */}
        <div style={{ padding:"14px 16px", borderBottom:`.5px solid ${C.bd}`, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`${rc}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
            {aiState==="thinking" ? <span style={{ animation:"spin .8s linear infinite", display:"inline-block" }}>⟳</span> : aiState==="answer" ? "✦" : "⌘"}
          </div>
          <input autoFocus type="text" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask Prism anything… or search commands"
            style={{ flex:1, background:"none", border:"none", outline:"none", color:C.tx0, fontSize:15, fontWeight:400 }} />
          {looksLikeQuery && aiState==="idle" && q.length > 3 && (
            <button onClick={runAI} style={{ padding:"4px 10px", borderRadius:7, background:`${rc}18`, border:`.5px solid ${rc}30`, color:rc, fontSize:11, fontWeight:700, cursor:"pointer" }}>ASK AI ↵</button>
          )}
          <span style={{ fontSize:11, color:C.tx2, background:"rgba(255,255,255,.06)", padding:"2px 6px", borderRadius:4, flexShrink:0 }}>ESC</span>
        </div>

        {/* AI answer */}
        {aiState === "thinking" && (
          <div style={{ padding:"20px 18px", display:"flex", align:"center", gap:10 }}>
            <span style={{ fontSize:13, color:C.tx2, animation:"fade-up .3s ease" }}>Querying Prism data…</span>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              {[0,1,2].map(i=><div key={i} style={{ width:5, height:5, borderRadius:"50%", background:rc, animation:`lp 1s ease-in-out ${i*0.2}s infinite` }}/>)}
            </div>
          </div>
        )}
        {aiState === "answer" && aiResult && (
          <div style={{ padding:"16px 18px", borderBottom:`.5px solid ${C.bd}`, animation:"fade-up .2s ease" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${rc}18`, border:`.5px solid ${rc}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{aiResult.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>{aiResult.title}</span>
                  {aiResult.tag && <span style={{ fontSize:10, fontWeight:700, color:aiResult.tagColor, background:`${aiResult.tagColor}15`, border:`.5px solid ${aiResult.tagColor}35`, padding:"2px 8px", borderRadius:10 }}>{aiResult.tag}</span>}
                </div>
                <div style={{ fontSize:13, color:C.tx1, lineHeight:1.65 }}>
                  {aiResult.body.split("**").map((part, i) => i%2===1 ? <strong key={i} style={{ color:C.tx0 }}>{part}</strong> : part)}
                </div>
                {aiResult.action && (
                  <button onClick={() => { onNav(aiResult.action.nav); onClose(); }}
                    style={{ marginTop:10, padding:"6px 14px", borderRadius:8, background:`${rc}18`, border:`.5px solid ${rc}30`, color:rc, fontSize:12, fontWeight:700, cursor:"pointer" }}>{aiResult.action.label}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        {(aiState !== "answer" || filtered.length > 0) && (
          <>
            {aiState === "idle" && q === "" && <div style={{ padding:"8px 18px 4px", fontSize:11, fontWeight:700, color:"rgba(255,255,255,.2)", letterSpacing:".1em", textTransform:"uppercase" }}>Quick navigation</div>}
            {aiState === "idle" && q !== "" && filtered.length > 0 && <div style={{ padding:"8px 18px 4px", fontSize:11, fontWeight:700, color:"rgba(255,255,255,.2)", letterSpacing:".1em", textTransform:"uppercase" }}>Commands</div>}
            <div style={{ maxHeight:240, overflowY:"auto", padding:"4px 8px 8px" }}>
              {filtered.map((item, idx) => (
                <div key={item.label} onClick={item.action}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 10px", borderRadius:10, cursor:"pointer", transition:"background .1s", background: selIdx===idx ? "rgba(255,255,255,.09)" : "transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.08)"; setSelIdx(idx); }}
                  onMouseLeave={e => { e.currentTarget.style.background = selIdx===idx ? "rgba(255,255,255,.09)" : "transparent"; }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:"rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:C.tx0 }}>{item.label}</div>
                    <div style={{ fontSize:11, color:C.tx2 }}>{item.desc}</div>
                  </div>
                  {item.badge && <span style={{ fontSize:10, fontWeight:700, color:C.guava, background:"rgba(244,93,72,.12)", padding:"2px 7px", borderRadius:8 }}>{item.badge}</span>}
                </div>
              ))}
              {filtered.length === 0 && aiState==="idle" && q.length > 0 && !looksLikeQuery && (
                <div style={{ padding:"16px 12px", textAlign:"center", fontSize:13, color:C.tx2 }}>No commands found · Try a natural language question</div>
              )}
            </div>
          </>
        )}
        <div style={{ padding:"7px 16px", borderTop:`.5px solid ${C.bd}`, display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:11, color:C.tx2 }}>↑↓ navigate</span>
          <span style={{ fontSize:11, color:C.tx2 }}>↵ select</span>
          {looksLikeQuery && <span style={{ fontSize:11, color:rc }}>↵ ask AI</span>}
          <span style={{ fontSize:11, color:"rgba(255,255,255,.15)", marginLeft:"auto" }}>Prism AI · powered by Gusto data</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INTRADAY OPS CENTER
// ══════════════════════════════════════════════════════════════
function fmtTIS(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2,"0")}`;
}

const RTM_SKILLS_LIST = ["Phone","Email","Chat/Email","FEIN","Benefits","Spanish","COBRA","Payroll Adv"];

const QUEUE_REQ_SKILLS = {
  benops:     ["Benefits","COBRA"],
  payroll:    ["FEIN","Payroll Adv"],
  premier:    ["Payroll Adv","Phone"],
  smb:        ["Phone","Chat/Email"],
  care:       ["Phone","Spanish"],
  onboarding: ["FEIN","Phone"],
};

const RTM_AGENTS = [
  { id:1,  n:"Anthony Piper",     p:"Payroll",    state:"Handling",    tis:48,   skills:["Phone","Email","FEIN"],                      adh:true  },
  { id:2,  n:"Aaliyah Ali",       p:"BenOps",     state:"Unavailable", tis:372,  skills:["Phone","Benefits","COBRA"],                  adh:false },
  { id:3,  n:"Hermes Diaz",       p:"Payroll",    state:"Handling",    tis:106,  skills:["Phone","FEIN","Email"],                      adh:true  },
  { id:4,  n:"Briana Perez",      p:"Payroll",    state:"Email",       tis:234,  skills:["Email","Chat/Email","FEIN"],                 adh:true  },
  { id:5,  n:"LaKeisha Hemphill", p:"Payroll",    state:"Available",   tis:12,   skills:["Phone","Email","Chat/Email","FEIN"],         adh:true  },
  { id:6,  n:"Mason Amling",      p:"Payroll",    state:"Break",       tis:891,  skills:["Phone","Email"],                            adh:false },
  { id:7,  n:"D'Angela Redman",   p:"Care",       state:"Handling",    tis:183,  skills:["Phone","Email","Spanish"],                   adh:true  },
  { id:8,  n:"Claudia Lizama",    p:"Payroll",    state:"Email",       tis:312,  skills:["Email","Chat/Email","FEIN","Payroll Adv"],   adh:true  },
  { id:9,  n:"Donna Jo Doney",    p:"Payroll",    state:"Tech Issues", tis:498,  skills:["Phone","Email"],                            adh:false },
  { id:10, n:"Jasmine Gill",      p:"BenOps",     state:"Handling",    tis:72,   skills:["Phone","Benefits","COBRA","Chat/Email"],    adh:true  },
  { id:11, n:"Jazz Eaton",        p:"BenOps",     state:"Available",   tis:24,   skills:["Chat/Email","Benefits","Email"],            adh:true  },
  { id:12, n:"Kelly Joe",         p:"Payroll",    state:"Project",     tis:1440, skills:["Phone","Email","FEIN"],                     adh:true  },
  { id:13, n:"Marcus Webb",       p:"Premier",    state:"Handling",    tis:156,  skills:["Phone","Email","Chat/Email","Payroll Adv"], adh:true  },
  { id:14, n:"Priya Sharma",      p:"SMB",        state:"Available",   tis:8,    skills:["Phone","Chat/Email","Email"],               adh:true  },
  { id:15, n:"Deon Harris",       p:"BenOps",     state:"Lunch",       tis:1245, skills:["Phone","Benefits","Spanish","COBRA"],       adh:false },
  { id:16, n:"Nina Okafor",       p:"Care",       state:"Handling",    tis:234,  skills:["Phone","Email","Spanish","Chat/Email"],    adh:true  },
  { id:17, n:"Tyler Brooks",      p:"SMB",        state:"Handling",    tis:88,   skills:["Phone","Email","Chat/Email"],               adh:true  },
  { id:18, n:"Alexis Monroe",     p:"Onboarding", state:"Available",   tis:45,   skills:["Phone","Email","FEIN"],                    adh:true  },
  { id:19, n:"Jordan Taylor",     p:"Care",       state:"Break",       tis:187,  skills:["Phone","Chat/Email","Email","Spanish"],     adh:true  },
  { id:20, n:"Carlos Reyes",      p:"BenOps",     state:"Handling",    tis:321,  skills:["Phone","Benefits","Email","COBRA"],        adh:true  },
];

const RTM_QUEUES_INIT = [
  { id:"benops",    label:"BenOps",     waiting:8,  lw:252, sl:79, aht:443, handling:4, target:85 },
  { id:"payroll",   label:"Payroll",    waiting:3,  lw:105, sl:91, aht:372, handling:6, target:85 },
  { id:"premier",   label:"Premier",    waiting:1,  lw:48,  sl:94, aht:412, handling:2, target:85 },
  { id:"smb",       label:"SMB Sales",  waiting:5,  lw:198, sl:83, aht:486, handling:3, target:85 },
  { id:"care",      label:"Care",       waiting:2,  lw:67,  sl:88, aht:398, handling:4, target:85 },
  { id:"onboarding",label:"Onboarding", waiting:0,  lw:0,   sl:97, aht:521, handling:2, target:85 },
];

function OTVTOModal({ onClose }) {
  const [type, setType] = useState("OT");
  const [scope, setScope] = useState("pillar");
  const [pillar, setPillar] = useState("BenOps");
  const [maxHrs, setMaxHrs] = useState("2");
  const [responses, setResponses] = useState([
    {n:"LaKeisha H.",   status:"pending"},
    {n:"Jordan (RTM)",  status:"pending"},
    {n:"Marcus V.",     status:"accepted"},
    {n:"Priya S.",      status:"declined"},
  ]);
  const pillars = ["BenOps","Payroll & Taxes","Premier DSA","Partner Care","SMB Sales","Benefits Care"];
  function sendOffer() {
    setResponses(prev => prev.map(r => r.status==="pending" ? {...r, status: Math.random()>.4?"accepted":"pending"} : r));
    window.prismToast?.(`${type} offer sent to ${scope==="all"?"all eligible agents":pillar+" agents"}`, "success");
  }
  const accepted = responses.filter(r=>r.status==="accepted").length;
  const pending  = responses.filter(r=>r.status==="pending").length;
  const declined = responses.filter(r=>r.status==="declined").length;
  return (
    <div style={{ background:`${C.amber}08`, border:`.5px solid ${C.amber}28`, borderRadius:11, padding:14, animation:"fade-up .2s ease" }}>
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {["OT","VTO"].map(t => (
          <button key={t} onClick={() => setType(t)} style={{ flex:1, padding:"6px 0", borderRadius:8, border:`.5px solid ${type===t?C.amber+"50":C.bd}`, background:type===t?`${C.amber}18`:"transparent", color:type===t?C.amber:C.tx2, fontSize:12, fontWeight:600, cursor:"pointer" }}>{t}</button>
        ))}
      </div>
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:10, color:C.tx2, marginBottom:4 }}>Scope</div>
        <div style={{ display:"flex", gap:4 }}>
          {[["all","All eligible"],["pillar","By pillar"]].map(([v,l]) => (
            <button key={v} onClick={() => setScope(v)} style={{ padding:"4px 10px", borderRadius:7, border:`.5px solid ${scope===v?C.amber+"40":C.bd}`, background:scope===v?`${C.amber}12`:"transparent", color:scope===v?C.amber:C.tx2, fontSize:11, cursor:"pointer" }}>{l}</button>
          ))}
        </div>
      </div>
      {scope==="pillar" && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, color:C.tx2, marginBottom:4 }}>Pillar</div>
          <select value={pillar} onChange={e=>setPillar(e.target.value)} style={{ width:"100%", padding:"5px 8px", borderRadius:7, border:`.5px solid ${C.bd}`, background:C.elev, color:C.tx0, fontSize:11 }}>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10, color:C.tx2, marginBottom:4 }}>Max hours</div>
        <div style={{ display:"flex", gap:4 }}>
          {["1","2","4"].map(h => (
            <button key={h} onClick={() => setMaxHrs(h)} style={{ flex:1, padding:"4px 0", borderRadius:7, border:`.5px solid ${maxHrs===h?C.amber+"40":C.bd}`, background:maxHrs===h?`${C.amber}12`:"transparent", color:maxHrs===h?C.amber:C.tx2, fontSize:11, cursor:"pointer" }}>{h}hr</button>
          ))}
        </div>
      </div>
      <button onClick={sendOffer} style={{ width:"100%", padding:"8px 0", borderRadius:8, background:`linear-gradient(135deg,${C.amber},${C.amber}BB)`, color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer", marginBottom:10 }}>
        Send {type} offer →
      </button>
      <div style={{ fontSize:10, fontWeight:600, color:C.tx2, marginBottom:6 }}>Responses</div>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        {[["✓","accepted","#0AC8A0",accepted],["-","pending",C.amber,pending],["✗","declined",C.guava,declined]].map(([ic,lbl,col,cnt]) => (
          <div key={lbl} style={{ flex:1, textAlign:"center", background:`${col}10`, border:`.5px solid ${col}25`, borderRadius:8, padding:"5px 0" }}>
            <div style={{ fontSize:13, fontWeight:700, color:col }}>{cnt}</div>
            <div style={{ fontSize:9, color:C.tx2 }}>{lbl}</div>
          </div>
        ))}
      </div>
      {responses.map((r,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 6px", borderRadius:7, marginBottom:3, background:"rgba(255,255,255,.025)" }}>
          <span style={{ fontSize:11, color:C.tx1 }}>{r.n}</span>
          <span style={{ fontSize:10, fontWeight:600, color:r.status==="accepted"?"#0AC8A0":r.status==="declined"?C.guava:C.amber }}>{r.status}</span>
        </div>
      ))}
    </div>
  );
}

function RealTimeMgmtView({ role }) {
  const [tick, setTick]           = useState(0);
  const [clock, setClock]         = useState("");
  const [tab, setTab]             = useState("live");
  const [pillarFilter, setPillar] = useState("All");
  const [sortAgents, setSort]     = useState("default");
  const [skillEdits, setSkillEdits] = useState({});
  const [dismissed, setDismissed] = useState(new Set());
  const [otOpen, setOtOpen]       = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [skillFlash, setSkillFlash] = useState(null);

  useEffect(() => {
    const iv1 = setInterval(() => setTick(t => t + 1), 5000);
    const iv2 = setInterval(() => setClock(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})), 1000);
    setClock(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}));
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, []);

  const liveQueues = RTM_QUEUES_INIT.map(q => {
    const drift   = (tick % 7) - 3;
    const slDrift = Math.round(Math.sin(tick * 0.8 + q.id.length) * 2.5);
    const lwDrift = (tick % 5) * 11 - 22;
    return {
      ...q,
      waiting:  Math.max(0, q.waiting + drift + (q.id === "benops" ? 1 : 0)),
      sl:       Math.max(68, Math.min(99, q.sl + slDrift)),
      lw:       Math.max(0, q.lw + lwDrift),
      aht:      q.aht + ((tick % 3) - 1) * 9,
      handling: Math.max(1, q.handling + (tick % 3 === 1 ? -1 : tick % 5 === 0 ? 1 : 0)),
    };
  });

  const totalWaiting  = liveQueues.reduce((s, q) => s + q.waiting, 0);
  const worstSL       = Math.min(...liveQueues.map(q => q.sl));
  const longestWait   = Math.max(...liveQueues.map(q => q.lw));
  const avgAHT        = Math.round(liveQueues.reduce((s,q) => s + q.aht, 0) / liveQueues.length);
  const liveASA       = 18 + (tick % 7) * 3;
  const adhAgents     = RTM_AGENTS.filter(a => a.adh).length;
  const liveAbandRate = parseFloat((2.1 + (tick % 5) * 0.35).toFixed(1));
  const availAgents   = RTM_AGENTS.filter(a => a.state === "Available").length;

  function getSkills(agent) {
    return skillEdits[agent.id] || new Set(agent.skills);
  }
  function toggleSkill(agentId, skill) {
    setSkillEdits(prev => {
      const base = new Set(prev[agentId] || RTM_AGENTS.find(a => a.id === agentId).skills);
      const next = new Set(base);
      if (next.has(skill)) next.delete(skill); else next.add(skill);
      return { ...prev, [agentId]: next };
    });
    setSkillFlash({ agentId, skill });
    setTimeout(() => setSkillFlash(null), 600);
  }
  const hasEdits = Object.keys(skillEdits).length > 0;

  const STATE_COLOR = {
    "Handling":"#0AC8A0","Available":"#0A9898","Email":"#0AC8A0",
    "Chat/Email":"#0AC8A0","FEIN":"#0AC8A0","Project":C.purple,
    "Break":C.amber,"Lunch":C.amber,
    "Unavailable":C.guava,"Tech Issues":C.guava,
  };
  const STATE_BG = {
    "Handling":"rgba(10,200,150,.08)","Available":"rgba(10,152,152,.08)",
    "Email":"rgba(10,200,150,.06)","Chat/Email":"rgba(10,200,150,.06)","FEIN":"rgba(10,200,150,.06)",
    "Project":"rgba(127,119,221,.08)","Break":"rgba(239,159,39,.08)","Lunch":"rgba(239,159,39,.08)",
    "Unavailable":"rgba(244,93,72,.1)","Tech Issues":"rgba(244,93,72,.1)",
  };

  const rawAlerts = [
    ...liveQueues.filter(q => q.sl < 85).map(q => ({
      id:`sl-${q.id}`, type:"critical",
      msg:`${q.label} SL at ${q.sl}% — ${q.waiting} waiting, target missed`
    })),
    longestWait > 180 ? { id:"lw-global", type:"critical", msg:`Longest wait ${fmtTIS(longestWait)} — immediate intervention needed` } : null,
    liveAbandRate > 4 ? { id:"aband", type:"warn", msg:`Abandon rate ${liveAbandRate}% — elevated above 4% threshold` } : null,
    liveQueues.find(q => q.id === "smb" && q.waiting >= 4) ? { id:"smb-avail", type:"warn", msg:`SMB Sales: ${liveQueues.find(q => q.id === "smb").waiting} waiting, 0 available agents` } : null,
  ].filter(Boolean).filter(a => !dismissed.has(a.id));

  const pillars = ["All", ...new Set(RTM_AGENTS.map(a => a.p))];
  let filteredAgents = pillarFilter === "All" ? [...RTM_AGENTS] : RTM_AGENTS.filter(a => a.p === pillarFilter);
  if (sortAgents === "tis")   filteredAgents = [...filteredAgents].sort((a,b) => (!a.adh && !b.adh) ? b.tis - a.tis : (!a.adh ? -1 : !b.adh ? 1 : 0));
  if (sortAgents === "state") filteredAgents = [...filteredAgents].sort((a,b) => {
    const ord = { "Unavailable":0,"Tech Issues":1,"Break":2,"Lunch":3,"Available":4,"Handling":5,"Email":5,"Chat/Email":5,"FEIN":5,"Project":6 };
    return (ord[a.state] ?? 7) - (ord[b.state] ?? 7);
  });

  const activeStates = ["Handling","Available","Email","Chat/Email","FEIN"];
  const skillCoverage = RTM_SKILLS_LIST.map(skill => {
    const agentsForFilter = pillarFilter === "All" ? RTM_AGENTS : RTM_AGENTS.filter(a => a.p === pillarFilter);
    const total  = agentsForFilter.filter(a => getSkills(a).has(skill)).length;
    const active = agentsForFilter.filter(a => getSkills(a).has(skill) && activeStates.includes(a.state)).length;
    const demand = liveQueues.filter(q => (QUEUE_REQ_SKILLS[q.id]||[]).includes(skill) && q.waiting > 0).reduce((s,q) => s+q.waiting, 0);
    return { skill, total, active, demand, gap: demand > 0 && active < 2 };
  });

  function KpiCard({ label, value, sub, color, warning, prev, prevLabel }) {
    const delta = prev !== undefined ? (typeof value === "string" ? null : value - prev) : null;
    return (
      <div style={{ background:C.card, border:`.5px solid ${warning ? color+"44" : C.bd}`, borderTop:`2px solid ${color}`, borderRadius:12, padding:"11px 13px", animation:warning?"live-pulse 2.2s ease-in-out infinite":"none" }}>
        <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{label}</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6 }}>
          <div key={`${value}-${tick}`} style={{ fontSize:22, fontWeight:800, color, lineHeight:1, marginBottom:2, animation:"val-pop .35s ease" }}>{value}</div>
          {delta !== null && <div style={{ fontSize:11, fontWeight:600, color:delta>0?C.guava:"#0AC8A0", marginBottom:4 }}>{delta>0?`+${delta}`:delta} vs {prevLabel||"last wk"}</div>}
        </div>
        <div style={{ fontSize:11, color:C.tx2 }}>{sub}</div>
      </div>
    );
  }

  function renderLive() {
    const pts = [
      {t:"10:30",sl:85,now:true},{t:"11:00",sl:84},{t:"11:30",sl:83},
      {t:"12:00",sl:85},{t:"12:30",sl:84},{t:"13:00",sl:83},
      {t:"13:30",sl:80},{t:"14:00",sl:79,risk:true},{t:"14:30",sl:77,risk:true},
      {t:"15:00",sl:76,risk:true},{t:"15:30",sl:80},{t:"16:00",sl:83},
    ];
    const sparkW = 280, sparkH = 54;
    // Interval F vs A (30-min intervals, today)
    const intervals = [
      {t:"8:00",f:42,a:38},{t:"8:30",f:48,a:45},{t:"9:00",f:56,a:54},{t:"9:30",f:62,a:60},
      {t:"10:00",f:71,a:74},{t:"10:30",f:78,a:80},{t:"11:00",f:82,a:79},{t:"11:30",f:85,a:null},
      {t:"12:00",f:88,a:null},{t:"12:30",f:84,a:null},{t:"13:00",f:80,a:null},{t:"13:30",f:76,a:null},
      {t:"14:00",f:74,a:null},{t:"14:30",f:70,a:null},{t:"15:00",f:66,a:null},{t:"15:30",f:60,a:null},
    ];
    const iMax = Math.max(...intervals.map(i => Math.max(i.f, i.a||0)));
    return (
      <div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:8 }}>
          <KpiCard label="Contacts waiting" value={totalWaiting}        sub="all queues combined"     color={totalWaiting > 10 ? C.guava : totalWaiting > 5 ? C.amber : "#0AC8A0"} warning={totalWaiting > 5}  prev={totalWaiting-3} />
          <KpiCard label="Longest wait"     value={fmtTIS(longestWait)} sub="max across queues"       color={longestWait > 180 ? C.guava : longestWait > 90 ? C.amber : "#0AC8A0"} warning={longestWait > 180} />
          <KpiCard label="Service level"    value={`${worstSL}%`}       sub="worst queue · 85% target" color={worstSL >= 85 ? "#0AC8A0" : worstSL >= 80 ? C.amber : C.guava} warning={worstSL < 85} />
          <KpiCard label="Abandon rate"     value={`${liveAbandRate}%`} sub="target <4%"              color={liveAbandRate >= 5 ? C.guava : liveAbandRate >= 4 ? C.amber : "#0AC8A0"} warning={liveAbandRate >= 4} prev={liveAbandRate-0.8} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
          <KpiCard label="Avg speed answer" value={`${liveASA}s`}       sub="target <30s"             color={liveASA >= 45 ? C.guava : liveASA >= 30 ? C.amber : "#0AC8A0"} warning={liveASA >= 30} prev={liveASA-6} />
          <KpiCard label="Avg handle time"  value={fmtTIS(avgAHT)}      sub="all queues avg"          color="#0AC8A0" warning={false} />
          <KpiCard label="Adherence"        value={`${adhAgents}/${RTM_AGENTS.length}`} sub={`${Math.round(adhAgents/RTM_AGENTS.length*100)}% · target 95%`} color={adhAgents/RTM_AGENTS.length >= .95 ? "#0AC8A0" : adhAgents/RTM_AGENTS.length >= .9 ? C.amber : C.guava} warning={adhAgents/RTM_AGENTS.length < .95} />
          <KpiCard label="Agents available" value={availAgents}          sub="ready for contact"       color={availAgents >= 3 ? "#0AC8A0" : availAgents >= 1 ? C.amber : C.guava} warning={availAgents < 2} prev={availAgents-2} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:12 }}>
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>SL projection · rest of day</div>
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:12, height:2, background:"#0AC8A0", borderRadius:1 }}/>Projected</div>
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:12, height:2, background:C.amber, borderRadius:1 }}/>Target</div>
              </div>
            </div>
            <svg width="100%" height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" style={{ display:"block" }}>
              <defs>
                <linearGradient id="slGradRTM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0AC8A0" stopOpacity=".16"/>
                  <stop offset="100%" stopColor="#0AC8A0" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <line x1={0} y1={sparkH-(85/100)*sparkH} x2={sparkW} y2={sparkH-(85/100)*sparkH} stroke="rgba(239,159,39,.3)" strokeWidth={1} strokeDasharray="3,3"/>
              <path d={`M ${pts.map((p,i) => `${(i/(pts.length-1))*sparkW},${sparkH-(p.sl/100)*sparkH}`).join(" L ")} L ${sparkW},${sparkH} L 0,${sparkH} Z`} fill="url(#slGradRTM)"/>
              <polyline points={pts.map((p,i) => `${(i/(pts.length-1))*sparkW},${sparkH-(p.sl/100)*sparkH}`).join(" ")} fill="none" stroke="#0AC8A0" strokeWidth={2} strokeLinecap="round"/>
              {pts.map((p,i) => p.risk && <circle key={i} cx={(i/(pts.length-1))*sparkW} cy={sparkH-(p.sl/100)*sparkH} r={3.5} fill={C.guava}/>)}
              {pts.map((p,i) => p.now  && <circle key={i} cx={(i/(pts.length-1))*sparkW} cy={sparkH-(p.sl/100)*sparkH} r={4}   fill="#0AC8A0" stroke="#fff" strokeWidth={1.5}/>)}
            </svg>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
              {["10:30","11:30","12:30","13:30","14:30","16:00"].map(t => <span key={t} style={{ fontSize:10, color:C.tx2 }}>{t}</span>)}
            </div>
          </div>
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:2 }}>Supervisor Actions</div>

            {/* Expanded alert panel */}
            {rawAlerts.length > 0 && (
              <div style={{ background:"rgba(244,93,72,.07)", border:".5px solid rgba(244,93,72,.18)", borderRadius:10, padding:"9px 11px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.guava, marginBottom:6 }}>⚠ {rawAlerts.length} active alert{rawAlerts.length>1?"s":""}</div>
                {rawAlerts.map(a => (
                  <div key={a.id} style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6, marginBottom:6 }}>
                    <div style={{ fontSize:10, color:C.tx1, flex:1 }}>{a.msg}</div>
                    <button onClick={() => { setDismissed(d=>new Set([...d,a.id])); window.prismToast?.("Alert acknowledged","info"); }}
                      style={{ fontSize:9, padding:"2px 7px", borderRadius:5, background:"rgba(244,93,72,.12)", border:".5px solid rgba(244,93,72,.2)", color:C.guava, cursor:"pointer", whiteSpace:"nowrap" }}>Ack</button>
                  </div>
                ))}
              </div>
            )}

            {/* Adherence alert */}
            <button onClick={() => setAlertSent(v=>!v)} style={{ padding:"8px 12px", borderRadius:9, background:alertSent?"rgba(10,200,150,.1)":"rgba(244,93,72,.1)", border:`.5px solid ${alertSent?"rgba(10,200,150,.28)":"rgba(244,93,72,.22)"}`, color:alertSent?"#0AC8A0":C.guava, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:7 }}>
              {alertSent ? "✓ Adherence alert sent" : "📣 Send adherence alert"}
            </button>

            {/* Pull from break */}
            <button onClick={() => window.prismToast?.("2 agents pulled from break — coverage improving","info")}
              style={{ padding:"8px 12px", borderRadius:9, background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, color:C.tx2, fontSize:12, fontWeight:500, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:7 }}>
              ☕ Pull agents from break
            </button>

            {/* OT / VTO push workflow */}
            <button onClick={() => setOtOpen(v=>!v)} style={{ padding:"8px 12px", borderRadius:9, background:otOpen?`${C.amber}14`:`${C.amber}08`, border:`.5px solid ${C.amber}${otOpen?"40":"22"}`, color:C.amber, fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:7 }}>
              ⚡ {otOpen ? "▼ OT / VTO offer open" : "Open OT / VTO offer"}
            </button>
            {otOpen && (
              <OTVTOModal onClose={() => setOtOpen(false)} />
            )}
          </div>
        </div>

        {/* Interval F vs A chart */}
        <div style={{ marginTop:12, background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>Interval Forecast vs Actual · Today</div>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:10, height:10, borderRadius:2, background:`${C.kale}50` }}/>Forecast</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:10, height:10, borderRadius:2, background:C.kale }}/>Actual</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.tx2 }}><div style={{ width:10, height:10, borderRadius:2, background:"rgba(255,255,255,.06)" }}/>Projected</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:70 }}>
            {intervals.map((iv, i) => (
              <div key={i} style={{ flex:1, display:"flex", gap:1, alignItems:"flex-end", height:"100%", position:"relative" }}>
                <div style={{ flex:1, height:`${(iv.f/iMax)*100}%`, background:`${C.kale}38`, borderRadius:"3px 3px 0 0" }} title={`Forecast: ${iv.f}`} />
                <div style={{ flex:1, height:`${((iv.a||0)/iMax)*100}%`, background:iv.a!=null?C.kale:"rgba(255,255,255,.06)", borderRadius:"3px 3px 0 0", opacity:iv.a!=null?1:.5 }} title={iv.a!=null?`Actual: ${iv.a}`:`Projected: ${iv.f}`} />
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            {intervals.filter((_,i) => i%4===0).map(iv => <span key={iv.t} style={{ fontSize:10, color:C.tx2 }}>{iv.t}</span>)}
          </div>
          <div style={{ marginTop:8, display:"flex", gap:14 }}>
            <div style={{ fontSize:11, color:C.tx2 }}>Forecast accuracy (completed intervals): <span style={{ color:"#0AC8A0", fontWeight:600 }}>96.2%</span></div>
            <div style={{ fontSize:11, color:C.tx2 }}>Variance: <span style={{ color:C.amber, fontWeight:600 }}>+4 contacts</span> over forecast</div>
          </div>
        </div>
      </div>
    );
  }

  function renderQueues() {
    const cols = ["Queue","Waiting","Longest Wait","SL%","AHT","Handling","Skilled Avail","Status"];
    return (
      <div>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, overflow:"hidden", marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"130px repeat(6,1fr) 90px", padding:"10px 16px", borderBottom:`.5px solid ${C.bd}`, background:"rgba(255,255,255,.02)" }}>
            {cols.map(h => <div key={h} style={{ fontSize:10, fontWeight:600, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em" }}>{h}</div>)}
          </div>
          {liveQueues.map((q, qi) => {
            const slBad  = q.sl < q.target;
            const slWarn = q.sl >= q.target - 5 && q.sl < q.target;
            const lwBad  = q.lw > 180;
            const wBad   = q.waiting > 5;
            const rowBad = slBad || lwBad || wBad;
            const skilled = RTM_AGENTS.filter(a => activeStates.includes(a.state) && (QUEUE_REQ_SKILLS[q.id]||[]).some(s => getSkills(a).has(s))).length;
            return (
              <div key={q.id} style={{
                display:"grid", gridTemplateColumns:"130px repeat(6,1fr) 90px",
                padding:"11px 16px",
                borderBottom: qi < liveQueues.length-1 ? `.5px solid ${C.bd}` : "none",
                background: rowBad ? "rgba(244,93,72,.04)" : slWarn ? "rgba(239,159,39,.03)" : "none",
                borderLeft: `2px solid ${rowBad ? C.guava : slWarn ? C.amber : "transparent"}`,
                transition:"background .4s",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:rowBad ? C.guava : slWarn ? C.amber : "#0AC8A0", boxShadow:rowBad?`0 0 6px ${C.guava}`:slWarn?`0 0 6px ${C.amber}`:"0 0 6px #0AC8A0" }}/>
                  <span style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>{q.label}</span>
                </div>
                <div key={`w${q.id}${tick}`} style={{ fontSize:13, fontWeight:700, color:q.waiting>6?C.guava:q.waiting>3?C.amber:C.tx0, animation:"val-pop .35s ease" }}>{q.waiting}</div>
                <div key={`lw${q.id}${tick}`} style={{ fontSize:13, fontWeight:600, color:q.lw>180?C.guava:q.lw>90?C.amber:C.tx0, animation:"val-pop .35s ease" }}>{q.lw>0?fmtTIS(q.lw):"—"}</div>
                <div key={`sl${q.id}${tick}`} style={{ fontSize:13, fontWeight:700, color:q.sl<q.target?C.guava:q.sl<q.target+5?C.amber:"#0AC8A0", animation:"val-pop .35s ease" }}>{q.sl}%</div>
                <div key={`aht${q.id}${tick}`} style={{ fontSize:13, color:C.tx1, animation:"val-pop .35s ease" }}>{fmtTIS(q.aht)}</div>
                <div key={`h${q.id}${tick}`}  style={{ fontSize:13, color:C.tx1, animation:"val-pop .35s ease" }}>{q.handling}</div>
                <div style={{ fontSize:12, color:skilled < 2 ? C.guava : C.tx1, fontWeight:skilled < 2 ? 600 : 400 }}>{skilled} avail</div>
                <div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, letterSpacing:".05em",
                    background:rowBad?"rgba(244,93,72,.15)":slWarn?"rgba(239,159,39,.15)":"rgba(10,200,150,.12)",
                    color:rowBad?C.guava:slWarn?C.amber:"#0AC8A0",
                    border:`.5px solid ${rowBad?C.guava+"44":slWarn?C.amber+"44":"#0AC8A066"}`,
                  }}>{rowBad?"AT RISK":slWarn?"MONITOR":"ON TRACK"}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {liveQueues.map(q => {
            const slOk = q.sl >= q.target;
            const c = slOk ? "#0AC8A0" : q.sl >= q.target-5 ? C.amber : C.guava;
            return (
              <div key={q.id} style={{ background:C.card, border:`.5px solid ${slOk?C.bd:c+"33"}`, borderRadius:12, padding:"13px 15px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>{q.label}</div>
                  <div key={`${q.sl}${tick}`} style={{ fontSize:20, fontWeight:800, color:c, animation:"val-pop .35s ease" }}>{q.sl}%</div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
                  {[["Waiting",String(q.waiting),q.waiting>4?C.guava:C.tx1],["Longest wait",q.lw>0?fmtTIS(q.lw):"—",q.lw>180?C.guava:q.lw>90?C.amber:C.tx1],["AHT",fmtTIS(q.aht),C.tx1],["Handling",String(q.handling),C.tx1]].map(([l,v,vc]) => (
                    <div key={l}>
                      <div style={{ fontSize:10, color:C.tx2, marginBottom:2 }}>{l}</div>
                      <div key={`${v}${tick}`} style={{ fontSize:13, fontWeight:600, color:vc, animation:"val-pop .35s ease" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height:3, background:"rgba(255,255,255,.06)", borderRadius:2 }}>
                  <div style={{ height:"100%", width:`${Math.min(100,q.sl)}%`, background:`linear-gradient(90deg,${c},${c}AA)`, borderRadius:2, transition:"width .4s ease" }}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                  <span style={{ fontSize:9, color:C.tx2 }}>0%</span>
                  <span style={{ fontSize:9, color:C.tx2 }}>target {q.target}%</span>
                  <span style={{ fontSize:9, color:C.tx2 }}>100%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderAgents() {
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {pillars.map(p => (
              <button key={p} onClick={() => setPillar(p)} style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:500, cursor:"pointer", background:pillarFilter===p?"rgba(10,128,128,.18)":"rgba(255,255,255,.04)", color:pillarFilter===p?C.kale:C.tx2, border:`.5px solid ${pillarFilter===p?C.kale+"44":C.bd}`, transition:"all .15s" }}>{p}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
            {[["default","Default"],["tis","OOA first"],["state","By state"]].map(([v,l]) => (
              <button key={v} onClick={() => setSort(v)} style={{ padding:"3px 10px", borderRadius:12, fontSize:11, cursor:"pointer", background:sortAgents===v?"rgba(255,255,255,.1)":"none", color:sortAgents===v?C.tx0:C.tx2, border:sortAgents===v?`.5px solid ${C.bd}`:"none", transition:"all .15s" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:14, marginBottom:12, flexWrap:"wrap" }}>
          {[["#0AC8A0","Handling / Available"],["#EF9F27","Break / Lunch"],["#7F77DD","Project"],["#F45D48","OOA / Tech"]].map(([color,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:color }}/>
              <span style={{ fontSize:11, color:C.tx2 }}>{l}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(218px,1fr))", gap:7, marginBottom:14 }}>
          {filteredAgents.map(a => {
            const sc = STATE_COLOR[a.state] || C.tx2;
            const sb = STATE_BG[a.state] || "rgba(255,255,255,.03)";
            const ooa     = !a.adh && a.tis > 600;
            const ooaWarn = !a.adh && a.tis >= 300 && a.tis <= 600;
            const skills  = getSkills(a);
            const skillArr = [...skills];
            return (
              <div key={a.id} style={{ padding:"10px 12px", borderRadius:12, background:ooa?"rgba(244,93,72,.07)":ooaWarn?"rgba(239,159,39,.06)":sb, border:`.5px solid ${ooa?C.guava+"44":ooaWarn?C.amber+"33":"rgba(255,255,255,.06)"}`, animation:ooa?"live-pulse 2s ease-in-out infinite":"none" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C.tx0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"68%" }}>{a.n}</div>
                  {ooa     && <span style={{ fontSize:9, fontWeight:700, color:C.guava,  background:"rgba(244,93,72,.15)",  padding:"2px 6px", borderRadius:5, flexShrink:0 }}>OOA</span>}
                  {ooaWarn && <span style={{ fontSize:9, fontWeight:700, color:C.amber,  background:"rgba(239,159,39,.12)", padding:"2px 6px", borderRadius:5, flexShrink:0 }}>WATCH</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:7 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:sc, background:`${sc}18`, padding:"2px 8px", borderRadius:8 }}>{a.state}</span>
                  <span style={{ fontSize:10, color:ooa?C.guava:ooaWarn?C.amber:C.tx2, fontVariantNumeric:"tabular-nums" }}>{fmtTIS(a.tis)}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:3, flexWrap:"wrap" }}>
                  <span style={{ fontSize:9, color:C.tx2, marginRight:2 }}>{a.p}</span>
                  {skillArr.slice(0,3).map(s => <span key={s} style={{ fontSize:9, padding:"1px 5px", borderRadius:6, background:"rgba(10,128,128,.12)", color:C.kale, border:`.5px solid rgba(10,128,128,.2)` }}>{s}</span>)}
                  {skillArr.length > 3 && <span style={{ fontSize:9, color:C.tx2 }}>+{skillArr.length-3}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { l:"In adherence",       v:`${adhAgents}/${RTM_AGENTS.length}`, c:adhAgents/RTM_AGENTS.length>=.95?"#0AC8A0":C.amber },
            { l:"Handling contacts",  v:RTM_AGENTS.filter(a=>activeStates.includes(a.state)).length, c:C.tx0 },
            { l:"On break / lunch",   v:RTM_AGENTS.filter(a=>["Break","Lunch"].includes(a.state)).length, c:C.amber },
            { l:"Unavailable / tech", v:RTM_AGENTS.filter(a=>["Unavailable","Tech Issues"].includes(a.state)).length, c:RTM_AGENTS.filter(a=>["Unavailable","Tech Issues"].includes(a.state)).length>1?C.guava:C.tx1 },
          ].map(s => (
            <div key={s.l} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:10, padding:"9px 12px" }}>
              <div style={{ fontSize:10, color:C.tx2, marginBottom:2 }}>{s.l}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderSkillsTab() {
    const skillAgents = pillarFilter === "All" ? RTM_AGENTS : RTM_AGENTS.filter(a => a.p === pillarFilter);
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:2 }}>Live skill coverage</div>
            <div style={{ fontSize:12, color:C.tx2 }}>Click any cell to toggle a skill · changes reflect in coverage counts immediately</div>
          </div>
          {hasEdits && <button onClick={() => { setSkillEdits({}); window.prismToast?.("Skill changes cleared","info"); }} style={{ padding:"6px 14px", borderRadius:9, background:"rgba(255,255,255,.06)", border:`.5px solid ${C.bd}`, color:C.tx2, fontSize:12, cursor:"pointer" }}>Reset</button>}
        </div>
        <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"wrap" }}>
          {pillars.map(p => <button key={p} onClick={() => setPillar(p)} style={{ padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:500, cursor:"pointer", background:pillarFilter===p?"rgba(10,128,128,.18)":"rgba(255,255,255,.04)", color:pillarFilter===p?C.kale:C.tx2, border:`.5px solid ${pillarFilter===p?C.kale+"44":C.bd}`, transition:"all .15s" }}>{p}</button>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14 }}>
          {skillCoverage.map(sc => (
            <div key={sc.skill} style={{ background:C.card, border:`.5px solid ${sc.gap?C.guava+"44":C.bd}`, borderRadius:10, padding:"9px 11px", animation:sc.gap?"live-pulse 2.2s ease-in-out infinite":"none" }}>
              <div style={{ fontSize:11, fontWeight:600, color:C.tx1, marginBottom:4 }}>{sc.skill}</div>
              <div style={{ fontSize:18, fontWeight:700, color:sc.gap?C.guava:sc.active>=3?"#0AC8A0":C.amber }}>{sc.active}</div>
              <div style={{ fontSize:10, color:C.tx2 }}>{sc.total} total · {sc.demand>0?`${sc.demand} in queue`:"no demand"}</div>
              {sc.gap && <div style={{ fontSize:9, fontWeight:700, color:C.guava, marginTop:3 }}>⚠ SKILL GAP</div>}
            </div>
          ))}
        </div>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, overflowX:"auto" }}>
          <div style={{ minWidth:700 }}>
            <div style={{ display:"grid", gridTemplateColumns:"150px repeat(8,1fr)", padding:"10px 14px 8px", borderBottom:`.5px solid ${C.bd}`, background:"rgba(255,255,255,.02)" }}>
              <div style={{ fontSize:10, color:C.tx2 }}>Agent · State</div>
              {RTM_SKILLS_LIST.map(s => {
                const sc = skillCoverage.find(c => c.skill === s);
                return (
                  <div key={s} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, fontWeight:600, color:sc?.gap?C.guava:C.tx2, textTransform:"uppercase", letterSpacing:".04em", lineHeight:1.3 }}>{s}</div>
                    {sc?.gap && <div style={{ fontSize:8, color:C.guava }}>GAP</div>}
                  </div>
                );
              })}
            </div>
            {skillAgents.map((a, ai) => {
              const agentSkills = getSkills(a);
              const sc = STATE_COLOR[a.state] || C.tx2;
              const isActive = activeStates.includes(a.state);
              return (
                <div key={a.id} style={{ display:"grid", gridTemplateColumns:"150px repeat(8,1fr)", padding:"7px 14px", borderBottom:ai<skillAgents.length-1?`.5px solid rgba(255,255,255,.04)`:"none", background:isActive?"rgba(10,128,128,.025)":"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:sc, flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:11, fontWeight:500, color:C.tx0 }}>{a.n}</div>
                      <div style={{ fontSize:9, color:C.tx2 }}>{a.p} · {a.state}</div>
                    </div>
                  </div>
                  {RTM_SKILLS_LIST.map(s => {
                    const has = agentSkills.has(s);
                    const covSc = skillCoverage.find(c => c.skill === s);
                    const isFlash = skillFlash?.agentId === a.id && skillFlash?.skill === s;
                    return (
                      <div key={s} style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <button onClick={() => toggleSkill(a.id, s)} title={`${has?"Remove":"Add"} ${s} ${has?"from":"to"} ${a.n}`}
                          style={{ width:22, height:22, borderRadius:"50%", border:"none", cursor:"pointer", transition:"all .15s",
                            background:isFlash?"rgba(10,200,150,.45)":has?(covSc?.gap?"rgba(10,200,150,.4)":"rgba(10,128,128,.22)"):"rgba(255,255,255,.05)",
                            boxShadow:has?`0 0 ${covSc?.gap?"10px rgba(10,200,150,.5)":"6px rgba(10,128,128,.2)"}`:"none",
                            outline:has?`.5px solid rgba(10,128,128,.4)`:`.5px solid rgba(255,255,255,.08)`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                          }}>
                          <div style={{ width:has?9:7, height:has?9:7, borderRadius:"50%", background:has?(covSc?.gap?"#0AC8A0":C.kale):"rgba(255,255,255,.12)", transition:"all .15s" }}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ display:"grid", gridTemplateColumns:"150px repeat(8,1fr)", padding:"9px 14px", borderTop:`.5px solid ${C.bd}`, background:"rgba(255,255,255,.02)" }}>
              <div style={{ fontSize:10, color:C.tx2, fontWeight:600 }}>Active coverage</div>
              {RTM_SKILLS_LIST.map(s => {
                const sc = skillCoverage.find(c => c.skill === s);
                return (
                  <div key={s} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:sc?.gap?C.guava:sc?.active>=3?"#0AC8A0":C.amber }}>{sc?.active ?? 0}</div>
                    <div style={{ fontSize:8, color:C.tx2 }}>active</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {hasEdits && (
          <div style={{ marginTop:10, display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(10,128,128,.08)", border:`.5px solid rgba(10,128,128,.2)`, borderRadius:10, padding:"10px 14px" }}>
            <div style={{ fontSize:12, color:C.kale }}>Unsaved changes · {Object.keys(skillEdits).length} agent{Object.keys(skillEdits).length>1?"s":""} modified</div>
            <button onClick={() => { window.prismToast?.("Skill changes saved — roster updated","success"); setSkillEdits({}); }} style={{ padding:"6px 16px", borderRadius:9, background:`linear-gradient(135deg,${C.kale},#0AB0B0)`, border:"none", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>Save changes →</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:17, fontWeight:700, color:C.tx0 }}>Real Time Management</div>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#0AC8A0", animation:"lp 1.8s ease-in-out infinite" }}/>
            <span style={{ fontSize:11, fontWeight:600, color:"rgba(10,200,150,.65)", background:"rgba(10,128,128,.1)", border:".5px solid rgba(10,128,128,.2)", padding:"3px 9px", borderRadius:8 }}>LIVE</span>
            {rawAlerts.length > 0 && <span style={{ fontSize:11, fontWeight:700, color:C.guava, background:"rgba(244,93,72,.12)", border:`.5px solid rgba(244,93,72,.2)`, padding:"3px 9px", borderRadius:8 }}>⚠ {rawAlerts.length} alert{rawAlerts.length>1?"s":""}</span>}
          </div>
          <div style={{ fontVariantNumeric:"tabular-nums", fontSize:13, fontWeight:600, color:C.tx1, letterSpacing:".06em" }}>{clock}</div>
        </div>
        <div style={{ fontSize:12, color:C.tx2 }}>{TODAY_LABEL} · {fmtH(Math.floor(NOW_H * 2)/2)} interval · {RTM_AGENTS.length} agents monitored across 6 queues</div>
      </div>

      {rawAlerts.map(alert => (
        <div key={alert.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", borderRadius:10, marginBottom:8, background:alert.type==="critical"?"rgba(244,93,72,.1)":"rgba(239,159,39,.09)", border:`.5px solid ${alert.type==="critical"?"rgba(244,93,72,.3)":"rgba(239,159,39,.28)"}`, animation:"fade-up .22s ease" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13 }}>{alert.type==="critical"?"🔴":"🟡"}</span>
            <span style={{ fontSize:12, fontWeight:500, color:alert.type==="critical"?C.guava:C.amber }}>{alert.msg}</span>
          </div>
          <button onClick={() => setDismissed(d => new Set([...d, alert.id]))} style={{ background:"none", border:"none", color:C.tx2, cursor:"pointer", fontSize:15, padding:"0 4px", lineHeight:1 }}>×</button>
        </div>
      ))}

      <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,.04)", borderRadius:12, padding:3, marginBottom:14, width:"fit-content" }}>
        {[["live","● Live"],["queues","Queues"],["agents","Agents"],["skills","Skills"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"6px 16px", borderRadius:9, fontSize:12, fontWeight:tab===t?600:400, cursor:"pointer", background:tab===t?"rgba(255,255,255,.1)":"none", color:tab===t?C.tx0:C.tx2, border:tab===t?`.5px solid ${C.bd}`:"none", transition:"all .15s", display:"flex", alignItems:"center", gap:5 }}>
            {l}
            {t==="live" && rawAlerts.length>0 && <span style={{ width:5, height:5, borderRadius:"50%", background:C.guava, display:"inline-block" }}/>}
            {t==="skills" && skillCoverage.some(s=>s.gap) && <span style={{ width:5, height:5, borderRadius:"50%", background:C.amber, display:"inline-block" }}/>}
          </button>
        ))}
      </div>

      <div key={tab} style={{ animation:"view-in .18s ease" }}>
        {tab==="live"   && renderLive()}
        {tab==="queues" && renderQueues()}
        {tab==="agents" && renderAgents()}
        {tab==="skills" && renderSkillsTab()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COVERAGE HEATMAP
// ══════════════════════════════════════════════════════════════
const HMAP_HOURS = ["7am","7:30","8am","8:30","9am","9:30","10am","10:30","11am","11:30","12pm","12:30","1pm","1:30","2pm","2:30","3pm","3:30","4pm","4:30","5pm","5:30","6pm"];
const HMAP_PILLARS = ["Payroll","BenOps","Premier","SMB","Care","Onboarding"];
const HMAP_REQ = { // required FTE per pillar per interval (simplified)
  Payroll:    [4,5,7,9,11,12,12,11,10,9,8,8,8,8,8,9,10,10,9,7,5,4,3],
  BenOps:     [2,3,4,6,8,10,10,9,8,7,6,6,6,6,7,8,9,9,8,6,4,3,2],
  Premier:    [3,4,5,6,7,8,8,7,6,5,4,4,4,5,5,6,7,7,6,5,4,3,2],
  SMB:        [1,2,3,4,5,6,6,5,5,4,4,4,4,4,5,5,6,6,5,4,3,2,1],
  Care:       [2,3,4,5,6,7,7,6,5,5,5,5,5,5,6,6,7,7,6,5,4,3,2],
  Onboarding: [1,1,2,2,3,4,4,4,3,3,2,2,2,2,3,3,4,4,3,2,2,1,1],
};
// Generate staffed FTE (slightly off from required, with intentional gaps)
function hmapStaffed(pillar, idx) {
  const req = HMAP_REQ[pillar][idx];
  const offset = pillar === "BenOps" && idx >= 2 && idx <= 6 ? -2 :
                 pillar === "SMB" && idx >= 9 && idx <= 13 ? -1 :
                 pillar === "Care" && idx >= 14 && idx <= 16 ? -1 : 0;
  return Math.max(0, req + offset + (Math.sin(idx * 0.7 + pillar.length) > 0.4 ? 1 : 0));
}
function hmapColor(staffed, req) {
  if (req === 0) return "rgba(255,255,255,.03)";
  const ratio = staffed / req;
  if (ratio >= 1.1) return "rgba(10,200,160,.22)";   // overstaffed — blue-green
  if (ratio >= 0.95) return "rgba(10,200,150,.15)";  // on target — green
  if (ratio >= 0.80) return "rgba(239,159,39,.2)";   // -20% — amber
  if (ratio >= 0.65) return "rgba(244,93,72,.28)";   // -35% — red
  return "rgba(244,93,72,.48)";                       // critical
}
function hmapBorder(staffed, req) {
  if (req === 0) return "transparent";
  const r = staffed/req;
  if (r >= 1.1) return "rgba(10,200,160,.35)";
  if (r >= 0.95) return "rgba(10,200,150,.25)";
  if (r >= 0.80) return "rgba(239,159,39,.35)";
  return "rgba(244,93,72,.4)";
}

function CoverageHeatmapView() {
  const [hov, setHov] = useState(null); // {p, i}
  const [selPillar, setSelPillar] = useState(null);
  const nowIdx = 7; // 10:30am

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
        <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:4 }}>Coverage Heatmap</div>
        <div style={{ fontSize:13, color:C.tx2 }}>Staffed FTE vs. required · Today · Click any cell for detail</div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14, flexWrap:"wrap" }}>
        {[["rgba(10,200,160,.22)","rgba(10,200,160,.35)","Overstaffed"],["rgba(10,200,150,.15)","rgba(10,200,150,.25)","On target"],["rgba(239,159,39,.2)","rgba(239,159,39,.35)","−20% or less"],["rgba(244,93,72,.28)","rgba(244,93,72,.4)","−35% or less"],["rgba(244,93,72,.48)","rgba(244,93,72,.5)","Critical gap"]].map(([bg,bd,l])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:14, height:14, borderRadius:4, background:bg, border:`.5px solid ${bd}` }}/>
            <span style={{ fontSize:11, color:C.tx2 }}>{l}</span>
          </div>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:2, height:14, background:"rgba(255,255,255,.4)", borderRadius:1 }}/>
          <span style={{ fontSize:11, color:C.tx2 }}>Now</span>
        </div>
      </div>

      {/* Pillar filter */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        <button onClick={() => setSelPillar(null)} style={{ padding:"4px 12px", borderRadius:8, fontSize:11, fontWeight:500, cursor:"pointer", background: selPillar===null ? `${C.kale}20` : "rgba(255,255,255,.04)", color: selPillar===null ? C.kale : C.tx2, border:`.5px solid ${selPillar===null ? C.kale+"40" : C.bd}` }}>All pillars</button>
        {HMAP_PILLARS.map(p => (
          <button key={p} onClick={() => setSelPillar(p===selPillar?null:p)} style={{ padding:"4px 12px", borderRadius:8, fontSize:11, fontWeight:500, cursor:"pointer", background: selPillar===p ? `${PILLARS[p]||C.kale}20` : "rgba(255,255,255,.04)", color: selPillar===p ? (PILLARS[p]||C.kale) : C.tx2, border:`.5px solid ${selPillar===p ? (PILLARS[p]||C.kale)+"40" : C.bd}` }}>{p}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, overflowX:"auto" }}>
        {/* Hour headers */}
        <div style={{ display:"flex", marginBottom:8, paddingLeft:90 }}>
          {HMAP_HOURS.map((h,i)=>(
            <div key={h} style={{ width:32, flexShrink:0, fontSize:9, color:i===nowIdx?"rgba(255,255,255,.7)":C.tx2, textAlign:"center", fontWeight:i===nowIdx?700:400, position:"relative" }}>
              {h}
              {i===nowIdx && <div style={{ position:"absolute", top:12, left:"50%", transform:"translateX(-50%)", width:2, height:280, background:"rgba(255,255,255,.25)", pointerEvents:"none" }}/>}
            </div>
          ))}
        </div>
        {/* Rows */}
        {(selPillar ? [selPillar] : HMAP_PILLARS).map(pillar => (
          <div key={pillar} style={{ display:"flex", alignItems:"center", marginBottom:5 }}>
            <div style={{ width:86, flexShrink:0, fontSize:12, color:C.tx1, fontWeight:500, paddingRight:8, display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:PILLARS[pillar]||C.kale, flexShrink:0 }}/>
              {pillar}
            </div>
            {HMAP_HOURS.map((_,i)=>{
              const req = HMAP_REQ[pillar][i];
              const staffed = hmapStaffed(pillar, i);
              const isHov = hov?.p===pillar && hov?.i===i;
              return (
                <div key={i} title={`${pillar} ${HMAP_HOURS[i]}: ${staffed}/${req} FTE`}
                  onMouseEnter={() => setHov({p:pillar,i})}
                  onMouseLeave={() => setHov(null)}
                  style={{ width:32, height:28, flexShrink:0, borderRadius:5, margin:"0 1px", background:hmapColor(staffed,req), border:`.5px solid ${isHov?"rgba(255,255,255,.4)":hmapBorder(staffed,req)}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", transition:"border-color .1s", boxShadow:isHov?"0 0 0 1.5px rgba(255,255,255,.3)":"none" }}>
                  {isHov && <div style={{ position:"absolute", bottom:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)", background:C.elev, border:`.5px solid ${C.bd}`, borderRadius:8, padding:"6px 10px", fontSize:11, color:C.tx0, whiteSpace:"nowrap", zIndex:10, boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
                    <strong>{pillar} · {HMAP_HOURS[i]}</strong><br/>
                    Staffed: <strong style={{ color:staffed>=req?"#0AC8A0":staffed/req>=.8?C.amber:C.guava }}>{staffed}</strong> / {req} required
                  </div>}
                  <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.55)" }}>{req > 0 ? staffed : ""}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginTop:14 }}>
        {[
          { l:"On-target intervals",   v:`${HMAP_HOURS.reduce((s,_,i)=>s+(HMAP_PILLARS.every(p=>hmapStaffed(p,i)/HMAP_REQ[p][i]>=.95)?1:0),0)}/${HMAP_HOURS.length}`, c:"#0AC8A0" },
          { l:"Under-staffed intervals",v:`${HMAP_HOURS.reduce((s,_,i)=>s+(HMAP_PILLARS.some(p=>hmapStaffed(p,i)/HMAP_REQ[p][i]<.8)?1:0),0)}`, c:C.guava },
          { l:"Biggest gap pillar",     v:"BenOps",       c:C.guava },
          { l:"Peak demand hour",       v:"9:00 AM",      c:C.amber },
        ].map(k => (
          <div key={k.l} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:12, padding:"11px 14px" }}>
            <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k.l}</div>
            <div style={{ fontSize:20, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PUBLISH WORKFLOW BANNER
// ══════════════════════════════════════════════════════════════
const PUBLISH_CHANGES = [
  { n:"Anthony Piper",    change:"Phone 8:30→9:00, Break removed" },
  { n:"Aaliyah Ali",      change:"Start time 8:00→8:30" },
  { n:"Achebe Franklin",  change:"Added Lunch 12:00–12:30" },
  { n:"Briana Perez",     change:"Email block 2pm→3pm added" },
  { n:"LaKeisha Hemphill",change:"OT added: 5:00–6:00 PM" },
];

function PublishWorkflowBanner({ phase, onPhaseChange }) {
  const [step, setStep] = useState(phase || "draft"); // draft | review | published
  const [notified, setNotified] = useState(false);
  const steps = [["draft","Draft"],["review","Review"],["published","Published"]];
  const stepIdx = steps.findIndex(([v])=>v===step);

  return (
    <div style={{ background:C.elev, border:`.5px solid ${C.bd}`, borderRadius:14, padding:"14px 16px", marginBottom:12 }}>
      {/* Step tracker */}
      <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:14 }}>
        {steps.map(([v,l],i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={v} style={{ display:"flex", alignItems:"center", flex: i<steps.length-1 ? 1 : "none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background: done ? "#0AC8A0" : active ? C.kale : "rgba(255,255,255,.08)", border:`.5px solid ${done?"#0AC8A0":active?C.kale:C.bd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color: done||active ? "#fff" : C.tx2, transition:"all .3s" }}>
                  {done ? "✓" : i+1}
                </div>
                <span style={{ fontSize:12, fontWeight: active ? 600 : 400, color: active ? C.tx0 : done ? "#0AC8A0" : C.tx2 }}>{l}</span>
              </div>
              {i < steps.length-1 && <div style={{ flex:1, height:1, background: done ? "#0AC8A030" : "rgba(255,255,255,.07)", margin:"0 12px" }}/>}
            </div>
          );
        })}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexShrink:0 }}>
          {step === "draft" && (
            <button onClick={() => { setStep("review"); onPhaseChange?.("review"); }}
              style={{ padding:"7px 16px", borderRadius:9, background:`linear-gradient(135deg,${C.kale},${C.kale}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 16px ${C.kale}30` }}>
              Review changes →
            </button>
          )}
          {step === "review" && (
            <>
              <button onClick={() => { setStep("draft"); onPhaseChange?.("draft"); }} style={{ padding:"7px 14px", borderRadius:9, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:13, cursor:"pointer" }}>← Back to draft</button>
              <button onClick={() => { setStep("published"); setNotified(true); onPhaseChange?.("published"); }}
                style={{ padding:"7px 16px", borderRadius:9, background:`linear-gradient(135deg,#0AC8A0,#08B090)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(10,200,150,.35)" }}>
                📡 Publish & notify agents
              </button>
            </>
          )}
          {step === "published" && (
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 13px", borderRadius:9, background:"rgba(10,200,150,.1)", border:".5px solid rgba(10,200,150,.3)", fontSize:13, fontWeight:600, color:"#0AC8A0" }}>
              ✓ Published · Agents notified
            </div>
          )}
        </div>
      </div>

      {/* Draft info */}
      {step === "draft" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:C.tx2 }}>
          <span style={{ padding:"2px 9px", borderRadius:7, background:`${C.amber}12`, border:`.5px solid ${C.amber}30`, color:C.amber, fontWeight:600, fontSize:11 }}>DRAFT</span>
          <span>{PUBLISH_CHANGES.length} agents with schedule changes · Last published 5 days ago</span>
        </div>
      )}

      {/* Review diff */}
      {step === "review" && (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:C.tx0, marginBottom:8 }}>Changes since last publish</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {PUBLISH_CHANGES.map(c => (
              <div key={c.n} style={{ display:"flex", gap:10, padding:"8px 10px", borderRadius:9, background:"rgba(255,255,255,.03)", border:`.5px solid ${C.bd}` }}>
                <div style={{ width:28, height:28, borderRadius:8, background:`${C.kale}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.kale, flexShrink:0 }}>{initials(c.n)}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>{c.n}</div>
                  <div style={{ fontSize:11, color:C.kale }}>~ {c.change}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published */}
      {step === "published" && (
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:C.tx2 }}>
          <span style={{ padding:"2px 9px", borderRadius:7, background:"rgba(10,200,150,.12)", border:".5px solid rgba(10,200,150,.3)", color:"#0AC8A0", fontWeight:600, fontSize:11 }}>LIVE</span>
          <span>Published at 10:32 AM · {PUBLISH_CHANGES.length} agents notified via Slack + Prism app · Schedule locked for edits</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PRISM MARK — precise polygon geometry
// viewBox 0 0 400 340
//
// Outer triangle:  A(200,12)  BL(18,300)  BR(322,300)
// Inner hollow:    IA(200,118) IL(96,252)  IR(250,240)  ← IR higher → opening
//
// Intersection math (all exact):
// Left edge A→BL:  dx=-182, dy=288  (param t from A)
//   y=118: t=106/288=0.368 → x=200-182*0.368=133  OLH(133,118)
//   y=190: t=178/288=0.618 → x=200-182*0.618=88   OLM(88,190)
//   y=252: t=240/288=0.833 → x=200-182*0.833=49   OLL(49,252)
// Right edge A→BR: dx=122, dy=288
//   y=118: t=106/288=0.368 → x=200+122*0.368=245  ORH(245,118)
//   y=240: t=228/288=0.792 → x=200+122*0.792=297  ORL(297,240)
// Inner left edge IA→IL:  dx=-104, dy=134
//   y=190: t=72/134=0.537  → x=200-104*0.537=144  MIA(144,190)
// Bottom projections: ILp(96,300)  IRp(250,300)
// Spike: SPm(350,284)  SPt(376,262)
// ══════════════════════════════════════════════════════════════
function PrismMark({ size = 120, glow = true }) {
  const [pop, setPop] = useState(false);

  function handleClick() {
    setPop(true);
    setTimeout(() => setPop(false), 600);
  }

  const LOGO = "data:image/webp;base64,UklGRlgpAABXRUJQVlA4WAoAAAAQAAAA7wAA7wAAQUxQSOgbAAAB10ImYLHRP7VXgIjYBdK5fE1IbBtJkqTMiNznTrH+G1zVVX2PARH9n4D6WwPQ3QAvADSABclFuE1yAuhi+8C2N70kCywchu6fBB44SWx3f/4kPB957R4pLwTbUncn0UvjXV75tNXufgVa9sxYyno1sj0jcSYggGqdkViSpwCSFs1Mc5bAeGePz9jYNVMll2bm4tcvXBu7auzPRJKebFeNtEhSojzwS26gZdZZsqtI0LcnNUDnxBcJWTc5PNhvujvhqG5yVRedsB78lxmM2zZyZPVf9uSZC9+ImAB9cYAUle1AG2GXpBnCJkIlASbSJA+Q97AtODFWfRLlAml1yAJyURZUh8Tf9Kxt29xIkiQ97/8Cv6i6xxzLPJBc5fmfQZ5HTKYqAL//XQAEQRIiMUdExAR427ZtbVtr2zZJtmwZYjtJ0wbLmJGRjqbM3EEpLqOgH+gxxiwMZigzM4QaajhxanYs+YNk+5RH5/eImAD+O3tT4IcKP6G+eyebesK/Ar3xMfOvER8xC/jQk/1IfZvA3iy8oU3Vve+y6QAL9E1/qQ7gDlQBhgJT35lOca02xXfW4J3CL6AoKMo5vsN31Xvc46wWYGwkEAJlR4/4zq439c142J0651+H3rMPFU/WzBiv0+/UXn19/8aoKIqCIqLcGccUkJAQQggRgr4nplN1Xou4KxC77RHR2N1DCBEIOmRvFgz1xf0r2x2wAT/BUOd4U6/mTX1R3jHA5qnm5J2X39mtr+dNFUQUEbFVFEVRUF7hCzf9FD2UTf0G9LFJODo25vDtQHsox/qmNvWF/Kvbr2VAr+E7dczUOd6pL8K8tvV6DxrXE6C+hH9Ve2OqDumAsslmPiBEtCMhkgeEgiKie32z3Fl2dECHbGqzXti5R8JueFAg9sWZQiAQzxT3dQzQ5uL92Kk+dtQAyQMSQPG4N3Xn8Tqw601dkDd+Cb/BmTuuk+oc1/X8a9zgYwKRYwaloQhCgAQriiIaUXskAdKjaGcMkWTP3qsdMUEBNnWCDWRciAHMw0I8aHYFiN3QaDQaDcT0SBWgBqBNCSTu3tmVMMXWnLop/q3Wm/4C/RHrQN9Mp7jvVe25szxhOdA3VY+579Xb/dtga0kOeC+KosgtCm3jTUtrcRQRRVEUBUVRlAEGjWxMwiAJija+Uw+ZOs3U1bQ0U3XPO4P7k7jrnTSbZ64YQDsNwYIGDHZPM+eb7+7K99KA/VgtB/oj9p691yF79ilVaK9qs2w6uVH1SD+wvEA/UPVyr3/vQfuOsjwCrHvfSD+iKEd8QKgBaliAiDcRxn0jUEmjDTWGiISV30ppNDUGaSQCWtrEUICg7I1HvKmnmaoknyAQR31AxmZ3Yht2zAagIOCWf/khiygyu7WwDJkqTBHAQBYaVIh2Bqc83Xy5NgtAADIociGfmqIONLaiuS18F/0c4wMy3njHEMAdsxs0cGt5t3t0B///L4czxjSWzWCIeSLHCpAfMdQJhroU/KTDZt8HOjbAT4A5cqmGGqbo+rvl85NKyi1NPDgC8BA+68KjPHBQijgsth2CcFNiNXtUhTL/GONzZbQmr1E0BGQDIigiLUQIGIqih67TgH0sEI7aBxqz2O2bGZRmANHRMmP/8fMHItff9dkqk2CaMmDQBITUQAL9oIr9myL0ep2qV3j3DwqgfeQjI5obP/74Qwis64o91Zwbc8vCl134VQwNbQzeGJsOePZkM2hZKwj/bE3VaVUmExSFd0QG0Ezd8bG6lhfe2fc9wIaPpt4+pmRdeGpvlU71tTAUFHivAGTuP/D9jCfN6OfEK8411Jq5kfA1+wSJ6I69N02AsumbT2yirIp7rDXrJy+psVa4jUw3PoBR2OPzQIcFtU2yIrAPdKou4EyBeFjiXPUQmHrmD151TQM8JRwcG232BSSEiCs2FD7yXIMp8KZwaKLah8TLDtLS0qTKBBTgTd0xQAEYXVUV5Vei9m6TFxBrmVfWrSaqLJYZU4XaCbuX9cadfYXXDs25MVm/+IK9sfGOouiIMRCmKCiyDcTa81ibKTVefc6wB0pbR58yNLASRikK6EAWBR2xqfcy++auEMeABDUghE2g7bUx5jYQr++hyTU0UaMpAI0RCOHBAdAOYL706NamSbzjkDNK/cfEl2u/TscG1PeK7pkUb1rcmH4U3UXvvRvmDix3OrW8gzvL095bzVPehVktfC/TpJ1J+IDRnIHXmaG1Bu9cn/R5+phbsI12DHVHIhiKbHTHUJc0oLFrA+SAM2KaktuyvlVuvbc2dYjN3UMNGqbYi+4VX3bTeCuWD76hNm3HP8He6/79c2mdWvNeJcA//6oD7rOwWQ64s2zcWV6n6v2erPDc9DjFx8eH+TZaEk0CAbE3GgYiB0k4/uSpY5qiFUwoIxIIhpCNiV7N1FP8lBmgAwTAHUhaU9LkSbNtx6RI1qlMIsvUcJXVNAZj0wjJhgZEeRlz1WH+aG12KvXO7XFKzFn5FtqPdAydbDImq5poOP1amn7qFDBPVPjteWVGlMT6PHeWqzldG2JD86Rnjb+GSsAwCAqiUYg876J1ShSEQK3PPP2235gLvXVOAQGjEfaFzgp6v36eGjYEsOl7GiLtx3Dr5vlxzVR8NypghgTa4LaZILj3B2aqyIAhvdsb6wXm5wokG5z7ggv8FIM3BqZWjOYF2zw/hzdWiJFwTu3eCHYVhjpgKL1QvQLFk82+wUCZArs9D5XZAgEq0PcKcIEpDhUvXa/whuJioztfpftjath788amQ+jj1vvP5dZb0a6EaWp8FvxcV5gby6ZTdcDYjFzEa6exjbjUSIStwvUXPmJqzwY/ZAxQtAFuV+KCyNRoLjAUpsDUjikw6zFDvUv5yPQ7G3fqMbe9xS5srlVjdLOUzdLBBRRm3wDmUfMtfR2tlC9aZG3ZNJc7YEPsPZkx91pBLdaTZu1WUv6YsI+bRMtmzbHooQwBugQQg2cK1ChAPDtEidFynJSihAdDODMgvkbzsi/sdEqdc9vlxDEaB01tvm57M3fxOT4aUE9aQ8lRu6Iqwvuvmj70C29stlV0cjvQw/JFvPAIE8Bzu502/G3XvQwMZUDcl1l0fExiou0Yg2NjMEoyOZXGyFlzpAAN2ybsx+1sZ0bAEDRp3GhK0gJMLBPJAUNdA5gHJcy+ARo2bLYWIwqn9dXkYMktO60IUbvH7dCTe6Yg2EmCR8S2qdojxTd0sJACXNgeQ2jCHBxjSMyXaX51n2Cf4j4nnqBPp2UTzbD+kZ3IB8Cbmpn5NAly7+2HimXHP/95r01UXci1PlJHVRieszlS2nIbWiBe8GTpEvRF1pPU7ky0ZsBAO21aHlsPHfex+ilzg01/LfT7ejYQFFGyaEJTqkDQq0xBeyR5Sjn3VOVA687HGI3JYMrn3CVGcv5gwaa+HNmGKSCnDvNigZCpjYlMU1sKInrBI9lwXS8+y8Ng/wH8tXew7qHs0za96+BVdnQf0yWtO1+oq3yozY90qvpMOX3Htk4J0SOHeRcfnbERPwPmkDYSKpSUTZ5js2CzPKvqNV7ZG8yp7/mzsXcH0uVhrKdFHLCZ7YB3nvFFXCqlb75eRTnPoCDu6hRIjbfxZDo9bZEROs/CC+ClkllPuQlIoJC2ycZjkwM6EILyTgYYd/rG1rTXzWQ8NyCtlXXK2dpkWzbS35Cy7BazxoYt0G+6Q9wo7fYJxK2aKtMEjBV6EzA+DzQB2Rkw3urdpxgtDG/n5eBcZHwOGhC81uY28FwdZut0KevnQudb6APubsBk0AnURKuNlnzTYFVqxACfqKANzTCd9P2KWcrtVkDhnbILQ51jMk4qqAvA9zAYLM58x82/Y8fofeJvUScmOIrwTpvnDXArnE3WTpcwCSBqO5ELfF5xdvH+CtBobXNfZ9AQTSra69io572Um0MWJ0MiA1OQSFT9QKSEWWgoGTuXX91HOm1jA0ESP7BJ79AatJkTJ/j+d46R63aref8Am3DwCP3v4+arnfDI9PVJj4sxVf8XmpHsvdsAbPpym6ja67AwNaDWx9ypeo3nS+JodAK+qGLychDJE3bFF+OoNpnLK3IvDBWqb9Jews+PEb58451t98a4iccLRG/SCTHJpb0fos6ZbfQorurxz6F6kru8KMbHPwLFdMwUlF0bU5fhqnN8oOguiKd0TsxI15nYTrOXyLwgmw7gsP7KnNa4CqluDxtYU0wNVBUHFQy1YcEY6ire3kt/uNAytAh/cwR0l1MLzFdzXv/MZrjsKoS4UYw/83WWfazNQFX3xt670aZMR8rFsvzuT37OexQ1qNHRgeO7X/kkv/qgETzB93vZXOxPf+qqEgozdCIWOmVGDCx3Ordxr01U3at6mdcUURPSHVPcw7TLE+4aRsKLegTnvXJM9rbgg2ejKZcWL8ZffCAhxGEXgCkutU7xI6gpNE6MEfXMHmZ0wq8is7+pAtjcPxderdzfAk+qstvoLcY8dSfioAjXXL4z60j3gTZxcwefEjbI1jCUCEYCfqXhIBXZMOJuCzAHcbxm45ISpr/66dtqb/omrNXrgM3yhOWl3vxbjUN9TZ/Fq13wpVYZ7WPhrR6ebib7TB3fyv1iOI2v0bUx6I6xq4yxGa1XeWgebSc69ppsExIcWuyheTkVurxqFdAGnj43dJTAn6b+gbMR0Mg4VhjqUCBIb8CuGUfYmq0nY0NjVxy/r5o7WQQ1Rg01XZVyScMag3tkA9wtgTFN3PVEo/lQ8RhB5A3eOMcVchuw3f5u6xiVOpmzIQz93vxh2ktgzb0rd9UJVZ2yN9MH1T9OUhmC5XY0tYxUDOcss5ClK5eBx2oJTOW9jM2N6Syb5W1eMZyc4jvYQNGd31DBNwFC4OGuxhesKYWRvf2Z9ay3rrrXQJ7VTHMh3RzsaWo+yUcalhdDqqRxi20Kg1C/uxRumQQUNHo13caRSpCOtM2Aei2oe4Ifhhm7aqYm5QP/aJwd9XIEMkXOVNIRSxx64TeyazFLYjQAw8QwfZQOiRwRQKC4Tk994fwMGc3/EK9NHD6pHB3bICyBLKyJLy5pPwjxdVZ1b6r46XbaBTjGJ9BjCcLqyoERC0/gf7yBViYFyPwFY12qe/3E9GPLXlbsizjeOHs53ASiLLVY9cqpx5qAfPQk96CdxeVhoAG0wRU37bk2hjpw+gboA6L0kbVJUKl3YAaybB1kCdG1vET28kzAbmuiJkargQLaCIiASONtfG/BGFOFiLFPylMDY6DDTTw9lgDoFdENVTAN19kMj9xreIh5ENHz3CqijfZJ0+KNuK+WlN7k3PZBuXH2IbR/AaohylILV8BdCb+iQD2swjrHV7wBAiOCrt7CgBe8IaI4OQPpQhp0VcN607ITvqqAGLyDQdZeQMf6OTyCw4j2XuHboNcdQ+Eqv5uMKVx7GTyxAFcBc8UwkGdLHGAC2pyL0wD1IMF+2UKYeF6BKUcKXGXumwIXVyqIgJyUJ+qanIX9wSbg2O0ReiDDvHglwEtcvXT2cm/3CRsdnmAMMygGFC6394fsQWcMUeMkHkd5moe+9YBf67/I2ht4QYHTTumsgDSuW3z+73ndxtpPtBnhbZLHrTVq8Ua19J3uX3s2S0W9odmBNOCCVbR54VQYvLqxlVkowDeyMyjQOsI6dGCDbtEAD4ToEdSmlShcqO/4joHamW4nyYQLPAb36+qc5P/kAIDOOQiBHzDFSejMwGtWfc1hAL0ekC/APiS+YKkYmAgtKbxT9vJOpu/ZtI3ZFlipk/gcnqegOthUSK7WKXqcN1ijkrjCKoA1aQIEsNboBEg2JAi3UKijS1RrkW8Krg281xM/4JNzU4TgBSwcb3bzUl9ip3PeTaMFZFEK65ii7nc6+4nYcGiHW0a5DxsHZDazXBCCcJl1aDL6aCNjYBprnePjIK5pIF8fwfX6NCUupMuPCf/6DDFhoxNq6IDrfEZRPWXSXXcd9RImgbQoT6ypH16aqs4y9SonSiQtQDjZTX5yClalWjVtXA4Wa+fv9aRBhlFBeYJAy+/sG6XEbfug8D4JTMJBNEEogAiX6QNNBTiC4uw98AQYqK9KDL79jBJbSdL9McAQORFSQgeoYf6/6CUQdsG71r/gDlBriMLsFrgeMQX1ajaiqjewcmsNNeq0ehiZgo+NZW7uu6RSYPgIby1ckUQUFmF9Ti2l3zoJ6fEA0AstZAVJ2smwq44ZiuL9FQPh8+EB0HomiPTFGg7rXGZiv8VAoPQWaxcHf2BlSegrwLveDVdNme0IX3YuN0MZ0xQxEL8PJnLwkb4O6nXK3spfFs7JZXm4Zzk6SZIOSvfrQPO6r2AQUxY21llVElnnRgQIgUbdXs2HIEFTgkoS5oFHoIzodXAiUs4mootynRaMsmrfYL1N20UiZaDvArb2wl3gtCgoQqQRCYUIIcEYr3Z6E4fUPQUSH0P7IcpeSoALQcuvyKUpjFmW0TbCZ5StA01VB6ELJPKiCBdaCz8E2PQ7QvSFAtOwIL4qCDrlhzh7mFYLeEtzY135A+FBBH52GgLtQy76gQSiZ4GyVF8w4N7f6Xi0UYRluGtA1rUMDhwSwBfMcbHN8hEluzlmkfj8KlsEoC/A1RCKwFPkKDFB+wHEu0tBknqL7FY3TWSIiga5CbWsrqZGR+wTnQmLXhohHTh8F1iMyFU6BFZONUOKaAzRE8kMMG63CZAE2H69RgNoE4PJjIHhrAdkxnOQoBn0DjE6z7h+0rITZMlORrd0cSbKIiHo66lrCcpwMX8rSkqQRZqBqmrQ9niHRyOeuA4z8yMEaK3n5kpEx5cwCtCExywoNgQB9AEJtiJ2nk5qhgjsocBDX1wMihJAXGRVd+8Tu8tJSw1yWBdFBlkmai0/bR45BqBnZUxA8pqdlmu0P0T4yRMpeRzg4wIvCQpqswb7y6az7sy/3+QVNxHkjmWR1z+zEeFrgIsygMtEBtyZlQCHY60v0YWhr83GLB/J8CM5MSCy9+YjrSVR9iRRJ9WmGAKQlvKUiLgGojrrLCfBAFQ6gMCv+N/i4M5VvpyFVrwJQxVFAIQ0cq+gvVoRREbGTjPjpINGJDNgadkCO3FwN/DnKoClAFLiEMAKjtxglwOwQZm2tOHnHAVBbd00ZV64WyTOi72uFndfw1rdMuwPOAHPO9Asm1CQZGosf0G6EdmB+0pItnAypxkjkqBrLKobfMeAbudsy3uxrxtnnerIIR6v/N5Cu4nL0AHOcuBHqk0cfE2Dy8aVzikXEewWAreJNqDwW0ABqB3JOKWOnPqNja9urqlOc0St6W8gamktMKdirZ9nsB5nLxKw4aQBzwUhIQpwbdqb3A0QIIRTN2Y1E/uu5dMvJh1hZUdUP2ahkxzWAR6H+NOhEYqfx6B1TkwLSWMbIBu9Xq8yS2vNhAypnYPb9ZtdWuNp+q0zfJl5rJ23BOmy6NPtz/VHOKz+s68I2TD1bjGT88nUbymG+nIzwHi5F70x6Z3BfmLe7FhsasaZYOfPnEgC6FjvUb174pU4BZADyd4lRW4yy4e8WDzpXjyf89ZgoIjTswkzM6uZH13iB4vtQT69vOCXWtnwBVRFqY6UdWafpv4ryBHUXr0RxeF2yo9S1TUq2bjfsix1/G2xuyijt+MdDUEqdgptVJAaFO/2mok65iqK5A+BF94bRXycfNHQt3ollfxHlesPMdsgIt44tLb+MX8syw9zm7L0E/6cnzlLJcfuTnAlktPvAJO0/sKEHOLlL9tDFYSkTE2JaW2NssT6/GhqG5EXA0HYCsSpMWbTFRObmhjIA4mxAfohCc3s7w8Cs7/gC3v9WqSmIv5XCPwlRkQhkYh4X7uhRoYap54N5Pn5Mjx7bmC7cX7wly+AqH6245bnE2D+P//XvGoUdjaJiKBaa1Wm9vIOQDA1mk8ZNtSZU/BPf/kaXW9mKbp2TVSHb09NvOmn6J/+39+/xj/8NRcynqwuokyRuX3WxHVfrsnVKPCXvKqZzrmVXFbKNENUJ6rDhN/3KbTSJ1436pGWtgvYzTLmOe92CzC3dR1+aMybzuziXaPNg4u38B+9OBKMn1LKq894psVtXfReZBlq1qA9dMudUy/+Z/7TWkHKuU6Ul0ohoQxJeasqZeQH4dGXLsVv+jVuw4p1W/NrMLNelMXMpNimmslLmZPlDVRjCBoivHNKsK4ft9///MhDLeuWc5N8ofMKCsgmXvnoI7/WSW6KBoR3z5rRfv/DvyybHNCpyFWMvmekDWkOjxcJE1wSCSSFdGmKuz9Rk+blHwz+M25EQKW1e89dpAqKuEg1WCcRCPF//B/0O0/JGOaYpkRcpewJ5iRNMRn/vwXimem0IbXJjUtN5cmbCeq+rqemU3lZMZdrGKnUk2q+o7cbc6rCJacnqvd/CFKwUpHbcL+EyL9ePtj17nf6G2duJ6xuUAtV5PeS+uN3Da1Vt6yVdYwjT7RjM+bu7qauMf9FTb1NHXraWRk5PeuVcx8spXlpJOqcOhOtQyv6tf5Zv/jz5+B3W24s1MKnkheY6JL0Y8qPzFM+mCb+ctKMf/JMzRU38x8sX8M8/1+ak+uWW8aN0CKR34OFdTPCQnhJy52p0ZkmOp7z53nz0T1yWiHt9WULH6ppXYY67bECGFqDyOxfrbP1ooZpg/CiE4Ym7o+2DjxpXVvLB+2MrNV+4vWqYKyYMtORogAiiEqoVWMvA0zxwuJ4WgJpuiEQs9CxwVjT9OHiqodqVJpXxZraGMoGGNAYiNFIA1CoJvGG651CaVFIrCFVImZaQ5tbCCNtuNnjotr4Ja3Ds1KFsLn/B/MHN8ZQwAFao8RbplhJNtNIpLVNYc4vIaCJEJikOUl9/pxiLlu3FWkIQFAHfjI++Ym4yFCD+6FWUOssN+7OE0BaQMMzl10EbpEBiTpixkCNRoEZeTMgwIACU6AVIQCBGQOTEQ19RE4bl0Uptx0adVMUBIqASKHBoHGNYwgYEKaqMIXdiVthGKSh1hqui4JaoSmKIqoAkWi0RABmUm5c5pIPstDaGArEEEJQCyQIwBNXPfQ5/pSxrn3MDYm7iZIGVe2DEUnjKqBPgBsfqoUu0BCgoUX1m9xuKg1dFZDfnjRuClI0kIK4CQXmliKIKxUSNh9qE7chIgi74xe6rXMbXHehVMSgQSRTQ0QTBWHSGEAuZV/6kBs3ggKCAIHbUmNqKFc10LQUaSCIGhmAlULi0ruAwf2Y3cK/DD3joo7ebkgcD1+hDrAdFNc/qAAya/ZmJL7CShpADcAKGisQXZoIMASCsC/YydURKQABFBGy4UsuDKIpg1yUIHzVzVk3swCbhTLG5nNw5faBhaq9qnwBZ3a2C7sWt4uZNje+8JGYAiITMEARYyFu4XJHM9KoQ0EVQn0JDIACGrRgatMaDSC3y7khMIEcgNwgfK0RAXF/sCtdzn44JvG1rjSTjMH9TtiuXHCniqEoguUO+zW+iLsD2h0gmwsfLUTc194XOiBYjCMwLqo2VlByL9nkK0EAjRwRdVG7Mw+Ona9151XbzriWr3rUi4yd/1woIP/q+l///zfuVlA4IEoNAACwOwCdASrwAPAAPpFInUslpCYnpBpJaPASCWNu3r6OINGUOmxEp9+HZp/3frO3EH/v6Mf0kby7vU/+doGXUaMO3a7UZisNZkfYFOFoMtZ3vq32CemF6LoxKJMboJZyb8PL2JuN7ZY57HfeUImN8eY6ycgnE+luwMdnFpvdqmf5RQqfWU+ka90fO+nJupy/4y/Na1DRz6mWZOet6lrO/VeUWlf5KjLm1NI6He0gKuTt8CfkKlYH805VSG346xwQHeNqivfexm5M5+lw9D8nHWdsVrhapWHTis4Q/GqP7o7DViqf1qJ5JxcM1tOZ32IPAX2fK8uwoUk2Zs/jj1LRGs5B8r69rBuATmhijYTjCK/03swstJInMy2ll7oflj3V5DxE0YrbamYOiu9GFOP+3MF9PykDY/4D3uRhFR1yhH88U9EExS3hBN0mW14QS37mBNxUnNSNhtUpYXOVOIcjIkcMV9v2cK8wiDofe38zHIN6LIXUfHb26uX9wQxP9eEig8rqK2McApcQSSU8PIJ2bjWCQg5rxugNYiKjO6k+2N441Q5ohu3ndtaMgYvp94AZiVtM1KsnSyREqssB5Xx2sEDYh1C0YyOnLQLzlimK0lrSCKA1yYFzME/9HG1dOSzdoLJyafzSEGgA/v1RD3KVwcsT58BThUEs9d+pGbKoEWhhEJ0/0NYengA7aMoGjmsnn93wWJ8jyw3+dzidQjoloqau2aCyxqK6zQ9ibOGS9m5EUfDwQUhNnfbrbsFZW9Ji4iihg+Jd5b9Ys7TBQGJ7kc333/7qErBaT/U0f24joq0/g6ez73vLRtWe2Yyv6NHyQX1OiOGjm1qlU0znMBevXpV/YruswrHT5dYBuUF/7bSsCzFf8PvURWy7zwr1sgnqrzsef74anVIc+h+GatkSxiq2+HtC2tB7v/DQLAgPuAI/kZ/Jl9RaHxMplKjEpPodl77yd7Xm+6iMf59gLbHPfuu1sKQDFeL8/hdLsudEugXqYK+dYUenwnpkV4XdSl0nGgjlgSw9wNOxvF01e5klqP1k0/erVF+fFfCr0xA/K3dwdlnLJ8Ey6TL/6FShIVYIZM+wJtOmu8s6OMntRi1POe0/P4588JmqP2fQaELcLMJTQdtFCkBUPjfDTExZzzWndox2Lw0qLxD//v+luSJG5vBnv4W/1DeczTBFwivMeirQe2a+m5+/3yE4N3Kw3HNph1YMbMR0E/RFcgLOmPL2LyIK1Jdf0fO8P8r3enNcCO5iQI4y06v+FmI+BsxvTzWmVtDTDuLiHdKb1+55gTgsQqeBmme2dNiU4HapGS4P4Bxpdje+WtaS1a3OBQZGHrurTIQHJ5TI24gtA0zDMeN7OOXnKvXtSIX3ctiNGmsNWcWOKNb19C6BcfXDo29pLVX1erdtvKTcgsjc0KRCpXvyggWp3ESU6RvkEmDdUj43EqtQFLIMZonQLHTriPkgv8UQQrgW3SGb6WtlBD3eeNNhltrRBmphHRzL8tonnrH1BoZ5TrEi2t1MnWSLi2S/WpeqaX716Kp09/PHz9yMfAIdg/TFWqPPeQmse2vr46KHtBxKFv4X+BLuAST5ShP6Jn7EkW1sETiAiTEhYttZ+bbnB92Bd4ywnydF169qaCpVqcqECScnQoPZaZORW2jCt2PE62yuZFZw/4p0pBrwQsHq4WSwUhMPVNpOmtq1K6duwLvymmZZVMnLpvbK0Zmxt7aQFehi2WOnE+OLMJJGs0Mis/cFy7hAQ3XFGmxPBgncBEo/b7SCLja1e+IjYEy3w2IcqQ9Jyx2bvqEuwRaBAn1mxDNjtCDlQh8j4in0rPzM7gNSQzEqm14K5JdJ6G9xjnt/k++XKOkOJLPV4H1jRv4re+rvFRuTyXAkPFQA258/qUnLc1uvZZ/epaJq4rw+R3HRyHcB07jEUV+X+LneKM1W+knZwhYkYqFPqBzHQjLy8p6nN+iuihb+XpfdLH58Lkxft5Du9Rh0yvFS55vb0QzHJahcdbr5C++sGuo9A2paDgPkx3RIR72zrRGnsLfeIjEOMFStoOzFuitiyxzGpfzkxCEaICb5o3uaCTg13Y23h6pg+84TjJDp5Nh78nWd5nnzgzWcP2zeCE82Q+rAoH88MdAHbZIeR4fJOmxJdOFUStsqT+J5EhA5T7cQw0Q2jS/Q58NH7tBJ0gm96ymNSiHnVUlrKxnvqSDlM/YEGCZOiYJV2SfwlirqE9eyIXFET+9wAtbNzZT7G7dc0cx6rV2rWhGUCI0Z1oen4DjHOlZIo9NEy0G6SfU5Lam8facyCLK+Er6BfrwrJTNov8v1y0fwBeHZKHqFnKW92XsTMl+Z5++72VB7ru6xE2E1ByE234nWf79TpiO+JmCYZF6Y0KSLiAzczuE7vup4eohESLO2gC3xao2fA46KIjHKZOoXC/hZ/smgwGEY8KqdqX9zAc2vwjIKlm6NmvG8QcjahczlgiF9s8HKH/qh/TzHNb2Vk6ukzyfoVRCuH2qq9nRKgT9aA/MTtQWf0zFiltUX+b9680fvuHhPtbm8ohO9K26WnQnRAJ9X4gyBPF9mOho/5SuxBUD+HNtKjOjLrmGvQktcHQhGChRSTN1NpeI+/sDBvR8ljImxQls1IvfcoYH1Aoc23fk8w2cbt3lvqdYF22pIyZVT5hGHN5B/E9Ca3eWswVF1iDG1pw8psmb6ZpNoWB0TVJDh9LA7PLjGH/yT9Ya77pg70lK3xmoTSXvgb9mZFOXRTvGbv6URPi457PV5blmVKAAYiPF9QVJWIz3ac1JhSIsw7fofH0NVgIUdnCaJvRvEcduyW2bguZctv2Z0X15P5ce+pqpLY2La6aG/SiGF4WyqP431+ZfEB3iMmzVeD8vgLwGNWUKi/zujdaJGX5RyZ2d9vc2xoJQujLmJuBZ8OG7z65WMcQRT7v4NuvDMM/v6UEEzvSsdYGDRU+TPuJMEVgVHzYI3Zpwi/0pIxGxF4umIrfFhDNtT39uWn1vgY8a/+QJsXOhw5R8yOW2IrhE5MAwa5WsarJXtHTmBiOThwiZc1tca5/8LNTCwezIrx9WjlV4NnPuHra7bQz0JaO+7979Sf1vyvTeiyIBpp8pUcmli3O/0EgqivCpRMaJKmzikyj0xx+Ib6PP9qTOmboaReO4wxtTsoyxFIBAwIfIFEJnBEZSbVWmZRnYYMmESUPdf/sKNwPDK1tn4y5UizFTvB63YTZTlN/UjSp1R6PzhvygcE0vdQ0RcaC0IB0leQZq91ngNFyNYPdnfJGMpMFgOnqobmkCO/i3jWCLW8kRxXwZ4hdZlx3EzDE0qQcm9cjXm5uPiy8bOTWv5O9taaiSRznekeQltFR1Q5yhselZneu1YaLlvlohZr7MF6EIAGeag4KIJSawxSv42+WbL2lvOgVva1rFTwlVI62DEZXribJW7HPn3AIRtILNdTrqnyo2l5tmyTqkSn8wg4Fx/3D6P/PD80AZM62co+AA8UW4S7q5o1KDC5no5w88Y9qW87MXmNKImUQWdONd50YqmvA341+BJRf4KsGKF/DDavKSLcLgH7POAzq5JrtIs6BqLYt2O0OtcyN2iGRBaj90zaOwbW1k9+IreZ2DSuM3tN6KzWL137YzCMH+hlwUnfUbVFQ+b8WLKCn3m7WVQhLXmJeKdFclD96SLEiXAK7q+Xb4Y/J+WBEYuZR5w+UO2mxMCpMJHz0zz7FkPYYyr6XbRoJ9a9lnum+dDFj6k/zsB+IVLoWD4kW6XuKqxlJ/RAxi3K+TIrrULI4M2Hm+cZffz6bF6WUgVVtMHkWos3wasDTB2FXP8LNwtMai/c5gV9fCoAYx0JXI4dPewTAX4EfX7GRA1VW95QWLFxBsnkrs8L9QHn07we9uR6bPCnWsrHiJXuALHfxNXIG5Wt0xLLBTXfV19LQDOxJbXlBFGTsJZ6b3Ll5Xrst5tiSgMX/eAHunMXeV94C1zJ8BTIXOHeuE2kB1qdoW47KAyPUZg6W1GZEsRjXN/hkIb5xVkS05/XD/LPmDijvtxNEj+dEs7U3aQl+e7u1Qp/iHGDggsFSIleOrdUXltOg+dTg5NlKRCErunzJGsqslEkl8SXOMdvj4MzOIc9tG76fA6cYbLxO+q1CUfWO4gRrkqUcOwu8Emtm3cENo6lKGqKVqExxbwRfODqbBuE9/m+av26stoPvynTqj2jwAO/v9F/Zjt7DkuipeIcRTNBgoSEWlC3GW8P+vfPzL5v1Ama3scBTMR32RQGtkgoaPHWcoBta3oKDOZZASPjDoDiwRzuzYdzyH0O6koqvRSNX9hXkNeAxRHXV9Q3y3eNo1vr0PElBH1OitAsbKD2TL+E9+cUn54UXK6sPRkoASqJj0P0daVeLE9gUG9OqHLV08CshWHHBEXIHIZoqEws5Ag99wG+/013vPbkG/ggYV6pouw0/GC7IAl72Q16kQC9BuwrRnTPXQxT7DNixDszP9njps+oRFtMt8JHIU5QS/4EuveBOkcuylUeWs7sss5Y4YwVsOnIZAAAAAAAAA=";

  return (
    <div onClick={handleClick} style={{position:"relative",width:size,height:size,cursor:"pointer",flexShrink:0}}>
      {glow && <div style={{position:"absolute",inset:"-40%",borderRadius:"50%",
        background:"radial-gradient(ellipse at 50% 35%, rgba(18,212,212,.22) 0%, rgba(10,128,128,.08) 40%, transparent 65%)",
        animation:"prism-glow-1 3s ease-in-out infinite",pointerEvents:"none"}}/>}
      {glow && <div style={{position:"absolute",inset:"-35%",borderRadius:"50%",
        background:"radial-gradient(ellipse at 30% 80%, rgba(244,93,72,.15) 0%, transparent 55%)",
        animation:"prism-glow-2 3s ease-in-out 1s infinite",pointerEvents:"none"}}/>}
      {glow && <div style={{position:"absolute",inset:"-35%",borderRadius:"50%",
        background:"radial-gradient(ellipse at 70% 80%, rgba(239,159,39,.13) 0%, transparent 55%)",
        animation:"prism-glow-2 3s ease-in-out 2s infinite",pointerEvents:"none"}}/>}
      {glow && <div style={{position:"absolute",inset:"-30%",borderRadius:"50%",
        background:"radial-gradient(ellipse at 20% 50%, rgba(127,119,221,.1) 0%, transparent 45%)",
        animation:"prism-glow-3 4s ease-in-out infinite",pointerEvents:"none"}}/>}
      <img src={LOGO} alt="Prism" style={{
        width:"100%",height:"100%",objectFit:"contain",position:"relative",zIndex:1,
        filter: glow
          ? "drop-shadow(0 0 18px rgba(10,128,128,.5)) drop-shadow(0 0 35px rgba(244,93,72,.22)) drop-shadow(0 0 6px rgba(239,159,39,.18))"
          : "drop-shadow(0 0 5px rgba(10,128,128,.3))",
        transition:"transform .3s ease",
        transform: pop ? "scale(1.12)" : "scale(1)",
      }}/>
      {glow && <div style={{position:"absolute",inset:0,zIndex:2,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:"20%",right:"20%",height:"35%",
          background:"radial-gradient(ellipse at 50% 0%, rgba(18,212,212,.1) 0%, transparent 75%)",
          animation:"prism-color-pulse 3s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"5%",left:0,width:"45%",height:"40%",
          background:"radial-gradient(ellipse at 0% 100%, rgba(244,93,72,.08) 0%, transparent 65%)",
          animation:"prism-color-pulse 3s ease-in-out 1s infinite"}}/>
        <div style={{position:"absolute",bottom:"5%",right:0,width:"45%",height:"40%",
          background:"radial-gradient(ellipse at 100% 100%, rgba(239,159,39,.08) 0%, transparent 65%)",
          animation:"prism-color-pulse 3s ease-in-out 2s infinite"}}/>
      </div>}
      {glow && <div style={{position:"absolute",bottom:"-8%",left:"15%",right:"15%",height:"12%",
        background:"radial-gradient(ellipse, rgba(239,159,39,.1) 0%, transparent 70%)",
        filter:"blur(6px)",animation:"prism-floor 3s ease-in-out infinite"}}/>}
    </div>
  );
}


// ─── WORDMARK ──────────────────────────────────────────────────
function Wordmark({ size=20 }) {
  return (
    <div style={{display:"flex",alignItems:"baseline"}}>
      {"PRISM".split("").map((ch,i) => (
        <span key={i} style={{fontSize:size,fontWeight:800,letterSpacing:"-.03em",lineHeight:1,
          animation:`wl${i} 2.8s ease-in-out infinite`,animationDelay:`${i*.18}s`}}>{ch}</span>
      ))}
    </div>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────
function TW({ text, speed=42, delay=0 }) {
  const [s,set]=useState("");
  useEffect(()=>{
    const t=setTimeout(()=>{
      let i=0;
      const iv=setInterval(()=>{i++;set(text.slice(0,i));if(i>=text.length)clearInterval(iv);},speed);
      return()=>clearInterval(iv);
    },delay);
    return()=>clearTimeout(t);
  },[text, speed, delay]);
  return <span>{s}<span style={{opacity:.4,animation:"blink .8s ease-in-out infinite"}}>|</span></span>;
}

const TICKS={
  agent:  ["Your adherence 97% · Top 10% of BenOps","Break in 18 minutes — check timeline","14-day streak active · +50 XP today"],
  manager:["BenOps Priority CRITICAL · SL 68% · 7 waiting","3 approvals pending · 2 auto-approvable","Team adherence 94% — up 2% this week"],
  wfm:    ["Prism rollout in progress · IEX retirement pending","BenOps Priority SL 68% · action needed","ClearCast accuracy 97.1% · best week ever — Gustified 🎯"],
};
function Ticker({ role }) {
  const msgs = TICKS[role] || TICKS.wfm;
  const [idx, setIdx] = useState(0), [anim, setAnim] = useState("ti");
  useEffect(() => {
    const t = setInterval(() => {
      setAnim("to");
      setTimeout(() => { setIdx(x => (x+1) % msgs.length); setAnim("ti"); }, 280);
    }, 4800);
    return () => clearInterval(t);
  }, [msgs.length]);
  return (
    <div style={{ background:"rgba(7,10,20,.96)", padding:"0 18px", display:"flex", alignItems:"center", gap:10, height:30, minHeight:30, borderBottom:`.5px solid rgba(255,255,255,.05)`, flexShrink:0, overflow:"hidden" }}>
      <span style={{ fontSize:11, fontWeight:700, color:"#0AC8A0", textTransform:"uppercase", letterSpacing:".1em", flexShrink:0, background:"rgba(10,200,150,.08)", padding:"2px 7px", borderRadius:5, border:".5px solid rgba(10,200,150,.2)" }}>LIVE</span>
      <span style={{ width:4, height:4, borderRadius:"50%", background:C.guava, flexShrink:0, animation:"lp 2.2s ease-in-out infinite" }} />
      <div style={{ flex:1, overflow:"hidden", height:16, position:"relative" }}>
        <span style={{ position:"absolute", fontSize:12, color:"rgba(255,255,255,.65)", fontWeight:400, letterSpacing:".005em", whiteSpace:"nowrap", animation:`${anim} .28s ease both` }}>{msgs[idx]}</span>
      </div>
    </div>
  );
}

function XPBar({ value, max, color=C.kale }) {
  const pct = Math.min(value/max*100, 100);
  return (
    <div style={{ height:5, background:"rgba(255,255,255,.06)", borderRadius:3, overflow:"hidden", position:"relative" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color}CC,${color})`, borderRadius:3, transition:"width 1.2s cubic-bezier(.4,0,.2,1)", position:"relative", overflow:"hidden" }}>
        {pct > 15 && <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,.22) 50%,transparent 100%)", animation:"shimmer 2.4s ease-in-out infinite" }} />}
      </div>
    </div>
  );
}

function Pill({ label, color, small }) {
  return (
    <span style={{ fontSize:small?8:9, fontWeight:600, padding:small?"2px 6px":"3px 9px", borderRadius:20,
      background:`${color}16`, color, border:`.5px solid ${color}38`, letterSpacing:".02em", display:"inline-flex", alignItems:"center", gap:4 }}>
      {label}
    </span>
  );
}

function AccessDenied({ msg }) {
  return (
    <div style={{ background:C.card, border:`.5px solid rgba(244,93,72,.18)`, borderRadius:16, padding:"56px 32px", textAlign:"center", maxWidth:420, margin:"0 auto" }}>
      <div style={{ width:56, height:56, borderRadius:16, background:"rgba(244,93,72,.1)", border:".5px solid rgba(244,93,72,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 16px" }}>🔒</div>
      <div style={{ fontSize:15, fontWeight:700, color:C.tx0, marginBottom:8, letterSpacing:"-.01em" }}>Access restricted</div>
      <div style={{ fontSize:13, color:C.tx2, lineHeight:1.65 }}>{msg}</div>
    </div>
  );
}

function TimeOffView({ user }) {
  const [requests, setRequests] = useState([
    { id: 1, type: "PTO", start: fmtRelDate(1), end: fmtRelDate(3), days: 3, status: "approved", note: "Family vacation" },
    { id: 2, type: "PTO", start: fmtRelDate(20), end: fmtRelDate(20), days: 1, status: "pending", note: "Personal day" },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [reqType, setReqType] = useState("PTO");
  const [reqNote, setReqNote] = useState("");
  const balance = { pto: 14, sick: 5, personal: 3, used: 8 };

  // US Holidays 2026
  const holidays = [
    { d: "Jan 1", n: "New Year's Day" }, { d: "Jan 19", n: "MLK Day" },
    { d: "Feb 16", n: "Presidents' Day" }, { d: "May 25", n: "Memorial Day" },
    { d: "Jun 19", n: "Juneteenth" }, { d: "Jul 4", n: "Independence Day" },
    { d: "Sep 7", n: "Labor Day" }, { d: "Nov 26", n: "Thanksgiving" },
    { d: "Dec 25", n: "Christmas Day" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 4 }}>Time off</div>
          <div style={{ fontSize: 13, color: C.tx2 }}>{user.pillar} · {balance.pto - balance.used} PTO days remaining</div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", borderRadius: 10, background: "linear-gradient(135deg," + C.kale + ",#0AB0B0)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Request time off
        </button>
      </div>

      {/* Balances */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { l: "PTO balance", v: balance.pto + "d", c: C.kale },
          { l: "Used YTD", v: balance.used + "d", c: C.amber },
          { l: "Remaining", v: (balance.pto - balance.used) + "d", c: "#0AC8A0" },
          { l: "Sick days", v: balance.sick + "d", c: C.purple },
        ].map(k => (
          <div key={k.l} style={{ background: C.card, border: ".5px solid " + C.bd, borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Request form */}
      {showForm && (
        <div style={{ background: C.card, border: ".5px solid " + C.kale + "44", borderRadius: 14, padding: 18, marginBottom: 14, animation: "view-in .2s ease" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 14 }}>New request</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: C.tx2, marginBottom: 5 }}>Type</div>
              <select value={reqType} onChange={e => setReqType(e.target.value)}
                style={{ width: "100%", background: C.surf, border: ".5px solid " + C.bd, borderRadius: 8, padding: "7px 10px", color: C.tx0, fontSize: 13 }}>
                <option value="PTO">PTO</option>
                <option value="Sick">Sick</option>
                <option value="Personal">Personal</option>
                <option value="Schedule Adjustment">Schedule Adjustment</option>
                <option value="Shift Swap">Shift Swap</option>
                <option value="Early Leave">Early Leave</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.tx2, marginBottom: 5 }}>Start date</div>
              <input type="date" style={{ width: "100%", background: C.surf, border: ".5px solid " + C.bd, borderRadius: 8, padding: "7px 10px", color: C.tx0, fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.tx2, marginBottom: 5 }}>End date</div>
              <input type="date" style={{ width: "100%", background: C.surf, border: ".5px solid " + C.bd, borderRadius: 8, padding: "7px 10px", color: C.tx0, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: C.tx2, marginBottom: 5 }}>Notes</div>
            <textarea value={reqNote} onChange={e => setReqNote(e.target.value)} rows={2} placeholder="Reason for request..."
              style={{ width: "100%", background: C.surf, border: ".5px solid " + C.bd, borderRadius: 8, padding: "7px 10px", color: C.tx0, fontSize: 13, resize: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setRequests(r => [...r, { id: Date.now(), type: reqType, start: "May 20", end: "May 20", days: 1, status: "pending", note: reqNote }]); setShowForm(false); setReqNote(""); window.prismToast?.("Time off request submitted — pending approval.", "info"); }}
              style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: "linear-gradient(135deg," + C.kale + ",#0AB0B0)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Submit request
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: "9px 16px", borderRadius: 9, background: "rgba(255,255,255,.06)", color: C.tx2, border: ".5px solid " + C.bd, fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Request history */}
      <div style={{ background: C.card, border: ".5px solid " + C.bd, borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 12 }}>My requests</div>
        {requests.length === 0 && <div style={{ textAlign: "center", padding: 20, color: C.tx2, fontSize: 13 }}>No requests yet</div>}
        {requests.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: ".5px solid rgba(255,255,255,.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: r.status === "approved" ? "rgba(10,200,150,.12)" : "rgba(239,159,39,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
              {r.type === "PTO" ? "🏖" : r.type === "Sick" ? "🤒" : "📋"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.tx0 }}>{r.type} · {r.start}{r.end !== r.start ? " – " + r.end : ""} ({r.days}d)</div>
              {r.note && <div style={{ fontSize: 12, color: C.tx2 }}>{r.note}</div>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 8,
              background: r.status === "approved" ? "rgba(10,200,150,.12)" : r.status === "denied" ? "rgba(244,93,72,.12)" : "rgba(239,159,39,.12)",
              color: r.status === "approved" ? "#0AC8A0" : r.status === "denied" ? C.guava : C.amber,
              border: ".5px solid " + (r.status === "approved" ? "rgba(10,200,150,.3)" : r.status === "denied" ? "rgba(244,93,72,.3)" : "rgba(239,159,39,.3)"),
              textTransform: "uppercase" }}>{r.status}</span>
          </div>
        ))}
      </div>

      {/* US Holidays */}
      <div style={{ background: C.card, border: ".5px solid " + C.bd, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 10 }}>US Holidays · 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>
          {holidays.map(h => (
            <div key={h.n} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: C.surf }}>
              <span style={{ fontSize: 14 }}>🇺🇸</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.tx0 }}>{h.n}</div>
                <div style={{ fontSize: 11, color: C.tx2 }}>{h.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title, desc, badge }) {
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{fontSize:17,fontWeight:700,color:C.tx0}}>{title}</div>
        {badge&&<Pill label={badge} color={C.kale}/>}
      </div>
      <div style={{background:C.card,border:`.5px solid ${C.bd}`,borderRadius:14,padding:"40px 24px",textAlign:"center"}}>
        <div style={{fontSize:13,color:C.tx2,lineHeight:1.75}}>{desc}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════════
const ROLE_FEATURES = {
  agent:   ["Your Gustie schedule at a glance", "Real-time adherence tracking & streaks", "XP, badges & team leaderboard"],
  manager: ["Live queue monitoring & alerts", "Team roster, skilling & cross-training", "Approval workflows & shift management"],
  wfm:     ["ClearCast · 86-CT Gustified forecast engine", "Schedule generation, patterns & automation", "Full queue analytics, projections & capacity"],
};

const SIGNING_STATUS = [
  "Authenticating with Okta SSO…",
  "Loading your Gustie workspace…",
  "Applying role permissions…",
  "Syncing ClearCast data…",
  "Almost there…",
  "Welcome to Prism, Gustie ✓",
];

const LOGIN_PARTICLES = [
  { x:7,  y:18, s:3,   c:"#0A8080", d:3.2 },
  { x:91, y:71, s:2.5, c:"#F45D48", d:4.1 },
  { x:21, y:79, s:3,   c:"#EF9F27", d:5.0 },
  { x:78, y:19, s:2,   c:"#7F77DD", d:3.7 },
  { x:55, y:91, s:1.5, c:"#0AC8A0", d:2.8 },
  { x:13, y:52, s:2.5, c:"#0A8080", d:6.0 },
  { x:86, y:44, s:1.5, c:"#EF9F27", d:4.5 },
  { x:42, y:6,  s:2,   c:"#7F77DD", d:3.9 },
  { x:64, y:94, s:1.5, c:"#F45D48", d:5.3 },
  { x:4,  y:84, s:2,   c:"#0AC8A0", d:4.8 },
  { x:33, y:38, s:1.5, c:"#7F77DD", d:6.2 },
  { x:70, y:60, s:2,   c:"#0A8080", d:3.5 },
];

function LoginScreen({ onLogin }) {
  const [phase, setPhase] = useState("role");
  const [selRole, setSelRole] = useState(null);
  const [selUser, setSelUser] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  function startSignIn() {
    setPhase("signing");
    let p = 0, si = 0;
    const iv = setInterval(() => {
      p += Math.random() * 9 + 4;
      setProgress(Math.min(p, 98));
      const nsi = Math.min(Math.floor(p / 18), SIGNING_STATUS.length - 2);
      if (nsi !== si) { si = nsi; setStatusIdx(si); }
      if (p >= 98) {
        clearInterval(iv);
        setStatusIdx(SIGNING_STATUS.length - 1);
        setTimeout(() => { setProgress(100); setTimeout(() => onLogin(selRole, selUser), 380); }, 650);
      }
    }, 65);
  }

  const rc = selRole && ROLE_META[selRole] ? ROLE_META[selRole].color : C.kale;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.bg, position: "relative", overflowX: "hidden", overflowY: "auto", padding: "40px 16px 32px" }}>

      {/* Grid overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />

      {/* Animated colour orbs */}
      <div style={{ position: "absolute", top: "10%", left: "14%", width: 560, height: 560, background: "radial-gradient(ellipse,rgba(10,128,128,.14) 0%,transparent 66%)", borderRadius: "50%", animation: "orb1 10s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "8%", right: "10%", width: 460, height: 460, background: "radial-gradient(ellipse,rgba(244,93,72,.1) 0%,transparent 64%)", borderRadius: "50%", animation: "orb2 13s ease-in-out infinite 2s", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "42%", right: "20%", width: 340, height: 340, background: "radial-gradient(ellipse,rgba(127,119,221,.09) 0%,transparent 60%)", borderRadius: "50%", animation: "orb3 15s ease-in-out infinite 5s", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "28%", left: "6%", width: 300, height: 300, background: "radial-gradient(ellipse,rgba(239,159,39,.07) 0%,transparent 60%)", borderRadius: "50%", animation: "orb2 17s ease-in-out infinite 1s", pointerEvents: "none" }} />

      {/* Floating particles */}
      {LOGIN_PARTICLES.map((p, i) => (
        <div key={i} style={{ position: "absolute", left: p.x + "%", top: p.y + "%", width: p.s, height: p.s, borderRadius: "50%", background: p.c, animation: `particle-breathe ${p.d}s ease-in-out infinite ${-(p.d * 0.4)}s`, pointerEvents: "none" }} />
      ))}

      {/* Logo block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: phase === "role" ? 32 : 28, animation: "fade-up .7s ease both", position: "relative", zIndex: 1 }}>
        <PrismMark size={phase === "signing" ? 110 : 160} id="login" />
        {phase !== "signing" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><Wordmark size={40} /></div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", letterSpacing: ".2em", textTransform: "uppercase", fontWeight: 300, marginBottom: 14 }}>Workforce Intelligence</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(10,128,128,.1)", border: ".5px solid rgba(10,128,128,.25)", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "rgba(10,200,150,.75)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0AC8A0", animation: "lp 2s ease-in-out infinite", flexShrink: 0 }} />
              340 Gusties · 86 forecast groups · Live
            </div>
          </div>
        )}
      </div>

      {/* ── ROLE SELECTION ─────────────────────────────── */}
      {phase === "role" && (
        <div style={{ width: "100%", maxWidth: 620, animation: "fade-up .5s ease .12s both", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.tx0, marginBottom: 6, letterSpacing: "-.025em" }}>Welcome back.</div>
            <div style={{ fontSize: 14, color: C.tx2 }}>Your role determines what you see and can do</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {Object.entries(ROLE_META).map(([role, meta], i) => (
              <div key={role}
                onClick={() => { setSelRole(role); setSelUser(null); setPhase("user"); }}
                style={{ background: "rgba(17,23,40,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: `.5px solid ${C.bd}`, borderTop: `2px solid ${meta.color}`, borderRadius: 18, padding: "24px 18px 20px", cursor: "pointer", textAlign: "center", transition: "all .22s", animation: `card-rise .5s ease ${.12 * i + .15}s both`, position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(17,23,40,.92)"; e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.boxShadow = `0 20px 56px rgba(0,0,0,.45), 0 0 0 .5px ${meta.color}44, 0 0 48px ${meta.color}14`; e.currentTarget.style.borderColor = `${meta.color}50`; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(17,23,40,0.72)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = C.bd; }}>
                {/* Corner glow */}
                <div style={{ position: "absolute", top: 0, right: 0, width: 90, height: 90, background: `radial-gradient(ellipse at top right,${meta.color}1A,transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, width: 70, height: 70, background: `radial-gradient(ellipse at bottom left,${meta.color}0E,transparent 70%)`, pointerEvents: "none" }} />
                {/* Icon bubble */}
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `${meta.color}18`, border: `.5px solid ${meta.color}38`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 16px", position: "relative" }}>
                  {meta.icon}
                  <div style={{ position: "absolute", inset: -1, borderRadius: 17, background: `linear-gradient(135deg,${meta.color}20,transparent)`, pointerEvents: "none" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx0, marginBottom: 6, letterSpacing: "-.01em", lineHeight: 1.3 }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: C.tx2, lineHeight: 1.65, marginBottom: 16 }}>{meta.desc}</div>
                {/* Feature list */}
                <div style={{ borderTop: `.5px solid rgba(255,255,255,.06)`, paddingTop: 13, textAlign: "left" }}>
                  {(ROLE_FEATURES[role] || []).map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: meta.color, flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "rgba(255,255,255,.16)", letterSpacing: ".06em" }}>
            GUSTO SSO · OKTA · ISO 27001 · SOC 2 TYPE II
          </div>
        </div>
      )}

      {/* ── USER PICKER ─────────────────────────────── */}
      {phase === "user" && selRole && (
        <div style={{ width: "100%", maxWidth: 500, animation: "fade-up .32s ease both", position: "relative", zIndex: 1 }}>
          <button onClick={() => setPhase("role")}
            style={{ background: "none", border: "none", color: C.tx2, fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0, display: "flex", alignItems: "center", gap: 5, transition: "color .15s" }}
            onMouseEnter={e => e.currentTarget.style.color = C.tx0}
            onMouseLeave={e => e.currentTarget.style.color = C.tx2}>
            ← All roles
          </button>
          <div style={{ background: "rgba(17,23,40,0.88)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `.5px solid ${C.bd}`, borderTop: `2px solid ${rc}`, borderRadius: 20, padding: 26, boxShadow: `0 28px 80px rgba(0,0,0,.55), 0 0 0 .5px ${rc}22, 0 0 60px ${rc}10` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${rc}18`, border: `.5px solid ${rc}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {ROLE_META[selRole].icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.tx0, marginBottom: 2, letterSpacing: "-.01em" }}>{ROLE_META[selRole].label}</div>
                <div style={{ fontSize: 12, color: C.tx2 }}>Choose your account</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
              {USERS[selRole].map((u, i) => {
                const active = selUser && selUser.id === u.id;
                return (
                  <div key={u.id} onClick={() => setSelUser(u)}
                    style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", borderRadius: 13, cursor: "pointer", border: `.5px solid ${active ? rc + "60" : C.bd}`, background: active ? `${rc}12` : "rgba(255,255,255,.025)", transition: "all .15s", animation: `fade-up .28s ease ${.05 * i}s both` }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.borderColor = rc + "30"; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,.025)"; e.currentTarget.style.borderColor = C.bd; } }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${rc}20`, border: `.5px solid ${active ? rc + "55" : rc + "28"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: rc, flexShrink: 0, boxShadow: active ? `0 0 18px ${rc}28` : "none", transition: "all .18s" }}>
                      {u.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.tx0 }}>{u.name}</span>
                        {u.level && <span style={{ fontSize:9, fontWeight:700, color:rc, background:`${rc}18`, border:`.5px solid ${rc}35`, borderRadius:5, padding:"1px 5px", letterSpacing:".06em" }}>{u.level}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.tx2 }}>
                        {u.subRole ? (ROLES_CONFIG[selRole]?.subRoles[u.subRole]?.label || u.title) : u.title}
                        {u.pillar !== "All" ? ` · ${u.pillar}` : ""}
                      </div>
                    </div>
                    {active && <div style={{ width: 8, height: 8, borderRadius: "50%", background: rc, boxShadow: `0 0 10px ${rc}` }} />}
                  </div>
                );
              })}
            </div>
            <button onClick={() => selUser && startSignIn()} disabled={!selUser}
              style={{ width: "100%", padding: "13px 0", borderRadius: 13, background: selUser ? `linear-gradient(135deg,${rc},${rc}BB)` : "rgba(255,255,255,.06)", color: selUser ? "#fff" : "rgba(255,255,255,.2)", border: "none", fontSize: 14, fontWeight: 700, cursor: selUser ? "pointer" : "not-allowed", transition: "all .22s", letterSpacing: "-.01em", boxShadow: selUser ? `0 8px 28px ${rc}30` : "none" }}>
              {selUser ? `Continue as ${selUser.name.split(" ")[0]} →` : "Select an account"}
            </button>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "rgba(255,255,255,.16)", letterSpacing: ".05em" }}>GUSTO SSO · OKTA · PERMISSIONS ENFORCED SERVER-SIDE</div>
          </div>
        </div>
      )}

      {/* ── SIGNING IN ─────────────────────────────── */}
      {phase === "signing" && (
        <div style={{ textAlign: "center", animation: "fade-up .38s ease both", position: "relative", zIndex: 1, marginTop: -16 }}>
          {/* Orbit rings around logo */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 28 }}>
            <div style={{ position: "absolute", inset: -18, borderRadius: "50%", border: `.5px solid ${rc}30`, animation: "spin 5s linear infinite" }} />
            <div style={{ position: "absolute", inset: -30, borderRadius: "50%", border: `.5px solid rgba(255,255,255,.05)`, borderTopColor: rc + "55", borderRightColor: rc + "22", animation: "spin 9s linear infinite reverse" }} />
            <div style={{ position: "absolute", inset: -44, borderRadius: "50%", border: `.5px solid rgba(255,255,255,.03)`, borderBottomColor: rc + "30", animation: "spin 14s linear infinite" }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 6, letterSpacing: "-.02em" }}>
            Signing in as <span style={{ color: rc }}>{selUser && selUser.name.split(" ")[0]}</span>
          </div>
          <div style={{ fontSize: 13, color: C.tx2, marginBottom: 28, minHeight: 16, animation: "fade-up .25s ease both" }} key={statusIdx}>
            {SIGNING_STATUS[statusIdx]}
          </div>
          <div style={{ width: 300, margin: "0 auto 12px", position: "relative" }}>
            <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg,${C.kale},${rc})`, borderRadius: 4, transition: "width .1s ease", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,.38) 48%,transparent 100%)", animation: "shimmer 1.3s ease-in-out infinite" }} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.28)", letterSpacing: ".04em" }}>{Math.round(progress)}%</div>
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR ───────────────────────────────────────────────────
const NAV_SECTIONS = {
  wfm: [
    { label: "Workforce Intelligence", ids: ["dashboard","queue","ops"], wi: true },
    { label: "Forecast",               ids: ["forecast","fvsa","fcst-intel"] },
    { label: "Schedule",               ids: ["calendar","coverage","coverage-cal","patterns"] },
    { label: "Team",                   ids: ["roster","approvals"] },
    { label: "More",                   ids: ["achievements","connections"] },
  ],
  manager: [
    { label: null,       ids: ["dashboard","queue","ops"] },
    { label: "Schedule", ids: ["calendar","coverage","coverage-cal"] },
    { label: "Team",     ids: ["roster","skills"] },
    { label: "More",     ids: ["approvals","achievements"] },
  ],
  agent: [
    { label: null,    ids: ["dashboard","schedule","swap","timeoff","achievements"] },
    { label: "Account", ids: ["profile"] },
  ],
};

function Sidebar({ role, view, onNav }) {
  const items    = NAVS[role] || NAVS.wfm;
  const rc       = ROLE_META[role]?.color || C.kale;
  const sections = NAV_SECTIONS[role] || NAV_SECTIONS.wfm;

  return (
    <div style={{ width:192, background:C.sidebar, borderRight:`.5px solid ${C.sidebarBd}`, display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto", overflowX:"hidden", paddingTop:6, paddingBottom:20, userSelect:"none" }}>
      {sections.map((sec, si) => (
        <div key={si}>
          {sec.label && sec.wi && (
            <div style={{ padding:"12px 16px 6px", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ height:.5, flex:1, background:`linear-gradient(90deg,${C.kale}50,transparent)` }}/>
              <span style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", opacity:.75 }}>{sec.label}</span>
              <div style={{ height:.5, flex:1, background:`linear-gradient(90deg,transparent,${C.kale}50)` }}/>
            </div>
          )}
          {sec.label && !sec.wi && (
            <div style={{ padding:"10px 20px 4px", fontSize:11, fontWeight:700, color:C.tx2, letterSpacing:".12em", textTransform:"uppercase" }}>{sec.label}</div>
          )}
          {si > 0 && !sec.label && <div style={{ height:.5, background:C.bd, margin:"6px 16px 6px" }} />}
          {sec.ids.map(id => {
            const item = items.find(it => it.id === id);
            if (!item) return null;
            const active = view === id;
            return (
              <div key={id}
                onClick={() => onNav(id)}
                style={{ position:"relative", margin:"1px 10px", borderRadius:11, padding:"9px 13px", display:"flex", alignItems:"center", gap:11, cursor:"pointer", transition:"background .14s, color .14s", background: active ? `${rc}1C` : "transparent", color: active ? rc : C.tx1 }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background=C.bd; e.currentTarget.style.color=C.tx0; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.tx1; }}}>

                {/* Left accent bar */}
                {active && (
                  <div style={{ position:"absolute", left:-10, top:"50%", transform:"translateY(-50%)", width:3, height:22, borderRadius:"0 3px 3px 0", background:rc, boxShadow:`0 0 10px ${rc}88` }} />
                )}

                {/* Icon box */}
                <div style={{ width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, transition:"all .14s",
                  background: active ? `${rc}28` : "rgba(255,255,255,.055)",
                  boxShadow: active ? `0 0 14px ${rc}30` : "none",
                  color: active ? rc : "inherit",
                }}>
                  {item.icon}
                </div>

                {/* Label */}
                <span style={{ fontSize:14, fontWeight: active ? 600 : 400, flex:1, letterSpacing:"-.01em", lineHeight:1 }}>
                  {item.label}
                </span>

                {/* Alert dot */}
                {item.alert && (
                  <div style={{ width:6, height:6, borderRadius:"50%", background:C.guava, flexShrink:0, boxShadow:`0 0 7px ${C.guava}`, animation:"lp 1.8s ease-in-out infinite" }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// MANAGER LIVE STRIP
// ══════════════════════════════════════════════════════════════
function ManagerLiveStrip({ onNav }) {
  const [tick, setTick] = useState(0);
  const [popKey, setPopKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setTick(x => x+1); setPopKey(k => k+1); }, 5000);
    return () => clearInterval(t);
  }, []);
  const sl = 81 + Math.round(Math.sin(tick * 0.7) * 3);
  const adh = 9 + (tick % 4 === 0 ? 1 : tick % 7 === 0 ? -1 : 0);
  const queue = 3 + (tick % 5 === 0 ? 3 : tick % 3 === 0 ? 1 : 2);
  const asa = 22 + (tick % 6) * 2;
  const slOk = sl >= 80;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:14, padding:"12px 14px", background:`linear-gradient(135deg,${C.surf},rgba(10,128,128,.08))`, borderRadius:14, border:`.5px solid ${C.kale}30`, animation:"fade-up .3s ease both, live-pulse 4s ease-in-out infinite" }}>
      {[
        { label:"Service Level", val:`${sl}%`,      color: slOk ? "#0AC8A0" : C.guava,   click:() => onNav("queue") },
        { label:"In Adherence",  val:`${adh}/12`,   color: adh >= 10 ? "#0AC8A0" : C.amber, click:() => onNav("ops") },
        { label:"Queue Depth",   val:`${queue}`,    color: queue > 5 ? C.guava : C.amber, click:() => onNav("queue") },
        { label:"Avg Speed Ans", val:`${asa}s`,     color: asa < 30 ? "#0AC8A0" : C.amber, click:() => onNav("ops") },
        { label:"Alerts",        val:"2 open",      color:C.guava,                        click:() => onNav("queue") },
      ].map(m => (
        <div key={m.label} onClick={m.click} style={{ textAlign:"center", cursor:"pointer", borderRadius:10, padding:"8px 4px", transition:"background .15s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div key={`${m.label}-${popKey}`} style={{ fontSize:18, fontWeight:700, color:m.color, lineHeight:1, marginBottom:3, animation:"val-pop .35s ease" }}>{m.val}</div>
          <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".05em" }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AGENT SELF PROFILE
// ══════════════════════════════════════════════════════════════
const SKILL_LABELS = { phone:"Phone", email:"Email", chat:"Chat/Email", chatEmail:"Chat/Email", cobra:"COBRA", fein:"FEIN", cancel:"Cancellations", training:"Training" };
const WORK_PATTERNS = [
  { id:"5x8",  label:"5×8   Mon–Fri",  desc:"8 hrs/day, 5 days — standard" },
  { id:"4x10", label:"4×10  Mon–Thu",  desc:"10 hrs/day, 4 days — compressed" },
  { id:"flex", label:"Flex  Mon–Fri",  desc:"Variable start, core hours 10am–3pm" },
  { id:"3x12", label:"3×12  Sun–Tue",  desc:"12 hrs/day, 3 days — weekend-heavy" },
];

function AgentSelfProfile({ user, onNav }) {
  const skillData = { phone:2, email:3, chat:2, cobra:0, fein:1, cancel:1 };
  const [skills, setSkills] = useState(skillData);
  const [editingSkills, setEditingSkills] = useState(false);
  const [pattern, setPattern] = useState("5x8");
  const [patternReqOpen, setPatternReqOpen] = useState(false);
  const [patternNote, setPatternNote] = useState("");
  const [patternSent, setPatternSent] = useState(false);
  const [teamEditOpen, setTeamEditOpen] = useState(false);
  const pto = { pto:14, sick:7, personal:3, usedPto:8, usedSick:1, usedPersonal:1 };
  const pillCol = PILLARS[user.pillar] || C.kale;

  function profBar(v) {
    const labels = ["","Developing","Proficient","Expert"];
    const cols = ["rgba(255,255,255,.08)","#EF9F27","#0AC8A0","#7F77DD"];
    return <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      {[1,2,3].map(i => <div key={i} style={{ width:18, height:5, borderRadius:3, background:i<=v ? cols[v] : "rgba(255,255,255,.08)", transition:"background .2s" }} />)}
      <span style={{ fontSize:11, color:C.tx2 }}>{labels[v]||"None"}</span>
    </div>;
  }

  return (
    <div style={{ animation:"fade-up .35s ease both" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20, padding:"18px 20px", background:`linear-gradient(135deg,${pillCol}18,${pillCol}08)`, borderRadius:16, border:`.5px solid ${pillCol}30` }}>
        <div style={{ width:56, height:56, borderRadius:16, background:`${pillCol}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:pillCol, flexShrink:0 }}>{initials(user.name)}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700, color:C.tx0, marginBottom:3 }}>{user.name}</div>
          <div style={{ fontSize:13, color:C.tx1, marginBottom:4 }}>{user.pillar} · CX Specialist</div>
          <div style={{ display:"flex", gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:8, background:`${pillCol}20`, color:pillCol }}>{user.pillar}</span>
            <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:8, background:"rgba(255,255,255,.06)", color:C.tx2 }}>Tier II</span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:13, color:C.tx2, marginBottom:4 }}>Prism XP</div>
          <div style={{ fontSize:22, fontWeight:800, color:C.amber, lineHeight:1 }}>{user.xp.toLocaleString()}</div>
        </div>
      </div>

      {/* Work pattern */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>Work pattern</div>
          <button onClick={() => setPatternReqOpen(true)} style={{ fontSize:11, fontWeight:600, color:C.amber, background:`${C.amber}12`, border:`.5px solid ${C.amber}30`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Request change</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6 }}>
          {WORK_PATTERNS.map(wp => (
            <div key={wp.id} style={{ padding:"10px 12px", borderRadius:10, border:`.5px solid ${pattern===wp.id ? C.kale+"55" : C.bd}`, background:pattern===wp.id ? `${C.kale}10` : "rgba(255,255,255,.02)", cursor:"pointer", transition:"all .15s" }}
              onClick={() => setPattern(wp.id)}>
              <div style={{ fontSize:13, fontWeight:600, color:pattern===wp.id ? C.kale : C.tx0, marginBottom:2 }}>{wp.label}</div>
              <div style={{ fontSize:11, color:C.tx2 }}>{wp.desc}</div>
            </div>
          ))}
        </div>
        {patternReqOpen && (
          <div style={{ marginTop:12, padding:"12px 14px", background:`${C.amber}08`, border:`.5px solid ${C.amber}25`, borderRadius:10 }}>
            {patternSent ? (
              <div style={{ textAlign:"center", padding:"8px 0" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>📤</div>
                <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Pattern change request sent!</div>
                <div style={{ fontSize:12, color:C.tx2, marginTop:4 }}>WFM will review within 2 business days.</div>
                <button onClick={() => { setPatternReqOpen(false); setPatternSent(false); setPatternNote(""); }} style={{ marginTop:10, padding:"6px 16px", borderRadius:8, background:C.kale, color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, color:C.tx2, marginBottom:6 }}>Note to WFM (optional)</div>
                <textarea value={patternNote} onChange={e=>setPatternNote(e.target.value)} placeholder="e.g. Childcare schedule changed — requesting 4×10 starting next cycle" rows={2}
                  style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box" }} />
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  <button onClick={() => setPatternReqOpen(false)} style={{ flex:1, padding:"7px 0", borderRadius:8, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:13, cursor:"pointer" }}>Cancel</button>
                  <button onClick={() => setPatternSent(true)} style={{ flex:2, padding:"7px 0", borderRadius:8, background:`linear-gradient(135deg,${C.amber},${C.amber}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}>Send request →</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Skills */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>Skills</div>
          {editingSkills
            ? <button onClick={() => setEditingSkills(false)} style={{ fontSize:11, fontWeight:600, color:"#0AC8A0", background:"rgba(10,200,160,.12)", border:`.5px solid rgba(10,200,160,.3)`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Save ✓</button>
            : <button onClick={() => setEditingSkills(true)} style={{ fontSize:11, fontWeight:600, color:C.kale, background:`${C.kale}12`, border:`.5px solid ${C.kale}30`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Edit</button>
          }
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {Object.entries(skills).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderRadius:9, background:"rgba(255,255,255,.03)" }}>
              <span style={{ fontSize:12, color:C.tx1, fontWeight:500 }}>{SKILL_LABELS[k] || k}</span>
              {editingSkills ? (
                <div style={{ display:"flex", gap:3 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} onClick={() => setSkills(s=>({...s,[k]:i}))} style={{ width:14, height:14, borderRadius:"50%", cursor:"pointer", border:`.5px solid rgba(255,255,255,.15)`, background:i<=v && v>0 ? ["","#EF9F27","#0AC8A0","#7F77DD"][v] : "rgba(255,255,255,.06)", transition:"background .15s" }} />
                  ))}
                </div>
              ) : profBar(v)}
            </div>
          ))}
        </div>
        {editingSkills && <div style={{ fontSize:11, color:C.tx2, marginTop:8, textAlign:"center" }}>Skill changes are submitted as requests and reviewed by your manager.</div>}
      </div>

      {/* Time off balances */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16, marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:12 }}>Time off remaining</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {[
            { label:"PTO",      total:pto.pto,      used:pto.usedPto,      color:C.kale,   icon:"🏖️" },
            { label:"Sick",     total:pto.sick,     used:pto.usedSick,     color:C.guava,  icon:"🤒" },
            { label:"Personal", total:pto.personal, used:pto.usedPersonal, color:C.purple, icon:"◑" },
          ].map(b => {
            const rem = b.total - b.used;
            const pct = rem / b.total;
            return (
              <div key={b.label} style={{ textAlign:"center", padding:"12px 8px", borderRadius:12, background:`${b.color}08`, border:`.5px solid ${b.color}20` }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{b.icon}</div>
                <div style={{ fontSize:22, fontWeight:800, color:b.color, lineHeight:1 }}>{rem}</div>
                <div style={{ fontSize:10, color:C.tx2, marginBottom:6 }}>of {b.total} {b.label}</div>
                <div style={{ height:4, background:"rgba(255,255,255,.08)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct*100}%`, background:b.color, borderRadius:2 }} />
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => onNav?.("timeoff")} style={{ width:"100%", marginTop:10, padding:"8px 0", borderRadius:9, background:`${C.purple}12`, color:C.purple, border:`.5px solid ${C.purple}25`, fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Request time off →
        </button>
      </div>

      {/* Team & manager */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>Team</div>
          <button onClick={() => setTeamEditOpen(o=>!o)} style={{ fontSize:11, color:C.tx2, background:"rgba(255,255,255,.05)", border:`.5px solid ${C.bd}`, borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>Request transfer</button>
        </div>
        {[
          { label:"Pillar",   val:user.pillar },
          { label:"Manager",  val:"Cyndy Boerger" },
          { label:"TL",       val:"Marcus Webb" },
          { label:"Location", val:"Remote · PT" },
          { label:"Hire date",val:"Aug 14, 2023" },
          { label:"Employee ID", val:`GUS-${(user.xp * 7 % 9999 + 10000).toString().slice(1)}` },
        ].map(r => (
          <div key={r.label} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`.5px solid rgba(255,255,255,.04)` }}>
            <span style={{ fontSize:12, color:C.tx2 }}>{r.label}</span>
            <span style={{ fontSize:12, fontWeight:500, color:C.tx0 }}>{r.val}</span>
          </div>
        ))}
        {teamEditOpen && (
          <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(127,119,221,.08)", border:`.5px solid rgba(127,119,221,.2)`, borderRadius:9 }}>
            <div style={{ fontSize:12, color:C.tx2, marginBottom:6 }}>Transfer requests are reviewed by WFM. Include your reason below.</div>
            <textarea placeholder="e.g. Interested in joining Premier DSA team" rows={2}
              style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box" }} />
            <button style={{ marginTop:8, width:"100%", padding:"7px 0", borderRadius:8, background:"rgba(127,119,221,.2)", color:"#7F77DD", border:`.5px solid rgba(127,119,221,.35)`, fontSize:13, fontWeight:600, cursor:"pointer" }}>Submit transfer request →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AGENT DASHBOARD
// ══════════════════════════════════════════════════════════════
function AgentDashboard({ user, onNav, onPri }) {
  const [schedAdjOpen, setSchedAdjOpen] = useState(false);
  const [adjType, setAdjType] = useState("swap");
  const [adjNote, setAdjNote] = useState("");
  const [adjSent, setAdjSent] = useState(false);
  const [liveTick, setLiveTick] = useState(0);
  const [refSection, setRefSection] = useState(null);
  const [kudosPanelOpen, setKudosPanelOpen] = useState(false);
  const [kudosTo, setKudosTo] = useState("LaKeisha H.");
  const [kudosMsg, setKudosMsg] = useState("");
  const [kudosSent, setKudosSent] = useState(false);
  const [receivedKudos] = useState([
    { from:"Marcus Webb",  type:"🎯", msg:"Crushed that escalation today — nicely handled!", time:"2h ago",   ck:"kale"   },
    { from:"Ashley Dickey",type:"💜", msg:"Always so helpful on the floor, appreciate you",  time:"Yesterday",ck:"purple" },
    { from:"LaKeisha H.",  type:"⚡", msg:"Fastest AHT on the team this week, keep it up!",  time:"3d ago",   ck:"amber"  },
  ]);
  useEffect(() => {
    const id = setInterval(() => setLiveTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const agent = ALL_AGENTS.find(a => a.n === user.agentName);
  const hasSched = !!agent;
  const curSeg = agent ? agent.segs.find(s => s.sh <= NOW_H && s.eh > NOW_H) : null;
  const nextSeg = agent ? agent.segs.find(s => s.sh > NOW_H) : null;
  const liveAdh = Math.min(99, (user.adherence||94) + (liveTick%7===0?-1:liveTick%11===0?1:0));
  const liveAHT = `${8}:${String(((liveTick*17+12)%59)).padStart(2,"0")}`;
  const liveContacts = 47 + Math.floor(liveTick * 0.4);
  const stateMin = Math.max(1, Math.floor(((NOW_H%1)*60 + liveTick*0.08) % 55) + 2);
  const xpToGold = 5000;
  const goldPct = Math.min(99, Math.round(user.xp / xpToGold * 100));
  const monthsLeft = Math.max(1, Math.ceil((xpToGold - user.xp) / 420));
  const goldDate = new Date(); goldDate.setMonth(goldDate.getMonth() + monthsLeft);
  const goldLabel = goldDate.toLocaleDateString("en-US", { month:"short", year:"numeric" });
  const teamPresence = [
    { n:"Ashley Dickey", status:"on",  seg:"Phone", captain:false, sup:false },
    { n:"LaKeisha H.",   status:"on",  seg:"Email", captain:true,  sup:false },
    { n:"Anthony Piper", status:"on",  seg:"Phone", captain:false, sup:false },
    { n:"Marcus Webb",   status:"on",  seg:"Ops",   captain:false, sup:true  },
    { n:"Nia W.",        status:"on",  seg:"Break", captain:false, sup:false },
    { n:"Briana Perez",  status:"off", seg:null,    captain:false, sup:false },
    { n:"Mason Amling",  status:"off", seg:null,    captain:false, sup:false },
  ];
  const onTeamCount  = teamPresence.filter(m=>m.status==="on").length;
  const breakCount   = teamPresence.filter(m=>m.seg==="Break").length;
  const offCount     = teamPresence.filter(m=>m.status==="off").length;
  const floorSup     = teamPresence.find(m=>m.sup);
  const quickRef = [
    { id:"escalation", icon:"⚡", label:"Escalation Guide", items:[
      { t:"Tier 1 → Tier 2",    d:"Billing disputes >$500 · Payroll errors · Legal threats" },
      { t:"Escalation script",  d:'"I understand — let me connect you with a specialist who can resolve this."' },
      { t:"Warm transfer tip",  d:"Brief the next agent on hold — 30-second summary before transfer" },
      { t:"Manager on-call",    d:"Marcus Webb ext. 4021 · or ping via Prism" },
    ]},
    { id:"scripts", icon:"💬", label:"Quick Scripts", items:[
      { t:"Opening",     d:'"Thank you for calling Gusto, this is Jordan. How can I help you today?"' },
      { t:"Hold",        d:'"May I place you on a brief hold while I look into this?"' },
      { t:"Empathy",     d:'"I completely understand your frustration — let me take care of this for you."' },
      { t:"Close",       d:'"Is there anything else I can help you with today? Have a great day!"' },
    ]},
    { id:"policies", icon:"📋", label:"Key Policies", items:[
      { t:"Refund window",       d:"30-day standard · 60-day with manager approval · None after 90 days" },
      { t:"Data verification",   d:"Verify last 4 SSN + company name before account access" },
      { t:"Repeat contacts",     d:"3rd contact in 7 days → auto-flag for case review" },
      { t:"After-hours hand-off",d:"Forward urgent to on-call specialist (Slack: #cx-oncall)" },
    ]},
  ];
  const board = [
    { n:"LaKeisha H.", xp:2840, r:1 }, { n:"Jordan (you)", xp:user.xp, r:2, me:true },
    { n:"Alex R.",     xp:1980, r:3 }, { n:"Nia W.",       xp:1750, r:4 },
  ];
  return (
    <div>
      {/* ─── GREETING ─── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:22, fontWeight:700, color:C.tx0, marginBottom:4, letterSpacing:"-.02em" }}>
          <TW text={`${new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}, ${user.name.split(" ")[0]}`} speed={38} />
        </div>
        <div style={{ fontSize:13, color:C.tx2 }}>{user.pillar} · {TODAY_LABEL} · {user.streak}-day streak 🔥 · {user.adherence}% adherence</div>
      </div>

      {/* ─── 1. LIVE SELF-AWARENESS STRIP ─── */}
      <div style={{ background:C.card, border:`.5px solid ${C.kale}30`, borderRadius:14, padding:"11px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:6, animation:"fade-up .4s ease .05s both", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,${C.kale}06,transparent 60%)`, pointerEvents:"none" }} />
        <div style={{ width:7, height:7, borderRadius:"50%", background:C.kale, boxShadow:`0 0 8px ${C.kale}`, flexShrink:0, animation:"lp 1.4s ease-in-out infinite" }} />
        <div style={{ fontSize:11, fontWeight:700, color:C.kale, letterSpacing:".08em", flexShrink:0, marginRight:6 }}>LIVE</div>
        {[
          { label:"AHT",        val:liveAHT,           sub:null,              color:C.tx0  },
          { label:"Adherence",  val:`${liveAdh}%`,     sub:null,              color:liveAdh>=95?"#0AC8A0":C.amber },
          { label:"State time", val:`${stateMin}m`,    sub:curSeg?.a||"Idle", color:curSeg?ac(curSeg.a):C.tx2 },
          { label:"Contacts",   val:String(liveContacts), sub:"today",        color:C.tx0  },
        ].map((m,i) => (
          <div key={m.label} style={{ flex:1, textAlign:"center", borderLeft:`1px solid ${C.bd}`, paddingLeft:8 }}>
            <div style={{ fontSize:10, color:C.tx2, marginBottom:1 }}>{m.label}</div>
            <div key={`${m.val}-${liveTick}`} style={{ fontSize:16, fontWeight:700, color:m.color, lineHeight:1, animation:"val-pop .3s ease" }}>{m.val}</div>
            {m.sub && <div style={{ fontSize:10, color:C.tx2, marginTop:1 }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* ─── QUICK ACTIONS ─── */}
      <div style={{ display:"flex", gap:7, marginBottom:14, flexWrap:"wrap", animation:"fade-up .4s ease .1s both" }}>
        {[
          { icon:"⇄",  label:"Swap shift",         color:C.kale,   action:() => onNav?.("swap")       },
          { icon:"📅",  label:"Request adjustment",  color:C.amber,  action:() => setSchedAdjOpen(true) },
          { icon:"🏖️", label:"Request time off",    color:C.purple, action:() => onNav?.("timeoff")    },
          { icon:"✦",   label:"Ask Pri",             color:C.kale,   action:() => onPri?.()             },
        ].map(a => (
          <button key={a.label} onClick={a.action}
            style={{ padding:"8px 14px", borderRadius:10, background:`${a.color}0E`, border:`.5px solid ${a.color}25`, color:a.color, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all .15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${a.color}1A`;e.currentTarget.style.borderColor=`${a.color}40`;}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${a.color}0E`;e.currentTarget.style.borderColor=`${a.color}25`;}}>
            <span>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* ─── 2. CURRENT SEGMENT + SMART NUDGE ─── */}
      {hasSched && curSeg && (
        <div style={{ background:`${ac(curSeg.a)}18`, border:`.5px solid ${ac(curSeg.a)}44`, borderRadius:14, padding:16, marginBottom:12, display:"flex", alignItems:"center", gap:14, animation:"fade-up .5s ease .2s both" }}>
          <div style={{ width:46, height:46, borderRadius:12, background:`${ac(curSeg.a)}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
            {curSeg.a==="Phone"?"📞":curSeg.a==="Break"?"☕":curSeg.a==="Lunch"?"🍱":"💬"}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:C.tx2, marginBottom:3 }}>Right now · {fmtH(NOW_H)}</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.tx0 }}>{curSeg.a}</div>
            <div style={{ fontSize:12, color:C.tx2, marginTop:2 }}>{fmtH(curSeg.sh)} – {fmtH(curSeg.eh)}</div>
            {nextSeg && Math.round((nextSeg.sh-NOW_H)*60) <= 12 && (
              <div style={{ marginTop:7, padding:"5px 10px", borderRadius:8, background:`${C.amber}12`, border:`.5px solid ${C.amber}30`, fontSize:12, color:C.amber, fontWeight:600, display:"inline-flex", alignItems:"center", gap:5 }}>
                <span>{nextSeg.a==="Break"?"☕":nextSeg.a==="Lunch"?"🍱":"⏰"}</span>
                {nextSeg.a==="Break"?`Break in ${Math.round((nextSeg.sh-NOW_H)*60)}m — wrap up your current call`:
                 nextSeg.a==="Lunch"?`Lunch in ${Math.round((nextSeg.sh-NOW_H)*60)}m — don't start a new ticket`:
                 `${nextSeg.a} in ${Math.round((nextSeg.sh-NOW_H)*60)}m`}
              </div>
            )}
          </div>
          {nextSeg && <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:11, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Next up</div>
            <div style={{ fontSize:14, fontWeight:600, color:ac(nextSeg.a) }}>{nextSeg.a}</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.amber, marginTop:2 }}>{Math.round((nextSeg.sh-NOW_H)*60)}m away</div>
          </div>}
        </div>
      )}

      {/* ─── SCHEDULE ADJUSTMENT MODAL ─── */}
      {schedAdjOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", backdropFilter:"blur(8px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e=>{ if(e.target===e.currentTarget){ setSchedAdjOpen(false); setAdjSent(false); setAdjNote(""); } }}>
          <div style={{ background:C.elev, border:`.5px solid ${C.bd}`, borderRadius:18, padding:26, width:360, boxShadow:"0 32px 80px rgba(0,0,0,.6)", animation:"fade-up .22s ease both" }}>
            {adjSent ? (
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:15, fontWeight:700, color:C.tx0, marginBottom:6 }}>Request submitted!</div>
                <div style={{ fontSize:13, color:C.tx2, marginBottom:18 }}>Your WFM team will review and respond within 4 hours. You're a great Gustie for planning ahead.</div>
                <button onClick={()=>{ setSchedAdjOpen(false); setAdjSent(false); setAdjNote(""); }} style={{ background:C.kale, color:"#fff", border:"none", borderRadius:10, padding:"10px 24px", fontSize:14, fontWeight:600, cursor:"pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:C.tx0 }}>Request schedule adjustment</div>
                  <button onClick={()=>setSchedAdjOpen(false)} style={{ background:"none", border:"none", color:C.tx2, fontSize:18, cursor:"pointer", lineHeight:1 }}>×</button>
                </div>
                <div style={{ fontSize:12, color:C.tx2, marginBottom:8 }}>Type</div>
                <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
                  {[["swap","Shift swap"],["vto","Voluntary time off"],["ot","Overtime"],["adjust","Shift adjust"],["wfh","Work from home"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setAdjType(v)} style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:adjType===v?`${C.kale}22`:"rgba(255,255,255,.04)", color:adjType===v?C.kale:C.tx2, border:`.5px solid ${adjType===v?C.kale+"55":C.bd}`, transition:"all .14s" }}>{l}</button>
                  ))}
                </div>
                <div style={{ fontSize:12, color:C.tx2, marginBottom:6 }}>Note to WFM <span style={{ color:"rgba(255,255,255,.2)" }}>(optional)</span></div>
                <textarea value={adjNote} onChange={e=>setAdjNote(e.target.value)} placeholder="e.g. Need to leave 2 hours early for a doctor's appointment" rows={3}
                  style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:10, padding:"10px 12px", fontSize:13, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box", lineHeight:1.5 }} />
                <div style={{ display:"flex", gap:8, marginTop:14 }}>
                  <button onClick={()=>setSchedAdjOpen(false)} style={{ flex:1, padding:"10px 0", borderRadius:10, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:14, cursor:"pointer" }}>Cancel</button>
                  <button onClick={()=>{ setAdjSent(true); window.prismToast?.("Adjustment request sent to your manager.","info"); }} style={{ flex:2, padding:"10px 0", borderRadius:10, background:`linear-gradient(135deg,${C.kale},${C.kale}BB)`, color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:`0 6px 20px ${C.kale}30` }}>Submit request →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── TODAY'S SCHEDULE ─── */}
      {hasSched && <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14, marginBottom:12, animation:"fade-up .5s ease .3s both" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Today · {fmtH(agent.sh)} – {fmtH(agent.se)}</div>
          <button onClick={()=>setSchedAdjOpen(true)} style={{ fontSize:11, fontWeight:600, color:C.kale, background:`${C.kale}12`, border:`.5px solid ${C.kale}30`, borderRadius:7, padding:"4px 10px", cursor:"pointer", transition:"all .14s" }}
            onMouseEnter={e=>e.currentTarget.style.background=`${C.kale}22`}
            onMouseLeave={e=>e.currentTarget.style.background=`${C.kale}12`}>Request adjustment</button>
        </div>
        <div style={{ display:"flex", height:8, gap:1, borderRadius:4, overflow:"hidden", marginBottom:10 }}>
          {agent.segs.map((s,i)=>(
            <div key={i} style={{ flex:s.eh-s.sh, background:ac(s.a), position:"relative" }}>
              {s.sh<=NOW_H&&s.eh>NOW_H && <div style={{ position:"absolute", right:0, top:0, width:2, height:"100%", background:"#fff", boxShadow:"0 0 6px #fff" }} />}
            </div>
          ))}
        </div>
        {agent.segs.map((s,i)=>{ const cur=s.sh<=NOW_H&&s.eh>NOW_H; return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 8px", borderRadius:8, background:cur?`${ac(s.a)}15`:"transparent", marginBottom:3 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:ac(s.a), flexShrink:0, boxShadow:cur?`0 0 8px ${ac(s.a)}`:"none" }} />
            <span style={{ fontSize:12, fontWeight:cur?600:400, color:cur?C.tx0:C.tx1, flex:1 }}>{s.a}</span>
            <span style={{ fontSize:11, color:C.tx2, fontFamily:"monospace" }}>{fmtH(s.sh)}–{fmtH(s.eh)}</span>
            {cur && <span style={{ fontSize:10, fontWeight:700, color:ac(s.a), padding:"1px 6px", borderRadius:8, background:`${ac(s.a)}18` }}>NOW</span>}
          </div>
        );})}
      </div>}

      {!hasSched && (
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:20, marginBottom:12, textAlign:"center", animation:"fade-up .5s ease .3s both" }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:6 }}>Schedule not yet loaded</div>
          <div style={{ fontSize:13, color:C.tx2, marginBottom:8 }}>Your schedule will appear here once connected via Workday or uploaded by WFM.</div>
          <div style={{ fontSize:12, color:C.kale }}>Pillar: {user.pillar} · Contact your WFM team for schedule access</div>
        </div>
      )}

      {/* ─── 3. IN-CALL QUICK REFERENCE ─── */}
      <div style={{ marginBottom:12, animation:"fade-up .5s ease .32s both" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>In-call reference</div>
          <span style={{ fontSize:10, color:C.tx2, background:"rgba(255,255,255,.05)", padding:"2px 7px", borderRadius:6, border:`.5px solid ${C.bd}` }}>tap to expand</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {quickRef.map(sec=>(
            <div key={sec.id} style={{ background:C.card, border:`.5px solid ${refSection===sec.id?C.kale+"44":C.bd}`, borderRadius:12, overflow:"hidden", transition:"border-color .2s" }}>
              <button onClick={()=>setRefSection(refSection===sec.id?null:sec.id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px", background:"none", border:"none", cursor:"pointer", textAlign:"left" }}>
                <span style={{ fontSize:15 }}>{sec.icon}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:C.tx0 }}>{sec.label}</span>
                <span style={{ fontSize:12, color:C.tx2, display:"inline-block", transform:refSection===sec.id?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
              </button>
              {refSection===sec.id && (
                <div style={{ padding:"0 14px 12px 14px", animation:"fade-up .18s ease both" }}>
                  {sec.items.map((item,i)=>(
                    <div key={i} style={{ display:"flex", gap:12, padding:"7px 0", borderTop:`.5px solid ${C.bd}` }}>
                      <div style={{ minWidth:110, fontSize:12, fontWeight:600, color:C.kale, flexShrink:0 }}>{item.t}</div>
                      <div style={{ fontSize:12, color:C.tx1, lineHeight:1.5 }}>{item.d}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── XP + LEADERBOARD ─── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, animation:"fade-up .5s ease .4s both" }}>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div>
              <div style={{ fontSize:11, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:2 }}>Level {user.level}</div>
              <div style={{ fontSize:30, fontWeight:800, color:C.purple, lineHeight:1 }}>{user.level}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:14, fontWeight:500, color:C.tx0 }}>{user.xp.toLocaleString()} XP</div>
              <div style={{ fontSize:11, color:C.amber, marginTop:2 }}>🔥 {user.streak}d streak</div>
              {user.streak>=7 && <div style={{ fontSize:10, color:"#0AC8A0", marginTop:2, fontWeight:600 }}>2× XP MULTIPLIER</div>}
            </div>
          </div>
          <div style={{ padding:"8px 10px", borderRadius:8, background:"rgba(127,119,221,.08)", border:".5px solid rgba(127,119,221,.25)", marginBottom:8, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:17 }}>🎯</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>Badge earned: Top 10% — Silver</div>
              <div style={{ fontSize:11, color:C.purple }}>+150 XP · Earned 2 days ago</div>
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"#C0C0C0", background:"rgba(192,192,192,.15)", padding:"2px 7px", borderRadius:6 }}>Silver</div>
          </div>
          <XPBar value={user.xp%1000} max={1000} color={C.purple} />
          <div style={{ fontSize:11, color:C.tx2, marginTop:6 }}>Schedule Sensei · {1000-(user.xp%1000)} XP to next level</div>
        </div>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:10 }}>Team leaderboard</div>
          {board.map((r,i)=>(
            <div key={r.n} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 7px", borderRadius:8, background:r.me?"rgba(10,144,144,.1)":"transparent", marginBottom:4, animation:`fade-up .3s ease ${.05*i+.3}s both` }}>
              <span style={{ fontSize:12, color:r.r<=2?C.amber:C.tx2, minWidth:14, fontWeight:500 }}>#{r.r}</span>
              <span style={{ flex:1, fontSize:12, fontWeight:r.me?600:400, color:C.tx0 }}>{r.n}</span>
              <span style={{ fontSize:12, color:C.tx1 }}>{r.xp.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PRISM SCORE ═══ */}
      <div style={{ marginTop:12, marginBottom:12, animation:"fade-up .5s ease .45s both" }}>
        <PrismScore score={Math.min(99,Math.round((user.adherence*0.5)+(Math.min(user.streak,30)/30*20)+(user.xp/2000*30)))}
          label="Your personal Gustie score"
          breakdown={[{label:"Adherence",value:user.adherence||94},{label:"Streak",value:Math.min(99,Math.round(user.streak/30*100))},{label:"XP progress",value:Math.min(99,Math.round(user.xp/2000*100))}]}
          color={C.purple} />
      </div>

      {/* ═══ PERFORMANCE STATS ═══ */}
      <div style={{ marginTop:12, animation:"fade-up .5s ease .5s both" }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:10 }}>My performance</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
          {[
            { period:"Today",      vol:47,    aht:"8:12", adh:"97%", sl:"84%", color:C.kale   },
            { period:"This week",  vol:198,   aht:"8:05", adh:"96%", sl:"82%", color:C.purple  },
            { period:"This month", vol:842,   aht:"7:58", adh:"95%", sl:"81%", color:C.amber   },
            { period:"YTD",        vol:"4.2K",aht:"8:18", adh:"94%", sl:"80%", color:C.guava   },
          ].map(s=>(
            <div key={s.period} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:12, padding:12, borderTop:`2px solid ${s.color}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:s.color, marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>{s.period}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                <div><div style={{ fontSize:11, color:C.tx2 }}>Contacts</div><div style={{ fontSize:17, fontWeight:700, color:C.tx0 }}>{s.vol}</div></div>
                <div><div style={{ fontSize:11, color:C.tx2 }}>Avg AHT</div><div style={{ fontSize:17, fontWeight:700, color:C.tx0 }}>{s.aht}</div></div>
                <div><div style={{ fontSize:11, color:C.tx2 }}>Adherence</div><div style={{ fontSize:17, fontWeight:700, color:parseFloat(s.adh)>=95?"#0AC8A0":C.amber }}>{s.adh}</div></div>
                <div><div style={{ fontSize:11, color:C.tx2 }}>SL Contrib</div><div style={{ fontSize:17, fontWeight:700, color:parseFloat(s.sl)>=80?"#0AC8A0":C.amber }}>{s.sl}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 4. GOAL TRACKING ═══ */}
      <div style={{ marginTop:12, animation:"fade-up .5s ease .52s both" }}>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Your Gustie journey</div>
              <div style={{ fontSize:12, color:C.tx2, marginTop:2 }}>Current: <span style={{ color:"#C0C0C0", fontWeight:600 }}>Silver Gustie</span></div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:C.tx2, marginBottom:2, textTransform:"uppercase", letterSpacing:".06em" }}>On track for</div>
              <div style={{ fontSize:16, fontWeight:800, background:"linear-gradient(135deg,#FFD700,#FFA500)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Gold Gustie</div>
              <div style={{ fontSize:11, color:C.amber, marginTop:1 }}>{goldLabel}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
            {[["Bronze","#CD7F32",user.xp>=1000],["Silver","#C0C0C0",user.xp>=2500],["Gold","#FFD700",user.xp>=5000],["Platinum","#E5E4E2",user.xp>=10000]].map(([tier,col,done],i)=>(
              <React.Fragment key={tier}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:done?`${col}30`:"rgba(255,255,255,.04)", border:`.5px solid ${done?col:C.bd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:done?col:C.tx2 }}>
                    {done?"★":"○"}
                  </div>
                  <div style={{ fontSize:10, color:done?col:C.tx2, fontWeight:done?600:400 }}>{tier}</div>
                </div>
                {i<3 && <div style={{ flex:1, height:2, background:done&&i<2?col:"rgba(255,255,255,.07)", borderRadius:1 }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.tx2, marginBottom:5 }}>
            <span>{user.xp.toLocaleString()} XP</span>
            <span>Goal: {xpToGold.toLocaleString()} XP</span>
          </div>
          <div style={{ height:6, background:"rgba(255,255,255,.06)", borderRadius:3, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", width:`${goldPct}%`, background:"linear-gradient(90deg,#C0C0C0,#FFD700)", borderRadius:3 }} />
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#0AC8A0", fontWeight:600 }}>✓ On track · +420 XP/month avg</span>
            <span style={{ fontSize:11, color:C.tx2 }}>{(xpToGold-user.xp).toLocaleString()} XP remaining</span>
          </div>
        </div>
      </div>

      {/* ═══ VTO OFFER ═══ */}
      <VTOWidget user={user} />

      {/* ═══ 5. PEER KUDOS ═══ */}
      <div style={{ marginTop:12, animation:"fade-up .5s ease .56s both" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Kudos</div>
          <button onClick={()=>{ setKudosPanelOpen(!kudosPanelOpen); setKudosSent(false); setKudosMsg(""); }}
            style={{ fontSize:12, fontWeight:600, color:C.purple, background:`${C.purple}12`, border:`.5px solid ${C.purple}30`, borderRadius:8, padding:"5px 12px", cursor:"pointer", transition:"all .14s" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=`${C.purple}22`; }}
            onMouseLeave={e=>{ e.currentTarget.style.background=`${C.purple}12`; }}>
            ✨ Send kudos
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:kudosPanelOpen?10:0 }}>
          {receivedKudos.map((k,i)=>{ const col=C[k.ck]||C.kale; return (
            <div key={i} style={{ background:C.card, border:`.5px solid ${col}22`, borderRadius:11, padding:"11px 14px", display:"flex", alignItems:"flex-start", gap:12, animation:`fade-up .3s ease ${i*.06}s both` }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${col}18`, border:`.5px solid ${col}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{k.type}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.tx0, marginBottom:2 }}>{k.msg}</div>
                <div style={{ fontSize:11, color:C.tx2 }}>from <span style={{ color:col, fontWeight:600 }}>{k.from}</span> · {k.time}</div>
              </div>
            </div>
          );})}
        </div>
        {kudosPanelOpen && (
          <div style={{ background:C.card, border:`.5px solid ${C.purple}30`, borderRadius:12, padding:16, animation:"fade-up .2s ease both" }}>
            {kudosSent ? (
              <div style={{ textAlign:"center", padding:"10px 0" }}>
                <div style={{ fontSize:30, marginBottom:8 }}>✨</div>
                <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:4 }}>Kudos sent to {kudosTo}!</div>
                <div style={{ fontSize:12, color:C.tx2, marginBottom:12 }}>You're making the team culture better, one kudos at a time.</div>
                <button onClick={()=>{ setKudosPanelOpen(false); setKudosSent(false); setKudosMsg(""); }}
                  style={{ background:C.purple, color:"#fff", border:"none", borderRadius:9, padding:"8px 20px", fontSize:13, fontWeight:600, cursor:"pointer" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:13, fontWeight:600, color:C.tx0, marginBottom:10 }}>Send kudos to a teammate</div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  <select value={kudosTo} onChange={e=>setKudosTo(e.target.value)}
                    style={{ flex:1, background:"rgba(255,255,255,.05)", border:`.5px solid ${C.bd}`, borderRadius:8, padding:"8px 10px", color:C.tx0, fontSize:12, outline:"none" }}>
                    {["LaKeisha H.","Ashley Dickey","Anthony Piper","Nia W.","Briana Perez","Marcus Webb"].map(n=>(
                      <option key={n} value={n} style={{ background:"#1a2035" }}>{n}</option>
                    ))}
                  </select>
                  <div style={{ display:"flex", gap:5 }}>
                    {[["🎯","Nailed it"],["💜","Support"],["⚡","Speed"],["🤝","Teamwork"]].map(([em,lb])=>(
                      <button key={em} onClick={()=>setKudosMsg(lb)} title={lb}
                        style={{ width:34, height:34, borderRadius:8, background:kudosMsg===lb?`${C.purple}22`:"rgba(255,255,255,.05)", border:`.5px solid ${kudosMsg===lb?C.purple+"44":C.bd}`, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .14s" }}>{em}</button>
                    ))}
                  </div>
                </div>
                <textarea value={kudosMsg} onChange={e=>setKudosMsg(e.target.value)}
                  placeholder="What did they do great? Be specific — it means more!" rows={2}
                  style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:8, padding:"9px 11px", fontSize:12, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box", lineHeight:1.5 }} />
                <div style={{ display:"flex", gap:7, marginTop:9 }}>
                  <button onClick={()=>setKudosPanelOpen(false)} style={{ flex:1, padding:"9px 0", borderRadius:9, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:13, cursor:"pointer" }}>Cancel</button>
                  <button onClick={()=>{ if(kudosMsg.trim()){ setKudosSent(true); playSound("approve"); window.prismToast?.(`Kudos sent to ${kudosTo}! 🌟`,"success"); }}}
                    style={{ flex:2, padding:"9px 0", borderRadius:9, background:`linear-gradient(135deg,${C.purple},${C.purple}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 16px ${C.purple}28`, opacity:kudosMsg.trim()?1:.5, transition:"opacity .15s" }}>
                    Send kudos ✨
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ 6. TEAM PRESENCE ═══ */}
      <div style={{ marginTop:12, marginBottom:12, animation:"fade-up .5s ease .58s both" }}>
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Who's on today</div>
            {floorSup && <div style={{ fontSize:12, color:C.tx2 }}>Floor lead: <span style={{ color:C.kale, fontWeight:600 }}>{floorSup.n}</span></div>}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {teamPresence.map((m,i)=>{
              const presColor = m.sup?C.kale:m.captain?C.amber:C.tx2;
              const dotColor  = m.seg==="Break"?C.amber:"#0AC8A0";
              return (
                <div key={m.n} title={`${m.n} · ${m.status==="on"?m.seg:"Off shift"}`}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"9px 10px", borderRadius:11, background:m.status==="on"?`${presColor}08`:"transparent", border:`.5px solid ${m.status==="on"?presColor+"30":C.bd+"44"}`, minWidth:62, opacity:m.status==="on"?1:.38, position:"relative" }}>
                  <div style={{ width:34, height:34, borderRadius:"50%", background:`${presColor}18`, border:`.5px solid ${presColor}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:presColor }}>
                    {m.n.split(" ").map(w=>w[0]).join("").slice(0,2)}
                  </div>
                  <div style={{ fontSize:10, color:m.status==="on"?C.tx1:C.tx2, textAlign:"center", lineHeight:1.3, fontWeight:m.sup||m.captain?600:400 }}>{m.n.split(" ")[0]}</div>
                  {m.sup  && <div style={{ fontSize:9, color:C.kale,  fontWeight:700, letterSpacing:".04em" }}>SUP</div>}
                  {m.captain&&!m.sup && <div style={{ fontSize:9, color:C.amber, fontWeight:700, letterSpacing:".04em" }}>CAP</div>}
                  {m.status==="on" && <div style={{ position:"absolute", top:7, right:7, width:7, height:7, borderRadius:"50%", background:dotColor, boxShadow:`0 0 5px ${dotColor}` }} />}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:C.tx2, display:"flex", alignItems:"center", gap:4 }}><span style={{ width:7,height:7,borderRadius:"50%",background:"#0AC8A0",display:"inline-block" }} />Active ({onTeamCount-breakCount})</span>
            <span style={{ fontSize:11, color:C.tx2, display:"flex", alignItems:"center", gap:4 }}><span style={{ width:7,height:7,borderRadius:"50%",background:C.amber,display:"inline-block" }} />On break ({breakCount})</span>
            <span style={{ fontSize:11, color:C.tx2, display:"flex", alignItems:"center", gap:4, opacity:.5 }}><span style={{ width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,.18)",display:"inline-block" }} />Off today ({offCount})</span>
          </div>
        </div>
      </div>

      {/* ═══ DAILY CHALLENGES ═══ */}
      <div style={{ marginTop:4, animation:"fade-up .5s ease .6s both" }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
          Daily challenges
          <span style={{ fontSize:11, fontWeight:600, color:C.amber, background:"rgba(239,159,39,.12)", padding:"2px 8px", borderRadius:8, border:".5px solid rgba(239,159,39,.3)" }}>2/3 complete</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:8 }}>
          {[
            { name:"Speed Demon",    desc:"Handle 5 calls under 7 min AHT", progress:5, goal:5, xp:25, done:true,  icon:"⚡" },
            { name:"Inbox Zero",     desc:"Clear 10 email contacts",          progress:8, goal:10,xp:20, done:false, icon:"📧" },
            { name:"Streak Builder", desc:"Stay adherent all day",            progress:1, goal:1, xp:30, done:true,  icon:"🔥" },
          ].map(ch=>(
            <div key={ch.name} style={{ background:ch.done?"rgba(10,200,150,.06)":C.card, border:`.5px solid ${ch.done?"rgba(10,200,150,.25)":C.bd}`, borderRadius:10, padding:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:17 }}>{ch.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>{ch.name}</div>
                  <div style={{ fontSize:11, color:C.tx2 }}>{ch.desc}</div>
                </div>
              </div>
              <div style={{ height:4, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden", marginBottom:6 }}>
                <div style={{ height:"100%", width:`${ch.progress/ch.goal*100}%`, background:ch.done?"#0AC8A0":C.amber, borderRadius:2 }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:ch.done?"#0AC8A0":C.tx2, fontWeight:ch.done?600:400 }}>{ch.done?"Complete!":`${ch.progress}/${ch.goal}`}</span>
                <span style={{ fontSize:11, color:C.purple, fontWeight:600 }}>+{ch.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── QUEUE VIEW ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// QUEUE ANALYTICS — Verint-level depth, ClearCast data
// ══════════════════════════════════════════════════════════════
const INTRADAY = [
  { t:"6:00",fv:12,av:10,fSL:92,aSL:94,adh:97,asa:8 },
  { t:"6:30",fv:18,av:16,fSL:90,aSL:92,adh:96,asa:12 },
  { t:"7:00",fv:22,av:20,fSL:88,aSL:90,adh:96,asa:18 },
  { t:"7:30",fv:28,av:30,fSL:86,aSL:84,adh:95,asa:22 },
  { t:"8:00",fv:38,av:42,fSL:84,aSL:80,adh:94,asa:28,miss:true },
  { t:"8:30",fv:48,av:52,fSL:82,aSL:76,adh:93,asa:35,miss:true },
  { t:"9:00",fv:58,av:65,fSL:80,aSL:72,adh:92,asa:42,miss:true },
  { t:"9:30",fv:62,av:60,fSL:80,aSL:78,adh:93,asa:38 },
  { t:"10:00",fv:58,av:55,fSL:82,aSL:82,adh:94,asa:30 },
  { t:"10:30",fv:55,av:47,fSL:82,aSL:85,adh:94,asa:24,now:true },
  { t:"11:00",fv:51,fSL:83,asa:20 },
  { t:"11:30",fv:48,fSL:83,asa:18 },
  { t:"12:00",fv:42,fSL:84,asa:16 },
  { t:"12:30",fv:38,fSL:85,asa:14 },
  { t:"13:00",fv:44,fSL:84,asa:18 },
  { t:"13:30",fv:50,fSL:82,asa:22 },
  { t:"14:00",fv:52,fSL:81,asa:26 },
  { t:"14:30",fv:48,fSL:82,asa:22 },
  { t:"15:00",fv:42,fSL:84,asa:18 },
  { t:"15:30",fv:35,fSL:86,asa:14 },
  { t:"16:00",fv:28,fSL:88,asa:10 },
  { t:"16:30",fv:20,fSL:90,asa:8 },
  { t:"17:00",fv:14,fSL:92,asa:6 },
  { t:"17:30",fv:8,fSL:94,asa:4 },
];

function SLRing({ sl, tgt = 80, size = 52 }) {
  const cc = sl >= tgt ? "#0AC8A0" : sl >= tgt - 10 ? C.amber : C.guava;
  const r = size * 0.36, circ = 2 * Math.PI * r;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={cc} strokeWidth="4"
          strokeDasharray={circ.toFixed(1)} strokeDashoffset={(circ * (1 - sl / 100)).toFixed(1)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s ease, stroke .4s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700, color: cc }}>{sl}%</div>
        <div style={{ fontSize: size * 0.14, color: C.tx2 }}>SL</div>
      </div>
    </div>
  );
}

function QueueLiveCard({ name, sl, wait, asa, tgt = 80 }) {
  const crit = sl < tgt - 10, bad = sl < tgt;
  const bc = crit ? C.guava : bad ? C.amber : "#0AC8A0";
  return (
    <div style={{ background: C.card, border: `.5px solid ${crit ? "rgba(244,93,72,.4)" : bad ? "rgba(239,159,39,.35)" : "rgba(10,144,144,.25)"}`, borderRadius: 12, padding: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: bc, animation: "lp 2s ease-in-out infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: C.tx0, flex: 1 }}>{name}</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: `${bc}18`, color: bc, border: `.5px solid ${bc}44` }}>
          {crit ? "CRITICAL" : bad ? "WARNING" : "ON TARGET"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: wait > 5 ? C.guava : wait > 2 ? C.amber : C.tx0, lineHeight: 1, transition: "color .4s" }}>{wait}</div><div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>waiting</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: C.tx0, lineHeight: 1 }}>{asa}s</div><div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>ASA</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: C.tx0, lineHeight: 1 }}>87%</div><div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>Occ</div></div>
        </div>
        <SLRing sl={sl} tgt={tgt} />
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, color, small }) {
  return (
    <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: small ? 8 : 10, padding: small ? "8px 10px" : "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 20, fontWeight: 700, color: color || C.tx0, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.tx2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, f, a, color, unit="" }) {
  if (!f && !a) return null;
  const vp = f > 0 ? ((a - f) / f * 100) : 0;
  const vc = Math.abs(vp) <= 5 ? "#0AC8A0" : Math.abs(vp) <= 12 ? C.amber : C.guava;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: C.tx0 }}>{label}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.tx2 }}>F: {f.toLocaleString()}{unit}</span>
          <span style={{ fontSize: 11, color: C.tx0, fontWeight: 500 }}>A: {a.toLocaleString()}{unit}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: vc }}>{vp >= 0 ? "+" : ""}{vp.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3 }}>
        <div style={{ flex: f, background: color, borderRadius: 3, opacity: 0.35 }} />
        <div style={{ flex: a, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function QueueView({ role }) {
  const { forecastData, loading, lastUpdated, refreshData } = useForecast();
  const [tab, setTab] = useState("overview");
  const [selCat, setSelCat] = useState(null);
  const [live, setLive] = useState({ sl: 82, wait: 4, asa: 38, sl2: 68, wait2: 7, asa2: 78 });

  useEffect(() => {
    const t = setInterval(() => {
      setLive(q => ({
        sl: Math.max(60, Math.min(99, q.sl + Math.round((Math.random() - .45) * 3))),
        wait: Math.max(0, q.wait + Math.round((Math.random() - .45) * 2)),
        asa: Math.max(10, q.asa + Math.round((Math.random() - .5) * 8)),
        sl2: Math.max(55, Math.min(99, q.sl2 + Math.round((Math.random() - .45) * 3))),
        wait2: Math.max(0, q.wait2 + Math.round((Math.random() - .4) * 2)),
        asa2: Math.max(20, q.asa2 + Math.round((Math.random() - .5) * 10)),
      }));
    }, 3800);
    return () => clearInterval(t);
  }, []);

  // Aggregate CT data by category for the table
  const catData = useMemo(() => {
    const base = forecastData?.length ? forecastData : CC_GROUPS;
    const map = {};
    for (const ct of base) {
      const cat = ct.category;
      if (!map[cat]) map[cat] = { q: 0, fV: 0, aV: 0, wk: 0, trend: 0, trendCount: 0, slSum: 0, slCount: 0, slT: 0, phFV: 0, phAV: 0, emFV: 0, emAV: 0, chFV: 0, chAV: 0, fte: 0 };
      const c = map[cat];
      c.q++;
      c.fV += ct.forecastVolume;
      c.aV += ct.actualVolume;
      c.wk += ct.weeklyForecastVolume || 0;
      if (ct.weeklyTrend != null) { c.trend += ct.weeklyTrend; c.trendCount++; }
      if (ct.serviceLevel > 0) { c.slSum += ct.serviceLevel; c.slCount++; }
      if ((ct.slTarget || 0) > c.slT) c.slT = ct.slTarget;
      if (ct.weeklyForecastVolume && ct.forecastAHT) {
        c.fte += calculateStaffing(ct.weeklyForecastVolume, ct.forecastAHT / 60, 0.85).fte;
      }
      const ch = ct.channel;
      if (ch === 'Phone')      { c.phFV += ct.forecastVolume; c.phAV += ct.actualVolume; }
      else if (ch === 'Email') { c.emFV += ct.forecastVolume; c.emAV += ct.actualVolume; }
      else if (ch === 'Chat')  { c.chFV += ct.forecastVolume; c.chAV += ct.actualVolume; }
    }
    for (const cat of Object.keys(map)) {
      const c = map[cat];
      c.sl = c.slCount > 0 ? Math.round(c.slSum / c.slCount) : 0;
      c.avgTrend = c.trendCount > 0 ? +(c.trend / c.trendCount).toFixed(1) : 0;
      c.fte = Math.ceil(c.fte);
      // Simple projected SL: current SL adjusted for volume overrun
      const varRatio = c.fV > 0 ? c.aV / c.fV : 1;
      c.projSL = c.sl > 0 ? Math.max(40, Math.min(99, Math.round(c.sl * (2 - varRatio)))) : 0;
    }
    return map;
  }, [forecastData]);

  const cats = Object.keys(catData);
  const d = selCat ? catData[selCat] : null;

  const totFV = cats.reduce((s, c) => s + catData[c].fV, 0);
  const totAV = cats.reduce((s, c) => s + catData[c].aV, 0);
  const totVar = totFV > 0 ? ((totAV - totFV) / totFV * 100) : 0;
  const totWk = cats.reduce((s, c) => s + catData[c].wk, 0);

  const vColor = (pct) => Math.abs(pct) <= 5 ? "#0AC8A0" : Math.abs(pct) <= 12 ? C.amber : C.guava;
  const slColor = (sl, tgt) => !sl ? C.tx2 : sl >= tgt ? "#0AC8A0" : sl >= tgt - 10 ? C.amber : C.guava;

  const tabs = [["overview","Overview"],["intraday","Intraday F vs A"],["agents","Agent Performance"]];
  const src = lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : "ClearCast static data";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 4 }}>Queue Analytics</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.tx2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0AC8A0", animation: "lp 2s ease-in-out infinite", flexShrink: 0 }} />
            Live · {src} · {cats.length} categories · {CC_GROUPS.length} CTs
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={refreshData} style={{ padding: "5px 11px", borderRadius: 8, background: "rgba(10,128,128,.12)", color: C.kale, border: `.5px solid rgba(10,128,128,.3)`, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>↻ Refresh</button>
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 3 }}>
            {tabs.map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: tab === v ? "rgba(255,255,255,.1)" : "none", color: tab === v ? C.tx0 : C.tx2, border: tab === v ? `.5px solid ${C.bd}` : "none", fontWeight: tab === v ? 500 : 400, transition: "all .15s" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Global stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { l: "MTD Forecast", v: totFV.toLocaleString(), c: C.tx0 },
          { l: "MTD Actual", v: totAV.toLocaleString(), c: C.tx0 },
          { l: "Variance", v: `${totVar >= 0 ? "+" : ""}${totVar.toFixed(1)}%`, c: vColor(totVar) },
          { l: "Wkly Forecast", v: totWk.toLocaleString(), c: C.purple },
          { l: "Categories", v: cats.length, c: C.kale },
        ].map(k => (
          <div key={k.l} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Category selector */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setSelCat(null)} style={{ padding: "3px 11px", borderRadius: 14, fontSize: 12, fontWeight: 500, cursor: "pointer", background: !selCat ? "rgba(10,128,128,.18)" : "rgba(255,255,255,.05)", color: !selCat ? C.kale : C.tx2, border: `.5px solid ${!selCat ? "rgba(10,128,128,.44)" : C.bd}` }}>All queues</button>
        {cats.map(cat => {
          const c = catData[cat];
          const sc = slColor(c.sl, c.slT);
          return (
            <button key={cat} onClick={() => setSelCat(cat)} style={{ padding: "3px 11px", borderRadius: 14, fontSize: 12, fontWeight: 500, cursor: "pointer", background: selCat === cat ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.05)", color: selCat === cat ? C.tx0 : C.tx2, border: `.5px solid ${selCat === cat ? "rgba(255,255,255,.2)" : C.bd}`, display: "flex", alignItems: "center", gap: 5 }}>
              {cat}
              {c.sl > 0 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc }} />}
            </button>
          );
        })}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === "overview" && !selCat && (
        <div>
          {/* Live pulse cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 14 }}>
            <QueueLiveCard name="Payroll/Taxes · Phone" sl={live.sl} wait={live.wait} asa={live.asa} tgt={80} />
            <QueueLiveCard name="Benefits · Phone"      sl={live.sl2} wait={live.wait2} asa={live.asa2} tgt={80} />
            <QueueLiveCard name="Onboarding · Phone"    sl={88} wait={2} asa={22} tgt={85} />
          </div>

          {/* Full category table — now powered by ClearCast data */}
          <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14, overflowX: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 12 }}>All categories · MTD + weekly forecast</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `.5px solid ${C.bd}` }}>
                  {["Category","CTs","Fcst Vol","Actual","Var%","SL","Tgt","Proj SL","Wkly Fcst","Trend","Est FTE"].map((h,i) => (
                    <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 7px", fontSize: 10, color: C.tx2, fontWeight: 400, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.map(cat => {
                  const c = catData[cat];
                  const vp = c.fV > 0 ? ((c.aV - c.fV) / c.fV * 100) : 0;
                  const vc = vColor(vp);
                  const sc = slColor(c.sl, c.slT);
                  const pc = slColor(c.projSL, c.slT);
                  const tc = c.avgTrend >= 0 ? "#0AC8A0" : C.guava;
                  return (
                    <tr key={cat} onClick={() => setSelCat(cat)} style={{ borderBottom: `.5px solid rgba(255,255,255,.04)`, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "6px 7px", fontWeight: 500, color: C.tx0, whiteSpace: "nowrap" }}>{cat}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", color: C.tx2 }}>{c.q}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", color: C.tx2 }}>{c.fV.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", fontWeight: 500, color: C.tx0 }}>{c.aV.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", fontWeight: 600, color: vc }}>{vp >= 0 ? "+" : ""}{vp.toFixed(1)}%</td>
                      <td style={{ textAlign: "right", padding: "6px 7px" }}>
                        {c.sl > 0 ? <span style={{ fontWeight: 600, color: sc }}>{c.sl}%</span> : <span style={{ color: C.tx2 }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 7px", color: C.tx2 }}>{c.slT > 0 ? c.slT + "%" : "—"}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px" }}>
                        {c.projSL > 0 ? <span style={{ fontWeight: 600, color: pc }}>{c.projSL}%</span> : <span style={{ color: C.tx2 }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", padding: "6px 7px", color: C.purple, fontWeight: 500 }}>{c.wk.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", fontWeight: 600, color: tc }}>{c.avgTrend >= 0 ? "+" : ""}{c.avgTrend}%</td>
                      <td style={{ textAlign: "right", padding: "6px 7px", color: C.kale, fontWeight: 600 }}>{c.fte}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ CATEGORY DRILL-DOWN ═══ */}
      {tab === "overview" && selCat && d && (
        <div>
          <button onClick={() => setSelCat(null)} style={{ padding: "6px 12px", borderRadius: 9, background: "rgba(255,255,255,.08)", color: C.tx1, border: `.5px solid ${C.bd}`, fontSize: 12, cursor: "pointer", fontWeight: 500, marginBottom: 14 }}>← All categories</button>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.tx0, marginBottom: 14 }}>{selCat} · {d.q} CTs · {d.fte} est FTE</div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Forecast Volume", v: d.fV.toLocaleString(), c: C.tx0 },
              { l: "Actual Volume", v: d.aV.toLocaleString(), c: C.tx0 },
              { l: "Variance", v: `${d.fV>0 ? ((d.aV-d.fV)/d.fV*100 >= 0 ? "+" : "") + ((d.aV-d.fV)/d.fV*100).toFixed(1) + "%" : "—"}`, c: vColor(d.fV>0 ? (d.aV-d.fV)/d.fV*100 : 0) },
              { l: "Service Level", v: d.sl > 0 ? d.sl + "%" : "—", c: slColor(d.sl, d.slT) },
              { l: "Projected SL", v: d.projSL > 0 ? d.projSL + "%" : "—", c: slColor(d.projSL, d.slT) },
              { l: "Weekly Forecast", v: d.wk.toLocaleString(), c: C.purple },
              { l: "Avg Trend", v: `${d.avgTrend >= 0 ? "+" : ""}${d.avgTrend}%`, c: d.avgTrend >= 0 ? "#0AC8A0" : C.guava },
              { l: "Est FTE", v: d.fte, c: C.kale },
            ].map(k => (
              <div key={k.l} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k.l}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Channel breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[["Phone", d.phFV, d.phAV, "#0A9090"], ["Email", d.emFV, d.emAV, "#185FA5"], ["Chat", d.chFV, d.chAV, "#2BABAD"]].map(([label, fV, aV, color]) => {
              if (!fV && !aV) return null;
              const vp = fV > 0 ? ((aV - fV) / fV * 100) : 0;
              return (
                <div key={label} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.tx0 }}>{label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.tx2 }}>Forecast</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.tx1 }}>{fV.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.tx2 }}>Actual</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.tx0 }}>{aV.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: vColor(vp) }}>{vp >= 0 ? "+" : ""}{vp.toFixed(1)}% variance</div>
                </div>
              );
            })}
          </div>

          {/* CT table for this category */}
          <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14, overflowX: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 10 }}>Contact types in {selCat}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `.5px solid ${C.bd}` }}>
                  {["CT Name","Channel","Fcst Vol","Actual","Var%","Fcst AHT","Act AHT","SL","Tgt","Wkly Fcst","Trend"].map((h,i) => (
                    <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "4px 7px", fontSize: 10, color: C.tx2, fontWeight: 400, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(forecastData?.length ? forecastData : CC_GROUPS).filter(g => g.category === selCat).map(g => {
                  const vp = g.forecastVolume > 0 ? ((g.actualVolume - g.forecastVolume) / g.forecastVolume * 100) : 0;
                  const va = g.forecastAHT > 0 && g.actualAHT > 0 ? ((g.actualAHT - g.forecastAHT) / g.forecastAHT * 100) : 0;
                  return (
                    <tr key={g.id} style={{ borderBottom: `.5px solid rgba(255,255,255,.04)` }}>
                      <td style={{ padding: "5px 7px", color: C.tx0, fontWeight: 500, whiteSpace: "nowrap" }}>{g.name}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: C.tx2 }}>{g.channel}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: C.tx2 }}>{g.forecastVolume.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", fontWeight: 500, color: C.tx0 }}>{g.actualVolume.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", fontWeight: 600, color: vColor(vp) }}>{vp >= 0 ? "+" : ""}{vp.toFixed(1)}%</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: C.tx1 }}>{g.forecastAHT}s</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: g.actualAHT > 0 ? C.tx0 : C.tx2 }}>{g.actualAHT > 0 ? g.actualAHT + "s" : "—"}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px" }}>
                        {g.serviceLevel > 0 ? <span style={{ fontWeight: 600, color: slColor(g.serviceLevel, g.slTarget) }}>{g.serviceLevel}%</span> : <span style={{ color: C.tx2 }}>—</span>}
                      </td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: C.tx2 }}>{g.slTarget > 0 ? g.slTarget + "%" : "—"}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", color: C.purple, fontWeight: 500 }}>{(g.weeklyForecastVolume || 0).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "5px 7px", fontWeight: 600, color: (g.weeklyTrend ?? 0) >= 0 ? "#0AC8A0" : C.guava }}>{(g.weeklyTrend ?? 0) >= 0 ? "+" : ""}{(g.weeklyTrend ?? 0).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ INTRADAY TAB ═══ */}
      {tab === "intraday" && (
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 6 }}>Intraday F vs A</div>
          <div style={{ fontSize: 13, color: C.tx2 }}>Half-hour interval forecast vs actual requires live NICE IEX connection.<br/>Data will appear here when the ClearCast backend is running.</div>
          <button onClick={refreshData} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 9, background: `linear-gradient(135deg,${C.kale},#0AB0B0)`, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Connect to ClearCast</button>
        </div>
      )}

      {/* ═══ AGENT PERFORMANCE TAB ═══ */}
      {tab === "agents" && (
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 12 }}>Agent Performance · Payroll/Taxes</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `.5px solid ${C.bd}` }}>
                {["Agent","Contacts","AHT","Adherence","SL","Occupancy"].map((h,i) => (
                  <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "5px 8px", fontSize: 10, color: C.tx2, fontWeight: 400, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { n: "Anthony Piper",    v: 412, aht: 498, adh: 97, sl: 84, occ: 89 },
                { n: "Briana Perez",     v: 389, aht: 512, adh: 94, sl: 82, occ: 87 },
                { n: "Claudia Lizama",   v: 378, aht: 532, adh: 91, sl: 79, occ: 84 },
                { n: "LaKeisha Hemphill",v: 401, aht: 495, adh: 98, sl: 86, occ: 91 },
                { n: "Donna Jo Doney",   v: 356, aht: 548, adh: 89, sl: 76, occ: 82 },
                { n: "Hermes Diaz",      v: 394, aht: 505, adh: 96, sl: 83, occ: 88 },
                { n: "Jazz Eaton",       v: 368, aht: 518, adh: 93, sl: 81, occ: 86 },
                { n: "Kelly Joe",        v: 345, aht: 555, adh: 90, sl: 78, occ: 83 },
              ].map(a => (
                <tr key={a.n} style={{ borderBottom: `.5px solid rgba(255,255,255,.04)` }}>
                  <td style={{ padding: "7px 8px", fontWeight: 500, color: C.tx0 }}>{a.n}</td>
                  <td style={{ textAlign: "right", padding: "7px 8px", color: C.tx0 }}>{a.v}</td>
                  <td style={{ textAlign: "right", padding: "7px 8px", color: C.tx1 }}>{a.aht}s</td>
                  <td style={{ textAlign: "right", padding: "7px 8px", fontWeight: 600, color: a.adh >= 95 ? "#0AC8A0" : a.adh >= 90 ? C.amber : C.guava }}>{a.adh}%</td>
                  <td style={{ textAlign: "right", padding: "7px 8px", fontWeight: 600, color: a.sl >= 80 ? "#0AC8A0" : C.amber }}>{a.sl}%</td>
                  <td style={{ textAlign: "right", padding: "7px 8px", color: a.occ >= 85 ? C.tx0 : C.amber }}>{a.occ}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ─── ROSTER ADMIN PANEL ───────────────────────────────────────
function RosterAdminPanel({ agent, onClose }) {
  const [wPattern, setWPattern] = useState("5x8");
  const [skillMap, setSkillMap] = useState({ phone:2, email:2, chat:1, cobra:0, fein:1, cancel:1 });
  const [editSkills, setEditSkills] = useState(false);
  const [managerEdit, setManagerEdit] = useState(false);
  const [newManager, setNewManager] = useState("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateStep, setTerminateStep] = useState(1);
  const [termConfirm, setTermConfirm] = useState("");

  const profColor = (v) => ["rgba(255,255,255,.08)","#EF9F27","#0AC8A0","#7F77DD"][v] || "rgba(255,255,255,.08)";

  return (
    <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:10 }}>

      {/* Work pattern */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.tx0, marginBottom:10 }}>Work pattern</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6 }}>
          {WORK_PATTERNS.map(wp => (
            <div key={wp.id} onClick={() => setWPattern(wp.id)}
              style={{ padding:"8px 10px", borderRadius:9, border:`.5px solid ${wPattern===wp.id ? C.kale+"55" : C.bd}`, background:wPattern===wp.id ? `${C.kale}10` : "rgba(255,255,255,.02)", cursor:"pointer", transition:"all .15s" }}>
              <div style={{ fontSize:12, fontWeight:600, color:wPattern===wp.id ? C.kale : C.tx0 }}>{wp.label}</div>
              <div style={{ fontSize:10, color:C.tx2 }}>{wp.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills editor */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.tx0 }}>Skills</div>
          {editSkills
            ? <button onClick={() => setEditSkills(false)} style={{ fontSize:11, fontWeight:600, color:"#0AC8A0", background:"rgba(10,200,160,.12)", border:`.5px solid rgba(10,200,160,.3)`, borderRadius:6, padding:"3px 9px", cursor:"pointer" }}>Save ✓</button>
            : <button onClick={() => setEditSkills(true)} style={{ fontSize:11, fontWeight:600, color:C.kale, background:`${C.kale}12`, border:`.5px solid ${C.kale}30`, borderRadius:6, padding:"3px 9px", cursor:"pointer" }}>Edit</button>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {Object.entries(skillMap).map(([k,v]) => (
            <div key={k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 8px", borderRadius:8, background:"rgba(255,255,255,.03)" }}>
              <span style={{ fontSize:12, color:C.tx1 }}>{SKILL_LABELS[k]||k}</span>
              {editSkills ? (
                <div style={{ display:"flex", gap:3 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} onClick={() => setSkillMap(s=>({...s,[k]:i}))}
                      style={{ width:12, height:12, borderRadius:"50%", cursor:"pointer", background: i<=v && v>0 ? profColor(v) : "rgba(255,255,255,.06)", border:`.5px solid rgba(255,255,255,.1)`, transition:"background .15s" }} />
                  ))}
                </div>
              ) : (
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3].map(i => <div key={i} style={{ width:14, height:4, borderRadius:2, background: i<=v ? profColor(v) : "rgba(255,255,255,.08)" }} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Manager / team assignment */}
      <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.tx0 }}>Manager & team</div>
          <button onClick={() => setManagerEdit(o=>!o)} style={{ fontSize:11, color:C.tx2, background:"rgba(255,255,255,.05)", border:`.5px solid ${C.bd}`, borderRadius:6, padding:"3px 9px", cursor:"pointer" }}>Change</button>
        </div>
        {[["Pillar", agent.pillar||"—"],["Manager","Cyndy Boerger"],["Team Lead","Marcus Webb"]].map(([l,v]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`.5px solid rgba(255,255,255,.04)` }}>
            <span style={{ fontSize:11, color:C.tx2 }}>{l}</span>
            <span style={{ fontSize:11, fontWeight:500, color:C.tx0 }}>{v}</span>
          </div>
        ))}
        {managerEdit && (
          <div style={{ marginTop:10 }}>
            <select value={newManager} onChange={e=>setNewManager(e.target.value)}
              style={{ width:"100%", background:C.surf, border:`.5px solid ${C.bd}`, borderRadius:8, padding:"7px 10px", color:C.tx0, fontSize:12, marginBottom:6, outline:"none" }}>
              <option value="">Select new manager</option>
              {["Cyndy Boerger","Marcus Webb","Tanya Reid","Jerome Okafor"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button style={{ width:"100%", padding:"7px 0", borderRadius:8, background:`${C.kale}18`, color:C.kale, border:`.5px solid ${C.kale}35`, fontSize:12, fontWeight:600, cursor:"pointer" }}>Reassign →</button>
          </div>
        )}
      </div>

      {/* Terminate */}
      <div style={{ background:"rgba(244,93,72,.04)", border:".5px solid rgba(244,93,72,.2)", borderRadius:14, padding:14 }}>
        {!terminateOpen ? (
          <button onClick={() => setTerminateOpen(true)}
            style={{ width:"100%", padding:"9px 0", borderRadius:9, background:"rgba(244,93,72,.1)", color:C.guava, border:`.5px solid rgba(244,93,72,.25)`, fontSize:13, fontWeight:600, cursor:"pointer", transition:"all .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(244,93,72,.18)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(244,93,72,.1)"}>
            Terminate employee
          </button>
        ) : terminateStep === 1 ? (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.guava, marginBottom:6 }}>Terminate {agent.n}?</div>
            <div style={{ fontSize:12, color:C.tx2, marginBottom:12 }}>This action will revoke platform access, close pending approvals, and archive the agent's schedule. It cannot be undone from this interface.</div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setTerminateOpen(false)} style={{ flex:1, padding:"7px 0", borderRadius:8, background:"rgba(255,255,255,.06)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => setTerminateStep(2)} style={{ flex:2, padding:"7px 0", borderRadius:8, background:"rgba(244,93,72,.15)", color:C.guava, border:`.5px solid rgba(244,93,72,.3)`, fontSize:12, fontWeight:700, cursor:"pointer" }}>Continue →</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.guava, marginBottom:6 }}>Type the agent's name to confirm</div>
            <input value={termConfirm} onChange={e=>setTermConfirm(e.target.value)} placeholder={agent.n}
              style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid rgba(244,93,72,.3)`, borderRadius:8, padding:"8px 10px", fontSize:12, color:C.tx0, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => { setTerminateStep(1); setTerminateOpen(false); setTermConfirm(""); }} style={{ flex:1, padding:"7px 0", borderRadius:8, background:"rgba(255,255,255,.06)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button disabled={termConfirm.trim().toLowerCase() !== agent.n.toLowerCase()}
                onClick={() => onClose()}
                style={{ flex:2, padding:"7px 0", borderRadius:8, background: termConfirm.trim().toLowerCase()===agent.n.toLowerCase() ? C.guava : "rgba(244,93,72,.12)", color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor: termConfirm.trim().toLowerCase()===agent.n.toLowerCase() ? "pointer" : "not-allowed", opacity: termConfirm.trim().toLowerCase()===agent.n.toLowerCase() ? 1 : .5 }}>
                Confirm termination
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROSTER ───────────────────────────────────────────────────
function RosterView() {
  const [selPillar, setSelPillar] = useState(null);
  const [selPE, setSelPE] = useState(null);
  const [selAgent, setSelAgent] = useState(null);
  const [search, setSearch] = useState("");
  const DAY_START = 6, DAY_SPAN = 13;

  // All pillars from FULL_ROSTER
  const pillarNames = Object.keys(FULL_ROSTER);
  const totalAgents = pillarNames.reduce((s, p) => s + FULL_ROSTER[p].a.length, 0);

  // Current pillar data
  const pillarData = selPillar ? FULL_ROSTER[selPillar] : null;
  const pillarColor = pillarData ? pillarData.c : C.kale;

  // Filter agents by search and PE
  const filteredAgents = pillarData
    ? pillarData.a.filter(a => {
        const nameMatch = !search || a[0].toLowerCase().includes(search.toLowerCase());
        const peMatch = !selPE || a[1] === selPE;
        return nameMatch && peMatch;
      })
    : [];

  // Check if agent has schedule data
  const hasSchedule = (name) => ALL_AGENTS.some(a => a.n === name);
  const getSchedule = (name) => ALL_AGENTS.find(a => a.n === name);

  // PILLAR OVERVIEW (no pillar selected)
  if (!selPillar) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 4 }}>Unified roster · {totalAgents} agents · 11 pillars</div>
          <div style={{ fontSize: 13, color: C.tx2 }}>Source: WFM Unified Roster · All Pillars · Live data</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {pillarNames.map(pName => {
            const pd = FULL_ROSTER[pName];
            return (
              <div key={pName} onClick={() => setSelPillar(pName)}
                style={{ background: C.card, border: ".5px solid " + C.bd, borderRadius: 14, padding: 18, cursor: "pointer", transition: "all .2s", borderLeft: "3px solid " + pd.c }}
                onMouseEnter={e => { e.currentTarget.style.background = C.elev; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.transform = "none"; }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 4 }}>{pName}</div>
                    <div style={{ fontSize: 12, color: C.tx2 }}>{pd.m.length} managers</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: pd.c, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1 }}>{pd.a.length}</div>
                </div>
                <XPBar value={pd.a.length} max={350} color={pd.c} />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {pd.m.slice(0, 3).map(m => (
                    <span key={m} style={{ fontSize: 10, color: C.tx2, background: "rgba(255,255,255,.05)", padding: "1px 6px", borderRadius: 8 }}>{m.split(" ")[0]}</span>
                  ))}
                  {pd.m.length > 3 && <span style={{ fontSize: 10, color: C.tx2 }}>+{pd.m.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(10,128,128,.06)", border: ".5px solid rgba(10,128,128,.2)", fontSize: 12, color: C.tx2 }}>
          <span style={{ color: "#0AC8A0", fontWeight: 600 }}>{totalAgents} total agents</span> · 86 managers · 11 pillars · Click any pillar to drill down into the team roster, PE assignments, and schedules
        </div>
      </div>
    );
  }

  // PILLAR DRILL-DOWN
  return (
    <div>
      {/* Back + Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button onClick={() => { setSelPillar(null); setSelPE(null); setSearch(""); setSelAgent(null); }}
          style={{ padding: "6px 12px", borderRadius: 9, background: "rgba(255,255,255,.08)", color: C.tx1, border: ".5px solid " + C.bd, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
          ← All pillars
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: pillarColor, display: "inline-block" }}></span>
            {selPillar} · {pillarData.a.length} agents
          </div>
          <div style={{ fontSize: 13, color: C.tx2 }}>{pillarData.m.length} managers · {filteredAgents.length} shown</div>
        </div>
      </div>

      {/* Search + PE filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input type="text" placeholder="Search agents..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 9, background: C.surf, border: ".5px solid " + C.bd, color: C.tx0, fontSize: 13, width: 200 }} />
        <button onClick={() => setSelPE(null)}
          style={{ padding: "3px 11px", borderRadius: 14, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: !selPE ? pillarColor + "18" : "rgba(255,255,255,.05)",
            color: !selPE ? pillarColor : C.tx2,
            border: ".5px solid " + (!selPE ? pillarColor + "44" : C.bd) }}>
          All ({pillarData.a.length})
        </button>
        {pillarData.m.map(m => {
          const ct = pillarData.a.filter(a => a[1] === m).length;
          return (
            <button key={m} onClick={() => setSelPE(selPE === m ? null : m)}
              style={{ padding: "3px 11px", borderRadius: 14, fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: selPE === m ? pillarColor + "18" : "rgba(255,255,255,.05)",
                color: selPE === m ? pillarColor : C.tx2,
                border: ".5px solid " + (selPE === m ? pillarColor + "44" : C.bd) }}>
              {m.split(" ")[0]} ({ct})
            </button>
          );
        })}
      </div>

      {/* Agent table */}
      <div style={{ background: C.card, border: ".5px solid " + C.bd, borderRadius: 14, padding: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: ".5px solid " + C.bd }}>
              {["Agent", "Manager (PE)", "Timezone", "Location", "Schedule"].map((h, i) => (
                <th key={i} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, color: C.tx2, fontWeight: 400, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((a) => {
              const hasSch = hasSchedule(a[0]);
              const isSelected = selAgent === a[0];
              return (
                <tr key={a[0]}
                  onClick={() => setSelAgent(isSelected ? null : a[0])}
                  style={{ borderBottom: ".5px solid rgba(255,255,255,.04)", cursor: "pointer", background: isSelected ? "rgba(255,255,255,.04)" : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = isSelected ? "rgba(255,255,255,.04)" : "transparent"}>
                  <td style={{ padding: "7px 10px", fontWeight: 500, color: C.tx0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: pillarColor, flexShrink: 0 }}></span>
                      {a[0]}
                    </span>
                  </td>
                  <td style={{ padding: "7px 10px", color: C.tx1 }}>{a[1] || "—"}</td>
                  <td style={{ padding: "7px 10px", color: C.tx2 }}>{a[2]}</td>
                  <td style={{ padding: "7px 10px", color: C.tx2 }}>{a[3]}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {hasSch
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: "#0AC8A0", background: "rgba(10,200,150,.1)", padding: "2px 8px", borderRadius: 8 }}>Loaded</span>
                      : <span style={{ fontSize: 11, color: C.tx2 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selAgent && (() => {
        const rosterAgent = pillarData?.a.find(a => a[0] === selAgent);
        const schedAgent = getSchedule(selAgent);
        const agentObj = {
          id: selAgent.toLowerCase().replace(/\s+/g, '-'),
          n: selAgent,
          name: selAgent,
          pillar: selPillar || '',
          p: selPillar || '',
          pe: rosterAgent?.[1] || '',
          tz: rosterAgent?.[2] || 'PT',
          location: rosterAgent?.[3] || '',
          segs: schedAgent?.segs || [],
          sh: schedAgent?.sh ?? 8,
          se: schedAgent?.se ?? 17,
        };
        return (
          <div>
            <AgentProfilePanel
              agent={agentObj}
              patterns={[]}
              onAssignPattern={() => {}}
              onUpdateSkills={() => {}}
              onUpdateGroups={() => {}}
              onClose={() => setSelAgent(null)}
            />
            <RosterAdminPanel agent={agentObj} onClose={() => setSelAgent(null)} />
          </div>
        );
      })()}
    </div>
  );
}


// ─── APPROVALS ────────────────────────────────────────────────
const APPROVAL_DATA = [
  { id: 1, type: "PTO",         agent: "Briana Perez",     pillar: "BenOps",     detail: `${fmtRelDate(1)}–${fmtRelDate(3)} · 3 days`, rule: "ok",   msg: "Balance OK · under 2 off simultaneously · 84% coverage", icon: "🏖" },
  { id: 2, type: "Shift Swap",  agent: "Anthony Piper",    pillar: "BenOps",     detail: `${fmtRelDate(6)} swap ${fmtRelDate(13)}`,    rule: "ok",   msg: "Skills match · no OT triggered", icon: "🔄" },
  { id: 3, type: "Early Leave", agent: "LaKeisha Hemphill",pillar: "Cust. Care", detail: `${fmtRelDate(-7)} · leave at 4pm`,            rule: "warn", msg: "Coverage drops to 76% at 4pm — review needed", icon: "🚗" },
  { id: 4, type: "VTO",         agent: "Mason Amling",     pillar: "SMB Sales",  detail: `${fmtRelDate(-6)} · 2pm–close`,               rule: "ok",   msg: "Overstaffed · VTO improves efficiency 81% to 89%", icon: "👋" },
  { id: 5, type: "Sick",        agent: "Donna Jo Doney",   pillar: "BenOps",     detail: "Today · full day",                            rule: "warn", msg: "Short notice · coverage 72% at 7am peak", icon: "🤒" },
];

function ApprovalsView() {
  const [items, setItems] = useState(APPROVAL_DATA);
  const autoOk = items.filter(a => a.rule === "ok").length;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 4 }}>Approvals · {items.length} pending</div>
          <div style={{ fontSize: 13, color: C.tx2 }}>No tickets · no Jira · avg 1m 47s resolution</div>
        </div>
        {autoOk > 0 && (
          <button onClick={() => setItems(a => a.filter(x => x.rule !== "ok"))}
            style={{ padding: "8px 16px", borderRadius: 10, background: `linear-gradient(135deg,${C.kale},#0AB0B0)`, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Auto-approve {autoOk}
          </button>
        )}
      </div>
      {items.length === 0 && (
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.tx0, marginBottom: 4 }}>Queue clear</div>
          <div style={{ fontSize: 13, color: C.tx2 }}>47 auto-processed this month</div>
        </div>
      )}
      {items.map(req => {
        const pct = req.msg.match(/(\d{2,3})%/)?.[1];
        const covPct = pct ? parseInt(pct) : null;
        const confidence = req.rule === "ok"
          ? (covPct ? Math.min(97, 70 + Math.round(covPct / 5)) : 91)
          : (covPct ? Math.max(38, covPct - 14) : 58);
        return (
        <div key={req.id}
          style={{ background: C.card, border: `.5px solid ${req.rule === "warn" ? "rgba(239,159,39,.25)" : "rgba(10,144,144,.2)"}`, borderRadius: 14, padding: 15, display: "flex", alignItems: "center", gap: 14, marginBottom: 10, transition: "all .2s" }}
          onMouseEnter={e => e.currentTarget.style.background = C.elev}
          onMouseLeave={e => e.currentTarget.style.background = C.card}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: req.rule === "warn" ? "rgba(239,159,39,.12)" : "rgba(10,144,144,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{req.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.tx0 }}>{req.agent}</span>
              <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "rgba(255,255,255,.06)", color: C.tx2 }}>{req.type}</span>
              <span style={{ fontSize: 13, color: C.tx1 }}>· {req.detail}</span>
            </div>
            <div style={{ fontSize: 12, color: req.rule === "warn" ? "rgba(239,159,39,.8)" : "rgba(10,200,150,.7)", marginBottom: 4 }}>{req.msg}</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Pill label={req.rule === "warn" ? "Needs review" : "Auto-approvable"} color={req.rule === "warn" ? C.amber : "#0AC8A0"} small />
              <span style={{ fontSize: 10, fontWeight:700, color:confidence>=80?"#0AC8A0":confidence>=60?C.amber:C.guava, background:confidence>=80?"rgba(10,200,150,.1)":confidence>=60?`${C.amber}12`:"rgba(244,93,72,.1)", padding:"2px 7px", borderRadius:6 }}>
                ✦ {confidence}% conf.
              </span>
              <span style={{ fontSize: 11, color: C.tx2 }}>{req.pillar}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button onClick={() => { setItems(a => a.filter(x => x.id !== req.id)); window.prismToast?.(`${req.agent.split(" ")[0]}'s request approved ✓`, "success"); playSound("approve"); }} style={{ padding: "7px 16px", borderRadius: 9, background: "rgba(10,144,144,.15)", color: "#0AC8A0", border: ".5px solid rgba(10,144,144,.3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Approve</button>
            <button onClick={() => { setItems(a => a.filter(x => x.id !== req.id)); window.prismToast?.(`${req.agent.split(" ")[0]}'s request denied`, "warn"); }} style={{ padding: "7px 16px", borderRadius: 9, background: "rgba(255,255,255,.05)", color: C.tx2, border: `.5px solid ${C.bd}`, fontSize: 13, cursor: "pointer" }}>Deny</button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ══════════════════════════════════════════════════════════════
const ALL_BADGES = {
  agent: [
    { id: "streak",    icon: "🔥", name: "On Fire",          desc: "Multi-day adherence streak",        color: "#F45D48", xp: 100, tiers: [7, 14, 30]   },
    { id: "top10",     icon: "🎯", name: "Top 10%",           desc: "Weekly leaderboard top 10%",        color: "#0A8080", xp: 150, tiers: [1, 3, 5]    },
    { id: "speed",     icon: "⚡", name: "Speed Responder",   desc: "Respond to alerts in under 2min",   color: "#EF9F27", xp: 75,  tiers: [5, 20, 50]   },
    { id: "perfect",   icon: "💯", name: "Perfect Week",      desc: "100% adherence for a full week",    color: "#7F77DD", xp: 200, tiers: [1, 3, 10]   },
    { id: "earlybird", icon: "🌅", name: "Early Bird",        desc: "Log in before shift starts",        color: "#0AC8A0", xp: 50,  tiers: [5, 25, 100]  },
    { id: "scholar",   icon: "📚", name: "Scholar",           desc: "Complete training sessions",        color: "#F0997B", xp: 125, tiers: [1, 5, 10]   },
    { id: "sensei",    icon: "📅", name: "Schedule Sensei",   desc: "Check schedule 5 days in a row",    color: "#AD1457", xp: 80,  tiers: [1, 3, 10]   },
    { id: "iron",      icon: "🛡️", name: "Iron Attendance",  desc: "Zero unplanned absences",            color: "#1565C0", xp: 300, tiers: [30, 90, 180] },
  ],
  manager: [
    { id: "fast",    icon: "⚡", name: "Fast Approver",  desc: "All requests approved within 4hrs",  color: "#EF9F27", xp: 100, tiers: [10, 50, 200] },
    { id: "slg",     icon: "🛡️", name: "SL Guardian",   desc: "Team SL above 85% for full week",    color: "#0A8080", xp: 200, tiers: [1, 4, 12]   },
    { id: "zero",    icon: "✅", name: "Zero Backlog",   desc: "Approval queue cleared same day",     color: "#0AC8A0", xp: 150, tiers: [5, 20, 50]  },
    { id: "lead",    icon: "🏆", name: "Team Leader",   desc: "Team avg adherence above 95%",        color: "#7F77DD", xp: 250, tiers: [1, 4, 12]   },
    { id: "coach",   icon: "🎓", name: "Coach",         desc: "Team members earn new badges",        color: "#F0997B", xp: 75,  tiers: [5, 20, 50]  },
    { id: "king",    icon: "📊", name: "Coverage King", desc: "Pillar coverage above 90% all week",  color: "#AD1457", xp: 175, tiers: [1, 4, 12]   },
  ],
  wfm: [
    { id: "oracle",  icon: "🔮", name: "Oracle",        desc: "Forecast accuracy above 95%",         color: "#0A8080", xp: 300, tiers: [1, 4, 12]   },
    { id: "slayer",  icon: "⚔️", name: "IEX Slayer",   desc: "Migration milestones completed",       color: "#F45D48", xp: 500, tiers: [2, 5, 8]    },
    { id: "auto",    icon: "🤖", name: "Automator",     desc: "Auto-approvals processed",            color: "#7F77DD", xp: 100, tiers: [10, 50, 200] },
    { id: "pub",     icon: "📡", name: "Publisher",     desc: "Schedules published on time",         color: "#EF9F27", xp: 150, tiers: [4, 20, 52]  },
    { id: "data",    icon: "📈", name: "Data Analyst",  desc: "SL miss reports actioned",            color: "#0AC8A0", xp: 75,  tiers: [10, 50, 200] },
    { id: "arch",    icon: "🏗️", name: "Architect",    desc: "Live connections configured",         color: "#AD1457", xp: 200, tiers: [3, 8, 12]   },
  ],
};
const BADGE_PROGRESS = {
  AA:{ streak:2,top10:3,speed:1,perfect:1,earlybird:2,scholar:0,sensei:3,iron:1 },
  AP:{ streak:1,top10:1,speed:2,perfect:0,earlybird:3,scholar:1,sensei:1,iron:0 },
  AF:{ streak:3,top10:2,speed:3,perfect:2,earlybird:1,scholar:2,sensei:2,iron:1 },
  CB:{ fast:2,slg:1,zero:3,lead:1,coach:2,king:1 },
  JK:{ fast:1,slg:2,zero:1,lead:0,coach:1,king:2 },
  AB:{ fast:3,slg:2,zero:2,lead:2,coach:3,king:1 },
  AW:{ oracle:2,slayer:2,auto:3,pub:2,data:1,arch:1 },
  TZ:{ oracle:1,slayer:1,auto:2,pub:3,data:3,arch:0 },
  DS:{ oracle:3,slayer:2,auto:1,pub:2,data:2,arch:2 },
};
const LEADERBOARDS = {
  agent:  [{n:"Achebe Franklin",xp:2840,pillar:"Premier DSA",streak:21},{n:"Aaliyah Ali",xp:2210,pillar:"BenOps",streak:14},{n:"Anthony Piper",xp:1980,pillar:"Payroll & Taxes",streak:7},{n:"Briana Perez",xp:1750,pillar:"Payroll & Taxes",streak:12},{n:"LaKeisha Hemphill",xp:1540,pillar:"Payroll & Taxes",streak:9},{n:"Mason Amling",xp:1380,pillar:"Payroll & Taxes",streak:7}],
  manager:[{n:"Cyndy Boerger",xp:3200,pillar:"Payroll & Taxes",streak:8},{n:"Jenny Kirou",xp:2800,pillar:"Benefits Care",streak:6},{n:"Ashley Broadwell",xp:2100,pillar:"SMB - Sales",streak:4}],
  wfm:    [{n:"Ammad Williams",xp:4100,pillar:"All",streak:12},{n:"Tammie Zapata",xp:3700,pillar:"All",streak:9},{n:"Dwight Simpson",xp:3200,pillar:"All",streak:7}],
};
const TEAM_STATS = {
  "BenOps":{"avgAdh":95,"badges":18,"streak":14,"topAgent":"Aaliyah Ali"},
  "SMB Sales":{"avgAdh":92,"badges":12,"streak":7,"topAgent":"Mason Amling"},
  "Customer Care":{"avgAdh":97,"badges":22,"streak":21,"topAgent":"LaKeisha Hemphill"},
  "Payroll":{"avgAdh":93,"badges":9,"streak":8,"topAgent":"Hermes Diaz"},
  "Premier":{"avgAdh":91,"badges":14,"streak":10,"topAgent":"Jazz Eaton"},
  "Onboarding":{"avgAdh":96,"badges":4,"streak":5,"topAgent":"Willy Sasso"},
  "All":{"avgAdh":94,"badges":47,"streak":14,"topAgent":"LaKeisha Hemphill"},
};
const TC = ["#CD7F32","#C0C0C0","#FFD700"];
const TL = ["Bronze","Silver","Gold"];

function ParticleBurst({ color, small }) {
  const count = small ? 14 : 22;
  const kf = small ? "particle-fly-sm" : "particle-fly";
  return (
    <div style={{ position:"absolute", top:"50%", left:"50%", pointerEvents:"none", zIndex:20 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ position:"absolute", top:0, left:0, transform:`translate(-50%,-50%) rotate(${(i/count)*360}deg)` }}>
          <div style={{
            width: small ? 3 + (i%3) : 4 + (i%4),
            height: small ? 3 + (i%3) : 4 + (i%4),
            borderRadius: i%3===0 ? "2px" : "50%",
            background: i%4===0 ? "#fff" : i%4===1 ? color : i%4===2 ? color+"cc" : TC[i%3],
            animation: `${kf} ${small ? 0.38+i%5*.04 : 0.55+i%6*.05}s cubic-bezier(.22,.68,0,1.2) ${i%8*.018}s both`,
          }} />
        </div>
      ))}
    </div>
  );
}

function BadgeDetailModal({ badge, tier, onClose }) {
  const earned = tier > 0;
  const [burst, setBurst] = useState(false);
  useEffect(() => { if (earned) { setBurst(true); const t = setTimeout(() => setBurst(false), 900); return () => clearTimeout(t); } }, []);
  const RARITY = ["Common","Rare","Epic","Legendary"];
  const rarity = badge.xp >= 300 ? "Legendary" : badge.xp >= 200 ? "Epic" : badge.xp >= 100 ? "Rare" : "Common";
  const rarityColor = badge.xp >= 300 ? "#FFD700" : badge.xp >= 200 ? "#7F77DD" : badge.xp >= 100 ? "#0A8080" : C.tx2;
  const TIER_FLAVOR = ["Bronze Gustie", "Silver Gustie", "Gold Gustie"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(12px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.elev, border: `.5px solid ${earned ? badge.color + "55" : C.bd}`, borderRadius: 24, padding: 32, width: 360, maxWidth: "90vw", boxShadow: `0 40px 100px rgba(0,0,0,.7), 0 0 0 .5px ${earned ? badge.color + "20" : "transparent"}, ${earned ? `0 0 80px ${badge.color}14` : "none"}`, animation: "badge-zoom .28s cubic-bezier(.34,1.56,.64,1) both", position: "relative", overflow: "hidden" }}>
      {/* Background glow */}
      {earned && <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: `radial-gradient(ellipse,${badge.color}18,transparent 70%)`, pointerEvents: "none" }} />}
      {/* Close */}
      <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.06)", border: `.5px solid ${C.bd}`, color: C.tx2, borderRadius: 8, width: 28, height: 28, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
      {/* Big badge icon */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ position:"relative", width: 88, height: 88, borderRadius: 24, background: earned ? `${badge.color}20` : "rgba(255,255,255,.04)", border: `1.5px solid ${earned ? badge.color + "60" : C.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, margin: "0 auto 14px", boxShadow: earned ? `0 0 32px ${badge.color}28` : "none", transition: "all .2s", overflow:"visible" }}>
          {earned ? badge.icon : "🔒"}
          {burst && <ParticleBurst color={badge.color} />}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: earned ? C.tx0 : C.tx2, marginBottom: 5, letterSpacing: "-.02em" }}>{badge.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: rarityColor, background: `${rarityColor}14`, border: `.5px solid ${rarityColor}30`, padding: "3px 10px", borderRadius: 20 }}>{rarity}</span>
          {earned && <span style={{ fontSize: 12, fontWeight: 700, color: TC[tier-1], background: `${TC[tier-1]}14`, border: `.5px solid ${TC[tier-1]}30`, padding: "3px 10px", borderRadius: 20 }}>{TIER_FLAVOR[tier-1]}</span>}
        </div>
      </div>
      {/* Description */}
      <div style={{ background: "rgba(255,255,255,.03)", border: `.5px solid ${C.bd}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.tx1, lineHeight: 1.65 }}>{badge.desc}</div>
      </div>
      {/* Tier progression */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.tx2, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>Tier Progression</div>
        <div style={{ display: "flex", gap: 6 }}>
          {badge.tiers.map((t, i) => {
            const reached = i < tier;
            const active = i === tier - 1;
            return (
              <div key={i} style={{ flex: 1, background: reached ? `${TC[i]}14` : "rgba(255,255,255,.03)", border: `.5px solid ${reached ? TC[i] + "40" : C.bd}`, borderRadius: 10, padding: "10px 8px", textAlign: "center", transition: "all .2s", boxShadow: active ? `0 0 18px ${TC[i]}20` : "none" }}>
                <div style={{ fontSize: 17, marginBottom: 4 }}>{i === 0 ? "🥉" : i === 1 ? "🥈" : "🥇"}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: reached ? TC[i] : C.tx2 }}>{TL[i]}</div>
                <div style={{ fontSize: 11, color: C.tx2, marginTop: 2 }}>× {t}</div>
                {reached && <div style={{ fontSize: 10, color: TC[i], marginTop: 4, fontWeight: 600 }}>+{badge.xp * (i+1)} XP</div>}
              </div>
            );
          })}
        </div>
      </div>
      {/* XP reward */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: earned ? `${badge.color}0C` : "rgba(255,255,255,.02)", border: `.5px solid ${earned ? badge.color + "22" : C.bd}`, borderRadius: 10, padding: "10px 14px" }}>
        <div>
          <div style={{ fontSize: 11, color: C.tx2, marginBottom: 2 }}>XP per tier</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: earned ? badge.color : C.tx2 }}>+{badge.xp} XP</div>
        </div>
        {earned ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.tx2, marginBottom: 2 }}>Total earned</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: badge.color }}>+{badge.xp * tier} XP</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.tx2, fontStyle: "italic" }}>Not yet unlocked</div>
        )}
      </div>
      </div>
    </div>
  );
}

function BadgeCard({ badge, tier, onClick }) {
  const earned = tier > 0;
  const [cardBurst, setCardBurst] = useState(false);
  function handleClick() {
    if (earned) { setCardBurst(true); setTimeout(() => setCardBurst(false), 600); }
    onClick();
  }
  return (
    <div onClick={handleClick} style={{ background: earned ? `${badge.color}12` : C.surf, border: `.5px solid ${earned ? badge.color + "44" : C.bd}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8, opacity: earned ? 1 : 0.55, transition: "all .18s", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; e.currentTarget.style.background = earned ? `${badge.color}20` : "rgba(255,255,255,.06)"; e.currentTarget.style.boxShadow = earned ? `0 10px 32px ${badge.color}18` : "0 6px 20px rgba(0,0,0,.3)"; e.currentTarget.style.borderColor = earned ? badge.color + "66" : "rgba(255,255,255,.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = earned ? `${badge.color}12` : C.surf; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = earned ? badge.color + "44" : C.bd; }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ position:"relative", width: 40, height: 40, borderRadius: 10, background: earned ? `${badge.color}28` : "rgba(255,255,255,.04)", border: `.5px solid ${earned ? badge.color + "55" : C.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, overflow:"visible" }}>
          {earned ? badge.icon : "🔒"}
          {cardBurst && <ParticleBurst color={badge.color} small />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: earned ? C.tx0 : C.tx2, marginBottom: 2 }}>{badge.name}</div>
          <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.4 }}>{badge.desc}</div>
        </div>
        {earned && <span style={{ fontSize: 11, fontWeight: 700, color: TC[tier-1], background: `${TC[tier-1]}18`, padding: "2px 7px", borderRadius: 8, flexShrink: 0 }}>{TL[tier-1]}</span>}
      </div>
      {earned && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            {badge.tiers.map((t,i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: i < tier ? TC[i] : "rgba(255,255,255,.1)" }} />
                <span style={{ fontSize: 10, color: i < tier ? TC[i] : C.tx2 }}>{t}×</span>
              </div>
            ))}
          </div>
          <XPBar value={tier} max={3} color={badge.color} />
        </div>
      )}
      {!earned && <div style={{ fontSize: 11, color: C.tx2, textAlign: "center" }}>Click to preview</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.tx2 }}>+{badge.xp} XP / tier</span>
        {earned ? <span style={{ fontSize: 11, color: badge.color, fontWeight: 600 }}>+{badge.xp * tier} XP</span>
          : <span style={{ fontSize: 10, color: "rgba(255,255,255,.2)", letterSpacing: ".04em" }}>LOCKED</span>}
      </div>
    </div>
  );
}

function AchievementsView({ role, user }) {
  const [tab, setTab] = useState("badges");
  const [selBadge, setSelBadge] = useState(null);
  const badges = ALL_BADGES[role] || ALL_BADGES.agent;
  const prog = BADGE_PROGRESS[user.id] || {};
  const totalXP = badges.reduce((s, b) => s + b.xp * (prog[b.id] || 0), 0);
  const earned = badges.filter(b => (prog[b.id] || 0) > 0).length;
  const tc = [0, 0, 0];
  badges.forEach(b => { const t = prog[b.id] || 0; if (t > 0) tc[t-1]++; });
  const rc = ROLE_META[role] ? ROLE_META[role].color : C.kale;
  const board = (LEADERBOARDS[role] || LEADERBOARDS.agent).map(r => ({ ...r, me: r.n === user.name || (role === "agent" && r.n.includes(user.name.split(" ")[1] || "")) }));
  const teamStat = TEAM_STATS[user.pillar] || TEAM_STATS["All"];

  const statCards = role === "agent"
    ? [{ l:"Total XP",v:totalXP.toLocaleString(),c:C.purple},{l:"Level",v:user.level,c:C.purple},{l:"Streak",v:`${user.streak}d 🔥`,c:C.amber},{l:`Badges`,v:`${earned}/${badges.length}`,c:C.kale}]
    : role === "manager"
    ? [{l:"My XP",v:"2,800",c:C.amber},{l:"Team badges",v:teamStat.badges,c:C.kale},{l:"Avg adh",v:teamStat.avgAdh+"%",c:"#0AC8A0"},{l:"Best streak",v:teamStat.streak+"d",c:C.amber}]
    : [{l:"My XP",v:"3,700",c:C.kale},{l:`Badges ${earned}/${badges.length}`,v:earned,c:C.kale},{l:"Forecast acc",v:"97.1%",c:"#0AC8A0"},{l:"Auto-approvals",v:"47",c:C.amber}];

  return (
    <div>
      {selBadge && <BadgeDetailModal badge={selBadge.badge} tier={selBadge.tier} onClose={() => setSelBadge(null)} />}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.tx0, marginBottom: 4 }}>
          {role === "agent" ? "My achievements" : role === "manager" ? "Team achievements" : "Platform achievements"}
        </div>
        <div style={{ fontSize: 13, color: C.tx2 }}>
          {role === "agent" ? `${earned}/${badges.length} badges · ${totalXP.toLocaleString()} XP · ${user.streak}-day streak` : role === "manager" ? `${user.pillar} · ${teamStat.badges} team badges this month` : `All pillars · WFM team leaderboard`}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
        {statCards.map(k => (
          <div key={k.l} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 3, marginBottom: 14, width: "fit-content" }}>
        {[["badges","Badges"],["leaderboard","Leaderboard"],...(role !== "agent" ? [["team","Team breakdown"]] : [])].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: tab === v ? "rgba(255,255,255,.1)" : "none", color: tab === v ? C.tx0 : C.tx2, border: tab === v ? `.5px solid ${C.bd}` : "none", fontWeight: tab === v ? 500 : 400, transition: "all .15s" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "badges" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["🥇","Gold","#FFD700",tc[2]],["🥈","Silver","#C0C0C0",tc[1]],["🥉","Bronze","#CD7F32",tc[0]]].map(([icon,label,color,count]) => (
              <div key={label} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 17 }}>{icon}</span>
                <div><div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{count}</div><div style={{ fontSize: 11, color: C.tx2 }}>{label}</div></div>
              </div>
            ))}
            <div style={{ flex: 1, background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "8px 14px" }}>
              <div style={{ fontSize: 11, color: C.tx2, marginBottom: 5 }}>Progress to next level</div>
              <XPBar value={totalXP % 1000} max={1000} color={rc} />
              <div style={{ fontSize: 11, color: C.tx2, marginTop: 4 }}>{totalXP % 1000} / 1000 XP</div>
            </div>
          </div>
          <div className="ps" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            {badges.map(badge => <BadgeCard key={badge.id} badge={badge} tier={prog[badge.id] || 0} onClick={() => setSelBadge({ badge, tier: prog[badge.id] || 0 })} />)}
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 14 }}>
            {role === "agent" ? "All agents · XP" : role === "manager" ? "Manager leaderboard" : "WFM team"}
          </div>
          {board.map((r, i) => (
            <div key={r.n}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", borderRadius: 10, background: r.me ? `${rc}12` : "transparent", border: r.me ? `.5px solid ${rc}30` : `.5px solid transparent`, marginBottom: 6, transition: "all .15s" }}
              onMouseEnter={e => { if (!r.me) e.currentTarget.style.background = "rgba(255,255,255,.04)"; }}
              onMouseLeave={e => { if (!r.me) e.currentTarget.style.background = "transparent"; }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? "#FFD70022" : i === 1 ? "#C0C0C022" : i === 2 ? "#CD7F3222" : "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : C.tx2 }}>#{i + 1}</span>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${rc}20`, border: `.5px solid ${rc}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: rc, flexShrink: 0 }}>
                {initials(r.n)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: r.me ? 600 : 400, color: C.tx0 }}>{r.n}{r.me ? " (you)" : ""}</div>
                <div style={{ fontSize: 12, color: C.tx2 }}>{r.pillar} · {r.streak}d streak</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: r.me ? rc : C.tx0 }}>{r.xp.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: C.tx2 }}>XP</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "team" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(PILLARS).map(([name, color]) => {
            const ct = ALL_AGENTS.filter(a => a.p === name && !a.loa && !a.pto).length;
            const stat = TEAM_STATS[name] || { avgAdh:90,badges:5,streak:5,topAgent:"—" };
            return (
              <div key={name} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, flex: 1 }}>{name}</div>
                  <span style={{ fontSize: 12, color: C.tx2 }}>{ct} agents</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[{ l:"Avg adherence",v:stat.avgAdh+"%",c:stat.avgAdh>=95?"#0AC8A0":stat.avgAdh>=90?C.amber:C.guava },
                    { l:"Badges",v:stat.badges,c:color },
                    { l:"Best streak",v:stat.streak+"d",c:C.amber },
                    { l:"Top performer",v:stat.topAgent.split(" ")[0],c:C.tx0 }].map(k => (
                    <div key={k.l}>
                      <div style={{ fontSize: 10, color: C.tx2, marginBottom: 2 }}>{k.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <XPBar value={stat.avgAdh} max={100} color={color} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── SKILLING VIEW ──────────────────────────────────────────────
const SKILL_DATA = {
  "BenOps": [
    { n:"Anthony Piper",    phone:3,email:3,chat:2,chatEmail:2,cobra:2,fein:1,cancel:0,training:["COBRA","FEIN"] },
    { n:"Briana Perez",     phone:2,email:3,chat:3,chatEmail:3,cobra:1,fein:2,cancel:1,training:["FEIN","Cancellations"] },
    { n:"Claudia Lizama",   phone:1,email:3,chat:2,chatEmail:2,cobra:3,fein:0,cancel:2,training:["COBRA","Cancellations"] },
    { n:"Donna Jo Doney",   phone:2,email:3,chat:1,chatEmail:2,cobra:2,fein:1,cancel:3,training:["Cancellations"] },
    { n:"Holi Reed",        phone:3,email:2,chat:2,chatEmail:2,cobra:1,fein:0,cancel:1,training:["COBRA"] },
    { n:"Jordyn Richardson",phone:1,email:3,chat:3,chatEmail:3,cobra:0,fein:2,cancel:2,training:["FEIN"] },
  ],
  "SMB Sales": [
    { n:"Mason Amling",     phone:3,email:3,chat:2,chatEmail:2,cobra:0,fein:0,cancel:1,training:["Cancellations"] },
    { n:"Ashley Dickey",    phone:3,email:2,chat:1,chatEmail:2,cobra:0,fein:0,cancel:2,training:[] },
    { n:"Natalie Chisholm", phone:2,email:2,chat:3,chatEmail:3,cobra:0,fein:0,cancel:1,training:["Chat"] },
    { n:"Deja Ramos",       phone:2,email:2,chat:1,chatEmail:1,cobra:0,fein:0,cancel:0,training:[],loa:true },
  ],
  "Customer Care": [
    { n:"D'Angela Redman", phone:3,email:2,chat:2,chatEmail:3,cobra:0,fein:0,cancel:2,training:[] },
    { n:"LaKeisha Hemphill", phone:3,email:3,chat:3,chatEmail:3,cobra:0,fein:0,cancel:1,training:["Chat"] },
    { n:"Elexus Hunter",     phone:3,email:1,chat:2,chatEmail:2,cobra:0,fein:0,cancel:1,training:[] },
  ],
  "Payroll": [
    { n:"Hermes Diaz",   phone:2,email:2,chat:3,chatEmail:3,cobra:0,fein:3,cancel:0,training:["FEIN"] },
    { n:"Jasmine Gill",  phone:3,email:2,chat:2,chatEmail:2,cobra:0,fein:2,cancel:0,training:[] },
  ],
  "Premier": [
    { n:"Jazz Eaton",        phone:3,email:2,chat:3,chatEmail:3,cobra:1,fein:1,cancel:2,training:[] },
    { n:"Jocelyne Valenzuela",phone:2,email:3,chat:2,chatEmail:2,cobra:2,fein:0,cancel:1,training:[],pto:true },
    { n:"Kelly Joe",         phone:1,email:3,chat:1,chatEmail:2,cobra:3,fein:0,cancel:2,training:["COBRA"] },
  ],
  "Onboarding": [
    { n:"Willy Sasso", phone:3,email:2,chat:1,chatEmail:1,cobra:0,fein:0,cancel:0,training:[] },
  ],
};

const SKILL_COLS = [
  { key:"phone",    label:"Phone",      color:"#0A9090" },
  { key:"email",    label:"Email",      color:"#185FA5" },
  { key:"chat",     label:"Chat",       color:"#2BABAD" },
  { key:"chatEmail",label:"Chat/Email", color:"#1D9E75" },
  { key:"cobra",    label:"COBRA",      color:"#7F77DD" },
  { key:"fein",     label:"FEIN",       color:"#EF9F27" },
  { key:"cancel",   label:"Cancels",    color:"#F0997B" },
];

const PROF_LABELS = ["—", "Training", "Skilled", "Primary"];
const PROF_COLORS = ["rgba(255,255,255,.12)", "#EF9F2766", "#0A909066", "#0A9090"];
const PROF_TEXT   = ["rgba(255,255,255,.2)",  "#EF9F27",   "#0AC8A0",   "#fff"];

function SkillCell({ level }) {
  const bg    = PROF_COLORS[level];
  const color = PROF_TEXT[level];
  const label = PROF_LABELS[level];
  return (
    <div style={{ height:28, display:"flex", alignItems:"center", justifyContent:"center",
      background:bg, borderRadius:5, fontSize:11, fontWeight:level>0?600:400, color,
      transition:"all .2s" }}>
      {level === 0 ? "—" : label}
    </div>
  );
}

function SkillsView({ user }) {
  const [pillar, setPillar] = useState(user.pillar === "All" ? "BenOps" : user.pillar);
  const [view, setView]     = useState("grid");   // grid | gaps | cross
  const agents = SKILL_DATA[pillar] || [];

  // Summary counts per skill
  const summary = SKILL_COLS.map(col => {
    const primary   = agents.filter(a => a[col.key] === 3).length;
    const skilled   = agents.filter(a => a[col.key] === 2).length;
    const training  = agents.filter(a => a[col.key] === 1).length;
    const none      = agents.filter(a => a[col.key] === 0).length;
    return { ...col, primary, skilled, training, none };
  });

  // Agents with gaps (has a 0 in a core channel)
  const coreChannels = ["phone","email","chatEmail"];
  const gapAgents = agents.filter(a => !a.loa && !a.pto && coreChannels.some(k => a[k] === 0));

  // Cross-training candidates: has Training (1) in a skill
  const crossCandidates = agents.filter(a => SKILL_COLS.some(col => a[col.key] === 1));

  const pillarColor = Object.fromEntries(Object.entries({
    "BenOps":"#0A9898","SMB Sales":"#E84840","Customer Care":"#7870D0",
    "Payroll":"#D89020","Premier":"#D88060","Onboarding":"#18A870"
  }))[pillar] || C.kale;

  const pillarsForUser = user.pillar === "All"
    ? Object.keys(SKILL_DATA)
    : [user.pillar];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:4 }}>Team skilling</div>
          <div style={{ fontSize:13, color:C.tx2 }}>{pillar} · {agents.length} agents · current skill proficiency</div>
        </div>
        <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,.05)", borderRadius:10, padding:3 }}>
          {[["grid","Grid"],["gaps","Coverage gaps"],["cross","Cross-training"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:"5px 12px", borderRadius:7, fontSize:12, cursor:"pointer",
                background:view===v?"rgba(255,255,255,.1)":"none", color:view===v?C.tx0:C.tx2,
                border:view===v?`.5px solid ${C.bd}`:"none", fontWeight:view===v?500:400, transition:"all .15s" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Pillar picker */}
      {pillarsForUser.length > 1 && (
        <div style={{ display:"flex", gap:5, marginBottom:12, flexWrap:"wrap" }}>
          {pillarsForUser.map(p => {
            const c = ({
              "BenOps":"#0A9898","SMB Sales":"#E84840","Customer Care":"#7870D0",
              "Payroll":"#D89020","Premier":"#D88060","Onboarding":"#18A870"
            })[p] || "#888";
            return (
              <button key={p} onClick={() => setPillar(p)}
                style={{ padding:"3px 11px", borderRadius:14, fontSize:12, fontWeight:500, cursor:"pointer",
                  background:pillar===p?`${c}18`:"rgba(255,255,255,.05)", color:pillar===p?c:C.tx2,
                  border:`.5px solid ${pillar===p?c+"44":C.bd}`, transition:"all .15s" }}>
                {p} ({(SKILL_DATA[p]||[]).length})
              </button>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:14 }}>
        {summary.map(col => {
          const total = agents.filter(a => !a.loa && !a.pto).length;
          const pct = total > 0 ? Math.round((col.primary + col.skilled) / total * 100) : 0;
          return (
            <div key={col.key} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:10, padding:"9px 10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                <div style={{ width:7, height:7, borderRadius:2, background:col.color }} />
                <span style={{ fontSize:11, fontWeight:600, color:C.tx1 }}>{col.label}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:pct>=80?"#0AC8A0":pct>=50?C.amber:C.guava, lineHeight:1, marginBottom:4 }}>{pct}%</div>
              <div style={{ height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:col.color, borderRadius:2 }}/>
              </div>
              <div style={{ fontSize:10, color:C.tx2, marginTop:4 }}>{col.primary} primary · {col.skilled} skilled</div>
            </div>
          );
        })}
      </div>

      {/* GRID VIEW */}
      {view === "grid" && (
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14, overflowX:"auto" }}>
          <div style={{ minWidth:600 }}>
            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"160px repeat(7,1fr) 1fr", gap:4, marginBottom:8, paddingLeft:0 }}>
              <div/>
              {SKILL_COLS.map(col => (
                <div key={col.key} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:col.color }} />
                  <span style={{ fontSize:10, fontWeight:600, color:C.tx1, textAlign:"center" }}>{col.label}</span>
                </div>
              ))}
              <div style={{ fontSize:10, fontWeight:600, color:C.tx2, textAlign:"center" }}>In training</div>
            </div>

            {/* Legend row */}
            <div style={{ display:"flex", gap:10, marginBottom:10, flexWrap:"wrap" }}>
              {[["#0A9090","Primary"],["#0A909066","Skilled"],["#EF9F2766","Training"],["rgba(255,255,255,.12)","—"]].map(([bg,label]) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:20, height:12, borderRadius:3, background:bg }} />
                  <span style={{ fontSize:11, color:C.tx2 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Agent rows */}
            {agents.map((agent) => (
              <div key={agent.n} style={{ display:"grid", gridTemplateColumns:"160px repeat(7,1fr) 1fr", gap:4, marginBottom:4, opacity:agent.loa||agent.pto?.6:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, paddingRight:8 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:pillarColor, flexShrink:0 }} />
                  <span style={{ fontSize:11, fontWeight:500, color:C.tx0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{agent.n}</span>
                  {agent.loa && <span style={{ fontSize:9, fontWeight:700, color:"#A32D2D" }}>LOA</span>}
                  {agent.pto && <span style={{ fontSize:9, fontWeight:700, color:C.guava }}>PTO</span>}
                </div>
                {SKILL_COLS.map(col => (
                  <SkillCell key={col.key} level={agent[col.key]} />
                ))}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:28, fontSize:10, color:C.kale, fontWeight:500 }}>
                  {agent.training && agent.training.length > 0 ? agent.training.join(", ") : <span style={{ color:C.tx2 }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GAPS VIEW */}
      {view === "gaps" && (
        <div>
          {gapAgents.length === 0 ? (
            <div style={{ background:C.card, border:`.5px solid rgba(10,144,144,.25)`, borderRadius:14, padding:40, textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✓</div>
              <div style={{ fontSize:15, fontWeight:600, color:C.tx0, marginBottom:4 }}>No coverage gaps</div>
              <div style={{ fontSize:13, color:C.tx2 }}>All active agents are skilled in core channels</div>
            </div>
          ) : (
            <div>
              <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(244,93,72,.06)", border:`.5px solid rgba(244,93,72,.2)`, fontSize:12, color:C.guava, marginBottom:12 }}>
                {gapAgents.length} agent{gapAgents.length!==1?"s":""} with gaps in core channels (Phone, Email, Chat/Email)
              </div>
              {gapAgents.map(agent => {
                const gaps = coreChannels.filter(k => agent[k] === 0);
                const colInfo = gaps.map(k => SKILL_COLS.find(c => c.key === k));
                return (
                  <div key={agent.n} style={{ background:C.card, border:`.5px solid rgba(244,93,72,.2)`, borderRadius:12, padding:14, marginBottom:10, display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${pillarColor}20`, border:`.5px solid ${pillarColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:pillarColor, flexShrink:0 }}>
                      {agent.n.split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:4 }}>{agent.n}</div>
                      <div style={{ display:"flex", gap:6 }}>
                        {colInfo.map(c => c && (
                          <span key={c.key} style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:8, background:"rgba(244,93,72,.12)", color:C.guava, border:".5px solid rgba(244,93,72,.3)" }}>
                            Not skilled: {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", fontSize:12, color:C.tx2 }}>
                      <div style={{ fontWeight:600, color:C.amber, marginBottom:2 }}>Recommended</div>
                      {colInfo.map(c => c && <div key={c.key}>{c.label} training</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CROSS-TRAINING VIEW */}
      {view === "cross" && (
        <div>
          <div style={{ padding:"10px 14px", borderRadius:10, background:`${C.kale}10`, border:`.5px solid ${C.kale}44`, fontSize:12, color:"#0AC8A0", marginBottom:12 }}>
            {crossCandidates.length} agent{crossCandidates.length!==1?"s":""} currently in training — expected to reach Skilled within 30 days
          </div>
          {crossCandidates.length === 0 ? (
            <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:40, textAlign:"center" }}>
              <div style={{ fontSize:13, color:C.tx2 }}>No agents currently in cross-training</div>
            </div>
          ) : crossCandidates.map(agent => {
            const inTraining = SKILL_COLS.filter(col => agent[col.key] === 1);
            return (
              <div key={agent.n} style={{ background:C.card, border:`.5px solid ${C.kale}30`, borderRadius:12, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:`${pillarColor}20`, border:`.5px solid ${pillarColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:pillarColor, flexShrink:0 }}>
                    {agent.n.split(" ").map(w=>w[0]).join("").slice(0,2)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>{agent.n}</div>
                    <div style={{ fontSize:12, color:C.tx2 }}>Currently training in {inTraining.length} channel{inTraining.length!==1?"s":""}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {inTraining.map(col => (
                    <div key={col.key} style={{ background:`${col.color}12`, border:`.5px solid ${col.color}44`, borderRadius:10, padding:"9px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                        <div style={{ width:7, height:7, borderRadius:2, background:col.color }} />
                        <span style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>{col.label}</span>
                        <span style={{ marginLeft:"auto", fontSize:11, color:C.amber, fontWeight:600 }}>Training</span>
                      </div>
                      <div style={{ height:4, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:"35%", background:col.color, borderRadius:2 }}/>
                      </div>
                      <div style={{ fontSize:11, color:C.tx2, marginTop:4 }}>~30 days to Skilled</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Recommended cross-training */}
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14, marginTop:10 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:10 }}>Recommended cross-training opportunities</div>
            {summary.filter(col => col.primary < 2).map(col => {
              const candidates = agents.filter(a => a[col.key] === 2 && !a.loa && !a.pto);
              if (candidates.length === 0) return null;
              return (
                <div key={col.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:`.5px solid ${C.bd}` }}>
                  <div style={{ width:7, height:7, borderRadius:2, background:col.color, flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:600, color:C.tx0, flex:1 }}>{col.label}</span>
                  <span style={{ fontSize:12, color:C.guava }}>Only {col.primary} primary</span>
                  <span style={{ fontSize:12, color:C.tx2 }}>Candidates: {candidates.map(a => a.n.split(" ")[0]).join(", ")}</span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANAGER DASHBOARD ────────────────────────────────────────

// ══════════════════════════════════════════════════════════════
// CLEARCAST — Tactical Forecast (Real Data)
// ══════════════════════════════════════════════════════════════
function ForecastSLBadge({ sl, tgt }) {
  if (!sl) return <span style={{ color: C.tx2 }}>—</span>;
  const cc = sl >= tgt ? "#0AC8A0" : sl >= tgt - 10 ? C.amber : C.guava;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: cc, background: `${cc}15`, padding: "2px 8px", borderRadius: 8, border: `.5px solid ${cc}44` }}>
      {sl}% <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>/ {tgt}%</span>
    </span>
  );
}

function ForecastHoursBar({ label, fH, aH, color }) {
  const max = Math.max(fH, aH, 1);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.tx0 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.tx2 }}>Fcst {fH.toLocaleString()}h · Act {aH.toLocaleString()}h</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 8 }}>
        <div style={{ flex: fH / max, background: color, borderRadius: 3, opacity: 0.4 }} title={`Forecast: ${fH}h`}></div>
        <div style={{ flex: aH / max, background: color, borderRadius: 3 }} title={`Actual: ${aH}h`}></div>
      </div>
    </div>
  );
}

function CCForecastCard({ ct, onClick }) {
  const vPct = ct.forecastVolume > 0 ? ((ct.actualVolume - ct.forecastVolume) / ct.forecastVolume * 100) : 0;
  const slOk = ct.serviceLevel >= (ct.slTarget || 80);
  const slWarn = ct.serviceLevel >= (ct.slTarget || 80) - 10;
  const health = (Math.abs(vPct) <= 5 && (ct.serviceLevel === 0 || slOk)) ? "on"
    : (Math.abs(vPct) <= 15 || slWarn) ? "watch" : "off";
  const hColor = health === "on" ? "#0AC8A0" : health === "watch" ? "#EF9F27" : "#F45D48";
  const chColor = ct.channel === "Phone" ? "#0A9090" : ct.channel === "Email" ? "#3B82F6" : ct.channel === "Chat" ? "#2BABAD" : C.tx2;
  const slPct = ct.slTarget > 0 ? Math.min(100, (ct.serviceLevel / ct.slTarget) * 100) : 0;
  const slColor = slOk ? "#0AC8A0" : slWarn ? "#EF9F27" : "#F45D48";
  return (
    <div onClick={onClick} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderLeft: `3px solid ${hColor}`, borderRadius: 12, padding: "13px 13px 11px 11px", cursor: "pointer", transition: "all .18s", position: "relative", overflow: "hidden" }}
      onMouseEnter={e => { e.currentTarget.style.background = C.elev; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,.32)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 70, height: "100%", background: `linear-gradient(90deg,${hColor}10,transparent)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 3, position: "relative" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.tx0, lineHeight: 1.3, flex: 1, marginRight: 6 }}>{ct.name}</div>
        <span style={{ fontSize: 10, fontWeight: 600, color: chColor, background: `${chColor}20`, padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{ct.channel}</span>
      </div>
      <div style={{ fontSize: 11, color: C.tx2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        {ct.category}
        {ct.weeklyTrend != null && (
          <span style={{ color: ct.weeklyTrend >= 0 ? "#0AC8A0" : "#F45D48", fontSize: 11, fontWeight: 600 }}>
            {ct.weeklyTrend >= 0 ? "↑" : "↓"}{Math.abs(ct.weeklyTrend)}%
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: ct.serviceLevel > 0 ? 8 : 0 }}>
        <span style={{ fontSize: 11, color: C.tx2, width: 28 }}>Vol</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.tx1 }}>{ct.forecastVolume.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,.2)", margin: "0 1px" }}>→</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.tx0 }}>{ct.actualVolume.toLocaleString()}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: hColor, background: `${hColor}18`, padding: "2px 6px", borderRadius: 4 }}>
          {vPct >= 0 ? "+" : ""}{vPct.toFixed(1)}%
        </span>
      </div>
      {ct.serviceLevel > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: C.tx2, width: 28 }}>SL</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: slColor }}>{ct.serviceLevel}%</span>
            {ct.slTarget > 0 && <span style={{ fontSize: 11, color: C.tx2 }}>/ {ct.slTarget}%</span>}
          </div>
          {ct.slTarget > 0 && (
            <div style={{ height: 3, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: slPct + "%", background: slColor, borderRadius: 2 }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CCChart({ data }) {
  const chartData = data.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
    Forecast: c.forecastVolume,
    Actual: c.actualVolume,
    vPct: c.forecastVolume > 0 ? +((c.actualVolume - c.forecastVolume) / c.forecastVolume * 100).toFixed(1) : 0,
  }));
  const tickStyle = { fill: C.tx2, fontSize: 11 };
  return (
    <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 14 }}>Forecast vs Actual Volume by Category</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 40 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="name" tick={{ ...tickStyle, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={tickStyle} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} />
          <Tooltip contentStyle={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: C.tx0, fontWeight: 600 }} itemStyle={{ color: C.tx1 }}
            formatter={(v, n) => [v.toLocaleString(), n]} />
          <Legend wrapperStyle={{ fontSize: 12, color: C.tx2, paddingTop: 6 }} />
          <Bar dataKey="Forecast" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={24}>
            {chartData.map((e, i) => <Cell key={i} fill={Math.abs(e.vPct) <= 5 ? "#0A8080" : Math.abs(e.vPct) <= 12 ? C.amber : C.guava} fillOpacity={0.55} />)}
          </Bar>
          <Bar dataKey="Actual" fill="#0AC8A0" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CCModelLab({ forecastData }) {
  const [models, setModels] = useState([]);
  const [modErr, setModErr] = useState(null);
  const [selModel, setSelModel] = useState(null);
  const [selPillar, setSelPillar] = useState("All");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [runErr, setRunErr] = useState(null);

  const pillars = useMemo(() => {
    const ps = new Set(forecastData.map(ct => ct.pillar || ct.category));
    return ["All", ...Array.from(ps).sort()];
  }, [forecastData]);

  useEffect(() => {
    listModels().then(setModels).catch(e => setModErr(e.message));
  }, []);

  const handleRun = useCallback(async () => {
    if (!selModel) return;
    setRunning(true); setResult(null); setRunErr(null);
    try {
      const filtered = selPillar === "All" ? forecastData : forecastData.filter(ct => (ct.pillar || ct.category) === selPillar);
      const ctIds = filtered.map(ct => ct.id);
      const raw = await runModel(selModel, ctIds, { forecastDays: 30, pillar: selPillar === "All" ? null : selPillar });
      setResult(summarizeResults(raw));
    } catch (e) { setRunErr(e.message); }
    finally { setRunning(false); }
  }, [selModel, selPillar, forecastData]);

  const statusColor = s => s === MODEL_STATUS.PRODUCTION ? "#0AC8A0" : s === MODEL_STATUS.IN_DEVELOPMENT ? C.amber : C.tx2;
  const statusLabel = s => s === MODEL_STATUS.PRODUCTION ? "PROD" : s === MODEL_STATUS.IN_DEVELOPMENT ? "DEV" : "BETA";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 12 }}>Available Models</div>
        {modErr && <div style={{ fontSize: 12, color: C.guava, marginBottom: 8 }}>Backend offline — {modErr}</div>}
        {models.length === 0 && !modErr && (
          <div style={{ fontSize: 12, color: C.tx2 }}>Connecting to model server…</div>
        )}
        {models.map(m => (
          <div key={m.codename} onClick={() => setSelModel(m.codename)}
            style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer", background: selModel === m.codename ? "rgba(92,83,200,.15)" : "rgba(255,255,255,.04)", border: `.5px solid ${selModel === m.codename ? C.purple : C.bd}`, transition: "all .15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.tx0 }}>{m.name || m.codename}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(m.status), background: `${statusColor(m.status)}18`, padding: "1px 5px", borderRadius: 4 }}>{statusLabel(m.status)}</span>
            </div>
            {m.description && <div style={{ fontSize: 12, color: C.tx2 }}>{m.description}</div>}
            {m.metrics && <div style={{ fontSize: 11, color: C.tx2, marginTop: 3 }}>WMAPE {m.metrics.wmape ?? "—"} · MAE {m.metrics.mae ?? "—"}</div>}
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: C.tx2, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Pillar scope</div>
          <select value={selPillar} onChange={e => setSelPillar(e.target.value)}
            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: C.elev, color: C.tx0, border: `.5px solid ${C.bd}`, fontSize: 13, outline: "none" }}>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={handleRun} disabled={!selModel || running}
          style={{ width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 9, background: selModel && !running ? `linear-gradient(135deg,${C.purple},#7F77DD)` : "rgba(255,255,255,.06)", color: selModel && !running ? "#fff" : C.tx2, border: "none", fontSize: 13, fontWeight: 600, cursor: selModel && !running ? "pointer" : "not-allowed", transition: "all .2s" }}>
          {running ? "Running…" : selModel ? `Run ${selModel}` : "Select a model"}
        </button>
      </div>
      <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 12 }}>Results</div>
        {!result && !runErr && (
          <div style={{ fontSize: 12, color: C.tx2, textAlign: "center", paddingTop: 40 }}>
            {running ? <span style={{ color: C.purple }}>Model running…</span> : "Run a model to see results here"}
          </div>
        )}
        {runErr && <div style={{ fontSize: 12, color: C.guava, padding: "10px 12px", borderRadius: 8, background: "rgba(244,93,72,.07)", border: ".5px solid rgba(244,93,72,.2)" }}>{runErr}</div>}
        {result && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[["CTs run", result.ctCount], ["Successful", result.successCount], ["Avg WMAPE", result.avgWmape != null ? result.avgWmape + "%" : "—"], ["Avg MAE", result.avgMae ?? "—"]].map(([l, v]) => (
                <div key={l} style={{ background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.tx0 }}>{v}</div>
                </div>
              ))}
            </div>
            {result.bestModelBreakdown?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.tx1, marginBottom: 8 }}>Best model breakdown</div>
                {result.bestModelBreakdown.map(({ name, count, pct }) => (
                  <div key={name} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: C.tx0 }}>{name}</span>
                      <span style={{ fontSize: 12, color: C.tx2 }}>{count} CTs · {pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: C.purple, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// F vs A VIEW
// ══════════════════════════════════════════════════════════════
const WEEKLY_FVA = [
  { week: fmtRelDate(-28), label:"Wk −4", fcst:12840, actual:13250, acc:96.8 },
  { week: fmtRelDate(-21), label:"Wk −3", fcst:13100, actual:12780, acc:97.6 },
  { week: fmtRelDate(-14), label:"Wk −2", fcst:12960, actual:13420, acc:96.4 },
  { week: fmtRelDate(-7),  label:"Wk −1", fcst:13240, actual:13380, acc:98.9 },
  { week:"This wk",        label:"This wk",fcst:13500, actual:13190, acc:97.7 },
];
const DAILY_FVA_BY_PILLAR = {
  "Payroll & Taxes": [
    {d:"Mon",fcst:820,actual:870},{d:"Tue",fcst:840,actual:855},{d:"Wed",fcst:810,actual:798},
    {d:"Thu",fcst:850,actual:882},{d:"Fri",fcst:780,actual:760},{d:"Sat",fcst:310,actual:295},{d:"Sun",fcst:180,actual:172},
  ],
  "Benefits Care": [
    {d:"Mon",fcst:540,actual:520},{d:"Tue",fcst:560,actual:575},{d:"Wed",fcst:550,actual:542},
    {d:"Thu",fcst:570,actual:590},{d:"Fri",fcst:510,actual:498},{d:"Sat",fcst:160,actual:148},{d:"Sun",fcst:90,actual:88},
  ],
  "SMB Sales": [
    {d:"Mon",fcst:380,actual:415},{d:"Tue",fcst:390,actual:422},{d:"Wed",fcst:370,actual:395},
    {d:"Thu",fcst:400,actual:418},{d:"Fri",fcst:360,actual:340},{d:"Sat",fcst:80,actual:72},{d:"Sun",fcst:40,actual:38},
  ],
  "Onboarding": [
    {d:"Mon",fcst:290,actual:278},{d:"Tue",fcst:300,actual:312},{d:"Wed",fcst:285,actual:268},
    {d:"Thu",fcst:310,actual:295},{d:"Fri",fcst:260,actual:252},{d:"Sat",fcst:90,actual:82},{d:"Sun",fcst:55,actual:50},
  ],
  "Premier DSA": [
    {d:"Mon",fcst:210,actual:198},{d:"Tue",fcst:220,actual:225},{d:"Wed",fcst:205,actual:195},
    {d:"Thu",fcst:225,actual:230},{d:"Fri",fcst:190,actual:185},{d:"Sat",fcst:60,actual:55},{d:"Sun",fcst:30,actual:28},
  ],
};

function ForecastVsActualsView() {
  const [tab, setTab] = useState("pillar");
  const [drillPillar, setDrillPillar] = useState(null);

  const pillarData = useMemo(() => {
    const map = {};
    for (const ct of CC_GROUPS) {
      if (!map[ct.category]) map[ct.category] = { name: ct.category, fcst: 0, actual: 0, count: 0 };
      map[ct.category].fcst += ct.forecastVolume;
      map[ct.category].actual += ct.actualVolume;
      map[ct.category].count++;
    }
    return Object.values(map)
      .map(p => ({ ...p, var: p.fcst > 0 ? (p.actual - p.fcst) / p.fcst * 100 : 0 }))
      .sort((a, b) => b.fcst - a.fcst);
  }, []);

  const missPatterns = useMemo(() =>
    [...pillarData].sort((a, b) => Math.abs(b.var) - Math.abs(a.var)).slice(0, 3),
  [pillarData]);

  const drillData = drillPillar ? (DAILY_FVA_BY_PILLAR[drillPillar] || null) : null;
  const overallAcc = pillarData.length > 0
    ? 100 - (pillarData.reduce((s, p) => s + Math.abs(p.var), 0) / pillarData.length)
    : 97;

  const tabs = [["pillar","By Pillar"],["weekly","Weekly Trend"]];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "rgba(14,20,38,.97)", border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 13px", fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: C.tx0, marginBottom: 5 }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong></div>
        ))}
        {payload.length >= 2 && (
          <div style={{ color: C.tx2, marginTop: 4, fontSize: 11 }}>
            Var: {(((payload[1]?.value - payload[0]?.value) / (payload[0]?.value || 1)) * 100).toFixed(1)}%
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation:"view-in .2s ease both" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
          <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:3 }}>Forecast vs Actuals</div>
          <div style={{ fontSize:13, color:C.tx2 }}>ClearCast accuracy · {pillarData.length} pillars · MTD</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ padding:"6px 12px", borderRadius:10, background:"rgba(10,200,150,.1)", border:".5px solid rgba(10,200,150,.3)", fontSize:13, fontWeight:600, color:"#0AC8A0" }}>
            <CountUp to={parseFloat(overallAcc.toFixed(1))} decimals={1} suffix="% acc" />
          </div>
          <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,.05)", borderRadius:10, padding:3 }}>
            {tabs.map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)} style={{ padding:"5px 12px", borderRadius:7, fontSize:12, cursor:"pointer", background:tab===v?"rgba(255,255,255,.1)":"none", color:tab===v?C.tx0:C.tx2, border:tab===v?`.5px solid ${C.bd}`:"none", fontWeight:tab===v?500:400, transition:"all .15s" }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── BY PILLAR TAB ─── */}
      {tab === "pillar" && (
        <div>
          {/* Stat row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              { l:"On target",     v:pillarData.filter(p=>Math.abs(p.var)<=5).length, suf:`/${pillarData.length}`, c:"#0AC8A0" },
              { l:"Watch (5–12%)", v:pillarData.filter(p=>Math.abs(p.var)>5&&Math.abs(p.var)<=12).length, suf:"", c:C.amber },
              { l:"Miss (>12%)",   v:pillarData.filter(p=>Math.abs(p.var)>12).length, suf:"", c:C.guava },
              { l:"Avg variance",  v:Math.abs(pillarData.reduce((s,p)=>s+p.var,0)/pillarData.length).toFixed(1), suf:"%", c:C.purple },
            ].map(k => (
              <div key={k.l} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:11, padding:"10px 13px" }}>
                <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k.l}</div>
                <div style={{ fontSize:20, fontWeight:700, color:k.c, lineHeight:1 }}><CountUp to={parseFloat(k.v)} decimals={k.suf==="%"?1:0} suffix={k.suf} /></div>
              </div>
            ))}
          </div>

          {/* Main bar chart */}
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:"16px 16px 10px", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.tx0, flex:1 }}>Volume by pillar · Forecast vs Actual {drillPillar ? `· ${drillPillar}` : "(all)"}</div>
              {drillPillar && <button onClick={() => setDrillPillar(null)} style={{ padding:"3px 10px", borderRadius:7, background:"rgba(255,255,255,.06)", border:`.5px solid ${C.bd}`, color:C.tx2, fontSize:12, cursor:"pointer" }}>← All pillars</button>}
              <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:11, color:C.tx2 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:C.kale }}/>Forecast</div>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ width:10, height:10, borderRadius:2, background:C.purple }}/>Actual</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              {drillData ? (
                <BarChart data={drillData} barCategoryGap="28%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="d" tick={{ fill: C.tx2, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.tx2, fontSize: 11 }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v.toLocaleString()} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,.03)" }} />
                  <Bar dataKey="fcst"   name="Forecast" fill={C.kale}   radius={[3,3,0,0]} />
                  <Bar dataKey="actual" name="Actual"   fill={C.purple} radius={[3,3,0,0]} />
                </BarChart>
              ) : (
                <BarChart data={pillarData} barCategoryGap="28%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                  <XAxis dataKey="name" tick={{ fill: C.tx2, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={36} />
                  <YAxis tick={{ fill: C.tx2, fontSize: 11 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => (v/1000).toFixed(0)+"k"} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,.03)" }} />
                  <Bar dataKey="fcst"   name="Forecast" fill={C.kale}   radius={[3,3,0,0]}
                    onClick={d => setDrillPillar(d.name)} style={{ cursor:"pointer" }} />
                  <Bar dataKey="actual" name="Actual"   fill={C.purple} radius={[3,3,0,0]}
                    onClick={d => setDrillPillar(d.name)} style={{ cursor:"pointer" }} />
                </BarChart>
              )}
            </ResponsiveContainer>
            {!drillData && <div style={{ fontSize:11, color:C.tx2, textAlign:"center", marginTop:4 }}>Click any pillar bar to drill down by day</div>}
          </div>

          {/* Miss patterns */}
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:14 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:10 }}>Miss patterns · top variance pillars</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {missPatterns.map((p, i) => {
                const vc = Math.abs(p.var) <= 5 ? "#0AC8A0" : Math.abs(p.var) <= 12 ? C.amber : C.guava;
                const dir = p.var >= 0 ? "Over" : "Under";
                return (
                  <div key={p.name} onClick={() => setDrillPillar(p.name)} style={{ background:`${vc}08`, border:`.5px solid ${vc}28`, borderRadius:10, padding:"11px 13px", cursor:"pointer", transition:"all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background=`${vc}14`; e.currentTarget.style.transform="translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background=`${vc}08`; e.currentTarget.style.transform="none"; }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:vc, background:`${vc}18`, padding:"2px 7px", borderRadius:6 }}>#{i+1}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>{p.name}</span>
                    </div>
                    <div style={{ fontSize:18, fontWeight:800, color:vc, lineHeight:1, marginBottom:2 }}>{p.var >= 0 ? "+" : ""}{p.var.toFixed(1)}%</div>
                    <div style={{ fontSize:11, color:C.tx2 }}>{dir}forecast · {p.count} CTs</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── WEEKLY TREND TAB ─── */}
      {tab === "weekly" && (
        <div>
          {/* Stat row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              { l:"5-wk avg acc",    v:"97.5", suf:"%", c:"#0AC8A0" },
              { l:"Best week",       v:"98.9", suf:"%", c:"#0AC8A0" },
              { l:"Worst week",      v:"96.4", suf:"%", c:C.amber   },
              { l:"Wk-over-wk trend",v:"+0.4", suf:"pp",c:"#0AC8A0" },
            ].map(k => (
              <div key={k.l} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:11, padding:"10px 13px" }}>
                <div style={{ fontSize:10, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k.l}</div>
                <div style={{ fontSize:20, fontWeight:700, color:k.c, lineHeight:1 }}>{k.v}{k.suf}</div>
              </div>
            ))}
          </div>

          {/* Volume chart */}
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:"16px 16px 10px", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.tx0, marginBottom:12 }}>Weekly volume · Forecast vs Actual</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={WEEKLY_FVA} barCategoryGap="32%" barGap={3}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="label" tick={{ fill:C.tx2, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:C.tx2, fontSize:11 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => (v/1000).toFixed(0)+"k"} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:"rgba(255,255,255,.03)" }} />
                <Bar dataKey="fcst"   name="Forecast" fill={C.kale}   radius={[3,3,0,0]} />
                <Bar dataKey="actual" name="Actual"   fill={C.purple} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Accuracy trend line */}
          <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, padding:"16px 16px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>Forecast accuracy % · 5-week trend</div>
              <div style={{ fontSize:11, color:"#0AC8A0", fontWeight:600 }}>Target ≥95%</div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={WEEKLY_FVA}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,.04)" />
                <XAxis dataKey="label" tick={{ fill:C.tx2, fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[94,100]} tick={{ fill:C.tx2, fontSize:11 }} axisLine={false} tickLine={false} width={32} tickFormatter={v => v+"%"} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background:"rgba(14,20,38,.97)", border:`.5px solid ${C.bd}`, borderRadius:10, padding:"8px 12px", fontSize:13 }}>
                    <div style={{ fontWeight:600, color:C.tx0, marginBottom:3 }}>{label}</div>
                    <div style={{ color:"#0AC8A0" }}>Accuracy: <strong>{payload[0]?.value}%</strong></div>
                  </div>
                ) : null} cursor={{ stroke:"rgba(255,255,255,.08)" }} />
                <ReferenceLine y={95} stroke="rgba(10,200,150,.3)" strokeDasharray="4 3" label={{ value:"95% target", position:"insideTopRight", fill:"rgba(10,200,150,.5)", fontSize:10 }} />
                <Line type="monotone" dataKey="acc" name="Accuracy" stroke="#0AC8A0" strokeWidth={2} dot={{ fill:"#0AC8A0", r:3, strokeWidth:0 }} activeDot={{ r:5, fill:"#0AC8A0" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ClearCastView({ role }) {
  const { forecastData, loading, lastUpdated, refreshData } = useForecast();
  const [tab, setTab] = useState("cards");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [selCt, setSelCt] = useState(null);
  const canEdit = role === "wfm";

  const data = forecastData?.length ? forecastData : CC_GROUPS;

  const cats = useMemo(() => ["All", ...Array.from(new Set(data.map(ct => ct.category))).sort()], [data]);

  const catSummary = useMemo(() => {
    const map = {};
    for (const ct of data) {
      const cat = ct.category;
      if (!map[cat]) map[cat] = { name: cat, q: 0, forecastVolume: 0, actualVolume: 0, wk: 0, slSum: 0, slCount: 0, onCount: 0, offCount: 0 };
      const c = map[cat];
      c.q++;
      c.forecastVolume += ct.forecastVolume;
      c.actualVolume += ct.actualVolume;
      c.wk += ct.weeklyForecastVolume || 0;
      if (ct.serviceLevel > 0) { c.slSum += ct.serviceLevel; c.slCount++; }
      const vp = ct.forecastVolume > 0 ? Math.abs((ct.actualVolume - ct.forecastVolume) / ct.forecastVolume * 100) : 0;
      if (vp <= 5 && (ct.serviceLevel === 0 || ct.serviceLevel >= (ct.slTarget || 80) - 5)) c.onCount++;
      else c.offCount++;
    }
    return Object.values(map).sort((a, b) => b.forecastVolume - a.forecastVolume);
  }, [data]);

  // Health counts across all CTs
  const healthCounts = useMemo(() => {
    let on = 0, watch = 0, off = 0;
    for (const ct of data) {
      const vp = ct.forecastVolume > 0 ? Math.abs((ct.actualVolume - ct.forecastVolume) / ct.forecastVolume * 100) : 0;
      const slOk = ct.serviceLevel === 0 || ct.serviceLevel >= (ct.slTarget || 80);
      const slWarn = ct.serviceLevel === 0 || ct.serviceLevel >= (ct.slTarget || 80) - 10;
      if (vp <= 5 && slOk) on++;
      else if (vp <= 15 || slWarn) watch++;
      else off++;
    }
    return { on, watch, off };
  }, [data]);

  const catHealthColor = (c) => {
    if (c.offCount > c.q * 0.3) return "#F45D48";
    if (c.offCount > 0 || c.onCount < c.q * 0.7) return "#EF9F27";
    return "#0AC8A0";
  };

  const filtered = useMemo(() => {
    let base = filterCat === "All" ? data : data.filter(ct => ct.category === filterCat);
    if (search.trim()) base = base.filter(ct => ct.name.toLowerCase().includes(search.toLowerCase()) || ct.category.toLowerCase().includes(search.toLowerCase()));
    return base;
  }, [data, filterCat, search]);

  const totFV = data.reduce((s, ct) => s + ct.forecastVolume, 0);
  const totAV = data.reduce((s, ct) => s + ct.actualVolume, 0);
  const totVar = totFV > 0 ? ((totAV - totFV) / totFV * 100) : 0;
  const totWk = data.reduce((s, ct) => s + (ct.weeklyForecastVolume || 0), 0);
  const src = lastUpdated ? `↺ ${new Date(lastUpdated).toLocaleTimeString()}` : "Offline — static data";

  const selCtData = selCt ? data.find(ct => ct.id === selCt) : null;
  const d = selCtData;

  return (
    <div>
      {/* Hero header */}
      <div style={{ background: "linear-gradient(135deg, rgba(10,128,128,.12) 0%, rgba(10,200,150,.05) 50%, transparent 100%)", border: `.5px solid rgba(10,128,128,.2)`, borderRadius: 16, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.tx0, letterSpacing: "-.02em" }}>ClearCast</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0AC8A0", background: "rgba(10,200,150,.15)", padding: "3px 8px", borderRadius: 6, border: ".5px solid rgba(10,200,150,.3)", letterSpacing: ".06em" }}>LIVE</span>
            </div>
            <div style={{ fontSize: 12, color: C.tx2 }}>{data.length} forecast groups · {cats.length - 1} categories · {src}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {canEdit && (
              <button onClick={refreshData} style={{ padding: "7px 14px", borderRadius: 9, background: loading ? "rgba(255,255,255,.08)" : "linear-gradient(135deg,#0A8080,#0AB0B0)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "…" : "↺ Refresh"}
              </button>
            )}
            {role === "manager" && <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: "rgba(239,159,39,.1)", padding: "3px 9px", borderRadius: 8, border: ".5px solid rgba(239,159,39,.2)" }}>View only</span>}
          </div>
        </div>

        {/* Health strip */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "On target", count: healthCounts.on, color: "#0AC8A0", bg: "rgba(10,200,150,.1)", border: "rgba(10,200,150,.25)" },
            { label: "Watch", count: healthCounts.watch, color: "#EF9F27", bg: "rgba(239,159,39,.1)", border: "rgba(239,159,39,.25)" },
            { label: "Off track", count: healthCounts.off, color: "#F45D48", bg: "rgba(244,93,72,.1)", border: "rgba(244,93,72,.25)" },
          ].map(h => (
            <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, background: h.bg, border: `.5px solid ${h.border}` }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: h.color, flexShrink: 0, animation: h.label === "On target" ? "lp 2.5s ease-in-out infinite" : "none" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: h.color }}>{h.count}</span>
              <span style={{ fontSize: 12, color: C.tx2 }}>{h.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
            {[
              { l: "Variance", v: `${totVar >= 0 ? "+" : ""}${totVar.toFixed(1)}%`, c: Math.abs(totVar) <= 5 ? "#0AC8A0" : C.amber },
              { l: "Wkly fcst", v: totWk.toLocaleString(), c: C.tx1 },
            ].map(k => (
              <div key={k.l} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em" }}>{k.l}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 3, marginBottom: 14, background: "rgba(255,255,255,.04)", borderRadius: 11, padding: 4 }}>
        {[["cards", "◫  CT Cards", data.length], ["chart", "◈  Chart", null], ["modellab", "⚗  Model Lab", null]].map(([id, label, badge]) => (
          <button key={id} onClick={() => { setTab(id); setSelCt(null); setSearch(""); }}
            style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 500, transition: "all .15s",
              background: tab === id ? "linear-gradient(135deg,rgba(10,128,128,.25),rgba(10,200,150,.1))" : "transparent",
              color: tab === id ? C.tx0 : C.tx2,
              boxShadow: tab === id ? `0 0 0 .5px rgba(10,128,128,.3)` : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            }}>
            {label}
            {badge !== null && <span style={{ fontSize: 10, background: tab === id ? "rgba(10,200,150,.2)" : "rgba(255,255,255,.07)", color: tab === id ? "#0AC8A0" : C.tx2, padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* CT Cards tab */}
      {tab === "cards" && !selCt && (
        <div>
          {/* Search + Category filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.tx2, pointerEvents: "none" }}>⌕</span>
              <input type="text" placeholder="Search CTs…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 9, background: C.surf, border: `.5px solid ${C.bd}`, color: C.tx0, fontSize: 13, width: 180, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {cats.map(cat => {
                const cs = catSummary.find(c => c.name === cat);
                const hc = cs ? catHealthColor(cs) : "#0AC8A0";
                const active = filterCat === cat;
                return (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20,
                      border: `.5px solid ${active ? hc : C.bd}`,
                      background: active ? `${hc}18` : "transparent",
                      color: active ? hc : C.tx2,
                      fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all .15s" }}>
                    {cat !== "All" && cs && <span style={{ width: 5, height: 5, borderRadius: "50%", background: hc, flexShrink: 0 }} />}
                    {cat}
                    {cs && <span style={{ fontSize: 10, opacity: .7 }}>{cs.q}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.tx2, fontSize: 14 }}>No CTs match your filter.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>
            {filtered.map(ct => (
              <CCForecastCard key={ct.id} ct={ct} onClick={() => setSelCt(ct.id)} />
            ))}
          </div>
        </div>
      )}

      {/* CT Drill-down */}
      {tab === "cards" && selCt && d && (
        <div>
          <button onClick={() => setSelCt(null)}
            style={{ padding: "6px 12px", borderRadius: 9, background: "rgba(255,255,255,.08)", color: C.tx1, border: `.5px solid ${C.bd}`, fontSize: 12, cursor: "pointer", fontWeight: 500, marginBottom: 14 }}>
            ← All CTs
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx0 }}>{d.name}</div>
            <span style={{ fontSize: 11, color: C.tx2, background: "rgba(255,255,255,.06)", padding: "2px 8px", borderRadius: 6 }}>{d.category}</span>
            <span style={{ fontSize: 11, color: d.channel === "Phone" ? "#0A9090" : d.channel === "Email" ? "#185FA5" : "#2BABAD", background: "rgba(255,255,255,.05)", padding: "2px 8px", borderRadius: 6 }}>{d.channel}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { l: "Fcst Vol", v: d.forecastVolume.toLocaleString() },
              { l: "Actual Vol", v: d.actualVolume.toLocaleString() },
              { l: "Variance", v: d.forecastVolume > 0 ? `${((d.actualVolume - d.forecastVolume) / d.forecastVolume * 100).toFixed(1)}%` : "—", c: Math.abs((d.actualVolume - d.forecastVolume) / (d.forecastVolume || 1) * 100) <= 5 ? "#0AC8A0" : C.amber },
              { l: "Fcst AHT", v: d.forecastAHT ? d.forecastAHT + "s" : "—" },
              { l: "Actual AHT", v: d.actualAHT ? d.actualAHT + "s" : "—" },
              { l: "Service Level", v: d.serviceLevel ? d.serviceLevel + "%" : "N/A", c: d.serviceLevel >= (d.slTarget || 80) ? "#0AC8A0" : d.serviceLevel > 0 ? C.guava : C.tx2 },
              { l: "SL Target", v: d.slTarget ? d.slTarget + "%" : "—" },
              { l: "Weekly Fcst", v: d.weeklyForecastVolume?.toLocaleString() || "—" },
              { l: "Trend", v: d.weeklyTrend != null ? `${d.weeklyTrend >= 0 ? "+" : ""}${d.weeklyTrend}%` : "—", c: d.weeklyTrend >= 0 ? "#0AC8A0" : C.guava },
            ].map(k => (
              <div key={k.l} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{k.l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.c || C.tx0 }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart tab */}
      {tab === "chart" && (
        <div>
          <CCChart data={catSummary} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8, marginTop: 12 }}>
            {catSummary.map(c => {
              const vPct = c.forecastVolume > 0 ? ((c.actualVolume - c.forecastVolume) / c.forecastVolume * 100) : 0;
              const vc = Math.abs(vPct) <= 5 ? "#0AC8A0" : Math.abs(vPct) <= 12 ? C.amber : C.guava;
              return (
                <div key={c.name} style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 10, padding: "10px 13px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.tx0 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: C.tx2 }}>{c.q} CTs · {c.forecastVolume.toLocaleString()} fcst</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: vc }}>{vPct >= 0 ? "+" : ""}{vPct.toFixed(1)}%</div>
                    {c.slCount > 0 && <div style={{ fontSize: 11, color: C.tx2 }}>SL {Math.round(c.slSum / c.slCount)}%</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Lab tab */}
      {tab === "modellab" && (
        canEdit
          ? <CCModelLab forecastData={data} />
          : <div style={{ textAlign: "center", padding: "40px 0", color: C.tx2, fontSize: 14 }}>Model Lab is available to WFM analysts only.</div>
      )}
    </div>
  );
}


function ManagerDashboard({ user, onNav }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.tx0, marginBottom: 4 }}><TW text={`${new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}, ${user.name.split(" ")[0]}`} speed={38} /></div>
        <div style={{ fontSize: 13, color: C.tx2 }}>Manager · {user.pillar} · {TODAY_LABEL}</div>
      </div>

      {/* Right Now live strip */}
      <ManagerLiveStrip onNav={onNav} />

      <div className="ps" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
        {[{ l: "Queue alerts", v: "2", c: C.guava, click: () => onNav("queue") }, { l: "Approvals", v: "3", c: C.guava, click: () => onNav("approvals") }, { l: "Adherence", v: "94%", c: "#0AC8A0" }, { l: "Coverage", v: "78%", c: C.amber }].map(k => (
          <div key={k.l} onClick={k.click}
            style={{ background: C.card, border: `.5px solid ${k.click ? "rgba(244,93,72,.3)" : C.bd}`, borderRadius: 12, padding: "11px 13px", cursor: k.click ? "pointer" : "default", transition: "all .2s" }}
            onMouseEnter={e => { if (k.click) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = C.elev; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = C.card; }}>
            <div style={{ fontSize: 11, color: C.tx2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <PrismScore score={82} label={`${user.pillar} team health`}
          breakdown={[{label:"Team adherence",value:94},{label:"Queue SL",value:81},{label:"Coverage",value:78},{label:"Approval speed",value:91}]}
          color={C.amber} onNav={() => onNav("ops")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: C.card, border: ".5px solid rgba(244,93,72,.3)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.guava, animation: "lp 1.5s ease-in-out infinite" }} />
            Live queue alerts
          </div>
          {[{ n: "BenOps Priority", sl: 68, wait: 7, type: "CRITICAL" }, { n: "SMB Sales Inbound", sl: 74, wait: 9, type: "WARNING" }].map(q => (
            <div key={q.n} style={{ padding: "8px 10px", borderRadius: 9, background: "rgba(244,93,72,.06)", border: ".5px solid rgba(244,93,72,.15)", marginBottom: 7 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                <Pill label={q.type} color={q.type === "CRITICAL" ? C.guava : C.amber} small />
                <span style={{ fontSize: 13, fontWeight: 500, color: C.tx0, flex: 1 }}>{q.n}</span>
              </div>
              <div style={{ fontSize: 12, color: C.tx2 }}>SL {q.sl}% · {q.wait} waiting</div>
            </div>
          ))}
          <button onClick={() => onNav("queue")} style={{ width: "100%", marginTop: 4, padding: "7px 0", borderRadius: 9, background: `linear-gradient(135deg,${C.guava},#E04030)`, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Open queue analytics
          </button>
        </div>
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 10 }}>Pillar coverage</div>
          {Object.keys(FULL_ROSTER).slice(0, 6).map(name => {
            const pd = FULL_ROSTER[name];
            const ct = pd.a.length;
            const active = ct;
            const color = pd.c;
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.tx1, flex: 1 }}>{name}</span>
                <div style={{ width: 60, height: 5, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "100%", background: color, borderRadius: 3 }}></div>
                </div>
                <span style={{ fontSize: 12, color: C.tx2, minWidth: 28, textAlign: "right" }}>{active}/{ct}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── WFM DASHBOARD ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// LIVE CONNECTIONS — SWITCHBOARD + CONNECTOR GRID
// ══════════════════════════════════════════════════════════════
const SB_COMPLIANCE = [
  { name:"Deployment Practices",   pct:100, levels:3 },
  { name:"GitHub Settings",        pct:100, levels:3 },
  { name:"SCM Compliance",         pct:100, levels:1 },
  { name:"Container Security",     pct:80,  levels:3 },
  { name:"Observability",          pct:80,  levels:2 },
  { name:"Software Catalog",       pct:90,  levels:2 },
  { name:"Team Metadata",          pct:80,  levels:1 },
  { name:"Service Mesh Standards", pct:0,   levels:2 },
];

const SB_INCIDENTS = [
  { sev:"SEV-3", title:"ETL SLO Breach",                                    age:"1d",  impact:"Reporting & forecast data feeds" },
  { sev:"SEV-3", title:"3,000 customers at risk of liens — 940 issue",       age:"9d",  impact:"High inbound volume expected" },
  { sev:"SEV-4", title:"HI Active Benefits not updating in Salesforce",       age:"6d",  impact:"BenOps agent data accuracy" },
  { sev:"SEV-4", title:"HI Kafka Consumer latency +2 hours",                  age:"11d", impact:"HI/Benefits data lag" },
  { sev:"SEV-3", title:"SLO breached: Managing Payrolls / Dashboard",         age:"37d", impact:"Payroll agent dashboard" },
];

const SB_TEAM = [
  { name:"Dwight Simpson",  role:"WFM Lead",         initials:"DS" },
  { name:"Ammad Williams",  role:"WFM Analyst",      initials:"AW" },
  { name:"David Percival",  role:"WFM Engineer",     initials:"DP" },
  { name:"Conner Church",   role:"Forecast (LaFlare)",initials:"CC" },
  { name:"Bunny Bates",     role:"Forecast (Lola)",  initials:"BB" },
  { name:"Heather Barker",  role:"Forecast (A7X)",   initials:"HB" },
  { name:"Franky Fernandez",role:"Ops",              initials:"FF" },
];

const OTHER_CONNECTORS = [
  { name:"PagerDuty",        icon:"🔔", status:"configured", desc:"Incident alerts → WFM schedule actions" },
  { name:"NICE IEX",         icon:"📡", status:"configured", desc:"ACD feed · schedule export · adherence" },
  { name:"Slack",            icon:"💬", status:"configured", desc:"Alert routing · team notifications" },
  { name:"Workday",          icon:"👤", status:"configured", desc:"Roster sync · headcount · org changes" },
  { name:"Google Calendar",  icon:"📅", status:"configured", desc:"Schedule publish → agent calendars" },
  { name:"Greenhouse",       icon:"🌱", status:"pending",    desc:"New hire onboarding → roster pre-load" },
  { name:"BigQuery",         icon:"📊", status:"configured", desc:"Historical volume · forecast training data" },
  { name:"Google Sheets",    icon:"🗒️", status:"configured", desc:"Capacity plan exports · ad-hoc reporting" },
  { name:"Jira",             icon:"🎯", status:"pending",    desc:"WFM project tracking · sprint board" },
  { name:"Okta",             icon:"🔐", status:"configured", desc:"Role-based access · SSO integration" },
];

function ConnectionsView() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));

  function doSync() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
      window.prismToast?.("Switchboard sync complete — data refreshed","success");
    }, 1600);
  }

  const sbScore = { total:100, grade:"A", tpo:20, sec:35, post:10, slo:35 };
  const sevColor = s => s === "SEV-3" ? C.guava : s === "SEV-4" ? C.amber : C.tx2;
  const pctColor = p => p === 100 ? "#0AC8A0" : p >= 80 ? C.amber : C.guava;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:C.tx0, marginBottom:3 }}>Live Connections</div>
            <div style={{ fontSize:12, color:C.tx2 }}>{OTHER_CONNECTORS.filter(c=>c.status==="configured").length+1} connectors active · Switchboard synced · last updated {lastSync}</div>
          </div>
          <button onClick={doSync} disabled={syncing}
            style={{ padding:"7px 16px", borderRadius:10, background:syncing?"rgba(10,128,128,.08)":`linear-gradient(135deg,${C.kale},#0AB0B0)`, border:syncing?`.5px solid rgba(10,128,128,.2)`:"none", color:syncing?C.kale:"#fff", fontSize:13, fontWeight:600, cursor:syncing?"default":"pointer", display:"flex", alignItems:"center", gap:7, transition:"all .2s" }}>
            <span style={{ display:"inline-block", animation:syncing?"spin 1s linear infinite":"none", fontSize:13 }}>↺</span>
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {/* Switchboard hero */}
      <div style={{ background:"linear-gradient(135deg,rgba(10,128,128,.1),rgba(127,119,221,.06))", border:`.5px solid rgba(10,128,128,.25)`, borderRadius:16, padding:18, marginBottom:14 }}>
        {/* Top row */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(10,128,128,.18)", border:`.5px solid rgba(10,128,128,.3)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⬡</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.tx0 }}>Switchboard</div>
              <div style={{ fontSize:11, color:C.tx2 }}>Gusto Software Catalog · team-workforce-management-dwight-simpson</div>
            </div>
            <span style={{ fontSize:10, fontWeight:700, color:"#0AC8A0", background:"rgba(10,200,150,.12)", border:".5px solid rgba(10,200,150,.3)", padding:"3px 10px", borderRadius:8, letterSpacing:".06em" }}>● CONNECTED</span>
          </div>
          {/* Report card */}
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(255,215,0,.08)", border:".5px solid rgba(255,215,0,.22)", borderRadius:12, padding:"10px 16px" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#FFD700", lineHeight:1 }}>{sbScore.grade}</div>
              <div style={{ fontSize:9, color:"rgba(255,215,0,.55)", letterSpacing:".1em", textTransform:"uppercase", marginTop:2 }}>Report Card</div>
            </div>
            <div style={{ width:.5, height:36, background:"rgba(255,215,0,.2)" }}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 14px" }}>
              {[["TPO",sbScore.tpo,20],["Security",sbScore.sec,35],["Postmortem",sbScore.post,10],["SLO",sbScore.slo,35]].map(([l,v,max]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:20, height:3, background:"rgba(255,255,255,.08)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${v/max*100}%`, background:"#FFD700", borderRadius:2 }}/>
                  </div>
                  <span style={{ fontSize:9, color:"rgba(255,215,0,.7)" }}>{l} {v}/{max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Three columns: compliance · incidents · team */}
        <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1.2fr .9fr", gap:14 }}>
          {/* Compliance */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>Soundcheck compliance</div>
              <div style={{ fontSize:18, fontWeight:800, color:41.17>=80?"#0AC8A0":41.17>=60?C.amber:C.guava }}>41%</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {SB_COMPLIANCE.map(t => (
                <div key={t.name}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:10, color:t.pct===0?C.guava:C.tx2 }}>{t.name}</span>
                    <span style={{ fontSize:10, fontWeight:600, color:pctColor(t.pct) }}>{t.pct}%</span>
                  </div>
                  <div style={{ height:3, background:"rgba(255,255,255,.06)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${t.pct}%`, background:pctColor(t.pct), borderRadius:2, transition:"width .6s ease" }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CX-impacting incidents */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>Active incidents · CX impact</div>
              <span style={{ fontSize:10, color:C.tx2 }}>25 org-wide</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {SB_INCIDENTS.map((inc,i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"7px 10px", borderRadius:9, background:"rgba(255,255,255,.03)", border:`.5px solid rgba(255,255,255,.06)` }}>
                  <span style={{ fontSize:9, fontWeight:700, color:sevColor(inc.sev), background:`${sevColor(inc.sev)}15`, padding:"2px 6px", borderRadius:5, flexShrink:0, marginTop:1 }}>{inc.sev}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:C.tx0, lineHeight:1.3, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inc.title}</div>
                    <div style={{ fontSize:9, color:C.tx2 }}>{inc.impact} · {inc.age} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team roster */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.tx0, marginBottom:10 }}>WFM team · {SB_TEAM.length} members</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {SB_TEAM.map(m => (
                <div key={m.name} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:8, background:`rgba(10,128,128,.18)`, border:`.5px solid rgba(10,128,128,.25)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:C.kale, flexShrink:0 }}>{m.initials}</div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:500, color:C.tx0, lineHeight:1.2 }}>{m.name}</div>
                    <div style={{ fontSize:9, color:C.tx2 }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Other connectors grid */}
      <div style={{ fontSize:12, fontWeight:600, color:C.tx1, marginBottom:10, letterSpacing:"-.01em" }}>Other connectors</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
        {OTHER_CONNECTORS.map(c => (
          <div key={c.name} style={{ background:C.card, border:`.5px solid ${c.status==="configured"?C.bd:"rgba(239,159,39,.2)"}`, borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18 }}>{c.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>{c.name}</span>
              </div>
              <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8, letterSpacing:".06em",
                color:c.status==="configured"?"#0AC8A0":C.amber,
                background:c.status==="configured"?"rgba(10,200,150,.1)":"rgba(239,159,39,.1)",
                border:`.5px solid ${c.status==="configured"?"rgba(10,200,150,.25)":"rgba(239,159,39,.25)"}`,
              }}>{c.status==="configured"?"ACTIVE":"PENDING"}</span>
            </div>
            <div style={{ fontSize:11, color:C.tx2, lineHeight:1.4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WFMDashboard({ user, onNav }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 5000); return () => clearInterval(iv); }, []);
  const liveSL    = 83 + Math.round(Math.sin(tick * 0.6) * 4);
  const liveAdh   = 9 + (tick % 5 === 0 ? 0 : tick % 3 === 0 ? -1 : 1);
  const liveQueue = 3 + (tick % 4);
  const migration = [
    ["ClearCast forecast engine", true], ["Schedule editor + Gantt", true],
    ["Approval auto-workflow", true],    ["Queue analytics F vs A", true],
    ["Role-based access control", true], ["Live ACD feed", false],
    ["Workday HR sync", false],          ["SmartSync fully retired", false],
  ];
  const done = migration.filter(([, d]) => d).length;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize:10, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:6, opacity:.75 }}>Workforce Intelligence</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.tx0, marginBottom: 4 }}><TW text={`${new Date().getHours()<12?"Good morning":new Date().getHours()<17?"Good afternoon":"Good evening"}, ${user.name.split(" ")[0]}`} speed={38} /></div>
        <div style={{ fontSize: 13, color: C.tx2 }}>Prism Platform · {TODAY_LABEL} · Platform rollout in progress · IEX retirement pending</div>
      </div>
      <div className="ps" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { l:"Queue alerts",  v:2,    suf:"",    c:C.guava,   click:()=>onNav("queue") },
          { l:"Approvals",     v:3,    suf:"",    c:C.guava,   click:()=>onNav("approvals") },
          { l:"Forecast acc.", v:97.1, suf:"%",   c:"#0AC8A0", decimals:1 },
          { l:"Total roster",  v:732,  suf:"",    c:"#0AC8A0" },
        ].map(k => (
          <div key={k.l} onClick={k.click}
            style={{ background:C.card, border:`.5px solid ${k.click?"rgba(244,93,72,.3)":C.bd}`, borderRadius:12, padding:"11px 13px", cursor:k.click?"pointer":"default", transition:"all .2s" }}
            onMouseEnter={e => { if (k.click) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.background=C.elev; } }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.background=C.card; }}>
            <div style={{ fontSize:11, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k.l}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.c, lineHeight:1, animation:"count-rise .6s ease both" }}>
              <CountUp to={k.v} decimals={k.decimals||0} suffix={k.suf||""} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
        <PrismScore score={87} label="Platform health · all pillars"
          breakdown={[{label:"Service Level",value:81},{label:"Adherence",value:94},{label:"Forecast accuracy",value:97},{label:"Approval speed",value:88}]}
          color={C.kale} onNav={() => onNav("ops")} />
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 8 }}>SmartSync migration · {done}/{migration.length}</div>
          <div style={{ height: 5, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${done / migration.length * 100}%`, background: `linear-gradient(90deg,${C.kale},#12B0B0)`, transition: "width 1.2s ease" }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 16px" }}>
            {migration.map(([label, d]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: d ? "#0AC8A0" : "rgba(255,255,255,.18)", fontSize: 13, fontWeight: d ? 700 : 400 }}>{d ? "✓" : "○"}</span>
                <span style={{ color: d ? C.tx0 : C.tx2 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14, cursor:"pointer", transition:"all .2s" }}
          onClick={() => onNav("ops")}
          onMouseEnter={e=>{e.currentTarget.style.background=C.elev;}} onMouseLeave={e=>{e.currentTarget.style.background=C.card;}}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 8, display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#0AC8A0", animation:"lp 1.8s ease-in-out infinite" }}/>
            Live ops snapshot
          </div>
          {[{l:"Agents in adherence",v:`${liveAdh}/12`,c:liveAdh>=10?"#0AC8A0":C.amber},{l:"Current SL",v:`${liveSL}%`,c:liveSL>=82?"#0AC8A0":C.guava},{l:"Queue depth",v:`${liveQueue} waiting`,c:liveQueue<=4?"#0AC8A0":C.amber},{l:"SL risk at 2pm",v:"⚠️ Watch",c:C.amber}].map(k=>(
            <div key={k.l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`.5px solid rgba(255,255,255,.04)` }}>
              <span style={{ fontSize:12, color:C.tx2 }}>{k.l}</span>
              <span style={{ fontSize:12, fontWeight:600, color:k.c }}>{k.v}</span>
            </div>
          ))}
          <div style={{ fontSize:11, color:C.kale, marginTop:8, fontWeight:600 }}>Open Real Time Management →</div>
        </div>
        <div style={{ background: C.card, border: `.5px solid ${C.bd}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tx0, marginBottom: 10 }}>Pillar overview</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 6 }}>
            {Object.keys(FULL_ROSTER).slice(0, 6).map(name => {
              const pd = FULL_ROSTER[name];
              return (
                <div key={name} onClick={() => onNav("roster")}
                  style={{ background: C.surf, borderRadius: 9, padding: 8, textAlign: "center", cursor: "pointer", border: ".5px solid " + C.bd, transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = pd.c + "12"; e.currentTarget.style.borderColor = pd.c + "40"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surf; e.currentTarget.style.borderColor = C.bd; }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: pd.c, margin: "0 auto 4px" }}></div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.tx0, lineHeight: 1.3, marginBottom: 2 }}>{name.length > 14 ? name.slice(0, 12) + ".." : name}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: pd.c, lineHeight: 1 }}>{pd.a.length}</div>
                  <div style={{ fontSize: 9, color: C.tx2 }}>agents</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Pri Intelligence panel */}
      <div style={{ background:C.card, border:`.5px solid ${C.kale}22`, borderRadius:14, padding:16, marginTop:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
          <div style={{ width:22, height:22, borderRadius:7, background:`${C.kale}18`, border:`.5px solid ${C.kale}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.tx0 }}>Pri Intelligence</div>
          <div style={{ fontSize:11, color:C.kale, fontWeight:500, marginLeft:"auto" }}>3 insights · live</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:8 }}>
          {getAiInsights("wfm-dashboard").map((ins, i) => (
            <PriInsight key={i} {...ins} onAction={ins.action ? () => onNav(i===1?"ops":"approvals") : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATION CENTER
// ══════════════════════════════════════════════════════════════
const INIT_NOTIFS = [
  { id:1,  type:"alert",    from:"WFM",          to:"all",    time:"10:28 AM", title:"BenOps SL below 80%", body:"BenOps Priority queue has dropped to 68% SL. OT offer opened. Please stay on queue until further notice.", read:false, pillar:"BenOps" },
  { id:2,  type:"schedule", from:"WFM",          to:"agents", time:"9:55 AM",  title:"Schedule updated",    body:"Your schedule for Thursday May 15 has been updated. Break moved from 2:00 PM to 2:30 PM due to coverage needs.", read:false, pillar:null },
  { id:3,  type:"approval", from:"System",       to:"manager",time:"9:42 AM",  title:"Swap request approved",body:"Anthony Piper ↔ Briana Perez swap on May 16 has been auto-approved per coverage rules.", read:true, pillar:"Payroll" },
  { id:4,  type:"broadcast",from:"Cyndy Boerger",to:"all",    time:"9:15 AM",  title:"Team standup moved",  body:"Today's 10am team sync has moved to 10:30am. Zoom link unchanged. Payroll & Taxes team only.", read:true, pillar:"Payroll" },
  { id:5,  type:"info",     from:"ClearCast",    to:"wfm",    time:"8:51 AM",  title:"Forecast updated",    body:"ClearCast has re-run the 11am–3pm forecast. Volume is now trending 18% above original forecast for SMB Sales. Schedule review recommended.", read:true, pillar:null },
  { id:6,  type:"alert",    from:"System",       to:"all",    time:"8:30 AM",  title:"3 agents running late",body:"Anthony Piper, Mason Amling, and Donna Jo Doney have not logged in within 5 minutes of shift start.", read:true, pillar:null },
];

const NOTIF_ICONS = { alert:"⚠️", schedule:"📅", approval:"✓", broadcast:"📣", info:"ℹ️" };
function notifColor(type) {
  return type==="alert"?"#F45D48":type==="schedule"?"#0A8080":type==="approval"?"#0AC8A0":type==="broadcast"?"#EF9F27":"#7F77DD";
}

function NotificationCenter({ role, notifs, setNotifs, onClose }) {
  const [tab, setTab] = useState("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMsg, setComposeMsg] = useState("");
  const [composeTo, setComposeTo] = useState("all");
  const [composeSent, setComposeSent] = useState(false);

  const filtered = tab === "all" ? notifs : notifs.filter(n => n.type === tab);
  const unread = notifs.filter(n => !n.read).length;

  function markAll() { setNotifs(ns => ns.map(n => ({ ...n, read:true }))); }
  function markRead(id) { setNotifs(ns => ns.map(n => n.id===id ? {...n,read:true} : n)); }

  return (
    <div style={{ position:"fixed", top:52, right:16, width:380, maxHeight:"80vh", background:C.elev, border:`.5px solid ${C.bd}`, borderRadius:16, boxShadow:"0 24px 80px rgba(0,0,0,.6)", zIndex:500, display:"flex", flexDirection:"column", animation:"view-in .15s ease" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px 10px", borderBottom:`.5px solid ${C.bd}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <span style={{ fontSize:15, fontWeight:700, color:C.tx0, flex:1 }}>Notifications</span>
        {unread > 0 && <span style={{ fontSize:11, fontWeight:700, color:"#F45D48", background:"rgba(244,93,72,.12)", border:".5px solid rgba(244,93,72,.25)", padding:"2px 8px", borderRadius:10 }}>{unread} unread</span>}
        {unread > 0 && <button onClick={markAll} style={{ fontSize:11, color:C.tx2, background:"none", border:"none", cursor:"pointer", transition:"color .12s" }} onMouseEnter={e=>e.currentTarget.style.color=C.tx0} onMouseLeave={e=>e.currentTarget.style.color=C.tx2}>Mark all read</button>}
        <button onClick={onClose} style={{ background:"rgba(255,255,255,.06)", border:`.5px solid ${C.bd}`, color:C.tx2, borderRadius:8, width:26, height:26, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, padding:"8px 10px 0", flexShrink:0 }}>
        {[["all","All"],["alert","Alerts"],["schedule","Schedule"],["broadcast","Broadcasts"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ padding:"4px 10px", borderRadius:7, fontSize:11, fontWeight:500, cursor:"pointer", background:tab===v?"rgba(255,255,255,.1)":"none", color:tab===v?C.tx0:C.tx2, border:tab===v?`.5px solid ${C.bd}`:"none", transition:"all .12s" }}>{l}</button>
        ))}
      </div>

      {/* Compose broadcast (WFM/Manager only) */}
      {(role === "wfm" || role === "manager") && !composeOpen && (
        <div style={{ padding:"8px 12px 0", flexShrink:0 }}>
          <button onClick={() => setComposeOpen(true)} style={{ width:"100%", padding:"9px 14px", borderRadius:10, background:`${C.kale}10`, border:`.5px solid ${C.kale}25`, color:C.kale, fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:7, transition:"all .15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background=`${C.kale}18`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${C.kale}10`;}}>
            📣 Send broadcast to team
          </button>
        </div>
      )}

      {/* Compose panel */}
      {composeOpen && (
        <div style={{ margin:"8px 12px 0", background:"rgba(255,255,255,.03)", border:`.5px solid ${C.bd}`, borderRadius:12, padding:14, flexShrink:0, animation:"fade-up .18s ease" }}>
          {composeSent ? (
            <div style={{ textAlign:"center", padding:"8px 0" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>📣</div>
              <div style={{ fontSize:14, fontWeight:700, color:C.tx0, marginBottom:4 }}>Broadcast sent!</div>
              <div style={{ fontSize:12, color:C.tx2 }}>All {composeTo === "all" ? "Gusties" : composeTo} notified in-app</div>
              <button onClick={() => { setComposeOpen(false); setComposeMsg(""); setComposeSent(false); }} style={{ marginTop:10, padding:"6px 14px", borderRadius:8, background:`${C.kale}18`, border:`.5px solid ${C.kale}30`, color:C.kale, fontSize:12, cursor:"pointer" }}>Done</button>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:600, color:C.tx0 }}>Broadcast message</span>
                <button onClick={() => setComposeOpen(false)} style={{ background:"none", border:"none", color:C.tx2, fontSize:15, cursor:"pointer" }}>×</button>
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                {[["all","All Gusties"],["agents","Agents only"],["manager","Managers only"],["wfm","WFM team"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setComposeTo(v)} style={{ padding:"4px 10px", borderRadius:7, fontSize:11, fontWeight:500, cursor:"pointer", background:composeTo===v?`${C.kale}20`:"rgba(255,255,255,.04)", color:composeTo===v?C.kale:C.tx2, border:`.5px solid ${composeTo===v?C.kale+"40":C.bd}` }}>{l}</button>
                ))}
              </div>
              <textarea value={composeMsg} onChange={e=>setComposeMsg(e.target.value)} placeholder="Write your message to the team…" rows={3}
                style={{ width:"100%", background:"rgba(255,255,255,.04)", border:`.5px solid ${C.bd}`, borderRadius:9, padding:"9px 11px", fontSize:13, color:C.tx0, resize:"none", outline:"none", boxSizing:"border-box", lineHeight:1.5 }}/>
              <div style={{ display:"flex", gap:7, marginTop:10 }}>
                <button onClick={() => setComposeOpen(false)} style={{ flex:1, padding:"8px 0", borderRadius:9, background:"rgba(255,255,255,.05)", color:C.tx2, border:`.5px solid ${C.bd}`, fontSize:13, cursor:"pointer" }}>Cancel</button>
                <button onClick={() => { if (composeMsg.trim()) setComposeSent(true); }} style={{ flex:2, padding:"8px 0", borderRadius:9, background:`linear-gradient(135deg,${C.kale},${C.kale}BB)`, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer" }}>Send broadcast →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Notification list */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 6px 10px" }}>
        {filtered.length === 0 && <div style={{ textAlign:"center", padding:"28px 0", fontSize:13, color:C.tx2 }}>No notifications in this category</div>}
        {filtered.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)}
            style={{ display:"flex", gap:11, padding:"11px 12px", borderRadius:11, cursor:"pointer", background:n.read?"transparent":"rgba(255,255,255,.035)", border:`.5px solid ${n.read?"transparent":C.bd}`, marginBottom:4, transition:"all .15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";}}
            onMouseLeave={e=>{e.currentTarget.style.background=n.read?"transparent":"rgba(255,255,255,.035)";}}>
            <div style={{ width:34, height:34, borderRadius:10, background:`${notifColor(n.type)}14`, border:`.5px solid ${notifColor(n.type)}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>
              {NOTIF_ICONS[n.type]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <span style={{ fontSize:13, fontWeight: n.read ? 500 : 700, color:C.tx0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{n.title}</span>
                {!n.read && <div style={{ width:6, height:6, borderRadius:"50%", background:notifColor(n.type), flexShrink:0 }}/>}
              </div>
              <div style={{ fontSize:11, color:C.tx2, lineHeight:1.5, marginBottom:4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{n.body}</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:"rgba(255,255,255,.2)" }}>{n.time}</span>
                <span style={{ fontSize:10, fontWeight:600, color:notifColor(n.type), background:`${notifColor(n.type)}12`, padding:"1px 6px", borderRadius:6, textTransform:"uppercase" }}>{n.type}</span>
                {n.from !== "System" && <span style={{ fontSize:10, color:C.tx2 }}>from {n.from}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ROLES ADMIN VIEW ─────────────────────────────────────────
function RolesAdminView() {
  const [expandedRole, setExpandedRole] = useState(null);
  const [activeTab, setActiveTab] = useState("structure");
  const roleColors = { agent:C.purple, manager:C.amber, wfm:C.kale };
  const roleIcons  = { agent:"★", manager:"◈", wfm:"⚡" };
  const allPerms = [
    { key:"view.dashboard",  label:"View dashboard" },
    { key:"view.schedule",   label:"View schedule" },
    { key:"view.timeoff",    label:"Time off" },
    { key:"view.achievements",label:"Achievements" },
    { key:"view.queue",      label:"Queue analytics" },
    { key:"view.rtm",        label:"Real Time Mgmt" },
    { key:"view.forecast",   label:"ClearCast / Forecast" },
    { key:"view.approvals",  label:"Approvals" },
    { key:"edit.schedule",   label:"Edit schedules" },
    { key:"edit.roster",     label:"Edit roster" },
    { key:"view.connections",label:"Live Connections" },
    { key:"admin.roles",     label:"Role administration" },
  ];
  return (
    <div>
      <div style={{ fontSize:9, fontWeight:800, color:C.kale, letterSpacing:".18em", textTransform:"uppercase", marginBottom:5, opacity:.7 }}>Workforce Intelligence</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
        <div style={{ fontSize:17, fontWeight:700, color:C.tx0 }}>Roles & Permissions</div>
        <div style={{ fontSize:11, color:C.tx2, background:`${C.amber}12`, border:`.5px solid ${C.amber}30`, borderRadius:8, padding:"4px 10px" }}>
          ⚠ Live editing coming Q3 2026 — config is read-only
        </div>
      </div>
      <div style={{ fontSize:12, color:C.tx2, marginBottom:16 }}>Define role structure, sub-roles, levels, and feature permissions across the platform.</div>

      <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,.04)", borderRadius:10, padding:3, marginBottom:16, width:"fit-content" }}>
        {[["structure","Structure"],["permissions","Permissions"],["members","Members"]].map(([t,l]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding:"5px 14px", borderRadius:8, fontSize:12, fontWeight:activeTab===t?600:400, background:activeTab===t?"rgba(255,255,255,.1)":"none", color:activeTab===t?C.tx0:C.tx2, border:activeTab===t?`.5px solid ${C.bd}`:"none", cursor:"pointer", transition:"all .15s" }}>{l}</button>
        ))}
      </div>

      {activeTab === "structure" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.entries(ROLES_CONFIG).map(([roleKey, cfg]) => {
            const rc = roleColors[roleKey]; const icon = roleIcons[roleKey];
            const isOpen = expandedRole === roleKey;
            return (
              <div key={roleKey} style={{ background:C.card, border:`.5px solid ${isOpen?rc+"40":C.bd}`, borderLeft:`3px solid ${rc}`, borderRadius:14, overflow:"hidden", transition:"all .2s" }}>
                <div onClick={() => setExpandedRole(isOpen ? null : roleKey)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${rc}18`, border:`.5px solid ${rc}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:C.tx0 }}>{ROLE_META[roleKey]?.label}</div>
                      <div style={{ fontSize:11, color:C.tx2 }}>{Object.keys(cfg.subRoles).length} sub-roles · {cfg.levels.length} levels</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {cfg.levels.map(l => <span key={l} style={{ fontSize:9, fontWeight:700, color:rc, background:`${rc}15`, borderRadius:5, padding:"2px 6px", letterSpacing:".05em" }}>{l}</span>)}
                    <span style={{ color:C.tx2, fontSize:12, marginLeft:4 }}>{isOpen?"▲":"▼"}</span>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding:"0 18px 16px", borderTop:`.5px solid ${C.bd}`, paddingTop:14, animation:"fade-up .2s ease" }}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.tx2, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Sub-roles</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
                      {Object.entries(cfg.subRoles).map(([srKey, sr]) => (
                        <div key={srKey} style={{ background:"rgba(255,255,255,.03)", border:`.5px solid ${C.bd}`, borderRadius:10, padding:"10px 14px" }}>
                          <div style={{ fontSize:13, fontWeight:600, color:C.tx0, marginBottom:3 }}>{sr.label}</div>
                          <div style={{ fontSize:11, color:C.tx2 }}>{sr.desc}</div>
                          {sr.focusView && <div style={{ marginTop:6, fontSize:10, color:rc, background:`${rc}12`, borderRadius:6, padding:"2px 7px", display:"inline-block" }}>Focus: {sr.focusView}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "permissions" && (
        <div style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr repeat(3,1fr)", padding:"10px 16px", borderBottom:`.5px solid ${C.bd}`, background:"rgba(255,255,255,.02)" }}>
            <div style={{ fontSize:10, fontWeight:600, color:C.tx2, textTransform:"uppercase", letterSpacing:".06em" }}>Feature</div>
            {["agent","manager","wfm"].map(r => <div key={r} style={{ fontSize:10, fontWeight:600, color:roleColors[r], textTransform:"uppercase", letterSpacing:".06em", textAlign:"center" }}>{ROLE_META[r]?.label}</div>)}
          </div>
          {allPerms.map((p, i) => (
            <div key={p.key} style={{ display:"grid", gridTemplateColumns:"1.6fr repeat(3,1fr)", padding:"9px 16px", borderBottom:i<allPerms.length-1?`.5px solid ${C.bd}`:undefined, background:i%2?"rgba(255,255,255,.01)":undefined }}>
              <div style={{ fontSize:12, color:C.tx1 }}>{p.label}</div>
              {["agent","manager","wfm"].map(r => (
                <div key={r} style={{ textAlign:"center" }}>
                  <span style={{ fontSize:13, color:ROLES_CONFIG[r].permissions[p.key]?"#0AC8A0":"rgba(255,255,255,.15)" }}>
                    {ROLES_CONFIG[r].permissions[p.key] ? "✓" : "—"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === "members" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.entries(USERS).map(([roleKey, members]) => {
            const rc = roleColors[roleKey];
            return (
              <div key={roleKey} style={{ background:C.card, border:`.5px solid ${C.bd}`, borderRadius:14, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:`.5px solid ${C.bd}`, background:"rgba(255,255,255,.02)" }}>
                  <span style={{ fontSize:14 }}>{roleIcons[roleKey]}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:rc }}>{ROLE_META[roleKey]?.label}</span>
                  <span style={{ fontSize:11, color:C.tx2, marginLeft:4 }}>{members.length} member{members.length>1?"s":""}</span>
                </div>
                <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
                  {members.map(u => (
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:10, background:"rgba(255,255,255,.025)" }}>
                      <div style={{ width:34, height:34, borderRadius:9, background:`${rc}18`, border:`.5px solid ${rc}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:rc, flexShrink:0 }}>{u.avatar}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:C.tx0 }}>{u.name}</div>
                        <div style={{ fontSize:11, color:C.tx2 }}>
                          {u.subRole ? (ROLES_CONFIG[roleKey]?.subRoles[u.subRole]?.label || u.title) : u.title}
                        </div>
                      </div>
                      {u.level && <span style={{ fontSize:9, fontWeight:700, color:rc, background:`${rc}18`, borderRadius:5, padding:"2px 6px", letterSpacing:".05em" }}>{u.level}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function PrismPlatform() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState("dashboard");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('idea');
  const [publishPhase, setPublishPhase] = useState("draft");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(INIT_NOTIFS);
  const [priOpen, setPriOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("prism-theme") || "dark");
  const [holidayBannerDismissed, setHolidayBannerDismissed] = useState(() => localStorage.getItem("prism-holiday-banner") === TODAY_LABEL);
  const activeHoliday = getActiveHoliday();
  C = { ...THEMES[theme] };
  if (theme === "festive" && activeHoliday) {
    C.guava = activeHoliday.guava; C.kale = activeHoliday.kale; C.amber = activeHoliday.amber;
    C.bg = activeHoliday.bg;
  }
  const [founderOpen, setFounderOpen] = useState(false);
  const logoClicksRef = useRef(0);
  const logoClickTimerRef = useRef(null);
  function handleLogoClick() {
    nav("dashboard");
    logoClicksRef.current += 1;
    clearTimeout(logoClickTimerRef.current);
    if (logoClicksRef.current >= 5) {
      logoClicksRef.current = 0;
      setFounderOpen(true);
      playSound("fanfare");
    } else {
      logoClickTimerRef.current = setTimeout(() => { logoClicksRef.current = 0; }, 2000);
    }
  }
  const [toasts, setToasts] = useState([]);
  window.prismToast = (msg, type = "success", icon) => {
    const id = Date.now() + Math.random();
    const cfg = {
      success:{ icon:"✓", bg:"rgba(4,50,46,.94)", border:"rgba(10,200,150,.4)", shadow:"rgba(10,128,128,.45)" },
      warn:   { icon:"⚠", bg:"rgba(80,50,4,.94)", border:"rgba(239,159,39,.4)", shadow:"rgba(239,159,39,.4)" },
      error:  { icon:"✗", bg:"rgba(90,14,8,.94)", border:"rgba(244,93,72,.4)", shadow:"rgba(244,93,72,.4)" },
      info:   { icon:"✦", bg:"rgba(38,32,85,.94)", border:"rgba(127,119,221,.4)", shadow:"rgba(127,119,221,.45)" },
    }[type] || {};
    setToasts(prev => [...prev.slice(-2), { id, msg, icon: icon||cfg.icon, bg:cfg.bg, border:cfg.border, shadow:cfg.shadow }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  };

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === "Escape") setCmdOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const cmdItems = auth ? [
    { label: "Dashboard",           desc: "Go to home",                icon: "⊞", action: () => { nav("dashboard"); setCmdOpen(false); } },
    { label: "Queue Analytics",     desc: "Live queue data",            icon: "◈", action: () => { nav("queue"); setCmdOpen(false); }, badge: "2 alerts" },
    { label: "Intraday Ops",        desc: "Live ops center · adherence",icon: "⚡", action: () => { nav("ops"); setCmdOpen(false); } },
    { label: "Schedule Editor",     desc: "Edit & publish schedules",   icon: "⊟", action: () => { nav("calendar"); setCmdOpen(false); } },
    { label: "Coverage Heatmap",    desc: "FTE vs. required by hour",   icon: "▦", action: () => { nav("coverage"); setCmdOpen(false); } },
    { label: "ClearCast Forecast",  desc: "86-CT Gustified forecast",   icon: "◇", action: () => { nav("forecast"); setCmdOpen(false); } },
    { label: "Forecast vs Actuals", desc: "Pillar F vs A + weekly trend", icon: "▤", action: () => { nav("fvsa"); setCmdOpen(false); } },
    { label: "Team Roster",         desc: "732 Gusties, 11 pillars",    icon: "◉", action: () => { nav("roster"); setCmdOpen(false); } },
    { label: "Approvals",           desc: "3 pending requests",         icon: "✓", action: () => { nav("approvals"); setCmdOpen(false); }, badge: "3" },
    { label: "Achievements",        desc: "Badges, XP, leaderboard",    icon: "◆", action: () => { nav("achievements"); setCmdOpen(false); } },
    { label: "Team Skilling",       desc: "Skill matrix + gap analysis",icon: "◑", action: () => { nav("skills"); setCmdOpen(false); } },
    ...(auth?.role === "wfm" ? [{ label: "Work Patterns", desc: "Shift templates", icon: "⊡", action: () => { nav("patterns"); setCmdOpen(false); } }] : []),
    { label: "Shift Swap Market",   desc: "Post or claim shift swaps",  icon: "⇄", action: () => { nav("swap"); setCmdOpen(false); } },
    { label: "Coverage Calendar",   desc: "Month-view coverage",        icon: "◻", action: () => { nav("coverage-cal"); setCmdOpen(false); } },
    { label: "Forecast Intelligence",desc:"Pattern recognition + trends",icon: "◈", action: () => { nav("fcst-intel"); setCmdOpen(false); } },
    { label: "Pri — Ask anything",  desc: "AI assistant · natural language",icon:"✦",action: () => { setPriOpen(true); setCmdOpen(false); } },
    { label: "Sign out",            desc: "Return to login",            icon: "←", action: () => { logout(); setCmdOpen(false); } },
  ] : [];

  function login(role, user) {
    setAuth({ role, user });
    setView("dashboard");
    const hook = import.meta.env.VITE_SLACK_WEBHOOK_URL;
    if (hook) {
      const ts = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: true });
      fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*Prism accessed* — ${user} (${role}) logged in at ${ts} PT\n_${navigator.userAgent}_` }),
      }).catch(() => {});
    }
  }
  function logout() { setAuth(null); setView("dashboard"); }
  function nav(v) { setView(v); }

  function renderView() {
    // View transition handled via CSS animation on the content wrapper
    if (!auth) return null;
    const { role, user } = auth;

    if (view === "dashboard") {
      if (role === "agent")   return <AgentDashboard user={user} onNav={nav} onPri={() => setPriOpen(true)} />;
      if (role === "manager") return <ManagerDashboard user={user} onNav={nav} />;
      return <WFMDashboard user={user} onNav={nav} />;
    }
    if (view === "queue") {
      if (role === "agent") return <AccessDenied msg="Queue analytics is available to managers and WFM analysts only." />;
      return <QueueView role={role} />;
    }
    if (view === "schedule") return <AgentDashboard user={user} onNav={nav} onPri={() => setPriOpen(true)} />;
    if (view === "profile")  return <AgentSelfProfile user={user} onNav={nav} />;
    if (view === "ops") {
      if (role === "agent") return <AccessDenied msg="Real Time Management is available to managers and WFM analysts only." />;
      return <RealTimeMgmtView role={role} onNav={nav} />;
    }
    if (view === "coverage") {
      if (role === "agent") return <AccessDenied msg="Coverage heatmap is available to managers and WFM analysts only." />;
      return <CoverageHeatmapView />;
    }
    if (view === "coverage-cal") {
      if (role === "agent") return <AccessDenied msg="Coverage calendar is available to managers and WFM analysts only." />;
      return <CoverageCalendarView />;
    }
    if (view === "fcst-intel") {
      if (role !== "wfm") return <AccessDenied msg="Forecast Intelligence is available to WFM analysts only." />;
      return <ForecastIntelView />;
    }
    if (view === "fvsa") {
      if (role === "agent") return <AccessDenied msg="Forecast vs Actuals is available to managers and WFM analysts only." />;
      return <ForecastVsActualsView />;
    }
    if (view === "swap") return <ShiftSwapView user={user} />;
    if (view === "calendar") {
      if (role === "agent") return <AccessDenied msg="Schedule editor is available to managers and WFM analysts." />;
      return (
        <div>
          <PublishWorkflowBanner phase={publishPhase} onPhaseChange={setPublishPhase} />
          <div style={{ height: "calc(100vh - 200px)", minHeight: 380 }}>
            <ScheduleContainer
              agents={ALL_AGENTS}
              currentUser={{ id: user.id, name: user.name, role }}
              initialDate={SCHEDULE_ANCHOR_DATE}
              onGenerateSchedules={generateSchedulesForAgents}
            />
          </div>
        </div>
      );
    }
    if (view === "forecast") {
      if (role === "agent") return <AccessDenied msg="ClearCast is available to managers and WFM analysts only." />;
      return <ClearCastView role={role} />;
    }
    if (view === "roster") {
      if (role === "agent") return <AccessDenied msg="Team roster is available to managers and WFM analysts only." />;
      return <RosterView />;
    }
    if (view === "approvals") {
      if (role === "agent") return <AccessDenied msg="Approvals are managed by managers and WFM analysts only." />;
      return <ApprovalsView role={role} />;
    }
    if (view === "skills") {
      if (role === "agent") return <AccessDenied msg="Team skilling is available to managers and WFM analysts only." />;
      return <SkillingManager agents={ALL_AGENTS} onUpdateSkills={() => {}} onOpenProfile={() => {}} />;
    }
    if (view === "achievements") return <AchievementsView role={role} user={user} />;
    if (view === "timeoff") return <TimeOffView user={user} />;
    if (view === "connections") {
      if (role !== "wfm") return <AccessDenied msg="Live Connections is managed by WFM analysts only." />;
      return <ConnectionsView />;
    }
    if (view === "patterns") {
      if (role !== "wfm") return <AccessDenied msg="Work pattern builder is a WFM analyst function. Contact your WFM team to request pattern changes." />;
      return <WorkPatternBuilder agents={ALL_AGENTS} onAssign={() => {}} onClose={() => {}} />;
    }
    if (view === "roles") {
      if (role !== "wfm") return <AccessDenied msg="Role & permission administration is restricted to Workforce Intelligence." />;
      return <RolesAdminView />;
    }
    return null;
  }

  const rc = auth ? (ROLE_META[auth.role] ? ROLE_META[auth.role].color : C.kale) : C.kale;

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 0, background: C.bg, color: C.tx0, fontFamily: "system-ui,-apple-system,sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        
        @keyframes prism-glow-1 { 0%,100% { opacity:.5; transform:scale(1); } 50% { opacity:.9; transform:scale(1.08); } }
        @keyframes prism-glow-2 { 0%,100% { opacity:.4; transform:scale(1); } 50% { opacity:.75; transform:scale(1.06); } }
        @keyframes prism-glow-3 { 0%,100% { opacity:.3; transform:scale(.95); } 50% { opacity:.6; transform:scale(1.05); } }
        @keyframes prism-color-pulse { 0%,100% { opacity:0; } 50% { opacity:1; } }
        @keyframes prism-floor { 0%,100% { opacity:.5; transform:scaleX(1); } 50% { opacity:.85; transform:scaleX(1.12); } }
        @keyframes prism-sweep { 0%{transform:translateX(-450px)} 100%{transform:translateX(550px)} }
        @keyframes wl0 { 0%,100%{color:#FF7060} 50%{color:#FFB090} }
        @keyframes wl1 { 0%,100%{color:#F8A870} 50%{color:#FFCCA0} }
        @keyframes wl2 { 0%,100%{color:#50D8D8} 50%{color:#30C0C0} }
        @keyframes wl3 { 0%,100%{color:#20C0C0} 50%{color:#08A8A8} }
        @keyframes wl4 { 0%,100%{color:#70C8C8} 50%{color:#50B0B0} }
        @keyframes lp   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.25;transform:scale(.65)} }
        @keyframes ti   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes to   { from{opacity:1} to{opacity:0;transform:translateY(-8px)} }
        @keyframes blink{ 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes view-in { from { opacity:0; transform:translateY(10px) scale(.992); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes fade-up{from{opacity:0;transform:translateY(12px) scale(.996)} to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.7} 33%{transform:translate(-24px,18px) scale(1.05);opacity:1} 66%{transform:translate(16px,-20px) scale(.96);opacity:.8} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 40%{transform:translate(20px,-14px) scale(1.08);opacity:.9} 70%{transform:translate(-18px,12px) scale(.94);opacity:.65} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0) scale(1);opacity:.5} 50%{transform:translate(-28px,20px) scale(1.12);opacity:.85} }
        @keyframes particle-breathe { 0%,100%{opacity:.15;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(260%)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes card-rise { from{opacity:0;transform:translateY(18px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes badge-zoom { from{opacity:0;transform:scale(.82) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pri-wave { 0%,100%{height:4px;opacity:.45} 50%{height:20px;opacity:1} }
        @keyframes pri-slide { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
        @keyframes count-rise { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes live-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(10,200,150,0),0 0 12px rgba(10,128,128,.08)} 50%{box-shadow:0 0 0 2px rgba(10,200,150,.12),0 0 24px rgba(10,128,128,.18)} }
        @keyframes val-pop { 0%{transform:scale(1)} 40%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes particle-fly { 0%{transform:translateX(0) scale(1);opacity:1} 100%{transform:translateX(88px) scale(0);opacity:0} }
        @keyframes particle-fly-sm { 0%{transform:translateX(0) scale(1);opacity:.9} 100%{transform:translateX(52px) scale(0);opacity:0} }
        button { font-family:inherit; }
        button:not(:disabled) { transition: transform .1s ease, opacity .1s ease; }
        button:not(:disabled):active { transform: scale(.962); opacity:.88; }
        a { color:inherit; text-decoration:none; }
        ::selection { background:rgba(10,128,128,.35); color:#fff; }
        :focus-visible { outline:2px solid rgba(10,200,150,.5); outline-offset:2px; border-radius:6px; }
        input::placeholder { color:rgba(255,255,255,.22); }
        textarea::placeholder { color:rgba(255,255,255,.22); }
        * { box-sizing:border-box }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:4px;transition:background .2s}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.28)}
        html,body{margin:0;padding:0;overflow:hidden;height:100%;width:100%}
        table{table-layout:auto}
        img{max-width:100%}
        input,select,textarea{font-family:inherit}
        select option { background: #111728; color: rgba(255,255,255,.9); }
        @keyframes toast-in { from{opacity:0;transform:translateY(14px) scale(.93)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes toast-out { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(.9)} }
        @keyframes founder-flash { 0%{opacity:.88} 100%{opacity:0} }
        @keyframes founder-card-in { 0%{transform:translateY(90px) scale(.82);opacity:0} 60%{transform:translateY(-14px) scale(1.03);opacity:1} 80%{transform:translateY(5px) scale(.99)} 100%{transform:translateY(0) scale(1)} }
        @keyframes founder-punch { 0%{transform:scale(1.55) translateY(10px);opacity:0;filter:blur(7px)} 65%{transform:scale(.97);opacity:1;filter:blur(0)} 100%{transform:scale(1)} }
        @keyframes founder-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes founder-glow-ring { 0%,100%{box-shadow:0 0 55px rgba(255,215,0,.22),0 0 140px rgba(127,119,221,.1),0 40px 100px rgba(0,0,0,.85)} 50%{box-shadow:0 0 100px rgba(255,215,0,.48),0 0 260px rgba(127,119,221,.22),0 40px 100px rgba(0,0,0,.85)} }
        @keyframes pyro-streak { 0%{transform:translateY(0) scaleY(1);opacity:1} 80%{opacity:.75} 100%{transform:translateY(-76vh) scaleY(.12);opacity:0} }
        @keyframes pyro-burst-out { 0%{transform:translateX(0) scale(1.4);opacity:1} 100%{transform:translateX(95px) scale(0);opacity:0} }
        @keyframes confetti-fall { 0%{transform:translateY(-30px) rotate(0deg);opacity:1} 85%{opacity:.65} 100%{transform:translateY(108vh) rotate(var(--cr)) translateX(var(--cx));opacity:0} }
        @keyframes coin-blink { 0%,48%{opacity:1} 50%,98%{opacity:0} 100%{opacity:1} }
        @keyframes coin-in { from{opacity:0;transform:translateY(10px) scale(.9)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes arcade-reveal { from{opacity:0;transform:scaleY(.6) translateY(8px)} to{opacity:1;transform:scaleY(1) translateY(0)} }
        .ps>*{animation:fade-up .38s cubic-bezier(.4,0,.2,1) both}
        .ps>*:nth-child(1){animation-delay:20ms} .ps>*:nth-child(2){animation-delay:80ms}
        .ps>*:nth-child(3){animation-delay:140ms} .ps>*:nth-child(4){animation-delay:200ms}
        .ps>*:nth-child(5){animation-delay:260ms} .ps>*:nth-child(6){animation-delay:320ms}
        .ps>*:nth-child(7){animation-delay:380ms} .ps>*:nth-child(8){animation-delay:440ms}
      `}</style>

      {!auth && <LoginScreen onLogin={login} />}

      {/* AI Command Palette */}
      {cmdOpen && auth && (
        <AICommandPalette auth={auth} cmdItems={cmdItems} onClose={() => setCmdOpen(false)} onNav={nav} />
      )}

      {/* Notification Center */}
      {notifOpen && auth && (
        <NotificationCenter role={auth.role} notifs={notifs} setNotifs={setNotifs} onClose={() => setNotifOpen(false)} />
      )}

      {/* MIA Drawer */}
      {priOpen && auth && (
        <PriDrawer auth={auth} view={view} onClose={() => setPriOpen(false)} />
      )}

      {auth && (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          {/* TOPBAR */}
          <div style={{ background:C.topbar, backdropFilter:"blur(12px)", padding:"0 16px", display:"flex", alignItems:"center", gap:10, height:52, flexShrink:0, minHeight:52, overflow:"hidden", borderBottom:`.5px solid ${C.topbarBd}` }}>
            {/* Logo */}
            <div onClick={handleLogoClick} style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer", flexShrink:0 }}
              onMouseEnter={e => e.currentTarget.style.opacity=".82"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}>
              <PrismMark size={36} glow={false} id="top" />
              <Wordmark size={16} />
            </div>

            {/* Role chip */}
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 11px", borderRadius:20, background:`${rc}12`, border:`.5px solid ${rc}35`, fontSize:12, fontWeight:600, color:rc, flexShrink:0, marginLeft:2 }}>
              <span style={{ fontSize:13 }}>{ROLE_META[auth.role].icon}</span>
              {ROLE_META[auth.role].label}
            </div>

            {/* Workforce Intelligence identity — WFM role only */}
            {auth.role === "wfm" && (
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <div style={{ width:.5, height:16, background:"rgba(255,255,255,.1)" }}/>
                <span style={{ fontSize:10, fontWeight:700, color:C.kale, letterSpacing:".14em", textTransform:"uppercase", opacity:.7 }}>Workforce Intelligence</span>
              </div>
            )}

            <div style={{ flex:1 }} />

            {/* Live status */}
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"rgba(10,200,150,.65)", background:"rgba(10,128,128,.09)", border:`.5px solid rgba(10,128,128,.2)`, padding:"4px 10px", borderRadius:8, flexShrink:0 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:"#0AC8A0", animation:"lp 1.8s ease-in-out infinite", flexShrink:0 }} />
              Live
            </div>

            {/* ⌘K */}
            <button onClick={() => setCmdOpen(true)}
              style={{ padding:"5px 10px", borderRadius:8, background:"rgba(255,255,255,.055)", border:".5px solid rgba(255,255,255,.1)", color:C.tx2, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all .15s", flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.1)"; e.currentTarget.style.color=C.tx0; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,.055)"; e.currentTarget.style.color=C.tx2; }}>
              <span style={{ fontSize:13 }}>⌘</span><span>K</span>
            </button>

            {/* XP streak — agents only */}
            {auth.user.xp && (
              <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:"rgba(127,119,221,.1)", border:".5px solid rgba(127,119,221,.25)", flexShrink:0 }}>
                <span style={{ fontSize:12 }}>🔥</span>
                <span style={{ fontSize:12, fontWeight:700, color:C.purple }}>{auth.user.streak || 0}d</span>
                <span style={{ fontSize:11, color:"rgba(127,119,221,.7)" }}>{auth.user.xp} XP</span>
              </div>
            )}

            {/* MIA button */}
            <button onClick={() => { setPriOpen(o=>!o); setNotifOpen(false); }}
              style={{ padding:"5px 11px", borderRadius:8, background: priOpen ? `${C.kale}20` : "rgba(255,255,255,.055)", border:`.5px solid ${priOpen ? C.kale+"40" : "rgba(255,255,255,.1)"}`, color: priOpen ? C.kale : C.tx2, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all .15s", flexShrink:0, letterSpacing:".04em" }}
              onMouseEnter={e => { e.currentTarget.style.background=`${C.kale}18`; e.currentTarget.style.color=C.kale; e.currentTarget.style.borderColor=`${C.kale}35`; }}
              onMouseLeave={e => { if (!priOpen) { e.currentTarget.style.background="rgba(255,255,255,.055)"; e.currentTarget.style.color=C.tx2; e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; } }}>
              <span style={{ fontSize:14 }}>✦</span> Pri
            </button>

            {/* Theme toggle */}
            <button onClick={() => { const next = theme==="dark"?"light":theme==="light"?"festive":"dark"; setTheme(next); localStorage.setItem("prism-theme",next); }}
              style={{ padding:"5px 9px", borderRadius:8, background: theme==="festive"&&activeHoliday?`${activeHoliday.guava}18`:"transparent", border:`.5px solid ${theme==="festive"&&activeHoliday?activeHoliday.guava+"40":C.bd}`, color:C.tx1, fontSize:14, cursor:"pointer", transition:"all .15s", flexShrink:0 }}
              title={theme==="dark"?"Dark mode · switch to light":theme==="light"?"Light mode · switch to festive":`Festive${activeHoliday?` · ${activeHoliday.name}`:""} · switch to dark`}>
              {theme==="dark"?"🌙":theme==="light"?"☀️":activeHoliday?activeHoliday.emoji:"🎉"}
            </button>

            {/* Sound toggle */}
            <button onClick={() => { const next = !soundOn; setSoundOn(next); window.prismSoundOn = next; if(next) playSound("chime"); }}
              style={{ padding:"5px 9px", borderRadius:8, background: soundOn ? `${C.purple}20` : "transparent", border:`.5px solid ${soundOn?C.purple+"50":C.bd}`, color: soundOn ? C.purple : C.tx2, fontSize:14, cursor:"pointer", transition:"all .15s", flexShrink:0 }}
              title={soundOn ? "Sound on · click to mute" : "Sound off · click to enable"}>
              {soundOn ? "🔊" : "🔇"}
            </button>

            {/* Notification bell */}
            <button onClick={() => { setNotifOpen(o=>!o); setPriOpen(false); }} style={{ position:"relative", padding:"5px 9px", borderRadius:8, background: notifOpen ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.055)", border:`.5px solid ${notifOpen ? C.bd : "rgba(255,255,255,.1)"}`, color: notifOpen ? C.tx0 : C.tx2, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.1)"; e.currentTarget.style.color=C.tx0; }}
              onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.background="rgba(255,255,255,.055)"; e.currentTarget.style.color=C.tx2; } }}>
              🔔
              {notifs.filter(n=>!n.read).length > 0 && (
                <span style={{ position:"absolute", top:3, right:3, width:8, height:8, borderRadius:"50%", background:"#F45D48", border:"1.5px solid rgba(5,8,15,.98)", animation:"lp 2s ease-in-out infinite" }}/>
              )}
            </button>

            {/* Avatar */}
            <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg,${rc},${rc}88)`, color:"#fff", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 0 0 2px ${rc}30`, cursor:"default" }}>
              {auth.user.avatar}
            </div>

            {/* Sign out */}
            <button onClick={logout}
              style={{ padding:"5px 11px", borderRadius:8, background:"transparent", color:"rgba(255,255,255,.35)", border:`.5px solid rgba(255,255,255,.1)`, fontSize:12, cursor:"pointer", fontWeight:500, transition:"all .16s", flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(244,93,72,.12)"; e.currentTarget.style.borderColor="rgba(244,93,72,.35)"; e.currentTarget.style.color=C.guava; }}
              onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,.1)"; e.currentTarget.style.color="rgba(255,255,255,.35)"; }}>
              Sign out
            </button>
          </div>

          <Ticker role={auth.role} />

          {/* Holiday banner */}
          {activeHoliday && !holidayBannerDismissed && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 18px", background:`linear-gradient(90deg,${activeHoliday.guava}22,${activeHoliday.kale}18)`, borderBottom:`.5px solid ${activeHoliday.guava}30`, animation:"fade-up .4s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>{activeHoliday.emoji}</span>
                <span style={{ fontSize:12, fontWeight:600, color:C.tx0 }}>{activeHoliday.msg}</span>
                <span style={{ fontSize:11, color:C.tx2 }}>· From the Prism team</span>
              </div>
              <button onClick={() => { setHolidayBannerDismissed(true); localStorage.setItem("prism-holiday-banner", TODAY_LABEL); }} style={{ background:"none", border:"none", color:C.tx2, cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }}>×</button>
            </div>
          )}

          <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", maxHeight: "calc(100vh - 86px)" }}>
            <Sidebar role={auth.role} view={view} onNav={nav} />
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "14px 16px", background: C.bg, minHeight: 0 }}>
              <ForecastProvider><div key={view} style={{animation:"view-in .2s cubic-bezier(.4,0,.2,1) both"}}>{renderView()}</div></ForecastProvider>
            </div>
          </div>

          {/* Floating feedback button */}
          <button
            onClick={() => setFeedbackOpen(true)}
            style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, padding: "10px 18px", borderRadius: 24, background: "linear-gradient(135deg,#0A8080,#0AB0B0)", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 18px rgba(10,128,128,.45)", display: "flex", alignItems: "center", gap: 7, transition: "transform .15s,box-shadow .15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(10,128,128,.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(10,128,128,.45)"; }}>
            💬 Feedback
          </button>

          {/* Feedback modal */}
          {feedbackOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,8,15,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={e => { if (e.target === e.currentTarget) { setFeedbackOpen(false); setFeedbackText(''); setFeedbackType('idea'); } }}>
              <div style={{ background: "#111728", border: ".5px solid rgba(255,255,255,.1)", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,.6)" }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,.92)", marginBottom: 6 }}>Share feedback</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 18 }}>Your feedback helps improve Prism for the whole team.</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {['idea','bug','praise'].map(t => (
                    <button key={t} onClick={() => setFeedbackType(t)}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s", border: feedbackType === t ? ".5px solid #0AB0B0" : ".5px solid rgba(255,255,255,.1)", background: feedbackType === t ? "rgba(10,176,176,.18)" : "rgba(255,255,255,.04)", color: feedbackType === t ? "#0AB0B0" : "rgba(255,255,255,.5)" }}>
                      {t === 'idea' ? '💡 Idea' : t === 'bug' ? '🐛 Bug' : '🙌 Praise'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Describe your feedback…"
                  rows={4}
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "rgba(255,255,255,.85)", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                  <button onClick={() => { setFeedbackOpen(false); setFeedbackText(''); setFeedbackType('idea'); }}
                    style={{ padding: "8px 18px", borderRadius: 9, background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.55)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                    Cancel
                  </button>
                  <button onClick={() => { window.prismToast("Feedback sent — thank you! 🙌","success"); setFeedbackOpen(false); setFeedbackText(''); setFeedbackType('idea'); }}
                    style={{ padding: "8px 18px", borderRadius: 9, background: "linear-gradient(135deg,#0A8080,#0AB0B0)", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {founderOpen && <FounderModal onClose={() => setFounderOpen(false)} />}
      <ToastRack toasts={toasts} />
    </div>
  );
}
