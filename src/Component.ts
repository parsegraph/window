import Window from './window';

let componentCount = 0;
export default abstract class Component {
  _id:number;
  _peerType:string;
  _window:Window;
  _needsUpdate:boolean;
  constructor(peerType:string) {
    this._id = ++componentCount;
    this._peerType = peerType;
    this._needsUpdate = false;
  }
  toString() {
    return '[Component ' + this.id() + ']';
  };
  id():number {
    return this._id;
  }
  type() {
    return this._peerType;
  };

  peer() {
    return this;
  };
  abstract paint(timeout?:number):boolean;
  abstract render(
      width:number,
      height:number,
      avoidIfPossible?:boolean,
  ):boolean;
  abstract contextChanged(isLost:boolean):void;
  hasEventHandler():boolean {
    return false;
  }
  handleEvent(...args:any[]):boolean {
    throw new Error("This component does not handle events");
  }

  needsUpdate() {
    return this._needsUpdate;
  };

  setOwner(window:Window) {
    if (this._window === window) {
      return;
    }
    if (this._window) {
      this._window.scheduleUpdate();
    }
    this._window = window;
    this._needsUpdate = true;
    if (this._window) {
      this._window.scheduleUpdate();
    }
  };

  scheduleUpdate() {
    // console.log("Component is scheduling update", this._window);
    if (this._window) {
      this._window.scheduleUpdate();
    }
  };
}