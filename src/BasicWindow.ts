import { BasicGLProvider } from "parsegraph-compileprogram";
import Rect from "parsegraph-rect";
import Component from "./Component";

export default abstract class BasicWindow extends BasicGLProvider {
  abstract containerFor(comp:Component):Element;
  abstract numComponents():number;
  abstract isOffscreen():boolean;
  abstract layout(target:Component):Rect;
  abstract forEach(func:Function, funcThisArg?:any):void;
  abstract scheduleUpdate():void;

  abstract textureSize():number;
  abstract overlay():CanvasRenderingContext2D;
  abstract overlayCanvas():HTMLCanvasElement;
  abstract addComponent(comp:Component):void;
  abstract removeComponent(compToRemove:Component):void;
  abstract tick(startTime:number):boolean;
  abstract paint(timeout:number):boolean;
  abstract log(msg:any):void;
  abstract clearLog():void;
  abstract finalizeLog():void;
}
