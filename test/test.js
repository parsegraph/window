var assert = require("assert");
import Window from "../dist/window";

describe("Package", function () {
  it("works", ()=>{
    assert.ok(new Window());
  });
});
