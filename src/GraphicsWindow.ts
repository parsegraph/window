import LayoutList, { COMPONENT_LAYOUT_HORIZONTAL } from "./LayoutList";
import Rect from "parsegraph-rect";
import { elapsed } from "parsegraph-timing";
import Color from "parsegraph-color";
import {
  BasicProjector,
  SharedProjector,
  Projected,
  Projection,
} from "parsegraph-projector";

import BasicWindow from "./BasicWindow";

export default class GraphicsWindow implements BasicWindow {
  _schedulerFunc: () => void;
  _schedulerFuncThisArg: object;
  _layoutList: LayoutList;
  _projector: BasicProjector;
  _projections: Map<Projected, Projection>;

  constructor(backgroundColor?: Color) {
    this._projector = new BasicProjector(backgroundColor);
    this._projector.setOnScheduleUpdate(this.scheduleUpdate, this);

    this._schedulerFunc = null;
    this._schedulerFuncThisArg = null;

    this._layoutList = new LayoutList(COMPONENT_LAYOUT_HORIZONTAL);

    this._projections = new Map();
  }

  container() {
    return this.projector().container();
  }

  setExplicitSize(width: number, height: number) {
    return this.projector().glProvider().setExplicitSize(width, height);
  }

  projectionFor(comp: Projected): Projection {
    return this._projections.get(comp);
  }

  projector() {
    return this._projector;
  }

  setBackground(bg: Color) {
    this.projector().glProvider().setBackground(bg);
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
    const windowSize = new Rect();
    this.projector().glProvider().getSize(windowSize);
    return this._layoutList.forEach(func, funcThisArg, windowSize);
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

  onContextChanged(isLost: boolean): void {
    this.projector().glProvider().onContextChanged(isLost);
    this.forEach((comp: Projected) => {
      comp.contextChanged(this.projectionFor(comp).projector(), isLost);
    }, this);
  }

  addHorizontal(comp: Projected, other: Projected) {
    this.createProjector(comp);
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
    this.createProjector(comp);
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

  private createProjector(comp: Projected) {
    if (this.projectionFor(comp)) {
      return;
    }

    this._projections.set(
      comp,
      new Projection(new SharedProjector(this.projector()), comp)
    );
    comp.setOnScheduleUpdate(this.scheduleUpdate, this);
    this.scheduleUpdate();
  }

  private removeComponentContainer(comp: Projected) {
    comp.setOnScheduleUpdate(null, null);
    if (this._projections.has(comp)) {
      const projections = this._projections.get(comp);
      (projections.projector() as SharedProjector).unmount();
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

  paint(timeout: number) {
    let needsUpdate = false;
    const startTime = new Date();
    const compCount = this.numComponents();
    while (timeout > 0) {
      this.forEach((comp: Projected) => {
        needsUpdate =
          this.projectionFor(comp).paint(timeout / compCount) || needsUpdate;
      }, this);
      timeout = Math.max(0, timeout - elapsed(startTime));
    }
    return needsUpdate;
  }

  render() {
    let needsUpdate = this.projector().render();

    this.forEach((comp: Projected, compSize: Rect) => {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " +
      // compSize.width() + "x" + compSize.height());
      const projection = this.projectionFor(comp);
      projection.setClip(compSize);
      projection.prepareClip();
      needsUpdate = projection.render() || needsUpdate;
      projection.removeClip();
    }, this);

    return needsUpdate;
  }
}
