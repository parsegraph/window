import { BasicGLProvider } from "parsegraph-compileprogram";
import Rect from "parsegraph-rect";
import Component from "./Component";

export default abstract class BasicWindow extends BasicGLProvider {
  abstract containerFor(comp:Component):Element;
  abstract numComponents();
  abstract isOffscreen();
  abstract layout(target:Component):Rect;
  abstract forEach(func:Function, funcThisArg?:any);
  abstract scheduleUpdate();

  abstract textureSize():number;
  abstract overlay();
  abstract overlayCanvas();
  abstract addComponent(comp:Component);
  abstract removeComponent(compToRemove:Component);
  abstract tick(startTime:number):boolean;
  abstract paint(timeout:number):boolean;
  abstract log(msg:any);
  abstract clearLog():void;
  abstract finalizeLog();
}