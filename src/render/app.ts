import { Application, Container } from "pixi.js";
import { COLOR, DESIGN_W, DESIGN_H } from "./theme";

export const app = new Application();
await app.init({ resizeTo: window, background: COLOR.bg, antialias: true });
document.body.appendChild(app.canvas);

// Everything is laid out against a fixed DESIGN_W x DESIGN_H canvas
// then scaled uniformly and centred. Add panels to `scene`, never to app.stage.
export const scene = app.stage.addChild(new Container());

// Scale by smaller axis ratio then center the leftover
function fit(): void {
  const scale = Math.min(app.screen.width / DESIGN_W, app.screen.height / DESIGN_H);
  scene.scale.set(scale);
  scene.x = (app.screen.width - DESIGN_W * scale) / 2;
  scene.y = (app.screen.height - DESIGN_H * scale) / 2;
}

fit();
app.renderer.on('resize', fit);
