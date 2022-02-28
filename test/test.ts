const { assert } = require("chai");
import { BasicProjector, Projector, Projected } from "parsegraph-projector";
import GraphicsWindow from "../src/index";
import Method from "parsegraph-method";

const isParentOf = (parent: Element, elem: Element) => {
  return elem.parentNode === parent || elem.parentElement === parent;
};

const isAncestorOf = (parent: Element, elem: Element) => {
  // console.log("Checking if ", parent, "is ancestor of ", elem);
  if (!parent || !elem) {
    return false;
  }
  return (
    isParentOf(parent, elem) ||
    isAncestorOf(parent, elem.parentElement) ||
    isAncestorOf(parent, elem.parentNode as Element)
  );
};

class ProxyComponent implements Projected {
  _color: string;
  _onScheduleUpdate: Method;
  _elems: Map<Projector, HTMLElement>;

  constructor(color: string = "") {
    this._color = color;
    this._onScheduleUpdate = new Method();
    this._elems = new Map();
  }

  tick() {
    return false;
  }

  dispose() {
  }

  unmount() {
  }

  setOnScheduleUpdate(func: Function, funcObj: any) {
    this._onScheduleUpdate.set(func, funcObj);
  }

  getElem(projector: Projector) {
    return this._elems.get(projector);
  }

  paint(projector: Projector) {
    if (!this._elems.has(projector)) {
      this._elems.set(projector, document.createElement("div"));
    }
    return false;
  }

  render(projector: Projector) {
    const elem = this._elems.get(projector);
    if (!elem) {
      return true;
    }
    elem.innerHTML = "Rendered";
    return false;
  }
}

describe("Window", function () {
  it("can be constructed", () => {
    assert.ok(new GraphicsWindow());
  });

  it("can add and remove components", () => {
    const win = new GraphicsWindow();
    const comp = new ProxyComponent();
    win.addHorizontal(comp);
    assert.ok(win.removeComponent(comp));
    assert.ok(!win.removeComponent(comp));
  });

  it("has an element container for a component", () => {
    const win = new GraphicsWindow();
    const comp = new ProxyComponent();
    win.addVertical(comp);
    const proj = new BasicProjector();
    win.paint(proj, 0);
    const container = win.projectionFor(proj, comp);
    assert.ok(container);
    assert.ok(container === win.projectionFor(proj, comp));
  });

  it("actually adds an element to the window's container", () => {
    const win = new GraphicsWindow();
    const comp = new ProxyComponent();
    win.addHorizontal(comp);
    const proj = new BasicProjector();
    win.paint(proj, 0);
    assert.ok(win.projectionFor(proj, comp));
    assert.ok(isAncestorOf(proj.container(), comp.getElem(proj)));
  });

  it("removes an element container from a component", () => {
    const win = new GraphicsWindow();
    const comp = new ProxyComponent();
    win.addHorizontal(comp);
    const proj = new BasicProjector();
    win.paint(proj, 0);
    assert.ok(win.projectionFor(proj, comp));
    const elem = comp.getElem(proj);
    assert.ok(isAncestorOf(proj.container(), elem));
    assert.ok(win.removeComponent(comp));
    assert.ok(!isAncestorOf(proj.container(), elem));
  });
});
