const fs = require('fs');
const csv = fs.readFileSync('data/modern.csv', 'utf8').trim().split('\n');
const events = [];

for (let i = 1; i < csv.length; i++) {
  const line = csv[i];
  const fields = [];
  let cur = '';
  let q = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') {
      q = !q;
    } else if (ch === ',' && !q) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);

  events.push({
    id: '',
    year: parseInt(fields[3], 10),
    month: parseInt(fields[1], 10),
    day: parseInt(fields[2], 10),
    text: fields[0].trim(),
    image: {
      url: null,
      local: 'images/' + fields[4].trim() + '.webp'
    },
    source: {
      text: fields[6].trim(),
      url: fields[5].trim()
    }
  });
}

fs.writeFileSync('puzzles/modern.json', JSON.stringify(events, null, 2) + '\n');
console.log('Converted', events.length, 'events to puzzles/modern.json');
