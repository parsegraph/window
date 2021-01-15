import Component from './Component';

export default class ProxyComponent extends Component {
  _painterFunc:Function;
  _painterFuncThisArg:object;
  _rendererFunc:Function;
  _rendererFuncThisArg:object;
  _contextChangedFunc:Function;
  _contextChangedFuncThisArg:object;
  _eventHandler:Function;
  _eventHandlerThisArg:object;
  _serializerFunc:Function;
  _serializerFuncThisArg:object;
  _peer:any;

  constructor(peer:any, peerType:string) {
    super(peerType);
    this._peer = peer;
    this._painterFunc = null;
    this._painterFuncThisArg = null;
    this._rendererFunc = null;
    this._rendererFuncThisArg = null;
    this._contextChangedFunc = null;
    this._contextChangedFuncThisArg = null;
    this._eventHandler = null;
    this._eventHandlerThisArg = null;
    this._serializerFunc = null;
    this._serializerFuncThisArg = null;
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

  hasEventHandler() {
    return !!this._eventHandler;
  };

  handleEvent(...args:any[]) {
    if (!this._eventHandler) {
      return false;
    }
    return this._eventHandler.apply(this._eventHandlerThisArg, args);
  };

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

  setEventHandler(
      eventHandler:Function,
      eventHandlerThisArg?:object,
  ) {
    this._eventHandler = eventHandler;
    this._eventHandlerThisArg = eventHandlerThisArg;
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
