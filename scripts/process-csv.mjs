import fs from 'fs';

// Proper CSV parser that handles quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

const rawData = `Title,Month,Day,Year,Image Local,Source URL,Source Cite
The current Philippine Constitution is ratified,2,2,1987,current-constitution-ratification,https://lawphil.net/executive/proc/proc1987/proc_58_1987.html,"Aquino, C. (1987, February 11). Proclamation No. 58. Malacañan Palace."
Eat Bulaga! first airs on ABS-CBN,7,18,1987,eat-bulaga-first-gma,https://eatbulaga.fandom.com/wiki/Eat..._Bulaga!:_Moving_On!,Eat... Bulaga!: Moving On! (n.d.). Eat... Bulaga! Wiki.
"MV Dona Paz collides with an oil tanker killing 4,385",12,20,1987,mv-dona-paz,https://www.guinnessworldrecords.com/world-records/772666-deadliest-maritime-disaster-peacetime,Guiness World Records. (n.d.). Deadliest maritime disaster (peacetime). Guiness World Records.
President Marcos Sr. dies in exile in Hawaii,9,28,1989,marcos-sr-death,https://www.upi.com/Archives/1989/09/28/Ferdinand-Marcos-dead/2055622958400/,"Todt, R. (1989, September 28). Ferdinand Marcos dead. United Press International."
SM Megamall opens to the public,6,28,1991,sm-megamall-open,https://www.sminvestments.com/press_release/at-25-sm-megamall-ushers-new-mall-revolution/,"SM Investments. (2016, August 16). At 25, SM Megamall Ushers New Mall Revolution."
Vizconde Massacre,6,30,1991,vizconde-massacre,https://lawphil.net/judjuris/juri2010/dec2010/gr_176389_2010.html,"Lejano v. People, G.R. No. 176389. (2010)."
Philippines connect to the Internet for the first time,3,29,1994,philippines-connects-internet,https://mb.com.ph/2026/03/29/32-years-online-how-the-internet-continues-to-shape-filipino-life,"Reyes, B. (2026, March 29). 32 Years Online: How the Internet Continues to Shape Filipino Life. Manila Bulletin."
Sine'skwela first aired on ABS-CBN,6,6,1994,sineskwela-first-abscbn,https://corporate.abs-cbn.com/newsroom/news-releases/2020/2/5/abs-cbn-brings-back-sineskwela-bayani-hira,"ABS-CBN Corporate. (2020, March 27). ABS-CBN brings back Sine'skwela, Bayani, Hiraya Manawari."
OFW Flor Contemplacion is executed in Singapore,3,17,1995,flor-contemplacion,https://www.nlb.gov.sg/main/article-detail?cmsuuid=4e7e82e8-a0e1-481c-9605-12a516702a40,"Chew, V. (n.d.). Flor Contemplacion. National Library Board, Singapore."
Enchanted Kingdom opens to the public,10,19,1995,enchanted-kingdom-opens,https://www.enchantedkingdom.ph/about-ek-affiliations/,Enchanted Kingdom. (n.d.). About EK affiliations.
The Ozone Disco fire kills 162,3,18,1996,ozone-disco-fire,https://newsinfo.inquirer.net/348777/what-went-before-ozone-disco-is-no-6-in-worlds-deadliest-nightclub-fires,"Philippine Daily Inquirer. (2013, January 29). WHAT WENT BEFORE: Ozone Disco is No. 6 [...]. INQUIRER.net."
MRT 3's first trip,12,15,1999,mrt-3-first-trip,https://philippine-railway.fandom.com/wiki/MRT-3,MRT-3. (n.d.). Philippine Railway Wiki.
The ILOVEYOU virus is released,5,4,2000,iloveyou-virus-release,https://www.wired.com/2010/05/0504i-love-you-virus/,"Poulsen, K. (2010, May 3). Tainted 'Love' Infects Computers. Wired."
PAL flight 812 gets hijacked,5,25,2000,pal-flight-812-hijacking,https://aviation-safety.net/asndb/323500,Aviation Safety Network. (n.d.). [PAL flight 812 gets hijacked].
The Payatas landfill landslide,7,10,2000,payatas-landfill-landslide,https://www.philstar.com/headlines/2001/07/10/91819/payatas-tragedy-one-year-after,"Sison Jr., B., & Felipe, C. (2001, July 10). Payatas tragedy: One year after. Philstar.com."
Former President Joseph Estrada is ousted,1,20,2001,estrada-ousted-from-presidency,https://www.latimes.com/archives/la-xpm-2001-jan-20-mn-14778-story.html,"Paddock, R. (2001, January 20). Estrada Quits; New Philippine Leader Installed. Los Angeles Times."
Game KNB? first aired on ABS-CBN,10,8,2001,game-knb-premiere,https://media-meter.com/popular-game-shows-in-the-philippines/,"Media Meter. (2026, February 27). Popular Game Shows in the Philippines."
LRT 2's first trip,4,5,2003,lrt-2-first-trip,https://www.lrta.gov.ph/railway-operations/,Light Railway Transit Authority. (n.d.). Railway Operations.
Meteor Garden first aired on ABS-CBN,5,5,2003,meteor-garden-premiere,https://dubdb.fandom.com/wiki/Meteor_Garden_(Filipino),The Dubbing Database. (n.d.). Meteor Garden.
The Oakwood Mutiny takes place,7,27,2003,oakwood-mutiny,https://www.rappler.com/newsbreak/iq/211894-timeline-antonio-trillanes-iv-mutiny-to-amnesty/,"Evangelista, A., & Bueza, M. (2018, September 15). Timeline: Trillanes, from mutiny to amnesty. Rappler."
Daisy Siete first airs on GMA,9,1,2003,daisy-siete-premiere,https://www.pep.ph/lifestyle/parenting/27236/rochelle-pangilinan-understands-life-in-showbiz-is-filled-with-uncertainty,"Godinez, B. (2010, November 19). Rochelle Pangilinan understands life in showbiz is filled with uncertainty. PEP."
The Hacienda Luisita massacre,11,16,2004,hacienda-luisita-massacre,https://www.bulatlat.com/news/4-42/4-42-massacre.html?tztc=1,"Tuazon, B. (2004, November 27). The Hacienda Luisita Massacre, Landlordism and State Terrorism. Bulatlat."
Fernando Poe Jr. passes away,12,14,2004,fernando-poe-jr-death,https://www.theguardian.com/world/2004/dec/14/philippines,"Reuters in Manila. (2004, December 14). Film star politician dies in Philippines. The Guardian."
President Arroyo delivers her I am sorry speech,6,27,2005,arroyo-i-am-sorry-speech,https://www.philstar.com/headlines/2005/06/28/283808/gma-i146m-sorry-it146s-me-tape,"Calica, A., & Romero, P. (2005, June 28). GMA: I'm sorry, it's me on tape. Philstar.com."
The first season of Pinoy Big Brother premiered,8,21,2005,pinoy-big-brother-season-1-premiere,https://www.abs-cbn.com/entertainment/showbiz/movies-series/2025/8/21/on-this-day-the-birth-of-pinoy-big-brother-and-the-hosts-who-shaped-it-0837,"Sabio, N. (2025, August 21). On this day: The Birth of Pinoy Big Brother and the Hosts Who Shaped It. ABS-CBN News."
Wowowee Stampede (Ultra Stampede),2,4,2006,wowowee-stampede,https://www.philstar.com/headlines/2006/02/14/321633/ultra-stampede-preceded-minor-one-another-gate,"Macairan, E., & Calica, A. (2016, February 14). Ultra stampede preceded by minor one at another gate?. Philstar.com."
SM Mall of Asia opens to the public,5,21,2006,sm-mall-of-asia-opening,https://www.smprime.com/latest_news/mall-of-asia-opens-in-manila/,"SM Prime. (2006, May 28). Mall of Asia opens in Manila."
Sandiganbayan finds President Estrada guilty of plunder,9,12,2007,estrada-plunder-conviction,https://www.cnbc.com/2007/09/12/philippines-estrada-deadpan-when-sentenced-to-life.html,"Reuters. (2007, September 12). Philippines' Estrada Deadpan When Sentenced to Life. CNBC."
Manila Peninsula Siege (led by Senator Trillanes IV),11,29,2007,manila-peninsula-siege,https://www.philstar.com/other-sections/starweek-magazine/2007/12/09/32297/inside-siege,"Sering, T. (2007, December 9). Inside a Siege. Philstar.com."
MV Princess of the Stars capsizes killing 814,6,21,2008,mv-princess-of-the-stars-capsizing,https://www.bairdmaritime.com/security/incidents/accidents/philippine-appeals-court-finds-shipowner-guilty-of-negligence-in-2008-ferry-tragedy,"Baird Maritime. (2008, June 21). Philippine appeals court finds shipowner guilty of negligence in 2008 ferry tragedy."
Eraserheads The Final Set reunion concert,3,7,2009,eraserheads-final-set-reunion-concert,https://www.gmanetwork.com/entertainment/showbiznews/new-book-chronicles-the-eraserheads-2009-the-final-set-concert/72178/,"Godinez, B. (2020, December 9). New book chronicles the Eraserheads' 2009 'The Final Set' concert. GMA News."
President Cory Aquino passes away,8,1,2009,cory-aquino-death,https://www.npr.org/sections/thetwo-way/2009/07/corazon_aquino_former_philippi.html,"James, F. (2009, July 31). Corazon Aquino, Former Philippines President, Dead At 76. NPR."
Showtime first airs on ABS-CBN,10,24,2009,showtime-premiere,https://www.abs-cbn.com/entertainment/showbiz/movies-series/2025/10/24/on-this-day-it-s-showtime-turns-16-a-look-back-at-the-fun-and-unforgettable-segments-we-miss-1853,"Sabio, N. (2025, October 24). 'It's Showtime' turns 16: A look back at the fun segments we miss. ABS-CBN News."
Maguindanao massacre,11,23,2009,maguindanao-massacre,https://newsinfo.inquirer.net/846981/fast-facts-maguindanao-massacre,"Inquirer Research. (2016, November 23). Fast facts: Maguindanao massacre. INQUIRER.net."`;

const lines = rawData.split('\n').filter(line => line.trim());
const events = [];

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  
  // We expect exactly 7 columns
  if (cols.length !== 7) {
    console.error(`Skipping line ${i + 1}: expected 7 columns, got ${cols.length}`);
    console.error('Line:', lines[i]);
    continue;
  }
  
  const [title, month, day, year, imageLocal, sourceUrl, sourceCite] = cols;
  
  // Clean up values
  const cleanTitle = title.replace(/^"|"$/g, '').trim();
  const cleanSourceCite = sourceCite ? sourceCite.replace(/^"|"$/g, '').trim() : null;
  const cleanSourceUrl = sourceUrl ? sourceUrl.trim() : null;
  const imagePath = imageLocal ? `images/${imageLocal.trim()}.webp` : null;
  
  events.push({
    id: '',
    year: parseInt(year, 10),
    month: month ? parseInt(month, 10) : null,
    day: day ? parseInt(day, 10) : null,
    text: cleanTitle,
    image: {
      url: null,
      local: imagePath
    },
    source: {
      text: cleanSourceCite,
      url: cleanSourceUrl
    }
  });
}

const json = JSON.stringify(events, null, 2);
fs.writeFileSync('puzzles/contemporary-early.json', json);
console.log(`Written ${events.length} events to puzzles/contemporary-early.json`);

// Verify first few
console.log('\nFirst 3 events:');
events.slice(0, 3).forEach((e, i) => {
  console.log(`${i + 1}. ${e.year}-${e.month}-${e.day}: ${e.text}`);
  console.log('   Image:', e.image.local);
  console.log('   Source:', e.source.url);
});
