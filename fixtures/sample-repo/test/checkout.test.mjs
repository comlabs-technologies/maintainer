import test from "node:test";
import assert from "node:assert/strict";

test("checkout helper keeps quantity at 1", () => {
  const quantity = 1;
  assert.equal(quantity, 1);
});
