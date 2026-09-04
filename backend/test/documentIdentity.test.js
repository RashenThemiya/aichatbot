const test = require("node:test");
const assert = require("node:assert/strict");

const { documentKey } = require("../src/services/documentIdentity");

test("copy and version suffixes resolve to the same document family", () => {
  assert.equal(documentKey("manuals/IC1230150.pdf"), "manuals/ic1230150");
  assert.equal(documentKey("manuals/IC1230150 (1).pdf"), "manuals/ic1230150");
  assert.equal(documentKey("manuals/IC1230150_copy_2.pdf"), "manuals/ic1230150");
  assert.equal(documentKey("manuals/IC1230150_v2.pdf"), "manuals/ic1230150");
});

test("different model suffixes remain different document families", () => {
  assert.notEqual(documentKey("IC121040.pdf"), documentKey("IC121040I.pdf"));
});

test("same generic filename in different folders remains distinct", () => {
  assert.notEqual(
    documentKey("controllers/manual.pdf"),
    documentKey("inverters/manual.pdf")
  );
});
