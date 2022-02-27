var assert = require("assert");
import Window, { ProxyComponent } from "../src/index.main";

describe("Window", function () {
  it("can be constructed", () => {
    assert.ok(new Window());
  });

  it("can add and remove components", () => {
    const win = new Window();
    const comp = new ProxyComponent();
    win.addComponent(comp);
    assert.ok(win.removeComponent(comp));
    assert.ok(!win.removeComponent(comp));
  });

  it("has an element container for a component", () => {
    const win = new Window();
    const comp = new ProxyComponent();
    win.addComponent(comp);
    const container = win.containerFor(comp);
    assert.ok(container);
    const d = document.createElement("div");
    container.appendChild(d);
    assert.ok(container === win.containerFor(comp));
  });

  it("actually adds an element to the window's container", () => {
    const win = new Window();
    const comp = new ProxyComponent();
    win.addComponent(comp);
    const container = win.containerFor(comp);
    const d = document.createElement("div");
    container.appendChild(d);

    const isParentOf = (parent, elem) => {
      return elem.parentNode === parent || elem.parentElement === parent;
    };
    const isAncestorOf = (parent, elem) => {
      //console.log("Checking if ", parent, "is ancestor of ", elem);
      if (!parent || !elem) {
        return false;
      }
      return (
        isParentOf(parent, elem) ||
        isAncestorOf(parent, elem.parentElement) ||
        isAncestorOf(parent, elem.parentNode)
      );
    };
    assert.ok(isAncestorOf(win.container(), d));
  });

  it("removes an element container from a component", () => {
    const win = new Window();
    const comp = new ProxyComponent();
    win.addComponent(comp);
    const container = win.containerFor(comp);
    const d = document.createElement("div");
    container.appendChild(d);

    const isParentOf = (parent, elem) => {
      return elem.parentNode === parent || elem.parentElement === parent;
    };
    const isAncestorOf = (parent, elem) => {
      if (!parent || !elem) {
        return false;
      }
      return (
        isParentOf(parent, elem) ||
        isAncestorOf(parent, elem.parentElement) ||
        isAncestorOf(parent, elem.parentNode)
      );
    };
    assert.ok(isAncestorOf(win.container(), d));
    assert.ok(win.removeComponent(comp));
    assert.ok(!isAncestorOf(win.container(), d));
  });
});
