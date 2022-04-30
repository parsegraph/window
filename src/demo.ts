import Color from "parsegraph-color";
import BasicWindow from "./BasicWindow";
import GraphicsWindow from "./GraphicsWindow";
import TimingBelt from "parsegraph-timingbelt";
import { BasicMouseController, MouseInput } from "parsegraph-input";
import { BasicGLProvider } from "parsegraph-compileprogram";
import {
  Projector,
  Projection,
  Projected,
  BasicProjector,
} from "parsegraph-projector";
import Method from "parsegraph-method";

class TestProjectedSlice extends BasicMouseController {
  _projected: TestProjected;
  _projector: Projector;
  _input: MouseInput;

  constructor(projected: TestProjected, projector: Projector) {
    super();
    this._projected = projected;
    this._projector = projector;
    this._input = new MouseInput();
    this._input.mount(projector.glProvider().canvas());
    this._input.setControl(this);
  }

  mouseup(button: any) {
    super.mouseup(button);
    const clickX = this._projected.testSize().clickX();
    const clickY = this._projected.testSize().clickY();
    const clickSize = this._projected.testSize().clickSize();
    if (
      this.lastMouseX() < clickX - clickSize / 2 ||
      this.lastMouseX() > clickX + clickSize / 2
    ) {
      return false;
    }
    if (
      this.lastMouseY() < clickY - clickSize / 2 ||
      this.lastMouseY() > clickY + clickSize / 2
    ) {
      return false;
    }
    this.window().removeComponent(this.projected());
    return true;
  }

  projected() {
    return this._projected;
  }

  window() {
    return this.projected().window();
  }

  paint(_: number) {
    console.log("Painting");
    const container = this._projector.getDOMContainer();
    const d = document.createElement("div");
    d.style.backgroundColor = "pink";
    d.style.width = "100px";
    d.style.height = "100px";
    d.style.left = "50px";
    d.style.top = "50px";
    d.style.position = "absolute";
    d.addEventListener("mousedown", () => {
      this.window().removeComponent(this.projected());
    });
    container.appendChild(d);
    return false;
  }

  unmount() {}

  contextChanged(_: boolean) {}
}

class TestSize {
  _clickX: number;
  _clickY: number;
  _clickSize: number;
  _size: number;

  constructor(clickX: number, clickY: number, clickSize: number, size: number) {
    this._clickX = clickX;
    this._clickY = clickY;
    this._clickSize = clickSize;
    this._size = size;
  }

  size() {
    return this._size;
  }

  clickSize() {
    return this._clickSize;
  }

  clickX() {
    return this._clickX;
  }

  clickY() {
    return this._clickY;
  }
}

class TestProjected implements Projected {
  _slices: Map<Projector, TestProjectedSlice>;
  _wind: BasicWindow;
  _color: string;
  _onScheduleUpdate: Method;
  _testSize: TestSize;

  constructor(window: BasicWindow, color: string, testSize: TestSize) {
    this._wind = window;
    this._slices = new Map();
    this._color = color;
    this._onScheduleUpdate = new Method();
    this._testSize = testSize;
  }

  testSize() {
    return this._testSize;
  }

  tick() {
    return false;
  }

  dispose() {
    this._slices.forEach((slice) => slice.unmount());
  }

  unmount(projector: Projector) {
    if (!this._slices.has(projector)) {
      return;
    }
    this._slices.get(projector).unmount();
    this._slices.delete(projector);
  }

  contextChanged(projector: Projector, isLost: boolean) {
    this._slices.get(projector).contextChanged(isLost);
  }

  setOnScheduleUpdate(func: Function, funcObj: any) {
    this._onScheduleUpdate.set(func, funcObj);
  }

  window() {
    return this._wind;
  }

  paint(projector: Projector, timeout?: number) {
    if (!this._slices.has(projector)) {
      this._slices.set(projector, new TestProjectedSlice(this, projector));
    }
    return this._slices.get(projector).paint(timeout);
  }

  render(projector: Projector): boolean {
    console.log("Rendering");
    const ctx = projector.overlay();
    ctx.font = "34px serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = this._color;
    const jump = 20;

    const size = this.testSize().size();
    const clickX = this.testSize().clickX();
    const clickY = this.testSize().clickY();
    const clickSize = this.testSize().clickSize();

    for (let y = 0; y < size; y += jump) {
      for (let x = 0; x < size; x += jump) {
        ctx.fillText("Hello World", x, y);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      clickX - clickSize / 2,
      clickY - clickSize / 2,
      clickSize,
      clickSize
    );
    ctx.font = "12px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText("CLICK ROUND HERE", clickX, clickY);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const belt = new TimingBelt();

  const provider = new BasicGLProvider();
  const size = 500;
  provider.setExplicitSize(size, size);
  const proj: BasicProjector = new BasicProjector(provider);
  const wind = new GraphicsWindow();
  belt.addRenderable(new Projection(proj, wind));

  const root = document.getElementById("demo");
  root.appendChild(proj.container());
  root.appendChild(
    (() => {
      const e = document.createElement("span");
      e.innerHTML = "content with element";
      return e;
    })()
  );
  wind.setBackground(Color.random());

  const testSize = new TestSize(250, 50, 10, size);
  ["#000", "#f00", "#ff0", "#0f0"].forEach((color) => {
    wind.addVertical(new TestProjected(wind, color, testSize), null);
  });
});
