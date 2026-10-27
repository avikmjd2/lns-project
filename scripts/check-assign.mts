import { COMBOS, buildAssignment, pickCombo, type Combo } from "../lib/assign";
import { serveAudio } from "../lib/serve-audio";
import { RECORDINGS } from "../lib/recordings";
import assert from "node:assert";

const byLabel = new Map(RECORDINGS.map((r) => [r.label, r]));
assert.equal(RECORDINGS.length, 8);
const seen = new Set<string>();
for (const c of COMBOS) {
  const labels = buildAssignment(c);
  assert.equal(labels.length, 4, c);
  const recs = labels.map((l) => byLabel.get(l)!);
  assert(recs.every(Boolean), "unknown label");
  assert.equal(new Set(recs.map((r) => r.speakerId)).size, 4, "one clip per speaker " + c);
  for (const g of ["female", "male"] as const) {
    const pair = recs.filter((r) => r.gender === g);
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0].guise, pair[1].guise, `opposite styles in ${g} pair ${c}`);
  }
  assert.equal(recs.filter((r) => r.guise === "mixed").length, 2);
  assert.equal(recs.filter((r) => r.guise === "pure").length, 2);
  seen.add(labels.join(","));
  console.log(c, labels.join(" "));
}
assert.equal(seen.size, 4, "4 distinct combos");

const tally: Record<Combo, number> = { A: 0, B: 0, C: 0, D: 0 };
for (let i = 0; i < 400; i++) tally[pickCombo(tally)]++;
assert.deepEqual(Object.values(tally), [100, 100, 100, 100]);
assert.equal(pickCombo({ A: 5, B: 2, C: 5, D: 5 }), "B");
console.log("balance ok", tally);

const buf = Buffer.alloc(3 * 1024 * 1024, 7);
async function r(h: string | null) {
  const x = serveAudio(buf, h);
  return { s: x.status, cr: x.headers.get("content-range"), len: (await x.arrayBuffer()).byteLength, ar: x.headers.get("accept-ranges") };
}
let x = await r(null);
assert.equal(x.s, 200);
assert.equal(x.len, buf.length);
assert.equal(x.ar, "bytes");

x = await r("bytes=0-");
assert.equal(x.s, 206);
assert.equal(x.len, 1024 * 1024);
assert.equal(x.cr, `bytes 0-${1024 * 1024 - 1}/${buf.length}`);

x = await r("bytes=0-1");
assert.equal(x.s, 206);
assert.equal(x.len, 2);

x = await r(`bytes=${buf.length - 10}-`);
assert.equal(x.s, 206);
assert.equal(x.len, 10);

x = await r("bytes=-100");
assert.equal(x.s, 206);
assert.equal(x.len, 100);

x = await r(`bytes=${buf.length}-`);
assert.equal(x.s, 416);

x = await r("bytes=abc");
assert.equal(x.s, 416);

x = await r("bytes=5-2");
assert.equal(x.s, 416);

console.log("range ok");
console.log("ALL CHECKS PASSED");
