import LayoutList, {COMPONENT_LAYOUT_HORIZONTAL} from './LayoutList';
import normalizeWheel from 'parsegraph-normalizewheel';
import Rect from 'parsegraph-rect';
import {elapsed} from 'parsegraph-timing';
import Component from './Component';
import {midPoint, make2DProjection} from 'parsegraph-matrix';
import Color from 'parsegraph-color';

import windowVertexShader from './Window_VertexShader.glsl';
import windowFragmentShader from './Window_FragmentShader.glsl';

import {compileProgram, BasicGLProvider} from 'parsegraph-compileprogram';

export const CLICK_DELAY_MILLIS:number = 500;

export const MAX_TEXTURE_SIZE = 2048;

// Background color.
export const BACKGROUND_COLOR = new Color(
    // 0, 47 / 255, 57 / 255, 1,
    // 256/255, 255/255, 255/255, 1
    0,0,0,1
    // 45/255, 84/255, 127/255, 1
);

export class TouchRecord {
  identifier:number;
  x:number;
  y:number;
  startX:number;
  startY:number;
  touchstart:number;

  constructor(id:number, x:number, y:number, startX:number, startY:number) {
    this.identifier = id;
    this.x = x;
    this.y = y;
    this.startX = startX;
    this.startY = startY;
    this.touchstart = null;
  }
}

let windowCount = 0;
export default class GraphicsWindow extends BasicGLProvider {
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
	_focused:boolean;
	_focusedComponent:Component;
	_isDoubleClick:boolean;
	_isDoubleTouch:boolean;
	_lastMouseX:number;
	_lastMouseY:number;

	_monitoredTouches:TouchRecord[];
  _touchstartTime:number;
  _touchendTimeout:any;
  _mouseupTimeout:number;
  _mousedownTime:number;

  _multisampleFramebuffer:WebGLFramebuffer;

  _needsUpdate:boolean;
  
  uWorld:WebGLUniformLocation;
  uTexture:WebGLUniformLocation;
  aPosition:number;
  aTexCoord:number;

  constructor(backgroundColor?:Color) {
    super("Window " + ++windowCount, backgroundColor || BACKGROUND_COLOR);
    this.container().className = 'parsegraph_Window';
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
    this.canvas().setAttribute('tabIndex', '0');

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

    // Whether the container is focused and not blurred.
    this._focused = false;
    this._focusedComponent = null;
    this._isDoubleClick = false;
    this._isDoubleTouch = false;

    this._lastMouseX = 0;
    this._lastMouseY = 0;

    this._monitoredTouches = [];
    this._touchstartTime = null;

    this._needsUpdate = true;

    this._isDoubleClick = false;
    this._mouseupTimeout = 0;

    this._componentContainers = new Map();

    this.canvas().addEventListener('touchstart', (event)=>{
      return this.touchstartListener(event);
    }, true);

    this.container().addEventListener('focus', ()=>{
      return this.focusListener();
    });

    this.container().addEventListener('blur', ()=>{
      return this.blurListener();
    });

    [
      ['DOMMouseScroll', this.onWheel],
      ['mousewheel', this.onWheel],
      ['touchmove', this.touchmoveListener],
      ['touchend', this.removeTouchListener],
      ['touchcancel', this.removeTouchListener],
      ['mousedown', this.mousedownListener],
      ['mousemove', this.mousemoveListener],
      ['mouseup', this.mouseupListener],
      ['mouseout', this.mouseupListener],
      ['keydown', this.keydownListener],
      ["keyup", this.keyupListener],
    ].forEach((pair)=>{
      this.canvas().addEventListener(pair[0] as string, (event)=>{
        return (pair[1] as Function).call(this, event);
      });
    });
  }

  _componentContainers:Map<Component, HTMLElement>;

  containerFor(comp:Component):HTMLElement {
    return this._componentContainers.get(comp);
  }

  setBackground(bg:Color) {
    super.setBackground(bg);
    this.scheduleUpdate();
  }

  getTextureSize():number {
    return Math.min(MAX_TEXTURE_SIZE, this.gl().getParameter(this.gl().MAX_TEXTURE_SIZE));
  }

  focusListener() {
    this._focused = true;
  }

  blurListener() {
    this._focused = false;
  }

  /**
   * Sets the mouse cursor bitmap by this canvas.
   * 
   * @param {string} cursorType CSS cursor style
   */
  setCursor(cursorType:string):void {
    this.canvas().style.cursor = cursorType;
  };

  mousedownListener(event:MouseEvent) {
    this._focused = true;

    console.log(event);
    this._lastMouseX = event.offsetX;
    this._lastMouseY = event.offsetY;

    // console.log("Setting mousedown time");
    this._mousedownTime = Date.now();

    if (
      this.handleEvent('mousedown', {
        x: this._lastMouseX,
        y: this._lastMouseY,
        button: event.button,
        startTime: this._mousedownTime,
      })
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.canvas().focus();
    }

    // This click is a second click following
    // a recent click; it's a double-click.
    if (this._mouseupTimeout) {
      window.clearTimeout(this._mouseupTimeout);
      this._mouseupTimeout = null;
      this._isDoubleClick = true;
    }
  }

  removeTouchListener(event:TouchEvent) {
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
      this._touchendTimeout = setTimeout(function() {
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
      this.handleEvent('touchend', {
        x: this._lastMouseX,
        y: this._lastMouseY,
        startTime: this._touchstartTime,
        multiple: this._monitoredTouches.length != 1,
      })
    ) {
      this._touchstartTime = null;
    }
  }

  touchmoveListener(event:TouchEvent) {
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
      this.handleEvent('touchmove', {
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
          this._monitoredTouches[1].y,
      );
      this.handleEvent('touchzoom', {
        x: zoomCenter[0],
        y: zoomCenter[1],
        dx: this._monitoredTouches[1].x - this._monitoredTouches[0].x,
        dy: this._monitoredTouches[1].y - this._monitoredTouches[0].y,
      });
    }
  }

  touchstartListener(event:TouchEvent) {
    event.preventDefault();
    this._focused = true;

    for (let i = 0; i < event.changedTouches.length; ++i) {
      const touch = event.changedTouches[i];
      const touchX = touch.pageX;
      const touchY = touch.pageY;
      const touchRec = new TouchRecord(
        touch.identifier,
        touchX, touchY,
        touchX, touchY
      );
      this._monitoredTouches.push(touchRec);
      this._lastMouseX = touchX;
      this._lastMouseY = touchY;

      this.handleEvent('touchstart', {
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
          this._monitoredTouches[1].y,
      );
      this.handleEvent('touchzoom', {
        x: zoomCenter[0],
        y: zoomCenter[1],
        dx: this._monitoredTouches[1].x - this._monitoredTouches[0].x,
        dy: this._monitoredTouches[1].y - this._monitoredTouches[0].y,
      });
    }
  }

  mousemoveListener(event:MouseEvent) {
    this.handleEvent('mousemove', {
      x: event.offsetX,
      y: event.offsetY,
      dx: event.offsetX - this._lastMouseX,
      dy: event.offsetY - this._lastMouseY,
    });
    this._lastMouseX = event.offsetX;
    this._lastMouseY = event.offsetY;
  }

  mouseupListener() {
    this.handleEvent('mouseup', {
      x: this._lastMouseX,
      y: this._lastMouseY,
    });
  }

  keydownListener(event:KeyboardEvent) {
    if (event.altKey || event.metaKey) {
    // console.log("Key event had ignored modifiers");
      return;
    }
    if (event.ctrlKey && event.shiftKey) {
      return;
    }

    this.handleEvent('keydown', {
      x: this._lastMouseX,
      y: this._lastMouseY,
      key: event.key,
      keyCode: event.keyCode,
      ctrlKey: event.ctrlKey
    });
  }

  keyupListener(event:KeyboardEvent) {
    return this.handleEvent('keyup', {
        x: this._lastMouseX,
        y: this._lastMouseY,
        key: event.key,
        keyCode: event.keyCode,
        ctrlKey: event.ctrlKey
      });
  }

  /**
   * The receiver of all canvas wheel events.
   * 
   * @param {WheelEvent} event current wheel event
   */
  onWheel(event:WheelEvent) {
    event.preventDefault();

    // console.log("Wheel event", wheel);
    const e = normalizeWheel(event);
    this.handleEvent('wheel', {
      x:event.offsetX,
      y:event.offsetY,
      ...e
    });
  }

  isOffscreen() {
    return false;
  };

  numActiveTouches() {
    let realMonitoredTouches = 0;
    this._monitoredTouches.forEach(function(touchRec) {
      if (touchRec.touchstart) {
        realMonitoredTouches++;
      }
    }, this);
    return realMonitoredTouches;
  };

  numComponents() {
    return this._layoutList.count();
  };

  focusedComponent() {
    return this._focused ? this._focusedComponent : null;
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

  setFocusedComponent(x:number, y:number):boolean {
    y = this.height() - y;
    // console.log("Focusing component at (" + x + ", " + y + ")");
    if (
      this.forEach(function(comp:Component, compSize:Rect) {
        if (!comp.hasEventHandler()) {
          return;
        }
        // console.log("Component size", compSize);
        if (x < compSize.x() || y < compSize.y()) {
          // console.log("Component is greater than X or Y (" +
          // compSize.x() + ", " + compSize.y() + ")");
          return;
        }
        if (
          x > compSize.x() + compSize.width() ||
          y > compSize.y() + compSize.height()
        ) {
          // console.log("Component is lesser than X or Y");
          return;
        }
        if (this._focusedComponent !== comp && this._focusedComponent) {
          this._focusedComponent.handleEvent('blur');
        }
        this._focusedComponent = comp;
        // console.log("Found focused component: " + comp);
        return true;
      }, this)
    ) {
      return;
    }
    // No component was focused.
    if (this._focusedComponent) {
      this._focusedComponent.handleEvent('blur');
    }
    this._focusedComponent = null;
  };

  handleEvent(eventType:string, inputData:any) {
    if (eventType === 'tick') {
      let needsUpdate = false;
      this.forEach(function(comp:Component) {
        needsUpdate = comp.handleEvent('tick', inputData) || needsUpdate;
      }, this);
      return needsUpdate;
    }
    if (
      eventType === 'touchstart' ||
      eventType === 'wheel' ||
      eventType === 'touchmove' ||
      eventType === 'mousedown'
    ) {
      this.setFocusedComponent(inputData.x, inputData.y);
      if (!this._focusedComponent) {
        // console.log("No focused component");
        return;
      }
      const compSize = this.layout(this._focusedComponent);
      inputData.x -= compSize.x();
      // Input data is topleft-origin.
      // Component position is bottomleft-origin.
      // Component input should be topleft-origin.
      console.log(
          'Raw Y: y=' +
          inputData.y +
          ', cs.h=' +
          compSize.height() +
          ', cs.y=' +
          compSize.y(),
      );
      inputData.y -= this.height() - (compSize.y() + compSize.height());
      console.log('Adjusted Y: ' + inputData.y + ', ' + compSize.y());
    }
    if (this._focusedComponent) {
      if (eventType === 'touchend' || eventType === 'mousemove') {
        const compSize = this.layout(this._focusedComponent);
        inputData.x -= compSize.x();
        inputData.y -= this.height() - (compSize.y() + compSize.height());
      }
      if (this._focusedComponent.handleEvent(eventType, inputData)) {
        this.scheduleUpdate();
        return true;
      }
    }
    return false;
  };

  getTouchByIdentifier(identifier:number):TouchRecord {
    for (let i = 0; i < this._monitoredTouches.length; ++i) {
      if (this._monitoredTouches[i].identifier == identifier) {
        return this._monitoredTouches[i];
      }
    }
    return null;
  };

  removeTouchByIdentifier(identifier:number) {
    let touch = null;
    for (let i = 0; i < this._monitoredTouches.length; ++i) {
      if (this._monitoredTouches[i].identifier == identifier) {
        touch = this._monitoredTouches.splice(i--, 1)[0];
        break;
      }
    }
    return touch;
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

  lastMouseCoords() {
    return [this._lastMouseX, this._lastMouseY];
  };

  lastMouseX() {
    return this._lastMouseX;
  };

  lastMouseY() {
    return this._lastMouseY;
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
    comp.setOwner(this);
    this.scheduleUpdate();
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

  createComponentContainer(comp:Component) {
    if (this.containerFor(comp)) {
      return;
    }
    const container = document.createElement('div');
    container.style.position = "absolute";
    container.style.pointerEvents = "none";
    this.container().appendChild(container);
    this._componentContainers.set(comp, container);
  }

  addVertical(comp:Component, other:Component) {
    comp.setOwner(this);
    this.scheduleUpdate();
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

  removeComponent(compToRemove:Component) {
    this.scheduleUpdate();
    if (compToRemove === this._focusedComponent) {
      if (this._focusedComponent) {
        this._focusedComponent.handleEvent('blur');
      }
      const prior = this._layoutList.getPrevious(compToRemove);
      const next = this._layoutList.getNext(compToRemove);
      this._focusedComponent = prior || next;
    }
    this._componentContainers.delete(compToRemove);
    return this._layoutList.remove(compToRemove);
  };

  tick(startTime:number) {
    let needsUpdate = false;
    this.forEach(function(comp:Component) {
      needsUpdate = comp.handleEvent('tick', startTime) || needsUpdate;
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

  renderWebgl2() {
    this._container.style.backgroundColor = this.backgroundColor().asRGB();

    const gl = (this.gl() as WebGL2RenderingContext);
    if (this.gl().isContextLost()) {
      return false;
    }
    // console.log("Rendering window");
    if (!this.canProject()) {
      throw new Error(
          'Refusing to render to an unprojectable window.' +
          ' Use canProject() to handle, and parent' +
          ' this window\'s container to fix.',
      );
    }

    // Lookup the size the browser is displaying the canvas.
    const displayWidth = this.container().clientWidth;
    const displayHeight = this.container().clientHeight;
    // Check if the canvas is not the same size.
    if (
      this.canvas().width != displayWidth ||
      this.canvas().height != displayHeight
    ) {
      // Make the canvas the same size
      this.canvas().width = displayWidth;
      this.canvas().height = displayHeight;
    }

    if (!this._framebuffer) {
      this._multisampleFramebuffer = gl.createFramebuffer();
      this._renderbuffer = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
      gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          gl.getParameter(gl.MAX_SAMPLES),
          gl.RGBA8,
          displayWidth,
          displayHeight,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._multisampleFramebuffer);
      gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.RENDERBUFFER,
          this._renderbuffer,
      );

      this._glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._glTexture);
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          displayWidth,
          displayHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          this._glTexture,
          0,
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, this._multisampleFramebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._multisampleFramebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
    }

    const bg = this.backgroundColor();
    gl.clearColor(bg.r(), bg.g(), bg.b(), bg.a());
    gl.enable(gl.SCISSOR_TEST);
    let needsUpdate = false;
    this.forEach(function(comp:Component, compSize:Rect) {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " +
      //   compSize.width() + "x" + compSize.height());
      gl.scissor(compSize.x(), compSize.y(), compSize.width(), compSize.height());
      gl.viewport(
          compSize.x(),
          compSize.y(),
          compSize.width(),
          compSize.height(),
      );
      needsUpdate =
        comp.render(compSize.width(), compSize.height(), true) || needsUpdate;
    }, this);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._multisampleFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.clearBufferfv(gl.COLOR, 0, [1.0, 1.0, 1.0, 1.0]);
    gl.blitFramebuffer(
        0,
        0,
        displayWidth,
        displayHeight,
        0,
        0,
        displayWidth,
        displayHeight,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
    );
    return needsUpdate;
  };

  renderMultisampleFramebuffer() {
    this._container.style.backgroundColor = this.backgroundColor().asRGB();
    const gl = this.gl();
    if (this.gl().isContextLost()) {
      return;
    }
    // console.log("Rendering window");
    if (!this.canProject()) {
      throw new Error(
          'Refusing to render to an unprojectable window.' +
          ' Use canProject() to handle, and parent' +
          ' this window\'s container to fix.',
      );
    }

    // Lookup the size the browser is displaying the canvas.
    const displayWidth = this.container().clientWidth;
    const displayHeight = this.container().clientHeight;
    // Check if the canvas is not the same size.
    if (
      this.canvas().width != displayWidth ||
      this.canvas().height != displayHeight
    ) {
      // Make the canvas the same size
      this.canvas().width = displayWidth;
      this.canvas().height = displayHeight;
    }

    const multisample = 8;
    const backbufferWidth = multisample * displayWidth;
    const backbufferHeight = multisample * displayHeight;

    if (!this._framebuffer) {
      this._glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._glTexture);
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          backbufferWidth,
          backbufferHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._framebuffer = gl.createFramebuffer();
      this._renderbuffer = gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
      gl.renderbufferStorage(
          gl.RENDERBUFFER,
          gl.DEPTH_COMPONENT16,
          backbufferWidth,
          backbufferHeight,
      );
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          this._glTexture,
          0,
      );
      gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          this._renderbuffer,
      );
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
    }

    gl.clearColor(
        this.backgroundColor().r(),
        this.backgroundColor().g(),
        this.backgroundColor().b(),
        this.backgroundColor().a(),
    );
    gl.enable(gl.SCISSOR_TEST);
    this.forEach(function(comp:Component, compSize:Rect) {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " +
      // compSize.width() + "x" + compSize.height());
      gl.scissor(
          multisample * compSize.x(),
          multisample * compSize.y(),
          multisample * compSize.width(),
          multisample * compSize.height(),
      );
      gl.viewport(
          multisample * compSize.x(),
          multisample * compSize.y(),
          multisample * compSize.width(),
          multisample * compSize.height(),
      );
      comp.render(compSize.width(), compSize.height(), true);
    }, this);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    if (!this._program) {
      this._program = compileProgram(
          this,
          'Window',
          windowVertexShader,
          windowFragmentShader,
      );
      this.uWorld = gl.getUniformLocation(this._program, 'u_world');
      this.uTexture = gl.getUniformLocation(this._program, 'u_texture');
      this.aPosition = gl.getAttribLocation(this._program, 'a_position');
      this.aTexCoord = gl.getAttribLocation(this._program, 'a_texCoord');
    }
    gl.useProgram(this._program);

    gl.activeTexture(gl.TEXTURE0);
    // console.log("Using texture " + frag.slot()._id);
    gl.enableVertexAttribArray(this.aPosition);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.bindTexture(gl.TEXTURE_2D, this._glTexture);
    gl.uniform1i(this.uTexture, 0);
    gl.uniformMatrix3fv(
        this.uWorld,
        false,
        make2DProjection(displayWidth, displayHeight),
    );

    gl.viewport(0, 0, displayWidth, displayHeight);
    if (!this._vertexBuffer) {
      this._vertexBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);

    const arr = new Float32Array(6 * 4);
    arr[0] = 0;
    arr[1] = 0;
    arr[2] = 0;
    arr[3] = (multisample * displayHeight) / backbufferHeight;
    // arr[2] = 0;
    // arr[3] = 0;

    arr[4] = displayWidth;
    arr[5] = 0;
    arr[6] = (multisample * displayWidth) / backbufferWidth;
    arr[7] = (multisample * displayHeight) / backbufferHeight;
    // arr[6] = 1;
    // arr[7] = 0;

    arr[8] = displayWidth;
    arr[9] = displayHeight;
    arr[10] = arr[6];
    arr[11] = 0;
    // arr[10] = 1;
    // arr[11] = 1;

    arr[12] = arr[0];
    arr[13] = arr[1];
    arr[14] = arr[2];
    arr[15] = arr[3];

    arr[16] = arr[8];
    arr[17] = arr[9];
    arr[18] = arr[10];
    arr[19] = arr[11];

    arr[20] = arr[0];
    arr[21] = arr[9];
    arr[22] = arr[2];
    arr[23] = arr[11];
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

    const FLOAT_SIZE = 4;
    const stride = 4 * FLOAT_SIZE;
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(
        this.aTexCoord,
        2,
        gl.FLOAT,
        false,
        stride,
        2 * FLOAT_SIZE,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  /**
   * Invokes all renderers.
   *
   * Throws if canProject() returns false.
   */
  renderFramebuffer() {
    const gl = this.gl();
    if (this.gl().isContextLost()) {
      return;
    }
    // console.log("Rendering window");
    if (!this.canProject()) {
      throw new Error(
          'Refusing to render to an unprojectable window.' +
          ' Use canProject() to handle, and parent this window\'s' +
          ' container to fix.',
      );
    }

    // Lookup the size the browser is displaying the canvas.
    const displayWidth = this.width();
    const displayHeight = this.height();
    // Check if the canvas is not the same size.
    if (
      this.canvas().width != displayWidth ||
      this.canvas().height != displayHeight
    ) {
      // Make the canvas the same size
      this.canvas().width = displayWidth;
      this.canvas().height = displayHeight;
    }

    const backbufferWidth = displayWidth;
    const backbufferHeight = displayHeight;

    if (!this._framebuffer) {
      this._glTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._glTexture);
      gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          backbufferWidth,
          backbufferHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._framebuffer = gl.createFramebuffer();
      this._renderbuffer = gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
      gl.renderbufferStorage(
          gl.RENDERBUFFER,
          gl.DEPTH_COMPONENT16,
          backbufferWidth,
          backbufferHeight,
      );
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          this._glTexture,
          0,
      );
      gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.RENDERBUFFER,
          this._renderbuffer,
      );
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._framebuffer);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this._renderbuffer);
    }

    gl.clearColor(
        this.backgroundColor().r(),
        this.backgroundColor().g(),
        this.backgroundColor().b(),
        this.backgroundColor().a(),
    );
    gl.enable(gl.SCISSOR_TEST);
    this.forEach(function(comp:Component, compSize:Rect) {
      // console.log("Rendering: " + comp.peer().id());
      // console.log("Rendering component of size " + compSize.width() +
      //   "x" + compSize.height());
      gl.scissor(compSize.x(), compSize.y(), compSize.width(), compSize.height());
      gl.viewport(
          compSize.x(),
          compSize.y(),
          compSize.width(),
          compSize.height(),
      );
      comp.render(compSize.width(), compSize.height(), true);
    }, this);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    if (!this._program) {
      this._program = compileProgram(
          this,
          'Window',
          windowVertexShader,
          windowFragmentShader,
      );
      this.uWorld = gl.getUniformLocation(this._program, 'u_world');
      this.uTexture = gl.getUniformLocation(this._program, 'u_texture');
      this.aPosition = gl.getAttribLocation(this._program, 'a_position');
      this.aTexCoord = gl.getAttribLocation(this._program, 'a_texCoord');
    }
    gl.useProgram(this._program);

    gl.activeTexture(gl.TEXTURE0);
    // console.log("Using texture " + frag.slot()._id);
    gl.enableVertexAttribArray(this.aPosition);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.bindTexture(gl.TEXTURE_2D, this._glTexture);
    gl.uniform1i(this.uTexture, 0);
    gl.uniformMatrix3fv(
        this.uWorld,
        false,
        make2DProjection(displayWidth, displayHeight),
    );

    gl.viewport(0, 0, displayWidth, displayHeight);
    if (!this._vertexBuffer) {
      this._vertexBuffer = gl.createBuffer();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);

    const arr = new Float32Array(6 * 4);
    arr[0] = 0;
    arr[1] = 0;
    arr[2] = 0;
    arr[3] = displayHeight / backbufferHeight;
    // arr[2] = 0;
    // arr[3] = 0;

    arr[4] = displayWidth;
    arr[5] = 0;
    arr[6] = displayWidth / backbufferWidth;
    arr[7] = displayHeight / backbufferHeight;
    // arr[6] = 1;
    // arr[7] = 0;

    arr[8] = displayWidth;
    arr[9] = displayHeight;
    arr[10] = arr[6];
    arr[11] = 0;
    // arr[10] = 1;
    // arr[11] = 1;

    arr[12] = arr[0];
    arr[13] = arr[1];
    arr[14] = arr[2];
    arr[15] = arr[3];

    arr[16] = arr[8];
    arr[17] = arr[9];
    arr[18] = arr[10];
    arr[19] = arr[11];

    arr[20] = arr[0];
    arr[21] = arr[9];
    arr[22] = arr[2];
    arr[23] = arr[11];
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);

    const FLOAT_SIZE = 4;
    const stride = 4 * FLOAT_SIZE;
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(
        this.aTexCoord,
        2,
        gl.FLOAT,
        false,
        stride,
        2 * FLOAT_SIZE,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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

  renderBasic() {
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
      const container = this.containerFor(comp);
      container.style.left = compSize.x() + "px";
      container.style.top = (height - compSize.y()) + "px";
      container.style.width = compSize.width() + "px";
      container.style.height = (height - compSize.y() - compSize.height()) + "px";
      needsUpdate =
        comp.render(compSize.width(), compSize.height()) || needsUpdate;
      this._overlayCtx.restore();
    }, this);
    gl.disable(gl.SCISSOR_TEST);

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
    return this.renderBasic();
  };

}
