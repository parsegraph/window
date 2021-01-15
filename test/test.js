var assert = require("assert");
import todo from "../dist/window";

describe("Package", function () {
  it("works", ()=>{
    assert.equal(todo(), 42);
  });
});
