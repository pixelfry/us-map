import { writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { toMembers, type Legislator, type MembersFile } from "./members.js";

const SOURCE_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const OUT = resolve(import.meta.dirname, "../../data/generated/members.json");

const res = await fetch(SOURCE_URL, { headers: { "user-agent": "us-map/0.1 (personal project)" } });
if (!res.ok) {
  console.error(`legislators fetch failed: HTTP ${res.status}; leaving ${OUT} untouched`);
  process.exit(1);
}
const legislators = (await res.json()) as Legislator[];
const today = new Date().toISOString().slice(0, 10);
const members = toMembers(legislators, today);
if (members.length < 500) {
  console.error(`only ${members.length} members parsed; refusing to overwrite ${OUT}`);
  process.exit(1);
}
const file: MembersFile = { fetched_at: new Date().toISOString(), source: SOURCE_URL, members };
const tmp = `${OUT}.${process.pid}.tmp`;
await writeFile(tmp, JSON.stringify(file, null, 1) + "\n");
await rename(tmp, OUT);
console.log(`wrote ${members.length} members to ${OUT}`);
