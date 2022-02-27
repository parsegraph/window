import LayoutList, { COMPONENT_LAYOUT_HORIZONTAL } from "./LayoutList";
import Rect from "parsegraph-rect";
import { elapsed } from "parsegraph-timing";
import Color from "parsegraph-color";
import {
  BasicProjector,
  SharedProjector,
  Projector,
  Projected,
  Projection,
} from "parsegraph-projector";

import BasicWindow from "./BasicWindow";

// Background color.
const BACKGROUND_COLOR = new Color(
  // 0, 47 / 255, 57 / 255, 1,
  // 256/255, 255/255, 255/255, 1
  0,
  0,
  0,
  1
  // 45/255, 84/255, 127/255, 1
);

export default class GraphicsWindow implements BasicWindow {
  _schedulerFunc: () => void;
  _schedulerFuncThisArg: object;
  _layoutList: LayoutList;
  _projections: Map<Projected, Map<Projector, Projection>>;
  _backgroundColor: Color;

  constructor() {
    this._schedulerFunc = null;
    this._schedulerFuncThisArg = null;

    this._layoutList = new LayoutList(COMPONENT_LAYOUT_HORIZONTAL);

    this._projections = new Map();

    this._backgroundColor = BACKGROUND_COLOR;
  }

  projectionFor(proj: Projector, comp: Projected): Projection {
    return this._projections.get(comp)?.get(proj);
  }

  setBackground(bg: Color) {
    this._backgroundColor = bg;
    this.scheduleUpdate();
  }

  numComponents() {
    return this._layoutList.count();
  }

  layout(target: Projected): Rect {
    let targetSize = null;
    this.forEach((comp: Projected, compSize: Rect) => {
      if (target === comp) {
        targetSize = compSize;
        return true;
      }
    }, this);
    if (!targetSize) {
      throw new Error("Layout target must be a child component of this window");
    }
    return targetSize;
  }

  forEach(func: (comp: Projected, compSize: Rect) => void, funcThisArg?: any) {
    return this._layoutList.forEach(func, funcThisArg);
  }

  protected scheduleUpdate() {
    // console.log("Window is scheduling update");
    if (this._schedulerFunc) {
      this._schedulerFunc.call(this._schedulerFuncThisArg, this);
    }
  }

  setOnScheduleUpdate(schedulerFunc: () => void, schedulerFuncThisArg?: any) {
    this._schedulerFunc = schedulerFunc;
    this._schedulerFuncThisArg = schedulerFuncThisArg;
  }

  addHorizontal(comp: Projected, other: Projected) {
    this.addComponent(comp);
    if (!other) {
      this._layoutList.addHorizontal(comp);
      return;
    }
    const container = this._layoutList.contains(other);
    if (!container) {
      throw new Error("Window must contain the given reference component");
    }
    container.addHorizontal(comp);
  }

  addVertical(comp: Projected, other: Projected) {
    this.addComponent(comp);
    if (!other) {
      this._layoutList.addVertical(comp);
      return;
    }
    const container = this._layoutList.contains(other);
    if (!container) {
      throw new Error("Window must contain the given reference component");
    }
    container.addVertical(comp);
  }

  private addComponent(comp: Projected) {
    this._projections.set(comp, new Map());
  }

  private removeComponentContainer(comp: Projected) {
    comp.setOnScheduleUpdate(null, null);
    if (this._projections.has(comp)) {
      const projections = this._projections.get(comp);
      projections.forEach(projection=>projection.unmount());
      this._projections.delete(comp);
    }
  }

  removeComponent(compToRemove: Projected) {
    this.scheduleUpdate();
    this.removeComponentContainer(compToRemove);
    return this._layoutList.remove(compToRemove);
  }

  tick(startTime: number) {
    let needsUpdate = false;
    this.forEach((comp: Projected) => {
      needsUpdate = comp.tick(startTime) || needsUpdate;
    }, this);
    return needsUpdate;
  }

  private addProjection(proj: Projector, comp: Projected) {
    if (this.projectionFor(proj, comp)) {
      return;
    }

    if (!this._projections.get(comp)) {
      this._projections.set(comp, new Map());
    }

    if (!this._projections.get(comp).has(proj)) {
      this._projections.get(comp).set(
        proj,
        new Projection(new SharedProjector(proj), comp)
      );
      comp.setOnScheduleUpdate(this.scheduleUpdate, this);
      this.scheduleUpdate();
    }
  }

  paint(proj:Projector, timeout: number) {
    let needsUpdate = false;
    const startTime = new Date();
    const compCount = this.numComponents();
    while (timeout > 0) {
      this.forEach((comp: Projected) => {
        this.addProjection(proj, comp);
        needsUpdate =
          this.projectionFor(proj, comp).paint(timeout / compCount) || needsUpdate;
      }, this);
      timeout = Math.max(0, timeout - elapsed(startTime));
    }
    return needsUpdate;
  }

  render(proj: Projector) {
    let needsUpdate = proj.render();

    const gl = proj.glProvider().gl();
    gl.clearColor(
      this._backgroundColor.r(),
      this._backgroundColor.g(),
      this._backgroundColor.b(),
      this._backgroundColor.a()
    );

    this.forEach((comp: Projected, compSize: Rect) => {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " +
      // compSize.width() + "x" + compSize.height());
      const projection = this.projectionFor(proj, comp);
      projection.setClip(compSize);
      projection.prepareClip();
      needsUpdate = projection.render() || needsUpdate;
      projection.removeClip();
    }, this);

    return needsUpdate;
  }

  unmount(projector: Projector) {
    this._projections.forEach(projectedMap=>{
      const projection = projectedMap.get(projector);
      if (projection) {
        projection.unmount();
      }
      projectedMap.delete(projector);
    });
  }

  dispose() {
    this._projections.forEach(projectedMap=>{
      projectedMap.forEach(projection=>projection.unmount());
    });
    this._projections.clear();
  }
}
