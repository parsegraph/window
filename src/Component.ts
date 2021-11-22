import BasicWindow from "./BasicWindow";

let componentCount = 0;
export default abstract class Component {
  _id: number;
  _peerType: string;
  _window: BasicWindow;
  _needsUpdate: boolean;
  constructor(peerType: string) {
    this._id = ++componentCount;
    this._peerType = peerType;
    this._needsUpdate = false;
  }
  toString() {
    return "[Component " + this.id() + "]";
  }
  id(): number {
    return this._id;
  }
  type() {
    return this._peerType;
  }

  peer() {
    return this;
  }
  /**
   * Runs logic between frames.
   * @param elapsed the number of milliseconds since the last tick
   * @return {Boolean} true if the scene needs to be updated.
   */
  abstract tick(elapsed: number): boolean;

  /**
   * Paints the scene's assets.
   * @param timeout
   */
  abstract paint(timeout?: number): boolean;

  /**
   * Renders the scene's assets.
   * @param width
   * @param height
   * @param avoidIfPossible
   */
  abstract render(
    width: number,
    height: number,
    avoidIfPossible?: boolean
  ): boolean;
  abstract contextChanged(isLost: boolean): void;

  /**
   * Mount this component to the given Window, adding event listeners
   * and DOM assets.
   * @param window the window on which to mount this component
   */
  abstract mount(window: BasicWindow): void;

  /**
   * Dismount the given window, removing component-specific event
   * listeners and DOM assets.
   * @param window the window to unmount this component.
   */
  abstract unmount(window: BasicWindow): void;

  setOwner(window: BasicWindow) {
    if (this._window === window) {
      return;
    }
    if (this._window) {
      this._window.scheduleUpdate();
      this.unmount(this._window);
    }
    this._window = window;
    this._needsUpdate = true;
    if (this._window) {
      this._window.scheduleUpdate();
      this.mount(this._window);
    }
  }

  needsUpdate() {
    return this._needsUpdate;
  }

  scheduleUpdate() {
    // console.log("Component is scheduling update", this._window);
    if (this._window) {
      this._window.scheduleUpdate();
    }
  }
}
