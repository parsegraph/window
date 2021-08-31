import Color from 'parsegraph-color';
import {setVFlip} from 'parsegraph-matrix';
import { elapsed } from 'parsegraph-timing';
import Rect from 'parsegraph-rect';
import Component from './Component';
import LayoutList, {COMPONENT_LAYOUT_HORIZONTAL} from './LayoutList';
import GraphicsWindow, {BACKGROUND_COLOR, MAX_TEXTURE_SIZE} from './GraphicsWindow';

export default class ImageWindow extends GraphicsWindow {
  _backgroundColor:Color;
  _schedulerFunc:Function;
  _schedulerFuncThisArg:any;
  _canvas:HTMLCanvasElement;
  _gl:WebGLRenderingContext;
  _shaders:{[id:string]:WebGLProgram};
  _layoutList:LayoutList;
  _textureSize:number;
  _needsUpdate:boolean;
  _imageCanvas:HTMLCanvasElement;
  _imageContext:CanvasRenderingContext2D;
  _explicitWidth:number;
  _explicitHeight:number;
  _focusedComponent:Component;
  _image:HTMLImageElement;
  _fb:WebGLFramebuffer;
  _targetTexture:WebGLTexture;

  constructor(width:number, height:number) {
    super();
    if (!width || !height) {
      throw new Error(
          'ImageWindow must receive a width and height during construction',
      );
    }
    this._backgroundColor = BACKGROUND_COLOR;

    this._schedulerFunc = null;
    this._schedulerFuncThisArg = null;

    // The canvas that will be drawn to.
    this._canvas = document.createElement('canvas');
    const that = this;
    this._canvas.addEventListener(
        'webglcontextlost',
        function(event) {
          console.log('Context lost');
          event.preventDefault();
          that.onContextChanged(true);
        },
        false,
    );
    this._canvas.addEventListener(
        'webglcontextrestored',
        function() {
          console.log('Context restored');
          that.onContextChanged(false);
        },
        false,
    );
    this._canvas.addEventListener(
        'contextmenu',
        function(e) {
          e.preventDefault();
        },
        false,
    );
    this._canvas.style.display = 'block';
    this._canvas.setAttribute('tabIndex', '0');

    // GL content, not created until used.
    this._gl = null;
    this._shaders = {};

    this._layoutList = new LayoutList(
        COMPONENT_LAYOUT_HORIZONTAL,
    );

    this._textureSize = NaN;

    this._needsUpdate = true;

    this.setExplicitSize(width, height);
    this.newImage();
    this._imageCanvas = document.createElement('canvas');
    this._imageCanvas.width = this.width();
    this._imageCanvas.height = this.height();
    this._imageContext = this._imageCanvas.getContext('2d');
  }

  log() {

  };

  clearLog() {

  };

  isOffscreen() {
    return true;
  };

  numComponents() {
    return this._layoutList.count();
  };

  layout(target:Component) {
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

  getSize(sizeOut:Rect) {
    sizeOut.setX(0);
    sizeOut.setY(0);
    sizeOut.setWidth(this.width());
    sizeOut.setHeight(this.height());
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

  id() {
    return this._id;
  };

  shaders() {
    return this._shaders;
  };

  textureSize() {
    if (this._gl.isContextLost()) {
      return NaN;
    }
    if (Number.isNaN(this._textureSize)) {
      this._textureSize = Math.min(MAX_TEXTURE_SIZE, this.gl().getParameter(this.gl().MAX_TEXTURE_SIZE));
    }
    return this._textureSize;
  };

  onContextChanged(isLost:boolean) {
    if (isLost) {
      const keys = [];
      for (const k in this._shaders) {
        if (Object.prototype.hasOwnProperty.call(this._shaders, k)) {
          keys.push(k);
        }
      }
      for (const i in keys) {
        if (Object.prototype.hasOwnProperty.call(keys, i)) {
          delete this._shaders[keys[i]];
        }
      }
    }
    this.forEach(function(comp:Component) {
      if (comp.contextChanged) {
        comp.contextChanged(isLost);
      }
    }, this);
  };

  canvas() {
    return this._canvas;
  };

  gl() {
    if (this._gl) {
      return this._gl;
    }
    this._gl = this._canvas.getContext('webgl', {preserveDrawingBuffer: true});
    if (this._gl) {
      return this._gl;
    }
    throw new Error('GL context is not supported');
  };

  setGL(gl:WebGLRenderingContext) {
    this._gl = gl;
  };

  setExplicitSize(w:number, h:number) {
    this._explicitWidth = w;
    this._explicitHeight = h;
  };

  upscale() {
    return 2;
  };

  getWidth() {
    return this._explicitWidth * this.upscale();
  };

  width() {
    return this.getWidth();
  }

  getHeight() {
    return this._explicitHeight * this.upscale();
  };
  height() {
    return this.getHeight();
  }

  paint(timeout?:number) {
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

  setBackground(color:number|Color, ...args:number[]):void {
    if (args.length > 0) {
      return this.setBackground(new Color(color as number, ...args));
    }
    this._backgroundColor = color as Color;
  };

  backgroundColor() {
    return this._backgroundColor;
  };

  /**
   * Returns whether the window has a nonzero client width and height.
   *
   * @return {boolean} true if the window has a valid size for a projection matrix.
   */
  canProject():boolean {
    const displayWidth = this.getWidth();
    const displayHeight = this.getHeight();

    return displayWidth != 0 && displayHeight != 0;
  };

  renderBasic() {
    const gl = this.gl();
    if (this.gl().isContextLost()) {
      return false;
    }
    // console.log("Rendering window");
    if (!this.canProject()) {
      throw new Error(
          'Refusing to render to an unprojectable window.' +
          ' Use canProject() to handle, and parent this' +
          ' window\'s container to fix.',
      );
    }

    // const compSize = new Rect();
    let needsUpdate = false;
    gl.clearColor(
        this._backgroundColor.r(),
        this._backgroundColor.g(),
        this._backgroundColor.b(),
        this._backgroundColor.a(),
    );
    gl.enable(gl.SCISSOR_TEST);
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
        comp.render(compSize.width(), compSize.height()) || needsUpdate;
    }, this);
    gl.disable(gl.SCISSOR_TEST);

    return needsUpdate;
  };

  loadImageFromTexture(
      gl:WebGLRenderingContext,
      texture:WebGLTexture,
      width:number,
      height:number,
  ) {
    // Create a framebuffer backed by the texture
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
    );

    // Read the contents of the framebuffer
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    gl.deleteFramebuffer(framebuffer);

    // Create a 2D canvas to store the result
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Copy the pixels to a 2D canvas
    const imageData = context.createImageData(width, height);
    imageData.data.set(data);
    context.putImageData(imageData, 0, 0);

    this._image.src = canvas.toDataURL();
  };

  image() {
    return this._image;
  };

  newImage() {
    this._image = new Image();
    this._image.style.width = Math.floor(this._explicitWidth) + 'px';
    this._image.style.height = Math.floor(this._explicitHeight) + 'px';
  };

  render() {
    const needsUpdate = this.renderBasic();
    const gl = this.gl();
    const targetTextureWidth = this.width();
    const targetTextureHeight = this.height();

    if (!this._fb) {
      const fb = gl.createFramebuffer();
      this._fb = fb;

      this._targetTexture = gl.createTexture();
      const targetTexture = this._targetTexture;

      gl.bindTexture(gl.TEXTURE_2D, targetTexture);
      {
        // define size and format of level 0
        const level = 0;
        const internalFormat = gl.RGBA;
        const border = 0;
        const format = gl.RGBA;
        const type = gl.UNSIGNED_BYTE;
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            targetTextureWidth,
            targetTextureHeight,
            border,
            format,
            type,
            null,
        );

        // set the filtering so we don't need mips
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      // attach the texture as the first color attachment
      const attachmentPoint = gl.COLOR_ATTACHMENT0;
      gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          attachmentPoint,
          gl.TEXTURE_2D,
          targetTexture,
          0,
      );
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._fb);
    }

    setVFlip(true);
    try {
      this.renderBasic();
    }
    finally {
      setVFlip(false);
    }

    this.loadImageFromTexture(
        gl,
        this._targetTexture,
        targetTextureWidth,
        targetTextureHeight,
    );

    return needsUpdate;
  }
}
