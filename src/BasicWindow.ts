import Rect from "parsegraph-rect";
import { Projected } from "parsegraph-projector";
import { Renderable } from "parsegraph-timingbelt";

/**
 * A BasicWindow displays Projected using 2D, 3D, or DOM-based rendering.
 */
export default interface BasicWindow extends Renderable {
  numComponents(): number;
  removeComponent(compToRemove: Projected): void;
  layout(target: Projected): Rect;
  forEach(
    func: (comp: Projected, compSize: Rect) => boolean,
    funcThisArg?: any
  ): void;
}
