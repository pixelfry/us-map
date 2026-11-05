import { resolve } from "node:path";
import { loadFromDisk, validate } from "./validate.js";

const { plans, topologies, members } = loadFromDisk(resolve(import.meta.dirname, "../.."));
const { problems, vacancies } = validate(plans, topologies, members);
console.log(`vacant districts: ${vacancies.length ? vacancies.map((v) => `${v.state}-${v.district}`).join(", ") : "none"}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`ok: ${plans.length} plans, ${members.length} members`);
