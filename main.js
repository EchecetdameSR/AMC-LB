const rankBtn = document.getElementById("rankInfoBtn");
const rankText = document.getElementById("rankInfoText");
rankBtn.addEventListener("click", () => {
  rankText.style.display = rankText.style.display === "block" ? "none" : "block";
});

const list = document.getElementById("list");
const count = document.getElementById("count");
const searchInput = document.getElementById("search");

const gameId = "76rqjqd8";

const categoryIds = [
  "vdoq4xvk",  // Any%
  "9d8jgv7k",  // All Dungeons
  "n2yj3r82",  // All Main Quests
  "wkpqmw8d",  // All Shrines
  "xk9jv4gd",  // 100%
  "5dw69v02",  // Best Ending
  "02q8pz92",  // Master Sword
  "02q8pz92",  // Master Sword Restricted
  "w20193jk",  // Master Sword and Dungeons
  "9kvmy40k",  // Great Plateau Any%
  "rklqj4w2"   // Great Plateau 100%
];

const categoryNames = [
  "Any%",
  "All Dungeons",
  "All Main Quests",
  "All Shrines",
  "100%",
  "Best Ending",
  "Master Sword",
  "Master Sword Restricted",
  "Master Sword & Dungeons",
  "Great Plateau Any%",
  "Great Plateau 100%",
];

const masterSwordSubcats = [
  { id: "02q8pz92", name: "Master Sword", varId: "wl334xol", value: "5lem8wz1" },
  { id: "02q8pz92", name: "Master Sword Restricted", varId: "wl334xol", value: "0q5g80nl" }
];

let allPlayers = [];
let totalRunnersByCat = {};
let WRsByCat = {};
let currentSortedCol = null;

let compareSlots = []; 
const playerColors = ['#00aaff', '#00bb88', '#ffaa00', '#ff4444'];
const compareTray = document.getElementById('compare-tray');
const slotElements = [
  document.getElementById('slot-1'),
  document.getElementById('slot-2'),
  document.getElementById('slot-3'),
  document.getElementById('slot-4')
];
const compareRunBtn = document.getElementById('compare-run-btn');
const compareClearBtn = document.getElementById('compare-clear-btn');
const modalBackdrop = document.getElementById('compare-modal-backdrop');
const modalBody = document.getElementById('compare-modal-body');
const modalCloseBtn = document.getElementById('compare-modal-close');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}: ${url}`);
  return res.json();
}

async function fetchLeaderboard(catId, catName, playersMap, varId=null, valueId=null) {
  let offset = 0;
  const max = 200;
  let more = true;
  let catRuns = [];
  let lb = { data: { runs: [], players: { data: [] } } };

  while (more) {
    let url = `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${catId}?embed=players&max=${max}&offset=${offset}`;
    if (varId && valueId) url += `&var-${varId}=${valueId}`;

    const tmp = await fetchJson(url);
    if (!tmp || !tmp.data || !tmp.data.runs) break;
    lb = tmp;
    catRuns = catRuns.concat(lb.data.runs);
    offset += max;
    more = lb.data.runs.length === max;
  }

  WRsByCat[catName] = catRuns?.[0]?.run?.times?.primary_t || 1;
  totalRunnersByCat[catName] = lb.data?.players?.data?.length || catRuns.length || 1;

  const playerLookup = {};
  for (const p of lb.data?.players?.data || []) {
    const id = p.id;
    const name = p.names?.international || p.name || id;
    const link = p.weblink || (id ? `https://www.speedrun.com/user/${id}` : null);
    playerLookup[id] = { name, link };
  }

  for (const runEntry of catRuns) {
    const runPlayers = runEntry.run?.players || [];
    for (const p of runPlayers) {
      const id = p.id || "guest:" + (p.name || "unknown");
      if (!playersMap.has(id)) {
        const info = playerLookup[id] || { name: p.name || id, link: p.weblink || null };
        playersMap.set(id, { name: info.name, link: info.link, ranks: {} });
      }
      const playerData = playersMap.get(id);
      if (!playerData.ranks[catName] && runEntry.place != null) {
        const run = runEntry.run;
        playerData.ranks[catName] = { 
          place: runEntry.place, 
          time: run.times.primary_t,
          video: run.videos?.links?.[0]?.uri || null, 
          date: run.date || null 
        };
      }
    }
  }
}

async function fetchPlayersWithRanks() {
  const playersMap = new Map();
  
  const loadingBarContainer = document.getElementById('loading-bar-container');
  const loadingBar = document.getElementById('loading-bar');
  
  const totalFetches = 13; 
  let fetchesDone = 0;
  loadingBar.style.width = '0%';
  loadingBarContainer.style.opacity = '1';

  for (let c=0; c<categoryIds.length; c++) {
    const catId = categoryIds[c];
    const catName = categoryNames[c];

    if (catId === "02q8pz92") {
      for (const sc of masterSwordSubcats) {
        await fetchLeaderboard(sc.id, sc.name, playersMap, sc.varId, sc.value);
        fetchesDone++;
        loadingBar.style.width = `${(fetchesDone / totalFetches) * 100}%`;
      }
    }

    if (!masterSwordSubcats.some(sc => sc.name === catName)) {
      await fetchLeaderboard(catId, catName, playersMap);
      fetchesDone++;
      loadingBar.style.width = `${(fetchesDone / totalFetches) * 100}%`;
    }
  }

  allPlayers = Array.from(playersMap.entries()).map(([id, data]) => ({ 
    id: id, 
    ...data 
  }));

  allPlayers.forEach(p => p.rankPercent = computeRankPercent(p));
  allPlayers.sort((a,b) => b.rankPercent - a.rankPercent);
  allPlayers.forEach((p,i) => p.globalRank = i + 1);

  updateDisplay(allPlayers);
  count.textContent = `${allPlayers.length} runners found`;
  
  loadingBar.style.width = '100%';
  setTimeout(() => { 
    loadingBarContainer.style.opacity = '0';
    setTimeout(() => { loadingBarContainer.style.display = 'none'; }, 500);
  }, 500);
}

fetchPlayersWithRanks().catch(err => {
  count.textContent = "Error: " + err.message;
  console.error(err);
  
  const loadingBarContainer = document.getElementById('loading-bar-container');
  if (loadingBarContainer) {
    loadingBarContainer.style.display = 'none';
  }
});

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2,"0")}:${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;
}

function computeRankPercent(player) {
  let sumWeighted = 0;
  let sumWeights = 0;

  const R_total_total = Object.values(totalRunnersByCat).reduce((a, b) => a + b, 0);

  const runCats = categoryNames.filter(cat => player.ranks?.[cat]?.time != null);
  const sumR_total_i = runCats.reduce((sum, cat) => sum + (totalRunnersByCat[cat] || 0), 0);

  const sumWRdivPB_weighted = runCats.reduce((sum, cat) => {
    const WR = WRsByCat[cat] || 1;
    const PB = player.ranks[cat].time || WR;
    const weight = totalRunnersByCat[cat] || 1;
    return sum + weight * (WR / PB);
  }, 0);

  const weightedMeanWRdivPB = sumR_total_i > 0 ? (sumWRdivPB_weighted / sumR_total_i) : 1;

  const coef = Math.pow(R_total_total / (sumR_total_i || 1), 1.15) * (1 / weightedMeanWRdivPB);

  for (const cat of categoryNames) {
    const WR = WRsByCat[cat] || 1;
    const weight = totalRunnersByCat[cat] || 1;
    let PB;

    if (player.ranks && player.ranks[cat]?.time != null) {
      PB = player.ranks[cat].time;
    } else {
      PB = WR * coef; 
    }

    const arg = Math.max(Math.min((WR / PB) - 1, 6), -6);
    sumWeighted += weight * Math.exp(arg);
    sumWeights += weight;
  }

  return sumWeights === 0 ? 0 : 100 * (sumWeighted / sumWeights);
}

function updateDisplay(filteredPlayers) {
  list.innerHTML = filteredPlayers.map((p,index) => {
    // Displayed Rank
    const rankValue = (() => {
      if (!currentSortedCol) return p.globalRank; 
      if (currentSortedCol === "Rank (%)") return p.rankPercent.toFixed(2);
      if (currentSortedCol === "Player") return p.globalRank;
      return p.ranks?.[currentSortedCol]?.place ?? "-";
    })();

    const rankCell = `<td>${rankValue}</td>`;
    const nameCell = `<td>${p.link ? `<a href="${p.link}" target="_blank">${p.name}</a>` : p.name}</td>`;
    
    let btnClass = 'compare-btn';
    if (compareSlots.includes(p.id)) btnClass += ' selected';
    const compareCell = `<td><button class="${btnClass}" data-player-id="${p.id}">Add</button></td>`;
    
    const rankCells = categoryNames.map(cat => {
      const r = p.ranks[cat];
      return r != null ? `<td class="${currentSortedCol===cat?'sorted':''}">${r.place}<br>${formatTime(r.time)}</td>` : `<td class="${currentSortedCol===cat?'sorted':''}">-</td>`;
    }).join("");
    const rankPercentCell = `<td>${p.rankPercent.toFixed(2)}</td>`;
    
    return `<tr class="${index%2===0?'even':'odd'}" data-player-id="${p.id}">${rankCell}${nameCell}${compareCell}${rankCells}${rankPercentCell}</tr>`;
  }).join("");
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const filtered = allPlayers.filter(p => p.name.toLowerCase().includes(term));
  updateDisplay(filtered);
  count.textContent = `${filtered.length} runners found (${allPlayers.length} total)`;
});

document.querySelectorAll("thead th").forEach((th) => {
  const colName = th.textContent.trim();
  if (colName !== "Rank" && colName !== "Player" && colName !== "Compare") {
    th.addEventListener("click", () => {
      if (currentSortedCol === colName) {
        currentSortedCol = null; 
      } else {
        currentSortedCol = colName;
      }

      document.querySelectorAll("thead th").forEach(h=>h.classList.remove("sorted"));
      if (currentSortedCol && currentSortedCol!=="Rank (%)") th.classList.add("sorted");

      const term = searchInput.value.toLowerCase();
      const filtered = allPlayers.filter(p => p.name.toLowerCase().includes(term));
      filtered.sort((a,b) => {
        if (!currentSortedCol || currentSortedCol === "Rank (%)") return b.rankPercent - a.rankPercent;
        const ra = a.ranks?.[currentSortedCol]?.place ?? Infinity;
        const rb = b.ranks?.[currentSortedCol]?.place ?? Infinity;
        return ra - rb;
      });
      updateDisplay(filtered);
    });
  }
});

let currentlyOpenRow = null; 

function generateDetailsHtml(player) {
  let pbListHtml = '<div class="details-pb-list"><h3>Personal Bests</h3>';
  const playedCategories = categoryNames.map(cat => ({
    name: cat,
    run: player.ranks[cat]
  })).filter(c => c.run);

  playedCategories.sort((a, b) => a.run.time - b.run.time);

  if (playedCategories.length > 0) {
    pbListHtml += '<table><thead><tr>' +
                  '<th>Category</th>' +
                  '<th>Time</th>' +
                  '<th>Rank</th>' +
                  '<th>Date</th>' +
                  '<th>Video</th>' +
                  '</tr></thead><tbody>';

    playedCategories.forEach(c => {
      const r = c.run;
      pbListHtml += `<tr>
        <td><strong>${c.name}</strong></td>
        <td>${formatTime(r.time)}</td>
        <td>#${r.place}</td>
        <td>${r.date || '-'}</td>
        <td>${r.video ? `<a href="${r.video}" target="_blank">View</a>` : '-'}</td>
      </tr>`;
    });
    
    pbListHtml += '</tbody></table>';
  } else {
    pbListHtml += "<p style='color:#888; margin-top:1rem;'>This player has no ranked PBs in the main categories.</p>";
  }
  
  pbListHtml += '</div>';

  return `<div class="details-content">${pbListHtml}</div>`;
}

list.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    return;
  }
  
  const compareBtn = e.target.closest('.compare-btn');
  if (compareBtn) {
    const playerId = compareBtn.dataset.playerId;
    addToCompare(playerId);
    return;
  }

  const clickedRow = e.target.closest('tr');
  if (!clickedRow || clickedRow.classList.contains('details-row')) return;
  if (currentlyOpenRow) {
    currentlyOpenRow.trigger.classList.remove('active-row');
    currentlyOpenRow.details.remove();
  }

  if (currentlyOpenRow && currentlyOpenRow.trigger === clickedRow) {
    currentlyOpenRow = null;
    return;
  }
  
  const playerId = clickedRow.dataset.playerId;
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return;

  clickedRow.classList.add('active-row');

  const detailsRow = document.createElement('tr');
  detailsRow.className = 'details-row';
  
  const detailsCell = document.createElement('td');
  const numCols = clickedRow.cells.length; 
  detailsCell.colSpan = numCols;
  
  detailsCell.innerHTML = generateDetailsHtml(player);
  
  detailsRow.appendChild(detailsCell);
  
  clickedRow.after(detailsRow);

  currentlyOpenRow = {
    trigger: clickedRow, 
    details: detailsRow  
  };
});

function getCompareColor(index, light = false) {
  const colors = [
    { main: '#00aaff', light: '#00aaff' }, // P1 
    { main: '#00bb88', light: '#00bb88' }, // P2 
    { main: '#ffaa00', light: '#ffaa00' }, // P3 
    { main: '#ff4444', light: '#ff4444' }  // P4 
  ];
  return colors[index] ? (light ? colors[index].light : colors[index].main) : '#888';
}

function addToCompare(playerId) {
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return;
  
  if (compareSlots.includes(playerId)) {
    return;
  }

  if (compareSlots.length < 4) {
    compareSlots.push(playerId);
  } else {
    console.warn("Compare tray is full.");
    return; 
  }
  
  updateCompareTray();
  updateCompareButtonsInTable();
}

function removeFromCompare(playerIdToRemove) {
  compareSlots = compareSlots.filter(id => id !== playerIdToRemove);
  updateCompareTray();
  updateCompareButtonsInTable();
}

function clearCompare() {
  compareSlots = [];
  updateCompareTray();
  updateCompareButtonsInTable();
}

function updateCompareButtonsInTable() {
  document.querySelectorAll('.compare-btn').forEach(btn => {
    const pid = btn.dataset.playerId;
    if (compareSlots.includes(pid)) {
      btn.classList.add('selected');
      btn.textContent = 'Added';
    } else {
      btn.classList.remove('selected');
      btn.textContent = 'Add';
    }
  });
}

function updateCompareTray() {
  if (compareSlots.length === 0) {
    compareTray.classList.remove('show');
  } else {
    compareTray.classList.add('show');
  }

  for (let i = 0; i < 4; i++) {
    const slotEl = slotElements[i];
    const playerId = compareSlots[i];
    
    if (playerId) {
      const player = allPlayers.find(p => p.id === playerId);
      slotEl.innerHTML = `<span>${player.name}</span><button class="remove-player" data-player-id="${playerId}">&times;</button>`;
      slotEl.classList.add('filled');
      slotEl.style.borderColor = getCompareColor(i);
    } else {
      slotEl.innerHTML = `<span>Player ${i + 1}</span>`;
      slotEl.classList.remove('filled');
      slotEl.style.borderColor = '#555';
    }
  }
  
  const count = compareSlots.length;
  compareRunBtn.textContent = `Compare (${count})`;
  if (count >= 2) {
    compareRunBtn.classList.remove('disabled');
    compareRunBtn.disabled = false;
  } else {
    compareRunBtn.classList.add('disabled');
    compareRunBtn.disabled = true;
  }
}

function showCompareModal() {
  if (compareSlots.length < 2) return;
  
  const players = compareSlots.map(id => allPlayers.find(p => p.id === id));
  
  modalBody.innerHTML = generateCompareHtml(players);
  modalBackdrop.style.display = 'flex';
  
  setTimeout(() => {
    document.querySelectorAll('.radar-shape').forEach(shape => {
      shape.style.transform = 'scale(1)';
    });
  }, 100);
}

function generateCompareHtml(players) {
  let playerHeaders = players.map((p, i) => `<th class="p${i+1}-color">${p.name}</th>`).join('');
  let statsHtml = `
    <h3>General Stats</h3>
    <table class="compare-stats">
      <thead>
        <tr>
          <th>Stat</th>
          ${playerHeaders}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Global Rank</td>
          ${players.map(p => `<td>${p.globalRank}</td>`).join('')}
        </tr>
        <tr>
          <td>Rank (%)</td>
          ${players.map(p => `<td>${p.rankPercent.toFixed(2)}%</td>`).join('')}
        </tr>
      </tbody>
    </table>`;

  let h2hHtml = `<h3>Head-to-Head Times</h3>
    <table class="compare-stats">
      <thead><tr><th>Category</th>${playerHeaders}</tr></thead>
      <tbody>`;
      
  let wins = new Array(players.length).fill(0);
  
  categoryNames.forEach(cat => {
    let times = players.map(p => p.ranks[cat]?.time || Infinity);
    let minTime = Math.min(...times);
    
    let cells = times.map((time, i) => {
      if (time === Infinity) return '<td>-</td>';
      
      let cssClass = '';
      let diffHtml = ''; 
      
      if (time === minTime) {
        cssClass = 'stat-winner';
        wins[i]++;
      } else {
        const diff = time - minTime;
        diffHtml = ` <span class="stat-loser" style="font-size: 0.85em;">(+${formatTime(diff)})</span>`;
      }
      
      return `<td class="${cssClass}">${formatTime(time)}${diffHtml}</td>`;
    }).join('');
    
    h2hHtml += `<tr><td>${cat}</td>${cells}</tr>`;
  });
  
  h2hHtml += `
    <tr>
      <td><strong>Total Wins</strong></td>
      ${wins.map((w, i) => `<td class="p${i+1}-color"><strong>${w}</strong></td>`).join('')}
    </tr>
    </tbody></table>`;
  
  let radarHtml = `
    <h3>Performance vs. WR (100% = WR)</h3>
    ${generateRadarChart(players)}
  `;
  
  return statsHtml + h2hHtml + radarHtml;
}

function generateRadarChart(players) {
  const size = 600; 
  const center = size / 2;
  const radius = size * 0.25;
  const numCats = categoryNames.length;
  const angleSlice = (Math.PI * 2) / numCats;
  const angleOffset = -Math.PI / 2; 
  const chartLabels = [
    ["Any%"],
    ["All", "Dungeons"],
    ["All Main", "Quests"],
    ["All", "Shrines"],
    ["100%"],
    ["Best Ending"],
    ["Master Sword"],
    ["Master Sword", "Restricted"],
    ["Master Sword", "& Dungeons"],
    ["Great Plateau", "Any%"],
    ["Great Plateau", "100%"],
  ];

  let svg = `<div class="radar-chart-container"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;

  const levels = 4;
  for (let i = 1; i <= levels; i++) {
    const levelRadius = (radius / levels) * i;
    let points = '';
    for (let j = 0; j < numCats; j++) {
      const angle = angleSlice * j + angleOffset;
      const x = center + levelRadius * Math.cos(angle);
      const y = center + levelRadius * Math.sin(angle);
      points += `${x},${y} `;
    }
    svg += `<polygon class="radar-web" points="${points}" fill="none" />`;
  }

  for (let i = 0; i < numCats; i++) {
    const angle = angleSlice * i + angleOffset;
    const x1 = center;
    const y1 = center;
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    svg += `<line class="radar-spoke" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    
    const labelRadius = radius * 1.45;
    const lx = center + labelRadius * Math.cos(angle);
    const ly = center + labelRadius * Math.sin(angle);
    
    let textAnchor = "middle";
    const epsilon = 0.1; 
    
    if (angle > -Math.PI / 2 + epsilon && angle < Math.PI / 2 - epsilon) {
      textAnchor = "start";
    }

    else if (angle < -Math.PI / 2 - epsilon || angle > Math.PI / 2 + epsilon) {
      textAnchor = "end";
    }

    const labelLines = chartLabels[i];
    const pxLineHeight = 16; 
    
    const initialDY = 5 - ((labelLines.length - 1) * pxLineHeight / 2);

    svg += `<text class="radar-label" x="${lx}" y="${ly}" dy="${initialDY}px" text-anchor="${textAnchor}">`;
    
    labelLines.forEach((line, lineIndex) => {
      const dy = (lineIndex === 0) ? 0 : `${pxLineHeight}px`;
      svg += `<tspan x="${lx}" dy="${dy}">${line}</tspan>`;
    });

    svg += `</text>`;
  }

  players.forEach((player, pIndex) => {
    const color = getCompareColor(pIndex);
    let points = '';
    for (let i = 0; i < numCats; i++) {
      const cat = categoryNames[i];
      const wr = WRsByCat[cat] || 1;
      const pb = player.ranks[cat]?.time;
      
      let score = 0; 
      if (pb) {
        score = Math.max(0, Math.min(1, wr / pb)); 
      }
      
      const dataRadius = radius * score;
      const angle = angleSlice * i + angleOffset;
      const x = center + dataRadius * Math.cos(angle);
      const y = center + dataRadius * Math.sin(angle);
      points += `${x},${y} `;
    }
    svg += `<polygon 
              class="radar-shape" 
              points="${points}" 
              fill="${color}" 
              fill-opacity="0.3" 
              stroke="${color}" 
              stroke-width="2" 
              style="transform: scale(0); transition: transform 0.5s ease-out ${pIndex * 0.1}s; transform-origin: ${center}px ${center}px;" 
            />`;
  });

  svg += `</svg>`;

  let legendHtml = `<div class="radar-legend">`;
  players.forEach((player, pIndex) => {
    const color = getCompareColor(pIndex);
    legendHtml += `<div class="legend-item">
      <div class="legend-color" style="background-color: ${color};"></div>
      <span>${player.name}</span>
    </div>`;
  });
  legendHtml += `</div>`;

  return svg + legendHtml + `</div>`;
}

compareClearBtn.addEventListener('click', clearCompare);
compareRunBtn.addEventListener('click', showCompareModal);
modalCloseBtn.addEventListener('click', () => {
  modalBackdrop.style.display = 'none';
});
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) { 
    modalBackdrop.style.display = 'none';
  }
});
compareTray.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.remove-player');
  if (removeBtn) {
    const playerId = removeBtn.dataset.playerId;
    removeFromCompare(playerId);
  }
});

fetchPlayersWithRanks().catch(err => {
  count.textContent = "Error: " + err.message;
  console.error(err);
});
