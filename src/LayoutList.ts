import { Projected } from "parsegraph-projector";
import Rect from "parsegraph-rect";

export enum ComponentLayout {
  VERTICAL,
  HORIZONTAL,
  ENTRY,
}

export const COMPONENT_LAYOUT_VERTICAL = ComponentLayout.VERTICAL;
export const COMPONENT_LAYOUT_HORIZONTAL = ComponentLayout.HORIZONTAL;
export const COMPONENT_LAYOUT_ENTRY = ComponentLayout.ENTRY;

export type LayoutEntry = Projected | LayoutList;

export default class LayoutList {
  _type: ComponentLayout;
  _parent: LayoutList;
  _entries: LayoutEntry[];

  constructor(type: ComponentLayout, parent?: LayoutList) {
    this._type = type;
    this._parent = parent;
    this._entries = [];
  }

  setEntry(comp: Projected) {
    if (this._entries[0]) {
      throw new Error("A layout list must not change its entry once set");
    }
    this._entries[0] = comp;
  }

  component() {
    return this._entries[0] as Projected;
  }

  type() {
    return this._type;
  }

  addWithType(comp: Projected, layoutType: ComponentLayout) {
    if (
      layoutType !== COMPONENT_LAYOUT_HORIZONTAL &&
      layoutType !== COMPONENT_LAYOUT_VERTICAL
    ) {
      throw new Error(
        "LayoutList type must be horizontal or vertical when adding with type."
      );
    }
    let entry;
    if (this._type === COMPONENT_LAYOUT_ENTRY) {
      if (this._parent && layoutType === this._parent.type()) {
        const entry = new LayoutList(COMPONENT_LAYOUT_ENTRY, this._parent);
        entry.setEntry(comp);
        for (let i = 0; i < this._parent._entries.length; ++i) {
          if (this._parent._entries[i] === this) {
            this._parent._entries.splice(i + 1, 0, entry);
            return;
          }
        }
        throw new Error("Failed to insert entry into parent");
      }
      // console.log("Changing list from entry");
      this._type = layoutType;
      const firstEntry = new LayoutList(COMPONENT_LAYOUT_ENTRY, this);
      firstEntry.setEntry(this.component());
      entry = new LayoutList(COMPONENT_LAYOUT_ENTRY, this);
      entry.setEntry(comp);
      this._entries[0] = firstEntry;
      this._entries[1] = entry;
      return;
    }
    if (
      this._type === layoutType ||
      this._entries.length === 0 ||
      (this._entries.length === 1 && this._entries[0] instanceof LayoutList)
    ) {
      // console.log("Repurposing list");
      this._type = layoutType;
      entry = new LayoutList(COMPONENT_LAYOUT_ENTRY, this);
      entry.setEntry(comp);
      this._entries.push(entry);
    } else {
      // console.log("Creating nested list");
      const firstEntry = new LayoutList(layoutType, this);
      firstEntry.addWithType(comp, layoutType);
      this._entries.push(firstEntry);
    }
  }

  addVertical(comp: Projected) {
    return this.addWithType(comp, COMPONENT_LAYOUT_VERTICAL);
  }

  addHorizontal(comp: Projected) {
    return this.addWithType(comp, COMPONENT_LAYOUT_HORIZONTAL);
  }

  forEach(
    func: (comp: Projected, compSize: Rect) => void,
    funcThisArg: any,
    compSize?: Rect
  ): boolean {
    if (this._type === COMPONENT_LAYOUT_ENTRY) {
      return func.call(funcThisArg, this.component(), compSize);
    }
    const entrySize = compSize ? compSize.clone() : null;
    for (let i = 0; i < this._entries.length; ++i) {
      if (compSize) {
        if (this._type === COMPONENT_LAYOUT_HORIZONTAL) {
          entrySize.setWidth(compSize.width() / this._entries.length);
          entrySize.setX(compSize.x() + i * entrySize.width());
        } else {
          entrySize.setHeight(compSize.height() / this._entries.length);
          entrySize.setY(
            compSize.y() + (this._entries.length - 1 - i) * entrySize.height()
          );
        }
      }
      const entry = this._entries[i];
      if ((entry as LayoutList).forEach(func, funcThisArg, entrySize)) {
        return true;
      }
    }
  }

  isEmpty() {
    return this._entries.length === 0;
  }

  getPrevious(target: Projected): Projected {
    let prior = null;
    if (
      this.forEach(function (comp: Projected) {
        if (target === comp) {
          return true;
        }
        prior = comp;
      }, this)
    ) {
      return prior;
    }
    return null;
  }

  getNext(target: Projected): Projected {
    let next = null;
    let found = false;
    if (
      this.forEach(function (comp: Projected) {
        if (found) {
          next = comp;
          return true;
        }
        if (target === comp) {
          found = true;
        }
      }, this)
    ) {
      return next;
    }
    return null;
  }

  remove(comp: Projected) {
    if (this._type === COMPONENT_LAYOUT_ENTRY) {
      throw new Error("A layoutList entry cannot remove itself");
    }
    for (let i = 0; i < this._entries.length; ++i) {
      const entry = this._entries[i] as LayoutList;
      if (entry.type() === COMPONENT_LAYOUT_ENTRY) {
        if ((entry as LayoutList).component() === comp) {
          this._entries.splice(i, 1);
          return true;
        }
      } else {
        if (entry.remove(comp)) {
          if (entry.isEmpty()) {
            this._entries.splice(i, 1);
          }
          return true;
        }
      }
    }
    return false;
  }

  contains(comp: Projected): LayoutList {
    if (this._type === COMPONENT_LAYOUT_ENTRY) {
      return this.component() === comp ? this : null;
    }
    for (let i = 0; i < this._entries.length; ++i) {
      const entry = this._entries[i] as LayoutList;
      const found = entry.contains(comp);
      if (found) {
        return found;
      }
    }
    return null;
  }

  count() {
    if (this._type === COMPONENT_LAYOUT_ENTRY) {
      return this.component() ? 1 : 0;
    }
    let c = 0;
    for (let i = 0; i < this._entries.length; ++i) {
      const entry = this._entries[i] as LayoutList;
      c += entry.count();
    }
    return c;
  }
}
