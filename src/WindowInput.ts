import normalizeWheel from "parsegraph-normalizewheel";
import { midPoint } from "parsegraph-matrix";
import Component from "./Component";
import GraphicsWindow from "./GraphicsWindow";
import Rect from "parsegraph-rect";
import Keystroke from "./Keystroke";
import TouchRecord from "./TouchRecord";

export const CLICK_DELAY_MILLIS: number = 500;

export type InputListener = (eventType: string, inputData?: any) => boolean;

export default class WindowInput {
  _isDoubleClick: boolean;
  _isDoubleTouch: boolean;
  _lastMouseX: number;
  _lastMouseY: number;
  _listener: InputListener;

  _monitoredTouches: TouchRecord[];
  _touchstartTime: number;
  _touchendTimeout: any;
  _mouseupTimeout: number;
  _mousedownTime: number;
  _window: GraphicsWindow;
  _focused: boolean;
  _component: Component;

  constructor(
    window: GraphicsWindow,
    comp: Component,
    listener: InputListener
  ) {
    if (!window) {
      throw new Error("Window must be provided");
    }
    if (!comp) {
      throw new Error("Component must be provided");
    }
    if (!listener) {
      throw new Error("Event listener must be provided");
    }
    this._window = window;
    this._isDoubleClick = false;
    this._isDoubleTouch = false;

    this._lastMouseX = 0;
    this._lastMouseY = 0;

    this._monitoredTouches = [];
    this._touchstartTime = null;

    this._isDoubleClick = false;
    this._mouseupTimeout = 0;

    // Whether the container is focused and not blurred.
    this._focused = false;
    this._component = comp;
    this._listener = listener;

    const windowContainer = this._window.canvas();
    windowContainer.setAttribute("tabIndex", "0");

    const addListeners = (elem: Element, listeners: [string, Function][]) => {
      listeners.forEach((pair: [string, Function]) => {
        elem.addEventListener(pair[0] as string, (event) => {
          return (pair[1] as Function).call(this, event, comp);
        });
      });
    };

    addListeners(windowContainer, [
      ["blur", this.blurListener],
      ["focus", this.focusListener],
      ["keydown", this.keydownListener],
      ["keyup", this.keyupListener],
    ]);

    addListeners(this.container(), [
      ["DOMMouseScroll", this.onWheel],
      ["mousewheel", this.onWheel],
      ["touchstart", this.touchstartListener],
      ["touchmove", this.touchmoveListener],
      ["touchend", this.removeTouchListener],
      ["touchcancel", this.removeTouchListener],
      ["mousedown", this.mousedownListener],
      ["mousemove", this.mousemoveListener],
      ["mouseup", this.mouseupListener],
      ["mouseout", this.mouseupListener],
    ]);
  }

  container() {
    return this._window.containerFor(this._component);
  }

  focusListener() {
    this._focused = true;
  }

  blurListener() {
    this._focused = false;
  }

  focusedComponent() {
    return this._focused ? this._component : null;
  }

  numActiveTouches() {
    let realMonitoredTouches = 0;
    this._monitoredTouches.forEach(function (touchRec) {
      if (touchRec.touchstart) {
        realMonitoredTouches++;
      }
    }, this);
    return realMonitoredTouches;
  }

  lastMouseCoords() {
    return [this._lastMouseX, this._lastMouseY];
  }

  lastMouseX() {
    return this._lastMouseX;
  }

  lastMouseY() {
    return this._lastMouseY;
  }

  /**
   * The receiver of all canvas wheel events.
   *
   * @param {WheelEvent} event current wheel event
   * @param {Component} comp component where the event was sourced
   */
  onWheel(event: WheelEvent, comp: Component) {
    event.preventDefault();

    // console.log("Wheel event", wheel);
    const e = normalizeWheel(event);
    this.handleEvent("wheel", {
      comp: comp,
      x: event.offsetX,
      y: event.offsetY,
      ...e,
    });
  }

  mousedownListener(event: MouseEvent) {
    this._focused = true;

    console.log(event);
    this._lastMouseX = event.offsetX;
    this._lastMouseY = event.offsetY;

    // console.log("Setting mousedown time");
    this._mousedownTime = Date.now();

    if (
      this.handleEvent("mousedown", {
        x: this._lastMouseX,
        y: this._lastMouseY,
        button: event.button,
        startTime: this._mousedownTime,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      this._window.canvas().focus();
    }

    // This click is a second click following
    // a recent click; it's a double-click.
    if (this._mouseupTimeout) {
      window.clearTimeout(this._mouseupTimeout);
      this._mouseupTimeout = null;
      this._isDoubleClick = true;
    }
  }

  removeTouchListener(event: TouchEvent, comp: Component) {
    // alert
    // console.log("touchend");
    for (let i = 0; i < event.changedTouches.length; ++i) {
      const touch = event.changedTouches[i];
      this.removeTouchByIdentifier(touch.identifier);
    }

    if (
      this._touchstartTime != null &&
      Date.now() - this._touchstartTime < CLICK_DELAY_MILLIS
    ) {
      const that = this;
      this._touchendTimeout = setTimeout(function () {
        that._touchendTimeout = null;

        if (that._isDoubleTouch) {
          // Double touch ended.
          that._isDoubleTouch = false;
          return;
        }

        // Single touch ended.
        that._isDoubleTouch = false;
      }, CLICK_DELAY_MILLIS);
    }

    if (
      this.handleEvent("touchend", {
        comp: comp,
        x: this._lastMouseX,
        y: this._lastMouseY,
        startTime: this._touchstartTime,
        multiple: this._monitoredTouches.length != 1,
      })
    ) {
      this._touchstartTime = null;
    }
  }

  touchmoveListener(event: TouchEvent, comp: Component) {
    if (!this._focused) {
      return;
    }
    event.preventDefault();
    // console.log("touchmove", event);

    for (let i = 0; i < event.changedTouches.length; ++i) {
      const touch = event.changedTouches[i];
      const touchRecord = this.getTouchByIdentifier(touch.identifier);

      const touchX = touch.pageX;
      const touchY = touch.pageY;
      this.handleEvent("touchmove", {
        comp: comp,
        multiple: this._monitoredTouches.length != 1,
        x: touchX,
        y: touchY,
        dx: touchX - touchRecord.x,
        dy: touchY - touchRecord.y,
      });
      touchRecord.x = touchX;
      touchRecord.y = touchY;
      this._lastMouseX = touchX;
      this._lastMouseY = touchY;
    }

    if (this.numActiveTouches() > 1) {
      const zoomCenter = midPoint(
        this._monitoredTouches[0].x,
        this._monitoredTouches[0].y,
        this._monitoredTouches[1].x,
        this._monitoredTouches[1].y
      );
      this.handleEvent("touchzoom", {
        comp: comp,
        x: zoomCenter[0],
        y: zoomCenter[1],
        dx: this._monitoredTouches[1].x - this._monitoredTouches[0].x,
        dy: this._monitoredTouches[1].y - this._monitoredTouches[0].y,
      });
    }
  }

  touchstartListener(event: TouchEvent, comp: Component) {
    event.preventDefault();
    this._focused = true;

    for (let i = 0; i < event.changedTouches.length; ++i) {
      const touch = event.changedTouches[i];
      const touchX = touch.pageX;
      const touchY = touch.pageY;
      const touchRec = new TouchRecord(
        touch.identifier,
        touchX,
        touchY,
        touchX,
        touchY
      );
      this._monitoredTouches.push(touchRec);
      this._lastMouseX = touchX;
      this._lastMouseY = touchY;

      this.handleEvent("touchstart", {
        comp: comp,
        multiple: this._monitoredTouches.length != 1,
        x: touchX,
        y: touchY,
        dx: 0,
        dy: 0,
      });

      touchRec.touchstart = Date.now();
      this._touchstartTime = Date.now();
    }

    if (this.numActiveTouches() > 1) {
      // Zoom.
      const zoomCenter = midPoint(
        this._monitoredTouches[0].x,
        this._monitoredTouches[0].y,
        this._monitoredTouches[1].x,
        this._monitoredTouches[1].y
      );
      this.handleEvent("touchzoom", {
        x: zoomCenter[0],
        y: zoomCenter[1],
        dx: this._monitoredTouches[1].x - this._monitoredTouches[0].x,
        dy: this._monitoredTouches[1].y - this._monitoredTouches[0].y,
      });
    }
  }

  mousemoveListener(event: MouseEvent) {
    this.handleEvent("mousemove", {
      x: event.offsetX,
      y: event.offsetY,
      dx: event.offsetX - this._lastMouseX,
      dy: event.offsetY - this._lastMouseY,
    });
    this._lastMouseX = event.offsetX;
    this._lastMouseY = event.offsetY;
  }

  mouseupListener() {
    this.handleEvent("mouseup", {
      x: this._lastMouseX,
      y: this._lastMouseY,
    });
  }

  keydownListener(event: KeyboardEvent) {
    if (event.altKey || event.metaKey) {
      // console.log("Key event had ignored modifiers");
      return;
    }
    if (event.ctrlKey && event.shiftKey) {
      return;
    }

    return this.handleEvent(
      "keydown",
      Keystroke.fromKeyboardEvent(event, this._lastMouseX, this._lastMouseY)
    );
  }

  keyupListener(event: KeyboardEvent) {
    return this.handleEvent(
      "keyup",
      Keystroke.fromKeyboardEvent(event, this._lastMouseX, this._lastMouseY)
    );
  }

  layout(): Rect {
    return this._window.layout(this._component);
  }

  handleEvent(eventType: string, inputData: any) {
    return this._listener(eventType, inputData);
  }

  getTouchByIdentifier(identifier: number): TouchRecord {
    for (let i = 0; i < this._monitoredTouches.length; ++i) {
      if (this._monitoredTouches[i].identifier == identifier) {
        return this._monitoredTouches[i];
      }
    }
    return null;
  }

  removeTouchByIdentifier(identifier: number) {
    let touch = null;
    for (let i = 0; i < this._monitoredTouches.length; ++i) {
      if (this._monitoredTouches[i].identifier == identifier) {
        touch = this._monitoredTouches.splice(i--, 1)[0];
        break;
      }
    }
    return touch;
  }
}
