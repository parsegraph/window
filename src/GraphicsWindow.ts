import LayoutList, {COMPONENT_LAYOUT_HORIZONTAL} from './LayoutList';
import Rect from 'parsegraph-rect';
import {elapsed} from 'parsegraph-timing';
import Component from './Component';
import Color from 'parsegraph-color';

import BaseWindow from './BasicWindow';

export const MAX_TEXTURE_SIZE = 2048;

// Background color.
export const BACKGROUND_COLOR = new Color(
    // 0, 47 / 255, 57 / 255, 1,
    // 256/255, 255/255, 255/255, 1
    0,0,0,1
    // 45/255, 84/255, 127/255, 1
);

let windowCount = 0;
export default class GraphicsWindow extends BaseWindow {
  _audio:AudioContext;
	_framebuffer:any;
	_renderbuffer:any;
  _glTexture:any;
  _vertexBuffer:WebGLBuffer;
	_program:any;
	_debugLog:string;
	_schedulerFunc:Function;
	_schedulerFuncThisArg:object;
	_overlayCanvas:HTMLCanvasElement;
	_debugPanel:HTMLElement;
	_overlayCtx:CanvasRenderingContext2D;
	_layoutList:LayoutList;
	_textureSize:number;

  _multisampleFramebuffer:WebGLFramebuffer;

  _needsUpdate:boolean;
  
  uWorld:WebGLUniformLocation;
  uTexture:WebGLUniformLocation;
  aPosition:number;
  aTexCoord:number;

  constructor(backgroundColor?:Color) {
    super("Window " + ++windowCount, backgroundColor || BACKGROUND_COLOR);
    this.container().className = 'parsegraph_Window';
    this.container().style.display = "block";
    this.container().style.position = "relative";
    this.container().style.overflow = "hidden";

    this._framebuffer = null;
    this._renderbuffer = null;
    this._glTexture = null;
    this._program = null;
    this._debugLog = '';

    this._schedulerFunc = null;
    this._schedulerFuncThisArg = null;

    this.canvas().style.display = 'block';

    this._overlayCanvas = document.createElement('canvas');
    this._overlayCanvas.style.position = 'absolute';
    this._overlayCanvas.style.top = '0';
    this._overlayCanvas.style.left = '0';
    this._overlayCanvas.style.pointerEvents = 'none';
    this._overlayCtx = this._overlayCanvas.getContext('2d');
    this._container.appendChild(this._overlayCanvas);

    this._debugPanel = document.createElement('span');
    this._debugPanel.className = 'debug';
    this._debugPanel.innerHTML = 'DEBUG';
    // this._container.appendChild(this._debugPanel);

    this._layoutList = new LayoutList(
        COMPONENT_LAYOUT_HORIZONTAL,
    );

    this._textureSize = NaN;
    this._needsUpdate = true;
    this._componentContainers = new Map();
  }

  _componentContainers:Map<Component, Element>;

  containerFor(comp:Component):Element {
    return this._componentContainers.get(comp)?.firstElementChild;
  }

  setBackground(bg:Color) {
    super.setBackground(bg);
    this.scheduleUpdate();
  }

  getTextureSize():number {
    return Math.min(MAX_TEXTURE_SIZE, this.gl().getParameter(this.gl().MAX_TEXTURE_SIZE));
  }

  /**
   * Sets the mouse cursor bitmap by this canvas.
   * 
   * @param {string} cursorType CSS cursor style
   */
  setCursor(cursorType:string):void {
    this.canvas().style.cursor = cursorType;
  };

  isOffscreen() {
    return false;
  };

  numComponents() {
    return this._layoutList.count();
  };

  layout(target:Component):Rect {
    let targetSize = null;
    this.forEach(function(comp:Component, compSize:Rect) {
      if (target === comp) {
        targetSize = compSize;
        return true;
      }
    }, this);
    if (!targetSize) {
      throw new Error('Layout target must be a child component of this window');
    }
    return targetSize;
  };

  forEach(func:Function, funcThisArg?:any) {
    const windowSize = new Rect();
    this.getSize(windowSize);
    return this._layoutList.forEach(func, funcThisArg, windowSize);
  };

  scheduleUpdate() {
    // console.log("Window is scheduling update");
    if (this._schedulerFunc) {
      this._schedulerFunc.call(this._schedulerFuncThisArg, this);
    }
  };

  setOnScheduleUpdate(
      schedulerFunc:Function,
      schedulerFuncThisArg?:any,
  ) {
    this._schedulerFunc = schedulerFunc;
    this._schedulerFuncThisArg = schedulerFuncThisArg;
  };

  textureSize() {
    if (this._gl.isContextLost()) {
      return NaN;
    }
    if (Number.isNaN(this._textureSize)) {
      this._textureSize = Math.min(512, this.getTextureSize());
    }
    return this._textureSize;
  };

  onContextChanged(isLost:boolean):void {
    super.onContextChanged(isLost);
    this.forEach(function(comp:Component) {
      if (comp.contextChanged) {
        comp.contextChanged(isLost);
      }
    }, this);
  };

  overlay() {
    return this._overlayCtx;
  };

  overlayCanvas() {
    return this._overlayCanvas;
  };

  setAudio(audio:AudioContext) {
    this._audio = audio;
  };

  startAudio() {
    if (!this._audio) {
      try {
        this._audio = new AudioContext();
      } catch (ex) {
        console.log(ex);
      }
      if (this._audio == null) {
        throw new Error('AudioContext is not supported');
      }
    }
    return this.audio();
  };

  audio():AudioContext {
    return this._audio;
  };

  addWidget(widget:any) {
    return this.addComponent(widget.component());
  };

  addComponent(comp:Component) {
    return this.addHorizontal(comp, null);
  };

  addHorizontal(comp:Component, other:Component) {
    this.createComponentContainer(comp);
    if (!other) {
      this._layoutList.addHorizontal(comp);
      return;
    }
    const container = this._layoutList.contains(other);
    if (!container) {
      throw new Error('Window must contain the given reference component');
    }
    container.addHorizontal(comp);
  };

  addVertical(comp:Component, other:Component) {
    this.createComponentContainer(comp);
    if (!other) {
      this._layoutList.addVertical(comp);
      return;
    }
    const container = this._layoutList.contains(other);
    if (!container) {
      throw new Error('Window must contain the given reference component');
    }
    container.addVertical(comp);
  };

  createComponentContainer(comp:Component) {
    if (this.containerFor(comp)) {
      return;
    }
    const container = document.createElement('div');
    container.style.position = "absolute";
    this.container().appendChild(container);

    const childContainer = document.createElement('div');
    childContainer.style.position = "relative";
    childContainer.style.overflow = "hidden";
    container.appendChild(childContainer);

    this._componentContainers.set(comp, container);

    comp.setOwner(this);
    this.scheduleUpdate();
  }

  removeComponentContainer(comp:Component) {
    comp.setOwner(null);

    const container = this.containerFor(comp)?.parentElement;
    if (container) {
      container.parentNode.removeChild(container);
      this._componentContainers.delete(comp);
    }
  }

  removeComponent(compToRemove:Component) {
    this.scheduleUpdate();
    this.removeComponentContainer(compToRemove);
    return this._layoutList.remove(compToRemove);
  };

  tick(startTime:number) {
    let needsUpdate = false;
    this.forEach(function(comp:Component) {
      needsUpdate = comp.tick(startTime) || needsUpdate;
    }, this);
    return needsUpdate;
  };

  paint(timeout:number) {
    if (this.gl().isContextLost()) {
      return;
    }
    // console.log("Painting window");
    this._shaders.gl = this.gl();
    this._shaders.timeout = timeout;

    let needsUpdate = false;
    const startTime = new Date();
    const compCount = this.numComponents();
    while (timeout > 0) {
      this.forEach(function(comp:Component) {
        needsUpdate = comp.paint(timeout / compCount) || needsUpdate;
      }, this);
      timeout = Math.max(0, timeout - elapsed(startTime));
    }
    return needsUpdate;
  };

  render() {
    this._overlayCanvas.width = this.width();
    this._overlayCanvas.height = this.height();
    this._overlayCtx.clearRect(
        0,
        0,
        this._overlayCanvas.width,
        this._overlayCanvas.height,
    );

    const gl = this.gl();
    if (this.gl().isContextLost()) {
      return false;
    }
    // console.log("Rendering window");
    super.render();
    let needsUpdate = false;
    gl.enable(gl.SCISSOR_TEST);
    this.forEach(function(comp:Component, compSize:Rect) {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " +
      // compSize.width() + "x" + compSize.height());
      gl.scissor(compSize.x(), compSize.y(), compSize.width(), compSize.height());
      gl.viewport(
          compSize.x(),
          compSize.y(),
          compSize.width(),
          compSize.height(),
      );
      this._overlayCtx.resetTransform();
      this._overlayCtx.save();
      const height = this._overlayCanvas.height;
      this._overlayCtx.beginPath();
      this._overlayCtx.moveTo(compSize.x(), height - compSize.y());
      this._overlayCtx.lineTo(compSize.x()+compSize.width(), height - compSize.y());
      this._overlayCtx.lineTo(compSize.x()+compSize.width(), height - (compSize.y()+compSize.height()));
      this._overlayCtx.lineTo(compSize.x(), height - (compSize.y()+compSize.height()));
      this._overlayCtx.clip();
      this._overlayCtx.translate(compSize.x(), height - compSize.y() - compSize.height());
      const container = this.containerFor(comp).parentElement;
      container.style.left = compSize.x() + "px";
      container.style.top = (height - compSize.y() - compSize.height()) + "px";
      const childContainer = this.containerFor(comp);
      childContainer.style.width = compSize.width() + "px";
      childContainer.style.height = compSize.height() + "px";
      needsUpdate =
        comp.render(compSize.width(), compSize.height()) || needsUpdate;
      this._overlayCtx.restore();
    }, this);
    gl.disable(gl.SCISSOR_TEST);

    return needsUpdate;
  };

  log(msg:any) {
    this._debugLog += msg + '<br/>';
  };

  clearLog() {
    this._debugLog = '';
    this.finalizeLog();
  };

  finalizeLog() {
    this._debugPanel.innerHTML = this._debugLog;
  };
}