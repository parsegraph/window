var assert = require("assert");
import Window from "../dist/parsegraph-window";

describe("Package", function () {
  it("works", ()=>{
    assert.ok(new Window());
  });
});
