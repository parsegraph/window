import Component from './Component';
import GraphicsWindow from './GraphicsWindow';

export default class ProxyComponent extends Component {
  _painterFunc:Function;
  _painterFuncThisArg:object;
  _rendererFunc:Function;
  _rendererFuncThisArg:object;
  _contextChangedFunc:Function;
  _contextChangedFuncThisArg:object;
  _serializerFunc:Function;
  _serializerFuncThisArg:object;
  _peer:any;
  _unmount:()=>{};
  _mountFunc:Function;
  _mountFuncThisArg:object;
  _tickFunc:Function;
  _tickFuncThisArg:object;

  constructor(peer:any, peerType:string) {
    super(peerType);
    this._peer = peer;
    this._painterFunc = null;
    this._painterFuncThisArg = null;
    this._rendererFunc = null;
    this._rendererFuncThisArg = null;
    this._contextChangedFunc = null;
    this._contextChangedFuncThisArg = null;
    this._serializerFunc = null;
    this._serializerFuncThisArg = null;
    this._unmount = null;
    this._mountFunc = null;
    this._mountFuncThisArg = null;
    this._tickFunc = null;
    this._tickFuncThisArg = null;
  }
  
  peer():any {
    return this._peer;
  }

  toString() {
    return '[ProxyComponent ' + this.id() + ']';
  };

  paint(timeout?:number) {
    if (!this._painterFunc) {
      return false;
    }
    if (this._painterFunc.call(this._painterFuncThisArg, timeout)) {
      this.scheduleUpdate();
      return true;
    }
    return false;
  };

  render(
      width:number,
      height:number,
      avoidIfPossible?:boolean,
  ) {
    if (!this._rendererFunc) {
      return false;
    }
    if (
      this._rendererFunc.call(
          this._rendererFuncThisArg,
          width,
          height,
          avoidIfPossible,
      )
    ) {
      this.scheduleUpdate();
      return true;
    }
    return false;
  };

  contextChanged(isLost:boolean) {
    if (!this._contextChangedFunc) {
      return;
    }
    return this._contextChangedFunc.call(this._contextChangedFuncThisArg, isLost);
  };

  setMount(mountFunc:Function, mountFuncThisArg?:object) {
    this._mountFunc = mountFunc;
    this._mountFuncThisArg = mountFuncThisArg;
  }

  mount(window:GraphicsWindow):void {
    if (this._mountFunc) {
      this._unmount = this._mountFunc.call(this._mountFuncThisArg, window);
    }
  }

  unmount():void {
    if (this._unmount) {
      this._unmount.call(this._mountFuncThisArg);
      this._unmount = null;
    }
  }

  setTick(tickFunc:Function, tickFuncThisArg?:object) {
    this._tickFunc = tickFunc;
    this._tickFuncThisArg = tickFuncThisArg;
  }

  tick(elapsed:number):boolean {
    if (this._tickFunc) {
      return this._tickFunc.call(this._tickFuncThisArg, elapsed);
    }
    return false;
  }

  setPainter(
      painterFunc:Function,
      painterFuncThisArg?:object,
  ) {
    this._painterFunc = painterFunc;
    this._painterFuncThisArg = painterFuncThisArg;
  };

  setRenderer(
      rendererFunc:Function,
      rendererFuncThisArg?:object,
  ) {
    this._rendererFunc = rendererFunc;
    this._rendererFuncThisArg = rendererFuncThisArg;
  };

  setContextChanged(
      contextChanged:Function,
      contextChangedThisArg?:object,
  ) {
    this._contextChangedFunc = contextChanged;
    this._contextChangedFuncThisArg = contextChangedThisArg;
  };

  setSerializer(
      serializerFunc:Function,
      serializerFuncThisArg?:object,
  ) {
    this._serializerFunc = serializerFunc;
    this._serializerFuncThisArg = serializerFuncThisArg;
  };
}
