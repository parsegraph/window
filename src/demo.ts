import Color from "parsegraph-color";
import BasicWindow from "./BaseWindow";
import GraphicsWindow from "./GraphicsWindow";
import ProxyComponent from "./ProxyComponent";
import TimingBelt from "./TimingBelt";
import WindowInput from "./WindowInput";

document.addEventListener("DOMContentLoaded", ()=>{
  const belt = new TimingBelt();
  const window = new GraphicsWindow();
  document.body.appendChild(window.container());
  document.body.appendChild((()=>{
    const e = document.createElement('span');
    e.innerHTML = "content with element";
    return e;
  })());
  belt.addWindow(window);
  const size = 500;
  window.setExplicitSize(size, size);
  window.setBackground(new Color(Math.random(), Math.random(), Math.random(), 1));

  const clickX = 250;
  const clickY = 50;
  const clickSize = 10;
  ["#000", "#f00", "#ff0", "#0f0"].forEach((color)=>{
      const comp = new ProxyComponent(null, "none");
      comp.setMount((window:BasicWindow)=>{
        new WindowInput(window, comp, (eventType, inputData)=>{
          if (eventType === "mouseup") {
            if (inputData.x < clickX - clickSize/2 || inputData.x > clickX + clickSize/2) {
              return;
            }
            if (inputData.y < clickY - clickSize/2 || inputData.y > clickY + clickSize/2) {
              return;
            }
            window.removeComponent(comp);
          }
          console.log(eventType, inputData);
        });
      });
      comp.setPainter(()=>{
        console.log("Painting");
        const container = window.containerFor(comp);
        const d = document.createElement('div');
        d.style.backgroundColor = "pink";
        d.style.width = "100px";
        d.style.height = "100px";
        d.style.left = "50px";
        d.style.top = "50px";
        d.style.position = "absolute";
        d.addEventListener("mousedown", ()=>{
          window.removeComponent(comp);
        });
        container.appendChild(d);
      });
      comp.setRenderer(()=>{
        console.log("Rendering");
        const ctx = window.overlay();
        ctx.font = "34px serif";
        ctx.textAlign = "left";
        ctx.textBaseline="top"; 
        ctx.fillStyle = color;
        const jump = 20;
        for(let y = 0; y < size; y += jump) {
          for(let x = 0; x < size; x += jump) {
            ctx.fillText("Hello World", x, y);
          }
        }
        ctx.fillStyle = "#fff";
        ctx.fillRect(clickX - clickSize/2, clickY - clickSize/2, clickSize, clickSize);
        ctx.font = "12px serif";
        ctx.textAlign = "center";
        ctx.textBaseline="middle"; 
        ctx.fillStyle = "#000";
        ctx.fillText("CLICK ROUND HERE", clickX, clickY);
      });
      window.addVertical(comp, null);
  });
});