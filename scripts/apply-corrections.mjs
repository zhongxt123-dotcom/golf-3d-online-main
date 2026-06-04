// Apply coordinate corrections and name updates to locations.js
import { readFileSync, writeFileSync } from "fs";
import { coordinateCorrections, nameUpdates } from "./course-corrections.mjs";

import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "..", "locations.js");
let content = readFileSync(filePath, "utf8");

// Apply coordinate corrections
let coordChanges = 0;
for (const [courseName, coords] of Object.entries(coordinateCorrections)) {
  // Find the pattern: name: "courseName", lat: X, lng: Y
  // We need to escape special regex characters in the name
  const escapedName = courseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the lat value for this specific course
  // Pattern: after the name line, find the lat and lng values
  const latPattern = new RegExp(
    `(name:\\s*"${escapedName}".*?lat:\\s*)([\\d.]+)`,
    's'
  );
  const lngPattern = new RegExp(
    `(name:\\s*"${escapedName}".*?lng:\\s*)([\\d.]+)`,
    's'
  );

  const latMatch = content.match(latPattern);
  const lngMatch = content.match(lngPattern);

  if (latMatch && lngMatch) {
    const oldLat = parseFloat(latMatch[2]);
    const oldLng = parseFloat(lngMatch[2]);

    if (Math.abs(oldLat - coords.lat) > 0.001 || Math.abs(oldLng - coords.lng) > 0.001) {
      content = content.replace(latPattern, `$1${coords.lat}`);
      content = content.replace(lngPattern, `$1${coords.lng}`);
      coordChanges++;
      console.log(`  ✓ ${courseName}: ${oldLat},${oldLng} → ${coords.lat},${coords.lng}`);
    }
  } else {
    console.log(`  ✗ ${courseName}: NOT FOUND in locations.js`);
  }
}

// Apply name updates
let nameChanges = 0;
for (const [oldName, newName] of Object.entries(nameUpdates)) {
  const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(`name:\\s*"${escapedOldName}"`, 'g');
  if (content.match(namePattern)) {
    content = content.replace(namePattern, `name: "${newName}"`);
    nameChanges++;
    console.log(`  ✓ Renamed: "${oldName}" → "${newName}"`);
  }
}

writeFileSync(filePath, content, "utf8");
console.log(`\nApplied ${coordChanges} coordinate corrections and ${nameChanges} name updates.`);
