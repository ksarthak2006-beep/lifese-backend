// Script to import a large medicine database (CSV/JSON) into backend/data/medicines.json
// Usage: node import_medicine_db.cjs <input.csv>

const fs = require('fs');
const path = require('path');

function parseCSV(csv) {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    return {
      id: cols[0],
      name: cols[1],
      brand: cols[2],
      dosageForms: cols[3] ? cols[3].split('|') : [],
    };
  });
}

const input = process.argv[2];
if (!input) {
  console.error('Usage: node import_medicine_db.cjs <input.csv>');
  process.exit(1);
}

const csv = fs.readFileSync(input, 'utf8');
const medicines = parseCSV(csv);
const outFile = path.resolve(__dirname, '../data/medicines.json');
fs.writeFileSync(outFile, JSON.stringify(medicines, null, 2));
console.log(`Imported ${medicines.length} medicines to ${outFile}`);