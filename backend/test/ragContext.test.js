const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConversationRagContext } = require("../src/services/ragClient");


test("uses the closest sourced answer as the preferred document scope", () => {
  const context = buildConversationRagContext([
    { role: "user", content: "What is SunSaver?" },
    {
      role: "assistant",
      content: "It is a solar controller.",
      sources: [{ documentId: "sun-manual" }, { documentId: "sun-manual" }],
    },
    { role: "user", content: "Thanks" },
    { role: "assistant", content: "You're welcome!", sources: [] },
  ]);

  assert.deepEqual(context.preferredDocumentIds, ["sun-manual"]);
  assert.equal(context.history.length, 4);
});
